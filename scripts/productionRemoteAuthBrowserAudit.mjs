import assert from "node:assert/strict";
import { chromium } from "playwright";

const requestedOrigin = new URL(process.env.ELYSIA_WEBSITE_ORIGIN ?? "https://elysiaecobotics.com").origin;
const requestedHost = new URL(requestedOrigin).hostname;
const requireTurnstileRendered = process.env.ELYSIA_EXPECT_TURNSTILE_RENDERED !== "0";
const allowedHost = requestedHost === "elysiaecobotics.com"
  || requestedHost === "www.elysiaecobotics.com"
  || requestedHost === "localhost"
  || requestedHost === "127.0.0.1"
  || requestedHost === "[::1]";
assert(allowedHost, "remote_auth_browser_audit_requires_canonical_or_loopback_origin");

const forbiddenFallbackCopy = [
  "Supabase env vars are not configured",
  "local demo mode",
  "Remote auth disabled until env vars are configured",
  "Account panels show demo-mode behavior only",
];

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  let pageErrorCount = 0;
  let materialConsoleErrorCount = 0;
  page.on("pageerror", () => { pageErrorCount += 1; });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text === "%c%d font-size:0;color:transparent NaN") return;
    if (text.includes("Acquiring an exclusive Navigator LockManager lock")) return;
    if (!requireTurnstileRendered && text.startsWith("Failed to load resource:") && text.includes("400")) return;
    materialConsoleErrorCount += 1;
  });

  const response = await page.goto(`${requestedOrigin}/commons-circle`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  assert(response, "remote_auth_document_response_missing");
  assert.equal(response.status(), 200, "remote_auth_document_status_invalid");
  assert.equal(new URL(page.url()).origin, requestedOrigin, "remote_auth_origin_changed");
  assert.equal(new URL(page.url()).pathname, "/commons-circle", "remote_auth_path_changed");
  if (requestedHost === "elysiaecobotics.com") {
    assert(response.headers()["cf-ray"], "canonical_remote_auth_document_not_served_by_cloudflare");
  }

  const account = page.locator("#account").first();
  await account.waitFor({ state: "visible", timeout: 90_000 });
  assert.equal(await account.getAttribute("data-remote-auth-configured"), "true", "production_remote_auth_configured_marker_false");

  const bodyText = await page.locator("body").innerText();
  for (const forbidden of forbiddenFallbackCopy) {
    assert(!bodyText.includes(forbidden), `production_remote_auth_fallback_copy_present:${forbidden.replaceAll(" ", "_")}`);
  }

  const email = page.locator("#website-account-email");
  const password = page.locator("#website-account-password");
  const submit = page.locator("#website-account-submit");
  await email.waitFor({ state: "visible", timeout: 30_000 });
  await password.waitFor({ state: "visible", timeout: 30_000 });
  await submit.waitFor({ state: "visible", timeout: 30_000 });
  assert(await email.isEnabled(), "production_remote_auth_email_input_disabled");
  assert(await password.isEnabled(), "production_remote_auth_password_input_disabled");
  assert(await submit.isEnabled(), "production_remote_auth_sign_in_disabled");
  assert.equal((await submit.innerText()).trim(), "Sign in", "production_remote_auth_sign_in_action_missing");

  const challenge = page.locator('.auth-turnstile-field[aria-label="Account safety verification"]');
  await challenge.waitFor({ state: "visible", timeout: 30_000 });
  const challengeScript = page.locator('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
  await challengeScript.waitFor({ state: "attached", timeout: 30_000 });
  assert(!((await challenge.innerText()).includes("not configured")), "production_auth_turnstile_unconfigured");
  if (requireTurnstileRendered) {
    await page.waitForFunction(
      () => (document.querySelector(".auth-turnstile-widget")?.childElementCount ?? 0) > 0,
      undefined,
      { timeout: 30_000 },
    );
    assert.equal(await challenge.locator(".auth-turnstile-retry").count(), 0, "production_auth_turnstile_failed_or_unconfigured");
  }

  await page.waitForTimeout(1_500);
  assert.equal(pageErrorCount, 0, "production_remote_auth_page_error_detected");
  assert.equal(materialConsoleErrorCount, 0, "production_remote_auth_console_error_detected");

  console.log(JSON.stringify({
    schemaVersion: 1,
    origin: requestedOrigin,
    status: response.status(),
    cloudflareServed: requestedHost === "elysiaecobotics.com" ? true : null,
    remoteAuthConfigured: true,
    demoFallbackAbsent: true,
    signInReachable: true,
    authTurnstileConfigured: true,
    authTurnstileRendered: requireTurnstileRendered ? true : null,
    pageErrorCount,
    consoleErrorCount: materialConsoleErrorCount,
    passed: true,
  }, null, 2));
} finally {
  await browser.close();
}
