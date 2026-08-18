"use client";

import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser-side auth client. Import this in client components only. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
