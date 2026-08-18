import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/** Auth pages: centered card, no app chrome. Signed-in users are bounced to the app. */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <Link href="/" className="mb-8 font-semibold text-lg tracking-tight">
        __APP_TITLE__
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
