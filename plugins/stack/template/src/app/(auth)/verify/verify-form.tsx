"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth/client";

/**
 * purpose "sign-in": passwordless sign-in by code.
 * purpose "verify": confirm a new (password) account's email — signs them in and keeps the password.
 */
export function VerifyForm({ email, purpose }: { email: string; purpose: "sign-in" | "verify" }) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = async (code: string) => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    const { error } =
      purpose === "verify"
        ? await authClient.emailOtp.verifyEmail({ email, otp: code })
        : await authClient.signIn.emailOtp({ email, otp: code });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "That code didn't work");
      setOtp("");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const resend = async () => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: purpose === "verify" ? "email-verification" : "sign-in",
    });
    if (error) toast.error(error.message ?? "Couldn't resend");
    else toast.success("New code sent");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter your code</CardTitle>
        <CardDescription>We emailed a 6-digit code to {email}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={setOtp}
          onComplete={verify}
          disabled={busy}
          autoFocus
          aria-label="One-time code"
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button type="button" variant="ghost" size="sm" onClick={resend} disabled={busy}>
          Resend code
        </Button>
        <Button type="button" variant="link" size="sm" onClick={() => router.push("/sign-in")}>
          Back to sign in
        </Button>
      </CardContent>
    </Card>
  );
}
