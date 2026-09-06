import { describe, expect, test } from "bun:test";
import { isSignupAllowed } from "@/lib/auth/signup-policy";

describe("isSignupAllowed", () => {
  test("empty allowlist lets anyone in", () => {
    expect(isSignupAllowed("anyone@example.com", [])).toBe(true);
  });

  test("exact email match, case-insensitive", () => {
    const list = ["matt@example.com"];
    expect(isSignupAllowed("Matt@Example.com", list)).toBe(true);
    expect(isSignupAllowed("other@example.com", list)).toBe(false);
  });

  test("@domain entries match the whole domain", () => {
    const list = ["@semanti.com"];
    expect(isSignupAllowed("sam@semanti.com", list)).toBe(true);
    expect(isSignupAllowed("sam@notsemanti.com", list)).toBe(false);
  });
});
