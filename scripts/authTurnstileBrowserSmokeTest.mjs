import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const expectedMode = process.env.ELYSIA_AUTH_CAPTCHA_EXPECTED_MODE;
assert(
  ["off", "preflight", "required"].includes(expectedMode),
  "ELYSIA_AUTH_CAPTCHA_EXPECTED_MODE must name the build under test.",
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(path.join(root, "public/_headers"), "utf8");
const csp = headersSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]?.trim();
assert(csp, "The production Content-Security-Policy must be available.");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
]);

const origin = "http://127.0.0.1:4173";

async function installStaticFixture(context) {
  await context.route(
    /^http:\/\/127\.0\.0\.[12](?::\d+)?\//,
    async (route) => {
      try {
        const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
        const candidate = path.resolve(dist, `.${pathname}`);
        const isSafeAsset = candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/";
        let body = indexHtml;
        let extension = ".html";
        if (isSafeAsset) {
          try {
            const stat = await fs.stat(candidate);
            if (stat.isFile()) {
              body = await fs.readFile(candidate);
              extension = path.extname(candidate);
            }
          } catch (error) {
            if (pathname.startsWith("/assets/")) throw error;
          }
        }
        await route.fulfill({
          status: 200,
          headers: {
            "Cache-Control": "no-store",
            "Content-Security-Policy": csp,
            "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
          },
          body,
        });
      } catch {
        await route.fulfill({
          status: 404,
          contentType: "text/plain; charset=utf-8",
          body: "Not found",
        });
      }
    },
  );
}

const fixtureEmail = "turnstile-member@example.invalid";
const fixturePassword = "fixture-password-123";
const fixtureUser = {
  id: "f1900000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: fixtureEmail,
  email_confirmed_at: "2026-07-30T12:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [{ id: "f1900000-0000-4000-8000-000000000002", provider: "email" }],
  created_at: "2026-07-30T12:00:00.000Z",
  updated_at: "2026-07-30T12:00:00.000Z",
};
const fixtureSession = {
  access_token: "fixture-auth-turnstile-access-token",
  refresh_token: "fixture-auth-turnstile-refresh-token",
  expires_in: 3_600,
  expires_at: Math.floor(Date.now() / 1_000) + 3_600,
  token_type: "bearer",
  user: fixtureUser,
};

const fakeTurnstileScript = `
(() => {
  const state = window.__elysiaAuthTurnstileTest = {
    nextId: 1,
    renders: [],
    removes: [],
    widgets: Object.create(null)
  };
  window.turnstile = {
    render(container, options) {
      const id = "auth-widget-" + state.nextId++;
      state.renders.push({
        id,
        action: options.action,
        appearance: options.appearance,
        execution: options.execution,
        language: options.language,
        responseField: options["response-field"],
        retry: options.retry,
        size: options.size,
        theme: options.theme
      });
      state.widgets[id] = options;
      queueMicrotask(() => {
        if (window.__elysiaAuthTurnstileBehavior === "success") {
          options.callback("synthetic-ephemeral-token-" + id);
        } else if (window.__elysiaAuthTurnstileBehavior === "error") {
          options["error-callback"]();
        } else if (window.__elysiaAuthTurnstileBehavior === "unsupported") {
          options["unsupported-callback"]();
        }
      });
      return id;
    },
    remove(id) {
      state.removes.push(id);
      delete state.widgets[id];
    }
  };
})();
`;

async function installTurnstileFixture(context, behavior = "success") {
  await context.addInitScript((initialBehavior) => {
    window.__elysiaAuthTurnstileBehavior = initialBehavior;
  }, behavior);
  await context.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: fakeTurnstileScript,
    });
  });
}

async function installBackendFixture(context, {
  signupResults = ["confirmation"],
} = {}) {
  await installStaticFixture(context);
  const protectedRequests = [];
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const corsHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,PATCH,POST,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }
    if (url.pathname.endsWith("/auth/v1/signup")) {
      const body = request.postDataJSON();
      protectedRequests.push({ kind: "signup", body });
      const result = signupResults[Math.min(
        protectedRequests.filter((entry) => entry.kind === "signup").length - 1,
        signupResults.length - 1,
      )];
      if (result === "captcha_error") {
        await new Promise((resolve) => setTimeout(resolve, 180));
        await route.fulfill({
          status: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            message: "Captcha verification process failed.",
            code: "captcha_failed",
            error_code: "captcha_failed",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify({ user: fixtureUser }),
        });
      }
      return;
    }
    if (url.pathname.endsWith("/auth/v1/recover")) {
      protectedRequests.push({ kind: "recover", body: request.postDataJSON() });
      await route.fulfill({ status: 200, headers: corsHeaders, body: "{}" });
      return;
    }
    if (url.pathname.endsWith("/auth/v1/token") && url.searchParams.get("grant_type") === "password") {
      protectedRequests.push({ kind: "password", body: request.postDataJSON() });
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(fixtureSession) });
      return;
    }
    if (url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({ status: 401, headers: corsHeaders, body: '{"message":"Auth session missing."}' });
      return;
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        body: objectResponse ? "null" : "[]",
      });
      return;
    }
    await route.fulfill({ status: 404, headers: corsHeaders, body: '{"message":"unexpected fixture request"}' });
  });
  return protectedRequests;
}

async function turnstileState(page) {
  return page.evaluate(() => ({
    renders: window.__elysiaAuthTurnstileTest?.renders ?? [],
    removes: window.__elysiaAuthTurnstileTest?.removes ?? [],
    widgetIds: Object.keys(window.__elysiaAuthTurnstileTest?.widgets ?? {}),
  }));
}

async function waitForRenderCount(page, count) {
  await page.waitForFunction(
    (minimum) => (window.__elysiaAuthTurnstileTest?.renders.length ?? 0) >= minimum,
    count,
  );
}

async function completeCurrentChallenge(page) {
  await page.evaluate(() => {
    const state = window.__elysiaAuthTurnstileTest;
    const id = state?.renders.at(-1)?.id;
    if (!id || !state.widgets[id]) throw new Error("No current challenge fixture.");
    state.widgets[id].callback(`synthetic-ephemeral-token-${id}-manual`);
  });
  await page.getByText("Account safety verification is ready for this request.", { exact: true }).waitFor();
}

function captchaTokenFrom(body) {
  return body?.gotrue_meta_security?.captcha_token;
}

async function assertTokenNotPersisted(page, tokens) {
  const snapshot = await page.evaluate(() => ({
    dom: document.documentElement.outerHTML,
    local: Object.values(window.localStorage),
    session: Object.values(window.sessionStorage),
    url: window.location.href,
  }));
  const serialized = JSON.stringify(snapshot);
  for (const token of tokens) {
    assert(token);
    assert.equal(serialized.includes(token), false, "a challenge token must not enter DOM, storage, or URL state");
  }
}

async function runOffMode(browser) {
  const context = await browser.newContext();
  const requests = await installBackendFixture(context);
  const challengeRequests = [];
  context.on("request", (request) => {
    if (request.url().startsWith("https://challenges.cloudflare.com/")) {
      challengeRequests.push(request.url());
    }
  });
  const page = await context.newPage();
  await page.goto(`${origin}/commons-circle`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".auth-turnstile-field").count(), 0);
  await page.getByRole("button", { name: "Use create-account mode" }).click();
  await page.getByLabel("Email").fill(fixtureEmail);
  await page.getByLabel("Create password").fill(fixturePassword);
  await page.getByRole("button", { name: "Create Website Account" }).click();
  await page.getByText("Account created. Check your email to confirm it before signing in.", { exact: true }).first().waitFor();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].kind, "signup");
  assert.equal(captchaTokenFrom(requests[0].body), undefined);
  assert.deepEqual(challengeRequests, []);
  await context.close();
}

async function runPreflightMode(browser) {
  const context = await browser.newContext();
  await installTurnstileFixture(context, "idle");
  const requests = await installBackendFixture(context);
  const page = await context.newPage();
  await page.goto(`${origin}/commons-circle`, { waitUntil: "networkidle" });
  await page.getByText("This verification is in client-readiness preflight. Server enforcement is not active yet.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Use create-account mode" }).click();
  await page.getByLabel("Email").fill(fixtureEmail);
  await page.getByLabel("Create password").fill(fixturePassword);
  await page.getByRole("button", { name: "Create Website Account" }).click();
  await page.getByText("Account created. Check your email to confirm it before signing in.", { exact: true }).first().waitFor();
  assert.equal(requests.length, 1, "preflight must preserve tokenless Auth while enforcement is disabled");
  assert.equal(captchaTokenFrom(requests[0].body), undefined);
  await context.close();
}

async function runRequiredMode(browser) {
  {
    const context = await browser.newContext();
    await installTurnstileFixture(context, "idle");
    const requests = await installBackendFixture(context);
    const page = await context.newPage();
    await page.goto(`${origin}/commons-circle`, { waitUntil: "networkidle" });
    await waitForRenderCount(page, 1);
    await page.getByRole("button", { name: "Use create-account mode" }).click();
    await waitForRenderCount(page, 2);
    await page.getByLabel("Email").fill(fixtureEmail);
    await page.getByLabel("Create password").fill(fixturePassword);
    await page.getByRole("button", { name: "Create Website Account" }).click();
    await page.getByText("Complete the account safety verification before continuing. Your password was not cleared.", { exact: true }).waitFor();
    assert.equal(requests.length, 0);
    assert.equal(await page.getByLabel("Create password").inputValue(), fixturePassword);
    assert.equal(await page.getByRole("button", { name: "Create Website Account" }).isEnabled(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      "Account safety verification",
    );
    await completeCurrentChallenge(page);
    await page.getByRole("button", { name: "Create Website Account" }).click();
    await page.getByText("Account created. Check your email to confirm it before signing in.", { exact: true }).first().waitFor();
    assert.equal(requests.length, 1);
    const token = captchaTokenFrom(requests[0].body);
    assert.match(token, /^synthetic-ephemeral-token-/);
    await assertTokenNotPersisted(page, [token]);
    await context.close();
  }

  {
    const context = await browser.newContext();
    await installTurnstileFixture(context, "success");
    const requests = await installBackendFixture(context, {
      signupResults: ["captcha_error", "confirmation"],
    });
    const page = await context.newPage();
    await page.goto(`${origin}/commons-circle/setup/profile`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Use create-account mode" }).click();
    await page.getByLabel("Email").fill(fixtureEmail);
    await page.getByLabel("Create password").fill(fixturePassword);
    await page.getByRole("button", { name: "Create Website Account" }).click();
    await page.getByRole("button", { name: "Working..." }).waitFor();
    await page.getByRole("button", { name: "Working..." }).evaluate((button) => button.click());
    await page.getByText("The Website Account safety check could not be completed. Refresh the page and try again.", { exact: true }).first().waitFor();
    assert.equal(requests.length, 1, "pending submission must remain single-request");
    assert.equal(await page.getByLabel("Create password").inputValue(), fixturePassword);
    assert.equal(await page.getByRole("button", { name: "Create Website Account" }).isEnabled(), true);
    await page.getByText("Account safety verification is ready for this request.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Create Website Account" }).click();
    await page.getByText("Account created. Check your email to confirm it before signing in.", { exact: true }).first().waitFor();
    assert.equal(requests.length, 2);
    const tokens = requests.map((request) => captchaTokenFrom(request.body));
    assert(tokens.every((token) => typeof token === "string"));
    assert.notEqual(tokens[0], tokens[1], "every attempted Auth request must consume a fresh token");
    await assertTokenNotPersisted(page, tokens);
    const storedDiagnostic = await page.evaluate(() =>
      window.sessionStorage.getItem("elysia.website-account-signup.diagnostic.v1")
    );
    assert(storedDiagnostic);
    assert(tokens.every((token) => !storedDiagnostic.includes(token)));
    await context.close();
  }

  {
    const context = await browser.newContext();
    await installTurnstileFixture(context, "success");
    const requests = await installBackendFixture(context);
    const page = await context.newPage();
    await page.goto(`${origin}/account/forgot-password`, { waitUntil: "networkidle" });
    await page.getByText("Account safety verification is ready for this request.", { exact: true }).waitFor();
    await page.getByLabel("Website Account email").fill(fixtureEmail);
    await page.getByRole("button", { name: "Send recovery link" }).click();
    await page.getByText(/If an account can receive recovery mail at that address/).waitFor();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].kind, "recover");
    const token = captchaTokenFrom(requests[0].body);
    assert.match(token, /^synthetic-ephemeral-token-/);
    await assertTokenNotPersisted(page, [token]);
    await context.close();
  }

  {
    const context = await browser.newContext();
    await installTurnstileFixture(context, "error");
    const requests = await installBackendFixture(context);
    const page = await context.newPage();
    await page.goto(`${origin}/commons-circle`, { waitUntil: "networkidle" });
    await page.getByText(/Account safety verification could not load/).waitFor();
    const before = (await turnstileState(page)).renders.length;
    await page.getByRole("button", { name: "Retry verification" }).click();
    await waitForRenderCount(page, before + 1);
    assert.equal(requests.length, 0);
    await context.close();
  }

  {
    const context = await browser.newContext();
    await installTurnstileFixture(context, "success");
    const requests = await installBackendFixture(context);
    const page = await context.newPage();
    await page.goto(`${origin}/commons-circle`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Use create-account mode" }).click();
    await page.getByText("Account safety verification is ready for this request.", { exact: true }).waitFor();
    await page.evaluate(() => {
      const state = window.__elysiaAuthTurnstileTest;
      const id = state.renders.at(-1).id;
      state.widgets[id]["expired-callback"]();
    });
    await page.getByText(/The verification expired and is refreshing/).waitFor();
    await page.getByLabel("Email").fill(fixtureEmail);
    await page.getByLabel("Create password").fill(fixturePassword);
    await page.getByRole("button", { name: "Create Website Account" }).click();
    assert.equal(requests.length, 0, "an expired token must never reach Auth");
    assert.equal(await page.getByLabel("Create password").inputValue(), fixturePassword);
    await context.close();
  }

  {
    const authPanelRoutes = [
      "/commons-circle",
      "/commons-circle/setup/profile",
      "/commons-circle/admin-console",
      "/commons-circle/signals",
      "/marketplace/account",
    ];
    for (const routePath of authPanelRoutes) {
      const context = await browser.newContext();
      await installTurnstileFixture(context, "success");
      await installBackendFixture(context);
      const page = await context.newPage();
      await page.goto(`${origin}${routePath}`, { waitUntil: "networkidle" });
      await page.locator("form.auth-form").waitFor();
      await waitForRenderCount(page, 1);
      assert.equal(await page.locator(".auth-turnstile-field").count(), 1, routePath);
      assert.equal(
        await page.locator('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]').count(),
        1,
        `${routePath} must load one challenge script`,
      );
      const initialState = await turnstileState(page);
      assert.equal(initialState.renders.at(-1).action, "online_signin");
      assert.equal(initialState.renders.at(-1).appearance, "always");
      assert.equal(initialState.renders.at(-1).execution, "render");
      assert.equal(initialState.renders.at(-1).language, "auto");
      assert.equal(initialState.renders.at(-1).responseField, false);
      assert.equal(initialState.renders.at(-1).retry, "auto");
      assert.equal(initialState.renders.at(-1).size, "flexible");
      assert.equal(initialState.renders.at(-1).theme, "auto");
      await page.getByRole("button", { name: "Use create-account mode" }).click();
      await page.waitForFunction(() =>
        window.__elysiaAuthTurnstileTest?.renders.at(-1)?.action === "online_signup"
      );
      assert.equal(await page.locator(".auth-turnstile-field").count(), 1);
      await context.close();
    }
  }

  {
    const context = await browser.newContext();
    await context.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) => route.abort("blockedbyclient"));
    await installBackendFixture(context);
    const page = await context.newPage();
    await page.goto(`${origin}/commons-circle`, { waitUntil: "networkidle" });
    await page.getByText(/Account safety verification could not load/).waitFor({ timeout: 15_000 });
    assert.equal(await page.getByRole("button", { name: "Retry verification" }).isEnabled(), true);
    await context.close();
  }
}

async function runUnauthorizedHost(browser) {
  const context = await browser.newContext();
  const requests = await installBackendFixture(context);
  const challengeRequests = [];
  context.on("request", (request) => {
    if (request.url().startsWith("https://challenges.cloudflare.com/")) challengeRequests.push(request.url());
  });
  const page = await context.newPage();
  const unauthorizedOrigin = "http://127.0.0.2:4173";
  await page.goto(`${unauthorizedOrigin}/commons-circle`, { waitUntil: "networkidle" });
  const link = page.getByRole("link", { name: "Continue securely on elysiaecobotics.com" });
  await link.waitFor();
  assert.equal(await link.getAttribute("href"), "https://elysiaecobotics.com/commons-circle");
  assert.equal(await page.locator("form.auth-form").count(), 0);
  assert.equal(requests.length, 0);
  assert.deepEqual(challengeRequests, []);
  await context.close();
}

let browser;
try {
  browser = await chromium.launch({
    headless: true,
  });
  if (expectedMode === "off") await runOffMode(browser);
  if (expectedMode === "preflight") await runPreflightMode(browser);
  if (expectedMode === "required") await runRequiredMode(browser);
  await runUnauthorizedHost(browser);
  console.log(`Online Auth Turnstile ${expectedMode} browser contract passed.`);
} finally {
  if (browser) await browser.close();
}
