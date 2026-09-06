import { expect, test } from "@playwright/test";

/**
 * Smoke test: proves the whole stack is wired — app, Postgres, auth, email (via
 * Mailpit's API), and the example feature. Requires `bun run setup` + infra up.
 * Every new feature gets a spec here that walks the happy path in the browser.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:__PORT_MAIL__";

const latestOtpFor = async (email: string): Promise<string> => {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`);
    const data = (await res.json()) as { messages?: { ID: string; Subject: string }[] };
    const msg = data.messages?.find((m) => /code/i.test(m.Subject));
    const otp = msg?.Subject.match(/\b(\d{6})\b/)?.[1];
    if (otp) return otp;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No OTP email arrived for ${email} — is the app pointing at Mailpit (SMTP_URL)?`);
};

test("health endpoint reports db up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ ok: true, db: "up" });
});

test("sign in with email code, create and delete a note", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page).toHaveURL(/\/verify\?email=/);

  const otp = await latestOtpFor(email);
  await page.getByLabel("One-time code").fill(otp);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/notes");
  await page.getByLabel("Title").fill("First note");
  await page.getByLabel("Body").fill("Hello from Playwright");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("heading", { name: "Your notes (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete First note" })).toBeVisible();

  await page.getByRole("button", { name: "Delete First note" }).click();
  await expect(page.getByRole("heading", { name: "Your notes (0)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete First note" })).toHaveCount(0);
});
