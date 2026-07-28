import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const requireCrossBrowser = process.env.ELYSIA_REQUIRE_CROSS_BROWSER === "1";
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(path.join(root, "public/_headers"), "utf8");
const csp = headersSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]?.trim();
assert(csp, "The production Content-Security-Policy must be available.");

const assetNames = await fs.readdir(path.join(dist, "assets"));
let projectRef = "";
for (const assetName of assetNames.filter((name) => name.endsWith(".js"))) {
  const source = await fs.readFile(path.join(dist, "assets", assetName), "utf8");
  const match = source.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (match) {
    projectRef = match[1];
    break;
  }
}
assert(projectRef, "The built Online application must contain its configured public Supabase origin.");

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

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
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
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Security-Policy": csp,
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
assert(address && typeof address === "object", "Local browser server did not start.");
const origin = `http://127.0.0.1:${address.port}`;
let activeBrowser = null;

const fixtureEmail = "signup-member@example.invalid";
const fixturePassword = "fixture-password-123";
const fixtureUser = {
  id: "f1800000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: fixtureEmail,
  email_confirmed_at: "2026-07-24T12:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [{ id: "f1800000-0000-4000-8000-000000000002", provider: "email" }],
  created_at: "2026-07-24T12:00:00.000Z",
  updated_at: "2026-07-24T12:00:00.000Z",
};
const fixtureSession = {
  access_token: "fixture-signup-access-token",
  refresh_token: "fixture-signup-refresh-token",
  expires_in: 3_600,
  expires_at: Math.floor(Date.now() / 1_000) + 3_600,
  token_type: "bearer",
  user: fixtureUser,
};

const routeCases = [
  {
    path: "/commons-circle",
    redirectPath: "/commons-circle",
    canVerifySignedOutProfileGate: false,
  },
  {
    path: "/commons-circle/setup/profile",
    redirectPath: "/commons-circle/setup/profile",
    canVerifySignedOutProfileGate: true,
  },
];

const providerErrorFixtures = {
  error: {
    status: 400,
    code: "weak_password",
    message: "Password should contain a stronger fixture value.",
    expectedMessage: "The password does not meet the current Website Account requirements. Use a longer, unique password.",
  },
  rate_limit: {
    status: 429,
    code: "over_email_send_rate_limit",
    message: "Email rate limit exceeded.",
    expectedMessage: "Too many authentication requests were made. Wait before trying again.",
  },
  captcha: {
    status: 400,
    code: "captcha_failed",
    message: "Captcha verification process failed.",
    expectedMessage: "The Website Account safety check could not be completed. Refresh the page and try again.",
  },
  smtp: {
    status: 500,
    code: "email_address_not_authorized",
    message: "Email address is not authorized.",
    expectedMessage: "Website Account confirmation email delivery is temporarily unavailable. Please try again later.",
  },
};

async function runCase(
  routeCase,
  mode,
  expectedBrowserFamily,
  viewport = { width: 1280, height: 900 },
) {
  assert(activeBrowser, "A browser must be active before running a signup case.");
  const context = await activeBrowser.newContext({ viewport });
  const providerErrorForMode = mode === "browser_clear"
    ? providerErrorFixtures.error
    : providerErrorFixtures[mode];
  const confirmationMode = ["autofill", "mode_after_entry", "enter_key", "confirmation"].includes(mode);
  const page = await context.newPage();
  const signupRequests = [];
  const signInRequests = [];
  const ageAssuranceRequests = [];
  const navigations = [];
  const pageErrors = [];
  const consoleErrors = [];
  await page.addInitScript(() => {
    window.__elysiaCspViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => {
      window.__elysiaCspViolations.push({
        blockedUri: event.blockedURI,
        directive: event.effectiveDirective,
        sourceFile: event.sourceFile,
      });
    });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/(?:age-assurance|guardian-relationship|guardian-consent|guardian-sponsored-account)(?:\/|$)/.test(pathname)) {
      ageAssuranceRequests.push(pathname);
    }
  });

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
      signupRequests.push({
        body: request.postDataJSON(),
        redirectTo: url.searchParams.get("redirect_to"),
      });
      if (mode === "network_failure") {
        await route.abort("failed");
        return;
      }
      if (mode === "pending_navigation") {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        try {
          await route.fulfill({
            status: providerErrorFixtures.error.status,
            headers: corsHeaders,
            body: JSON.stringify({
              message: providerErrorFixtures.error.message,
              code: providerErrorFixtures.error.code,
              error_code: providerErrorFixtures.error.code,
            }),
          });
        } catch {
          // The deliberate full-document reload can cancel this pending fixture.
        }
        return;
      }
      const providerError = providerErrorForMode;
      if (providerError) {
        if (mode === "error" || mode === "browser_clear") {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        await route.fulfill({
          status: providerError.status,
          headers: corsHeaders,
          body: JSON.stringify({
            message: providerError.message,
            code: providerError.code,
            error_code: providerError.code,
          }),
        });
        return;
      }
      if (mode === "obfuscated") {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify({ user: { ...fixtureUser, identities: [] } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify(mode === "session" ? fixtureSession : { user: fixtureUser }),
      });
      return;
    }
    if (url.pathname.endsWith("/auth/v1/token") && url.searchParams.get("grant_type") === "password") {
      signInRequests.push(request.postDataJSON());
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(fixtureSession) });
      return;
    }
    if (url.pathname.endsWith("/auth/v1/user")) {
      if (mode === "error") {
        await route.fulfill({
          status: 401,
          headers: corsHeaders,
          body: '{"message":"Auth session missing."}',
        });
        return;
      }
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(fixtureUser) });
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

  const response = await page.goto(`${origin}${routeCase.path}`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  assert.equal(response?.status(), 200);
  await page.getByText("No active website session.", { exact: true }).waitFor();
  assert.equal(
    await page.locator("section.account-card#account").getAttribute("data-auth-signup-contract"),
    "2026-07-28.2",
    `${routeCase.path} must expose the deployed signup diagnostic contract before an attempt`,
  );
  const initialSentinel = page.locator("[data-auth-signup-attempt]");
  assert.equal(await initialSentinel.count(), 1, `${routeCase.path} must always render exactly one signup diagnostic sentinel`);
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-attempt"), "none");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-route"), routeCase.path);
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-mode"), "sign_in");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-handler-started"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-submit-received"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-prevent-default"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-sdk-called"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-request-started"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-pagehide"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-beforeunload"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-navigation"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-result"), "not_started");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-pending"), "idle");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-button-disabled"), "false");
  assert.equal(await initialSentinel.getAttribute("data-auth-signup-disabled-reason"), "none");
  const initialEmail = page.getByLabel("Email");
  const initialPassword = page.getByLabel("Password");
  const initialSubmit = page.locator("form.auth-form button[type='submit']");
  assert.equal(await initialEmail.getAttribute("id"), "website-account-email");
  assert.equal(await initialEmail.getAttribute("name"), "email");
  assert.equal(await initialEmail.getAttribute("autocomplete"), "email");
  assert.equal(await initialPassword.getAttribute("id"), "website-account-password");
  assert.equal(await initialPassword.getAttribute("name"), "password");
  assert.equal(await initialPassword.getAttribute("autocomplete"), "current-password");
  assert.equal(await initialSubmit.isEnabled(), true, "empty auth form must rely on native validation, not stale React state");

  if (mode === "sign_in" || mode === "sign_in_autofill") {
    const signInEmail = page.getByLabel("Email");
    const signInPassword = page.getByLabel("Password");
    if (mode === "sign_in_autofill") {
      await signInEmail.evaluate((input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
      }, fixtureEmail);
      await signInPassword.evaluate((input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
      }, fixturePassword);
    } else {
      await signInEmail.fill(fixtureEmail);
      await signInPassword.fill(fixturePassword);
    }
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText(`Signed in as ${fixtureEmail}.`, { exact: true }).first().waitFor();
    assert.equal(signInRequests.length, 1, "existing-account sign-in must remain intact");
    assert.equal(signupRequests.length, 0, "sign-in must not invoke signup");
  } else {
    const signInPassword = page.getByLabel("Password");
    if (mode === "mode_after_entry") {
      await page.getByLabel("Email").fill(fixtureEmail);
      await signInPassword.fill(fixturePassword);
    }
    await page.getByRole("button", { name: "Use create-account mode" }).click();
    assert.equal(await initialSentinel.getAttribute("data-auth-signup-mode"), "sign_up");
    assert.equal(await initialSentinel.getAttribute("data-auth-signup-mode-switch-received"), "true");
    assert.equal(await initialSentinel.getAttribute("data-auth-signup-mode-switch-password-clear"), "none");
    const email = page.getByLabel("Email");
    const password = page.getByLabel("Create password");
    const submit = page.locator("form.auth-form button[type='submit']");
    const modeSwitch = page.getByRole("button", { name: "Use sign-in mode" });
    assert.equal(await password.getAttribute("id"), "website-account-new-password");
    assert.equal(await password.getAttribute("name"), "password");
    assert.equal(await password.getAttribute("autocomplete"), "new-password");
    assert.equal(await password.getAttribute("minlength"), "6");
    if (mode === "mode_after_entry") {
      assert.equal(await email.inputValue(), fixtureEmail, "choosing create-account mode after entry must preserve email");
      assert.equal(await password.inputValue(), fixturePassword, "choosing create-account mode after entry must preserve password");
      await modeSwitch.click();
      assert.equal(await page.getByLabel("Password").inputValue(), fixturePassword, "returning to sign-in mode must preserve the entered password");
      await page.getByRole("button", { name: "Use create-account mode" }).click();
      assert.equal(await password.inputValue(), fixturePassword, "a complete mode round trip must preserve the entered password");
    } else if (mode === "autofill") {
      await email.evaluate((input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
      }, fixtureEmail);
      await password.evaluate((input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
      }, fixturePassword);
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-react-email-present"), "false");
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-react-password-present"), "false");
    } else if (mode === "invalid") {
      await email.fill("not-an-email");
      await password.fill("short");
    } else {
      await email.fill(fixtureEmail);
      await password.fill(fixturePassword);
    }
    assert.equal(await submit.isEnabled(), true);
    await submit.scrollIntoViewIfNeeded();
    const clickedElement = await submit.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const target = document.elementFromPoint(
        rect.left + (rect.width / 2),
        rect.top + (rect.height / 2),
      );
      return target === button || Boolean(target && button.contains(target));
    });
    assert.equal(clickedElement, true, `${routeCase.path} must deliver the click to its visible signup button`);
    assert.notDeepEqual(
      await submit.boundingBox(),
      await modeSwitch.boundingBox(),
      `${routeCase.path} signup and auth-mode controls must remain distinct`,
    );
    const navigationCountBeforeSubmit = navigations.length;
    if (mode === "enter_key") {
      await password.press("Enter");
    } else {
      await submit.click();
    }
    if (mode === "invalid") {
      await page.getByText("Enter a valid email and password before continuing.", { exact: true }).first().waitFor();
      assert.equal(signupRequests.length, 0, "native-invalid credentials must not invoke signup");
      assert.equal(await password.inputValue(), "short", "native validation must preserve the password");
      assert.equal(await submit.isEnabled(), true, "native validation must keep the form retryable");
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-pointer-received"), "true");
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-click-received"), "true");
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-invalid-event"), "true");
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-form-submit-received"), "false");
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-request-started"), "false");
      assert.deepEqual(ageAssuranceRequests, []);
      assert.deepEqual(pageErrors, []);
      await context.close();
      return;
    }
    if (mode === "pending_navigation") {
      await page.getByRole("button", { name: "Working..." }).waitFor();
      const attemptId = await initialSentinel.getAttribute("data-auth-signup-attempt");
      assert(attemptId && attemptId !== "none", "pending navigation fixture must begin a diagnostic attempt");
      assert.equal(await initialSentinel.getAttribute("data-auth-signup-request-started"), "true");
      await page.reload({ waitUntil: "networkidle" });
      assert(
        navigations.length > navigationCountBeforeSubmit,
        "the pending navigation fixture must deliberately navigate the document",
      );
      const restoredDiagnostic = page.locator("[data-auth-signup-attempt]");
      await restoredDiagnostic.waitFor();
      assert.equal(
        await restoredDiagnostic.getAttribute("data-auth-signup-attempt"),
        attemptId,
        "pending signup diagnostics must survive a forced document navigation",
      );
      assert.equal(
        await restoredDiagnostic.getAttribute("data-auth-signup-navigation"),
        "true",
        "a forced navigation during signup must remain recorded after reload",
      );
      assert.match(
        await restoredDiagnostic.getAttribute("data-auth-signup-pagehide") ?? "",
        /^(?:true|false)$/,
        "the browser-specific pagehide result must remain available after reload",
      );
      assert.match(
        await restoredDiagnostic.getAttribute("data-auth-signup-beforeunload") ?? "",
        /^(?:true|false)$/,
        "the browser-specific beforeunload result must remain available after reload",
      );
      assert.equal(
        await restoredDiagnostic.getAttribute("data-auth-signup-request-started"),
        "true",
        "the interrupted request start must remain recorded after reload",
      );
      const persistedDiagnostic = await page.evaluate(() =>
        window.sessionStorage.getItem("elysia.website-account-signup.diagnostic.v1")
      );
      assert(persistedDiagnostic, "interrupted signup diagnostics must remain in the current tab");
      assert.equal(persistedDiagnostic.includes(fixtureEmail), false);
      assert.equal(persistedDiagnostic.includes(fixturePassword), false);
      assert.equal(/access_token|refresh_token|authorization|apikey|user_id/i.test(persistedDiagnostic), false);
      assert.deepEqual(ageAssuranceRequests, []);
      assert.deepEqual(pageErrors, []);
      const cspViolations = await page.evaluate(() => window.__elysiaCspViolations);
      assert.equal(cspViolations.some((violation) => violation.blockedUri === "eval"), false);
      assert.equal(await page.locator("header.site-header").count(), 1);
      assert.equal(await page.locator("footer.site-footer").count(), 1);
      await context.close();
      return;
    }
    assert.equal(
      navigations.length,
      navigationCountBeforeSubmit,
      "visible signup submission must not navigate the document",
    );

    if (providerErrorForMode || mode === "network_failure") {
      if (mode === "error" || mode === "browser_clear") {
        await page.getByRole("button", { name: "Working..." }).waitFor();
        assert.equal(await submit.isDisabled(), true, "pending signup must disable the submit control");
        assert.equal(await email.isDisabled(), true, "pending signup must keep the captured email stable");
        assert.equal(await password.isDisabled(), true, "pending signup must keep the captured password stable");
        if (mode === "browser_clear") {
          await password.evaluate((input) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            setter?.call(input, "");
            input.dispatchEvent(new Event("input", { bubbles: true }));
          });
          assert.equal(await password.inputValue(), "", "fixture must reproduce a browser-originated password clear while pending");
        }
        await submit.evaluate((button) => button.click());
      }
      const expectedMessage = mode === "network_failure"
        ? "The Website Account sign-up request could not reach authentication. Your password was not cleared; check your connection and try again."
        : providerErrorForMode.expectedMessage;
      await page.getByText(expectedMessage, { exact: true }).first().waitFor();
      assert.equal(await password.inputValue(), fixturePassword, "signup error must preserve password");
      assert.equal(await submit.isEnabled(), true, "failed signup must restore an enabled retry control");
      if (mode === "error" || mode === "browser_clear") {
        assert.equal(signupRequests.length, 1, "pending signup must block duplicate submission");
      }
    } else if (confirmationMode) {
      await page.getByText("Account created. Check your email to confirm it before signing in.", { exact: true }).first().waitFor();
      assert.equal(await password.inputValue(), "", "verified new-user response must clear the password only after success");
    } else if (mode === "obfuscated") {
      await page.getByText("If this address can create a new account, check its inbox. Otherwise, sign in or recover the account.", { exact: true }).first().waitFor();
      assert.equal(await password.inputValue(), fixturePassword, "ambiguous existing-user-shaped response must retain the password");
    } else {
      await page.getByText(`Signed in as ${fixtureEmail}.`, { exact: true }).first().waitFor();
      assert.equal(await page.getByLabel("Create password").count(), 0, "session success must enter signed-in state");
    }

    assert.equal(signupRequests.length, 1, "signup must call Supabase exactly once");
    assert.equal(signupRequests[0].body.email, fixtureEmail, "signup must trim submitted email");
    assert.equal(signupRequests[0].body.password, fixturePassword, "signup must use the captured current password");
    assert.equal(
      signupRequests[0].redirectTo,
      `${origin}${routeCase.redirectPath}`,
      `${routeCase.path} signup must preserve its intended Commons confirmation handoff`,
    );
    assert.equal(signInRequests.length, 0);

    const diagnostic = page.locator("[data-auth-signup-attempt]");
    await diagnostic.waitFor();
    await page.waitForFunction(() =>
      document.querySelector("[data-auth-signup-attempt]")?.getAttribute("data-auth-signup-pending") === "settled"
    );
    assert.equal(await diagnostic.getAttribute("data-auth-signup-contract"), "2026-07-28.2");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-route"), routeCase.path);
    const expectedMode = mode === "session" ? "signed_in" : "sign_up";
    assert.equal(await diagnostic.getAttribute("data-auth-signup-mode"), expectedMode);
    assert.equal(await diagnostic.getAttribute("data-auth-signup-browser"), expectedBrowserFamily);
    assert.equal(await diagnostic.getAttribute("data-auth-signup-handler-started"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-submit-received"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-prevent-default"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-validation-passed"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-called"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-sdk-called"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-request-started"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-request-completed"), "true");
    assert.equal(
      await diagnostic.getAttribute("data-auth-signup-pointer-received"),
      mode === "enter_key" ? "false" : "true",
    );
    assert.equal(
      await diagnostic.getAttribute("data-auth-signup-click-received"),
      "true",
    );
    assert.equal(await diagnostic.getAttribute("data-auth-signup-button-disabled"), "false");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-disabled-reason"), "none");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-form-submit-received"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-dom-email-present"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-dom-password-present"), "true");
    assert.equal(
      await diagnostic.getAttribute("data-auth-signup-react-email-present"),
      mode === "autofill" ? "false" : "true",
    );
    assert.equal(
      await diagnostic.getAttribute("data-auth-signup-react-password-present"),
      mode === "autofill" || confirmationMode || mode === "session" ? "false" : "true",
    );
    assert.equal(await diagnostic.getAttribute("data-auth-signup-form-valid"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-formdata-email-present"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-formdata-password-present"), "true");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-pagehide"), "false");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-beforeunload"), "false");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-navigation"), "false");
    assert.equal(await diagnostic.getAttribute("data-auth-signup-pending"), "settled");
    assert.equal(
      await diagnostic.getAttribute("data-auth-signup-password-restored"),
      confirmationMode || mode === "session" ? "false" : "true",
    );
    const expectedResult = mode === "network_failure"
      ? "network_error"
      : providerErrorForMode
        ? "provider_error"
        : confirmationMode
          ? "confirmation_required"
          : mode === "obfuscated"
            ? "confirmation_or_existing"
            : "signed_in";
    assert.equal(await diagnostic.getAttribute("data-auth-signup-result"), expectedResult);
    assert.equal(
      await diagnostic.getAttribute("data-auth-signup-password-clear"),
      confirmationMode
        ? "confirmed_new_user"
        : mode === "session"
          ? "immediate_session"
          : mode === "browser_clear"
            ? "input_event_during_pending"
          : "none",
    );
    if (providerErrorForMode) {
      assert.equal(
        await diagnostic.getAttribute("data-auth-signup-http-status"),
        String(providerErrorForMode.status),
      );
      assert.equal(
        await diagnostic.getAttribute("data-auth-signup-safe-code"),
        providerErrorForMode.code,
      );
    }

    if ((providerErrorForMode || mode === "network_failure") && routeCase.canVerifySignedOutProfileGate) {
      await page.getByLabel("Username").fill("fixture-member");
      await page.getByRole("button", { name: "4. Final confirmation" }).click();
      await page.getByRole("button", { name: "Create Commons Profile", exact: true }).click();
      await page.getByText("Sign in to a Website Account before creating your Commons Profile.", { exact: true }).first().waitFor();
    }

    if (mode === "network_failure" && routeCase.canVerifySignedOutProfileGate) {
      const attemptId = await diagnostic.getAttribute("data-auth-signup-attempt");
      await page.reload({ waitUntil: "networkidle" });
      const restoredDiagnostic = page.locator("[data-auth-signup-attempt]");
      await restoredDiagnostic.waitFor();
      assert.equal(
        await restoredDiagnostic.getAttribute("data-auth-signup-attempt"),
        attemptId,
        "safe attempt status must survive a component/page remount",
      );
      assert.equal(
        await restoredDiagnostic.getAttribute("data-auth-signup-navigation"),
        "true",
        "a recent reload must remain visible even when the request had already settled",
      );
      await page.getByText(
        "The Website Account sign-up request could not reach authentication. Enter your password to retry after checking your connection.",
        { exact: true },
      ).first().waitFor();
    }

    const persistedDiagnostic = await page.evaluate(() =>
      window.sessionStorage.getItem("elysia.website-account-signup.diagnostic.v1")
    );
    assert(persistedDiagnostic, "safe signup diagnostics must be available in the current tab");
    assert.equal(persistedDiagnostic.includes(fixtureEmail), false, "signup diagnostics must not retain email");
    assert.equal(persistedDiagnostic.includes(fixturePassword), false, "signup diagnostics must not retain password");
    assert.equal(/access_token|refresh_token|authorization|apikey|user_id/i.test(persistedDiagnostic), false, "signup diagnostics must not retain Auth secrets or private identifiers");
  }

  assert.deepEqual(ageAssuranceRequests, [], `${routeCase.path} base signup must not invoke age-assurance or guardian enrollment`);
  assert.deepEqual(pageErrors, [], "signup browser case must not throw");
  const unexpectedConsoleErrors = consoleErrors.filter(
    (message) => !(
      (providerErrorForMode && /Failed to load resource:.*status of (?:400|429|500)/.test(message))
      || (mode === "network_failure" && /(?:Failed to load resource:.*(?:ERR_FAILED|NS_ERROR_FAILURE)|TypeError: Failed to fetch)/.test(message))
      || (mode === "network_failure" && expectedBrowserFamily === "firefox" && /(?:JSHandle@object|Cross-Origin Request Blocked:.*CORS request did not succeed)/.test(message))
    ),
  );
  assert.deepEqual(unexpectedConsoleErrors, [], "signup browser case must not emit unexpected console errors");
  const cspViolations = await page.evaluate(() => window.__elysiaCspViolations);
  assert.equal(
    cspViolations.some((violation) => violation.blockedUri === "eval"),
    false,
    "strict-CSP signup pages must not attempt eval-like execution",
  );
  assert.equal(await page.locator("header.site-header").count(), 1);
  assert.equal(await page.locator("footer.site-footer").count(), 1);
  await context.close();
}

async function runBrowserSuite({
  browserType,
  launchOptions,
  expectedBrowserFamily,
  modes,
  includeMobile,
}) {
  activeBrowser = await browserType.launch({ headless: true, ...launchOptions });
  try {
    for (const routeCase of routeCases) {
      for (const mode of modes) {
        await runCase(routeCase, mode, expectedBrowserFamily);
      }
      if (includeMobile) {
        await runCase(routeCase, "error", expectedBrowserFamily, { width: 390, height: 844 });
      }
    }
  } finally {
    await activeBrowser.close();
    activeBrowser = null;
  }
}

async function executableAvailable(executablePath) {
  try {
    await fs.access(executablePath);
    return true;
  } catch {
    return false;
  }
}

try {
  await runBrowserSuite({
    browserType: chromium,
    expectedBrowserFamily: "chromium",
    modes: ["invalid", "autofill", "mode_after_entry", "enter_key", "pending_navigation", "network_failure", "browser_clear", "error", "rate_limit", "captcha", "smtp", "confirmation", "obfuscated", "session", "sign_in", "sign_in_autofill"],
    includeMobile: true,
  });
  const braveExecutable = process.env.ELYSIA_BRAVE_EXECUTABLE ?? "/usr/bin/brave-browser-stable";
  if (await executableAvailable(braveExecutable)) {
    await runBrowserSuite({
      browserType: chromium,
      launchOptions: { executablePath: braveExecutable },
      expectedBrowserFamily: "brave",
      modes: ["invalid", "autofill", "mode_after_entry", "enter_key", "pending_navigation", "network_failure", "browser_clear", "error", "confirmation", "obfuscated", "session", "sign_in", "sign_in_autofill"],
      includeMobile: true,
    });
  } else if (requireCrossBrowser) {
    assert.fail(`Required Brave executable is unavailable at ${braveExecutable}.`);
  } else {
    console.warn(`Brave browser regression skipped because ${braveExecutable} is unavailable.`);
  }
  const firefoxExecutable = firefox.executablePath();
  if (await executableAvailable(firefoxExecutable)) {
    await runBrowserSuite({
      browserType: firefox,
      expectedBrowserFamily: "firefox",
      modes: ["invalid", "autofill", "mode_after_entry", "enter_key", "pending_navigation", "network_failure", "browser_clear", "error", "confirmation", "obfuscated", "session", "sign_in", "sign_in_autofill"],
      includeMobile: true,
    });
  } else if (requireCrossBrowser) {
    assert.fail(`Required Playwright Firefox executable is unavailable at ${firefoxExecutable}.`);
  } else {
    console.warn(`Firefox browser regression skipped because ${firefoxExecutable} is unavailable.`);
  }
  console.log("Mocked production-build Website Account browser regression passed in Chromium, Brave, and Firefox on /commons-circle and /commons-circle/setup/profile for standard form semantics, native invalidity, direct-DOM autofill, mode changes, Enter/click submission, navigation prevention, interrupted-navigation persistence, network/provider errors, confirmation, obfuscated existing-user, session, duplicate, age-assurance non-invocation, signed-out profile gate, and existing-account sign-in states.");
} finally {
  if (activeBrowser) await activeBrowser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
