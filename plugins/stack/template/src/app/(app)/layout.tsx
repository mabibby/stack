import { AppHeader } from "@/components/app-shell/app-header";
import { requireSession } from "@/lib/auth/session";

/**
 * Everything under (app) requires a session — enforced HERE, once, server-side.
 * Pages inside can call getSession() again cheaply (cookie cache) when they need the user.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader user={session.user} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</main>
    </div>
  );
}
