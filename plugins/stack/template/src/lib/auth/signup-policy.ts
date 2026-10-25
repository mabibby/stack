/**
 * Who may create an account. Driven by SIGNUP_ALLOWLIST in env:
 *   ""                                  → anyone can sign up (local default)
 *   "you@example.com,@yourcompany.com" → only those emails / that domain
 * Enforced in ONE place (better-auth's user.create.before hook) so every way
 * in — password, email code, magic link — obeys it.
 */
export const isSignupAllowed = (email: string, allowlist: readonly string[]): boolean => {
  if (allowlist.length === 0) return true;
  const normalized = email.trim().toLowerCase();
  const domain = normalized.slice(normalized.lastIndexOf("@"));
  return allowlist.some((entry) =>
    entry.startsWith("@") ? entry === domain : entry === normalized,
  );
};

export const SIGNUP_CLOSED_MESSAGE =
  "Accounts are by invitation only. Ask the app owner to add your email address.";
