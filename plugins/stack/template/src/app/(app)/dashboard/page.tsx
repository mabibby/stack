import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user } = await requireSession();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Hi {user.name || "there"} 👋</h1>
        <p className="text-muted-foreground">
          You're signed in. This is your app's home — replace it with something useful.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Notes (example feature)</CardTitle>
          <CardDescription>
            A complete worked example of the pattern: schema → domain → server action → form. Copy
            it, then delete it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/notes">Open notes</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
