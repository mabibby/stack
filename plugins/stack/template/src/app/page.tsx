import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

/** Public landing. Signed-in users go straight to the app. */
export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">__APP_TITLE__</h1>
      <p className="text-muted-foreground max-w-md text-balance">
        Replace this landing page with your product's story. Everything behind{" "}
        <code className="bg-muted rounded px-1">/dashboard</code> requires sign-in.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Create account</Link>
        </Button>
      </div>
    </main>
  );
}
