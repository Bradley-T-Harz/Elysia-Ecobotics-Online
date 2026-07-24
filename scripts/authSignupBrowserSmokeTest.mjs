import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
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
const browser = await chromium.launch({ headless: true });

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
  identities: [],
  created_at: "2026-07-24T12:00:00.000Z",
  updated_at: "2026-07-24T12:00:00.000Z",
};
const fixtureSession = {
  access_token: "fixture-signup-access-token",
  refresh_token: "fixture-signup-refresh-token",
  expires_in: 3_600,
  expires_at: 1_785_000_000,
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

async function runCase(routeCase, mode, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const signupRequests = [];
  const signInRequests = [];
  const ageAssuranceRequests = [];
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
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
      if (mode === "error") {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.fulfill({
          status: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Password should contain a stronger fixture value." }),
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

  if (mode === "sign_in") {
    await page.getByLabel("Email").fill(fixtureEmail);
    await page.getByLabel("Password").fill(fixturePassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText(`Signed in as ${fixtureEmail}.`, { exact: true }).first().waitFor();
    assert.equal(signInRequests.length, 1, "existing-account sign-in must remain intact");
    assert.equal(signupRequests.length, 0, "sign-in must not invoke signup");
  } else {
    await page.getByRole("button", { name: "Create an account instead" }).click();
    const email = page.getByLabel("Email");
    const password = page.getByLabel("Create password");
    const submit = page.locator("form.auth-form button[type='submit']");
    const modeSwitch = page.getByRole("button", { name: "Use existing account" });
    await email.fill(`  ${fixtureEmail}  `);
    await password.fill(fixturePassword);
    assert.equal(await submit.isEnabled(), true);
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
    await submit.click();

    if (mode === "error") {
      await page.getByRole("button", { name: "Working..." }).waitFor();
      assert.equal(await submit.isDisabled(), true, "pending signup must disable the submit control");
      await submit.evaluate((button) => button.click());
      await page.getByText("The password does not meet the current Website Account requirements. Use a longer, unique password.").first().waitFor();
      assert.equal(await password.inputValue(), fixturePassword, "signup error must preserve password");
      assert.equal(signupRequests.length, 1, "pending signup must block duplicate submission");
      if (routeCase.canVerifySignedOutProfileGate) {
        await page.getByLabel("Username").fill("fixture-member");
        await page.getByRole("button", { name: "4. Final confirmation" }).click();
        await page.getByRole("button", { name: "Create Commons Profile", exact: true }).click();
        await page.getByText("Sign in to a Website Account before creating your Commons Profile.", { exact: true }).first().waitFor();
      }
    } else if (mode === "confirmation") {
      await page.getByText("Account created. Check your email to confirm it.", { exact: true }).first().waitFor();
      assert.equal(await password.inputValue(), "", "confirmation success must clear password");
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
  }

  assert.deepEqual(ageAssuranceRequests, [], `${routeCase.path} base signup must not invoke age-assurance or guardian enrollment`);
  assert.deepEqual(pageErrors, [], "signup browser case must not throw");
  const unexpectedConsoleErrors = consoleErrors.filter(
    (message) => !(mode === "error" && /Failed to load resource:.*status of 400/.test(message)),
  );
  assert.deepEqual(unexpectedConsoleErrors, [], "signup browser case must not emit unexpected console errors");
  assert.equal(await page.locator("header.site-header").count(), 1);
  assert.equal(await page.locator("footer.site-footer").count(), 1);
  await context.close();
}

try {
  for (const routeCase of routeCases) {
    for (const mode of ["error", "confirmation", "session", "sign_in"]) {
      await runCase(routeCase, mode);
    }
    await runCase(routeCase, "error", { width: 390, height: 844 });
  }
  console.log("Website Account signup browser regression passed on /commons-circle and /commons-circle/setup/profile for desktop/mobile error, confirmation, session, duplicate, age-assurance non-invocation, signed-out profile gate, and existing-account sign-in states.");
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
