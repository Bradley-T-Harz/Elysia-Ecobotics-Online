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

const fixtureUserId = "f1700000-0000-4000-8000-000000000001";
const fixtureMediaId = "f1700000-0000-4000-8000-000000000002";
const fixtureAccessToken = "fixture-avatar-access-token";
const fixtureUser = {
  id: fixtureUserId,
  aud: "authenticated",
  role: "authenticated",
  email: "avatar-owner@example.invalid",
  email_confirmed_at: "2026-07-24T12:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-07-24T12:00:00.000Z",
  updated_at: "2026-07-24T12:00:00.000Z",
};
const fixtureProfile = {
  id: fixtureUserId,
  username: "fixture-avatar-owner",
  display_name: "Fixture Avatar Owner",
  headline: "Profile workflow fixture",
  bio: "Synthetic browser-only profile.",
  interests: "Accessible profile controls",
  website_url: "https://example.invalid/profile",
  github_url: "https://example.invalid/code",
  avatar_url: null,
  organization: "Fixture Commons",
  featured_public_links: [],
  is_developer: false,
  is_admin: false,
  commons_onboarding_completed_at: null,
  stewardship_onboarding_skipped_at: null,
  work_with_onboarding_skipped_at: null,
};
const safePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
  "base64",
);

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
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
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

async function loadProfileEditor(viewport, exerciseMedia) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 600,
  });
  await context.addInitScript(({ ref, accessToken, user }) => {
    const expiresAt = Math.floor(Date.now() / 1_000) + 3_600;
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: accessToken,
      refresh_token: "fixture-avatar-refresh-token",
      token_type: "bearer",
      expires_in: 3_600,
      expires_at: expiresAt,
      user,
    }));
  }, { ref: projectRef, accessToken: fixtureAccessToken, user: fixtureUser });

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const sameOriginFailures = [];
  const uploadRequests = [];
  const profileMediaMutations = [];
  const failedResponses = [];
  const unknownSupabaseRequests = [];

  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin)) sameOriginFailures.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });

  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const corsHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "DELETE,GET,PATCH,POST,PUT,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }
    if (url.pathname.endsWith("/auth/v1/user")) {
      assert.equal(
        request.headers().authorization,
        `Bearer ${fixtureAccessToken}`,
        "profile owner authentication must accompany user lookup",
      );
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(fixtureUser) });
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/profile-avatars/")) {
      assert.equal(
        request.headers().authorization,
        `Bearer ${fixtureAccessToken}`,
        "avatar storage mutation must use the owner's authenticated session",
      );
      uploadRequests.push({ method: request.method(), pathname: url.pathname });
      await route.fulfill({ status: 200, headers: corsHeaders, body: '{"Key":"fixture"}' });
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/profile-avatars/")) {
      if (request.method() === "GET") {
        await route.fulfill({ status: 200, headers: { ...corsHeaders, "Content-Type": "image/png" }, body: safePng });
      } else {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify({ signedURL: `${url.pathname.replace(/^\/storage\/v1/, "")}?token=fixture-owner-preview` }),
        });
      }
      return;
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.slice("/rest/v1/".length);
      if (request.method() !== "GET") profileMediaMutations.push({ method: request.method(), table });
      if (table === "profiles" && request.method() === "GET") {
        const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(objectResponse ? fixtureProfile : [fixtureProfile]),
        });
        return;
      }
      if (table === "profile_media" && request.method() === "POST") {
        await route.fulfill({ status: 201, headers: corsHeaders, body: JSON.stringify({ id: fixtureMediaId }) });
        return;
      }
      await route.fulfill({ status: 200, headers: corsHeaders, body: "[]" });
      return;
    }
    unknownSupabaseRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 404, headers: corsHeaders, body: '{"message":"unexpected fixture request"}' });
  });

  const response = await page.goto(`${origin}/commons-circle/setup/profile`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  assert.equal(response?.status(), 200, "profile setup route must return the app document");
  await page.getByRole("heading", { name: "Review Commons Profile draft" }).waitFor();
  const chooseButton = page.getByRole("button", { name: "Choose profile picture" });
  const removeButton = page.getByRole("button", { name: "Remove profile picture" });
  const fileInput = page.getByLabel("Choose profile picture file");

  assert.equal(await chooseButton.isEnabled(), true, "eligible owner avatar chooser must be enabled");
  assert.equal(await removeButton.isDisabled(), true, "avatar removal must be disabled when no avatar exists");
  await chooseButton.scrollIntoViewIfNeeded();
  const hitTarget = await chooseButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const mantle = button.closest(".commons-profile-mantle");
    return {
      hitIsButton: hit === button || Boolean(hit && button.contains(hit)),
      scrimPointerEvents: mantle ? getComputedStyle(mantle, "::after").pointerEvents : null,
    };
  });
  assert.equal(hitTarget.hitIsButton, true, "decorative mantle scrim must not intercept the chooser");
  assert.equal(hitTarget.scrimPointerEvents, "none", "decorative mantle scrim must ignore pointer events");

  for (const label of [
    "Username", "Display name", "Headline, optional", "Bio", "Interests",
    "Website", "GitHub", "Organization, optional", "Featured public links, optional",
  ]) assert.equal(await page.getByLabel(label).count(), 1, `${label} must remain available`);
  assert.equal(
    await page.getByText("Request developer profile flag.", { exact: false }).count(),
    1,
    "developer request control must remain available",
  );

  if (exerciseMedia) {
    const chooserPromise = page.waitForEvent("filechooser");
    await chooseButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: "avatar.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await page.getByText("Avatar and banner uploads must be PNG, JPG, JPEG, or WebP.").waitFor();
    assert.equal(uploadRequests.length, 0, "unsupported image MIME must fail before storage");

    await fileInput.setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not-a-png") });
    await page.getByText("The selected profile image does not match its declared image type.").waitFor();
    assert.equal(uploadRequests.length, 0, "malformed image bytes must fail before storage");

    await fileInput.setInputFiles({
      name: "oversized.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0),
    });
    await page.getByText("Avatar and banner uploads must be non-empty and 5 MB or smaller.").waitFor();
    assert.equal(uploadRequests.length, 0, "oversized image must fail before storage");

    const browserGeneratedPng = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1, height: 1 },
    });
    await fileInput.setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: browserGeneratedPng });
    await page.getByText("Public profile picture uploaded.", { exact: false }).waitFor();
    assert.equal(uploadRequests.length, 1, "one valid avatar must produce one owner-scoped storage upload");
    assert.equal(await removeButton.isEnabled(), true, "avatar removal must enable after successful upload");
    assert.equal(await page.locator(`text=${fixtureUserId}`).count(), 0, "account UUID must not enter rendered profile UI");
    assert.equal(await page.locator("body").innerText().then((text) => text.includes("profile-avatars")), false, "private bucket name must not enter rendered profile UI");

    await removeButton.click();
    await page.getByText("Public profile picture removed.", { exact: false }).waitFor();
    assert.equal(await removeButton.isDisabled(), true, "avatar removal must disable after removal");
    assert(
      profileMediaMutations.some(({ method, table }) => method === "PATCH" && table === "profile_media"),
      "avatar removal must update the owner's profile_media state",
    );
    assert.equal(await page.getByLabel("Username").inputValue(), fixtureProfile.username, "avatar removal must preserve username");
    assert.equal(await page.getByLabel("Display name").inputValue(), fixtureProfile.display_name, "avatar removal must preserve display name");
    assert.equal(await page.getByLabel("Bio").inputValue(), fixtureProfile.bio, "avatar removal must preserve bio");
  }

  assert.equal(await page.locator("header").count(), 1, "site header must render");
  assert.equal(await page.locator("footer").count(), 1, "site footer must render");
  assert.deepEqual(pageErrors, [], "profile editor must not throw an uncaught browser error");
  assert.deepEqual(unknownSupabaseRequests, [], "profile editor made an unexpected Supabase request");
  assert.deepEqual(failedResponses, [], "profile editor received an unsuccessful response");
  assert.deepEqual(consoleErrors, [], "profile editor must not emit a browser console error");
  assert.deepEqual(sameOriginFailures, [], "profile editor same-origin assets must load");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert(overflow <= 1, `profile editor overflows by ${overflow}px`);
  await context.close();
}

async function loadHomebaseAvatar({ imageFailure = null }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(({ ref, accessToken, user }) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: accessToken,
      refresh_token: "fixture-homebase-avatar-refresh-token",
      token_type: "bearer",
      expires_in: 3_600,
      expires_at: Math.floor(Date.now() / 1_000) + 3_600,
      user,
    }));
  }, { ref: projectRef, accessToken: fixtureAccessToken, user: fixtureUser });

  const page = await context.newPage();
  let signRequests = 0;
  let imageRequests = 0;
  const mutationRequests = [];
  const mediaRow = {
    id: fixtureMediaId,
    media_type: "avatar",
    bucket: "profile-avatars",
    storage_path: `${fixtureUserId}/avatars/fixture-avatar.png`,
    created_at: "2026-07-24T12:00:00.000Z",
  };

  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const corsHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,PATCH,POST,PUT,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(fixtureUser) });
    if (url.pathname.startsWith("/storage/v1/object/sign/profile-avatars/")) {
      if (request.method() === "POST") {
        signRequests += 1;
        return route.fulfill({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify({ signedURL: `${url.pathname.replace(/^\/storage\/v1/, "")}?token=fixture-owner-preview-${signRequests}` }),
        });
      }
      imageRequests += 1;
      if (imageFailure === "malformed") return route.fulfill({ status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" }, body: "not an image" });
      if (typeof imageFailure === "number") return route.fulfill({ status: imageFailure, headers: corsHeaders, body: "" });
      return route.fulfill({ status: 200, headers: { ...corsHeaders, "Content-Type": "image/png" }, body: safePng });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.slice("/rest/v1/".length);
      if (!["GET", "HEAD"].includes(request.method())) mutationRequests.push(`${request.method()} ${table}`);
      if (request.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...corsHeaders, "Content-Range": "*/0" }, body: "" });
      if (table === "profiles") {
        const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
        return route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(objectResponse ? fixtureProfile : [fixtureProfile]) });
      }
      if (table === "profile_media") return route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify([mediaRow]) });
      if (table === "profile_customization") return route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify([{ avatar_media_id: fixtureMediaId }]) });
      return route.fulfill({ status: 200, headers: corsHeaders, body: "[]" });
    }
    return route.fulfill({ status: 404, headers: corsHeaders, body: '{"message":"unexpected fixture request"}' });
  });

  const response = await page.goto(`${origin}/commons-circle`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, "Commons Homebase must load for the avatar stability fixture");
  await page.locator(".commons-private-homebase").getByRole("heading", { name: "Fixture Avatar Owner", exact: true }).waitFor();
  const signalsCard = page.locator(".commons-signal-feed");
  await signalsCard.getByRole("heading", { name: "Signals", exact: true }).waitFor();
  assert.equal(await signalsCard.getByRole("link", { name: "Open Signals", exact: true }).getAttribute("href"), "/commons-circle/signals", "Homebase Signals doorway must target the dedicated Signals hub");
  assert.match(await signalsCard.innerText(), /Signals contains private messages, notifications, requests, reviews, domain activity, and authorized staff tools\./, "Homebase Signals doorway must use the approved neutral summary");
  assert.doesNotMatch(await signalsCard.innerText(), /compatibility|existing notification preview|legacy preview|remains during migration/i, "Homebase Signals doorway must omit migration-era language");
  const privateAvatar = page.locator(".commons-private-homebase__avatar");

  if (imageFailure === null) {
    const image = privateAvatar.locator('img[alt="Commons profile avatar"]');
    await image.waitFor();
    await page.waitForFunction(() => {
      const candidate = document.querySelector('.commons-private-homebase__avatar img[alt="Commons profile avatar"]');
      return candidate instanceof HTMLImageElement && candidate.complete && candidate.naturalWidth > 0;
    });
    const stableSrc = await image.getAttribute("src");
    assert.equal(signRequests, 1, "Homebase must issue one initial owner-avatar signing request");
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(900);
    assert.equal(signRequests, 1, "Unrelated focus and visibility activity must not regenerate the owner-avatar URL");
    assert.equal(await image.getAttribute("src"), stableSrc, "The successful owner-avatar URL must remain stable");
  } else {
    await privateAvatar.locator("span", { hasText: "F" }).waitFor();
    await page.waitForTimeout(900);
    assert.equal(signRequests, 2, `${imageFailure} must cause one initial sign and at most one canonical renewal`);
    assert(imageRequests >= 2, `${imageFailure} must exercise both the failed initial image and the bounded renewal`);
    assert.equal(await privateAvatar.locator("img").count(), 0, `${imageFailure} must stop rendering the broken image and retain the stable fallback`);
    await page.waitForTimeout(900);
    assert.equal(signRequests, 2, `${imageFailure} must not enter a signed-URL renewal loop`);
  }

  assert.deepEqual(mutationRequests, [], "Homebase avatar load, cache, failure, and renewal must not mutate profile or Storage data");
  await context.close();
}

try {
  await loadProfileEditor({ width: 1440, height: 1000 }, true);
  await loadProfileEditor({ width: 1024, height: 900 }, false);
  await loadProfileEditor({ width: 768, height: 900 }, false);
  await loadProfileEditor({ width: 390, height: 844 }, false);
  await loadHomebaseAvatar({ imageFailure: null });
  for (const imageFailure of [401, 403, 404, "malformed"]) await loadHomebaseAvatar({ imageFailure });
  console.log("Commons Profile avatar browser regression passed for owner upload/removal, one-sign Homebase caching, bounded renewal, stable failure fallback, desktop, and mobile.");
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
