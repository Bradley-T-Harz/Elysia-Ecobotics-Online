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
  if (match) { projectRef = match[1]; break; }
}
assert(projectRef, "Build with a synthetic public Supabase URL before running this focused browser test.");

const userId = "a2900000-0000-4000-8000-000000000001";
const now = "2026-08-29T18:00:00.000Z";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const accessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureUser = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "account-owner@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: now,
  updated_at: now,
};
const fixtureSession = {
  access_token: accessToken,
  refresh_token: "fixture-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: fixtureUser,
};
const fixtureProfile = {
  id: userId,
  username: "account-owner",
  display_name: "Account Owner",
  headline: "Stewarding shared ecological tools",
  bio: "A private account fixture used only by the local browser evidence harness.",
  interests: "ecobotics, shared tools",
  website_url: null,
  github_url: null,
  public_profile_enabled: true,
  short_public_bio: "Stewarding shared ecological tools.",
  commons_onboarding_completed_at: now,
  stewardship_onboarding_skipped_at: null,
  work_with_onboarding_skipped_at: null,
  saved_addon_ids: [],
  is_admin: false,
  created_at: now,
  updated_at: now,
};
const eventPreferences = {
  taxonomyVersion: 1,
  preferences: [
    { category: "account_security", taxonomyVersion: 1, preferenceVersion: 1, inAppEnabled: true, emailEnabled: true, quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: "UTC" },
    { category: "community_mentions", taxonomyVersion: 1, preferenceVersion: 1, inAppEnabled: true, emailEnabled: false, quietHoursStart: "22:00:00", quietHoursEnd: "08:00:00", quietHoursTimezone: "UTC" },
    { category: "private_messages", taxonomyVersion: 1, preferenceVersion: 1, inAppEnabled: true, emailEnabled: false, quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: "UTC" },
  ],
};

function bootstrap(deactivated) {
  return {
    accountActivation: {
      state: deactivated ? "temporarily_deactivated" : "active",
      temporarilyDeactivatedAt: deactivated ? now : null,
      reactivatedAt: null,
      updatedAt: now,
    },
    communityAccess: {
      userId,
      participationState: "restricted",
      ageBand: "18_plus",
      assuranceStatus: "restricted",
      assuranceExpiresAt: null,
      jurisdictionCode: "US-CO",
      publicProfileEnabled: true,
      publicProfilePublished: !deactivated,
      canPublishPublicProfile: !deactivated,
      profileComplete: true,
      canJoinArtisan: false,
      canPostArtisan: false,
      canCommentArtisan: false,
      canAppreciateArtisan: false,
      canUploadImage: false,
      canSubmitChallenge: false,
      evaluatedAt: now,
    },
    membership: {
      status: "active",
      joinedAt: now,
      defaultCreditLine: null,
      defaultCreationMethod: null,
      defaultLicenseCode: null,
    },
    profileCard: {
      userId,
      handle: "account-owner",
      displayName: "Account Owner",
      avatarUrl: null,
      shortPublicBio: "Stewarding shared ecological tools.",
      canonicalProfileUrl: "https://elysiaecobotics.com/commons-circle/@account-owner",
      publicProfileEnabled: true,
      updatedAt: now,
    },
    guardianSummary: { relationships: [] },
    legalManifest: { documents: [], missingAcceptances: [], requiredDocumentsReady: true, complete: true },
    notificationPreferences: {
      inAppEnabled: true,
      emailEnabled: true,
      mentionsEnabled: true,
      commentsEnabled: true,
      challengeUpdatesEnabled: true,
      moderationUpdatesEnabled: true,
      guardianUpdatesEnabled: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      updatedAt: now,
    },
    featureFlags: {},
  };
}

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
    const requested = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const candidate = path.normalize(path.join(dist, requested === "/" ? "index.html" : requested));
    const safeCandidate = candidate.startsWith(dist) ? candidate : path.join(dist, "index.html");
    let body;
    let filePath = safeCandidate;
    try { body = await fs.readFile(filePath); }
    catch { filePath = path.join(dist, "index.html"); body = indexHtml; }
    response.writeHead(200, {
      "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      "Content-Security-Policy": csp,
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const screenshotDir = path.resolve(root, process.env.ELYSIA_ACCOUNT_PROFILE_SCREENSHOT_DIR || "docs/security/account-profile-lifecycle-evidence-20260829/online");
await fs.mkdir(screenshotDir, { recursive: true });

const scenarios = [
  { slug: "commons-homebase", path: "/commons-circle", heading: "The Commons Circle", kind: "homebase" },
  { slug: "account-profile-settings", path: "/commons-circle/settings", heading: "Account & Profile Settings", kind: "settings" },
  { slug: "privacy-public-profile", path: "/commons-circle/settings/privacy", heading: "Privacy & Public Profile", kind: "privacy" },
  { slug: "notification-preferences", path: "/commons-circle/settings/notifications", heading: "Notification Preferences", kind: "notifications" },
  { slug: "signals-account-destinations", path: "/commons-circle/signals", heading: "Signals", kind: "signals" },
  { slug: "change-password", path: "/account/change-password", heading: "Change Password", kind: "password" },
  { slug: "temporary-deactivation", path: "/account/deactivate", heading: "Temporarily Deactivate Account", kind: "deactivate" },
  { slug: "reactivation-restricted", path: "/account/reactivate", heading: "Reactivate Account", kind: "reactivate", deactivated: true },
  { slug: "permanent-deletion", path: "/account/delete", heading: "Permanently Delete Account", kind: "delete" },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    for (const scenario of scenarios) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: "dark" });
      const observed = { passwordUpdates: [], profileVisibilityWrites: 0 };
      await context.addInitScript(({ storageKey, session }) => {
        localStorage.setItem(storageKey, JSON.stringify(session));
        window.__elysiaCspViolations = [];
        window.addEventListener("securitypolicyviolation", (event) => window.__elysiaCspViolations.push({ blockedUri: event.blockedURI, directive: event.effectiveDirective }));
      }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
      await context.route(/\/api\/identity\/v1\/bootstrap(?:\?|$)/, async (route) => route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true, data: bootstrap(Boolean(scenario.deactivated)) }),
      }));
      await context.route(/\/api\/identity\/v1\/lifecycle\/requests(?:\?|$)/, async (route) => route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true, data: { items: [], nextBefore: null } }),
      }));
      await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = {
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "DELETE,GET,PATCH,POST,PUT,OPTIONS",
          "Access-Control-Allow-Origin": "*",
          "Content-Range": "0-0/0",
          "Content-Type": "application/json; charset=utf-8",
        };
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
        if (url.pathname.endsWith("/auth/v1/user") && request.method() === "GET") return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
        if (url.pathname.endsWith("/auth/v1/user") && request.method() === "PUT") {
          observed.passwordUpdates.push(request.postDataJSON());
          return route.fulfill({ status: 200, headers, body: JSON.stringify({ ...fixtureUser, updated_at: now }) });
        }
        if (url.pathname.endsWith("/auth/v1/logout")) return route.fulfill({ status: 204, headers, body: "" });
        if (url.pathname.endsWith("/rest/v1/rpc/current_user_account_event_preferences")) return route.fulfill({ status: 200, headers, body: JSON.stringify(eventPreferences) });
        if (url.pathname.endsWith("/rest/v1/profiles")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureProfile) });
        if (url.pathname.endsWith("/rest/v1/profile_visibility_settings") && request.method() !== "GET") observed.profileVisibilityWrites += 1;
        return route.fulfill({ status: 200, headers, body: "[]" });
      });

      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const response = await page.goto(`${origin}${scenario.path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      assert.equal(response?.status(), 200, `${scenario.path} should load.`);
      await page.getByRole("heading", { name: scenario.heading, exact: true }).first().waitFor();
      await page.waitForTimeout(250);

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false, `${scenario.path} must not overflow at ${viewport.width}px.`);
      assert.deepEqual(await page.evaluate(() => window.__elysiaCspViolations ?? []), [], `${scenario.path} must not violate CSP.`);
      assert.deepEqual(pageErrors, [], `${scenario.path} should have no page errors.`);
      const accessibility = await page.evaluate(() => {
        const duplicateIds = [...document.querySelectorAll("[id]")].map((node) => node.id).filter((id, index, all) => all.indexOf(id) !== index);
        const unnamedControls = [...document.querySelectorAll("button, input:not([type=hidden]), select, textarea")].filter((node) => {
          if (node instanceof HTMLInputElement && ["submit", "button"].includes(node.type) && node.value) return false;
          return !node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby") && !("labels" in node && node.labels?.length) && !node.textContent?.trim() && !node.getAttribute("title");
        }).map((node) => node.outerHTML.slice(0, 160));
        const missingAlt = [...document.querySelectorAll("img")].filter((node) => !node.hasAttribute("alt")).map((node) => node.outerHTML.slice(0, 160));
        return { duplicateIds, unnamedControls, missingAlt, h1Count: document.querySelectorAll("h1").length };
      });
      assert.deepEqual(accessibility.duplicateIds, [], `${scenario.path} must not contain duplicate IDs.`);
      assert.deepEqual(accessibility.unnamedControls, [], `${scenario.path} controls must have accessible names.`);
      assert.deepEqual(accessibility.missingAlt, [], `${scenario.path} images must expose alt text, including intentional empty alt.`);
      assert.equal(accessibility.h1Count, 1, `${scenario.path} must expose one page-level heading.`);

      if (scenario.kind === "homebase") {
        await page.getByText("Private Account Homebase", { exact: true }).waitFor();
        assert.equal(await page.getByRole("link", { name: "Account & Profile Settings", exact: true }).count(), 1, "The private homebase must expose one settings entry.");
        assert.equal(await page.getByRole("link", { name: "Temporarily Deactivate Account", exact: true }).count(), 0, "Lifecycle controls must stay off the Commons root.");
        assert.equal(await page.getByText("Privacy Lanterns", { exact: true }).count(), 0, "Privacy controls must be relocated off the Commons root.");
      } else if (scenario.kind === "settings") {
        const securityControls = page.locator(".account-security-control");
        assert.equal(await securityControls.count(), 3, "Settings must expose the three deliberate orange Account & Security controls.");
        assert.deepEqual(await securityControls.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))), ["/account/change-password", "/account/deactivate", "/account/delete"]);
        const sizes = await securityControls.evaluateAll((nodes) => nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          backgroundColor: getComputedStyle(node).backgroundColor,
          backgroundImage: getComputedStyle(node).backgroundImage,
          color: getComputedStyle(node).color,
        })));
        assert(sizes.every(({ height }) => height >= 44), "All orange Account & Security controls must meet the 44px touch-target requirement.");
        assert(sizes.every(({ backgroundColor, backgroundImage }) => backgroundColor !== "rgba(0, 0, 0, 0)" || backgroundImage !== "none"), "All security controls must have a visible orange treatment.");
        await securityControls.first().focus();
        assert.equal(await securityControls.first().evaluate((node) => document.activeElement === node), true, "Security controls must be keyboard focusable.");
      } else if (scenario.kind === "privacy") {
        await page.getByRole("heading", { name: "Public profile visibility", exact: true }).waitFor();
        assert.equal(await page.locator(".commons-privacy-grid input[type=checkbox]").count(), 14, "Every existing Privacy Lantern must remain present.");
        if (viewport.name === "desktop") {
          await page.locator(".commons-privacy-grid input[type=checkbox]").first().click();
          await page.getByRole("button", { name: "Save visibility", exact: true }).click();
          await page.getByText("Privacy Lantern visibility saved", { exact: false }).waitFor();
          assert.equal(observed.profileVisibilityWrites, 1, "The relocated Privacy Lanterns must retain one canonical save operation.");
        }
      } else if (scenario.kind === "notifications") {
        await page.getByRole("heading", { name: "Choose optional in-app and email delivery", exact: true }).waitFor();
        await page.getByRole("heading", { name: "Commons activity notifications", exact: true }).waitFor();
        assert.equal(await page.getByRole("link", { name: "Messaging Settings", exact: true }).getAttribute("href"), "/commons-circle/signals/inbox/settings", "Messaging settings must remain separate.");
      } else if (scenario.kind === "signals") {
        const accountDestination = page.getByRole("link", { name: "Notification Preferences", exact: true });
        await accountDestination.waitFor();
        assert.equal(await accountDestination.getAttribute("href"), "/commons-circle/settings/notifications", "Signals must link to the canonical Notification Preferences page.");
      } else if (scenario.kind === "password" && viewport.name === "desktop") {
        await page.getByLabel("New password", { exact: true }).fill("fixture-password-123");
        await page.getByLabel("Confirm new password", { exact: true }).fill("not-the-same");
        await page.getByRole("button", { name: "Change Password", exact: true }).click();
        await page.getByRole("alert").waitFor();
        assert.equal(observed.passwordUpdates.length, 0, "Mismatched password confirmation must not call Auth.");
        await page.getByLabel("Confirm new password", { exact: true }).fill("fixture-password-123");
        await page.getByRole("button", { name: "Change Password", exact: true }).click();
        await page.getByText("Password changed for this Website Account", { exact: false }).waitFor();
        assert.equal(observed.passwordUpdates.length, 1, "A valid change must use one canonical Auth update.");
        assert.deepEqual(
          Object.keys(observed.passwordUpdates[0]).sort(),
          ["code_challenge", "code_challenge_method", "password"],
          "The browser may submit only the current password update and Supabase PKCE fields; it must not submit a target account ID.",
        );
        assert.equal("userId" in observed.passwordUpdates[0] || "user_id" in observed.passwordUpdates[0] || "email" in observed.passwordUpdates[0], false, "Password updates must never carry a cross-account target.");
      } else if (scenario.kind === "deactivate") {
        const control = page.getByRole("button", { name: "Temporarily Deactivate Account", exact: true });
        assert.equal(await control.isDisabled(), true, "Temporary deactivation must require explicit confirmation and verification.");
        await page.getByLabel("Type DEACTIVATE").fill("DEACTIVATE");
        assert.equal(await control.isDisabled(), true, "Confirmation alone must not bypass human verification.");
      } else if (scenario.kind === "reactivate") {
        await page.getByRole("heading", { name: "Restore ordinary account access", exact: true }).waitFor();
        await page.getByText("restricted", { exact: true }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Reactivate Account", exact: true }).isDisabled(), true, "Reactivation must be explicit and verified.");
        assert.equal(await page.getByRole("link", { name: "Permanently delete account", exact: true }).getAttribute("href"), "/account/delete");
      } else if (scenario.kind === "delete") {
        await page.getByRole("heading", { name: "Request permanent account deletion", exact: true }).waitFor();
        assert.equal(await page.getByLabel(/reviewed permanent account-deletion workflow/).isChecked(), false);
        assert.equal(await page.getByRole("button", { name: "Request permanent deletion review", exact: true }).isDisabled(), true, "Deletion must require its governed confirmations.");
        await page.getByText("No lifecycle requests are recorded for this account.", { exact: true }).waitFor();
      }

      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(screenshotDir, `${scenario.slug}-${viewport.name}.png`), fullPage: true });
      await context.close();
    }
  }

  const compatibilityContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await compatibilityContext.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
  await compatibilityContext.route(/\/api\/identity\/v1\/bootstrap(?:\?|$)/, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: bootstrap(false) }) }));
  await compatibilityContext.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const url = new URL(route.request().url());
    const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
  const compatibilityPage = await compatibilityContext.newPage();
  await compatibilityPage.goto(`${origin}/commons-circle?from=legacy#privacy-lanterns`, { waitUntil: "domcontentloaded" });
  await compatibilityPage.getByRole("heading", { name: "Privacy & Public Profile", exact: true }).waitFor();
  const canonical = new URL(compatibilityPage.url());
  assert.equal(`${canonical.pathname}${canonical.search}`, "/commons-circle/settings/privacy?from=legacy", "The legacy Privacy Lanterns deep link must preserve its query while resolving to the canonical settings destination.");
  await compatibilityContext.close();

  const deactivatedContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await deactivatedContext.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
  await deactivatedContext.route(/\/api\/identity\/v1\/bootstrap(?:\?|$)/, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: bootstrap(true) }) }));
  await deactivatedContext.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const url = new URL(route.request().url());
    const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
  const deactivatedPage = await deactivatedContext.newPage();
  await deactivatedPage.goto(`${origin}/commons-circle`, { waitUntil: "domcontentloaded" });
  await deactivatedPage.getByRole("heading", { name: "Reactivate Account", exact: true }).waitFor();
  assert.equal(new URL(deactivatedPage.url()).pathname, "/account/reactivate", "A signed-in temporarily deactivated account must reach only the restricted reactivation surface.");
  assert.equal(await deactivatedPage.getByRole("heading", { name: "The Commons Circle", exact: true }).count(), 0, "Ordinary Commons access must not render before explicit reactivation.");
  await deactivatedContext.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Account/profile lifecycle browser and accessibility checks passed. Evidence: ${screenshotDir}`);
