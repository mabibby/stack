import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { UnauthenticatedError } from "@/lib/server/errors";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
};

export type Session = { user: SessionUser; sessionId: string };

/** Current session or null. Server components, route handlers, actions. */
export const getSession = async (): Promise<Session | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;
  return {
    sessionId: result.session.id,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name ?? "",
      emailVerified: result.user.emailVerified,
      image: result.user.image ?? null,
    },
  };
};

/** For pages/layouts: redirects to sign-in when signed out. */
export const requireSession = async (redirectTo = "/sign-in"): Promise<Session> => {
  const session = await getSession();
  if (!session) redirect(redirectTo);
  return session;
};

/** For server actions: throws (defineAction turns it into { ok:false, error:"unauthenticated" }). */
export const requireSessionAction = async (): Promise<Session> => {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return session;
};
