import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Enter your code" };

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { email, purpose } = await searchParams;
  if (typeof email !== "string" || !email) redirect("/sign-in");
  return <VerifyForm email={email} purpose={purpose === "verify" ? "verify" : "sign-in"} />;
}
