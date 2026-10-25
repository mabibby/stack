"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export function SignInForm() {
  const router = useRouter();
  const [busy, setBusy] = useState<"password" | "otp" | "magic" | null>(null);
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onPassword = form.handleSubmit(async (values) => {
    setBusy("password");
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error?.code === "EMAIL_NOT_VERIFIED") {
      // Right password, but the address was never confirmed. better-auth has just emailed a code.
      setBusy(null);
      toast.info("Confirm your email first — we've sent you a code.");
      router.push(`/verify?purpose=verify&email=${encodeURIComponent(values.email)}`);
      return;
    }
    setBusy(null);
    if (error) {
      toast.error(error.message ?? "Sign in failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  });

  /** Both passwordless options only need a valid email. */
  const withEmail = async (fn: (email: string) => Promise<void>) => {
    const ok = await form.trigger("email");
    if (!ok) return;
    await fn(form.getValues("email"));
  };

  const sendCode = () =>
    withEmail(async (email) => {
      setBusy("otp");
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      setBusy(null);
      if (error) {
        toast.error(error.message ?? "Couldn't send code");
        return;
      }
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    });

  const sendMagicLink = () =>
    withEmail(async (email) => {
      setBusy("magic");
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/dashboard" });
      setBusy(null);
      if (error) {
        toast.error(error.message ?? "Couldn't send link");
        return;
      }
      setMagicSentTo(email);
    });

  if (magicSentTo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            We sent a sign-in link to {magicSentTo}. It expires shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => setMagicSentTo(null)}>
            Use a different method
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your password, or get a code or link by email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onPassword} noValidate>
          <FieldGroup>
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Link
                      href="/forgot-password"
                      className="text-muted-foreground text-sm hover:underline"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <SubmitButton className="w-full" pending={busy === "password"} disabled={busy !== null}>
              Sign in
            </SubmitButton>
          </FieldGroup>
        </form>

        <div className="text-muted-foreground my-4 flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" />
          or, without a password
          <span className="bg-border h-px flex-1" />
        </div>

        <div className="grid gap-2">
          <Button type="button" variant="outline" onClick={sendCode} disabled={busy !== null}>
            {busy === "otp" ? "Sending…" : "Email me a code"}
          </Button>
          <Button type="button" variant="ghost" onClick={sendMagicLink} disabled={busy !== null}>
            {busy === "magic" ? "Sending…" : "Email me a magic link"}
          </Button>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          No account?{" "}
          <Link href="/sign-up" className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
