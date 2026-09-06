import type { Metadata } from "next";
import { env } from "@/lib/env";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return <SignUpForm inviteOnly={env.SIGNUP_ALLOWLIST.length > 0} />;
}
