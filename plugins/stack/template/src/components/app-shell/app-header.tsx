import Link from "next/link";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { SessionUser } from "@/lib/auth/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/notes", label: "Notes" },
] as const;

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          __APP_TITLE__
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
