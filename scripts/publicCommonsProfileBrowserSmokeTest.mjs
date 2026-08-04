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
assert(projectRef, "The built public-profile application must include its configured public Supabase origin.");

function base64Url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
const fixtureUserId = "fa900000-0000-4000-8000-000000000001";
const fixtureUser = { id: fixtureUserId, aud: "authenticated", role: "authenticated", email: "public-profile-fixture@example.invalid", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-08-03T12:00:00.000Z", updated_at: "2026-08-03T12:00:00.000Z" };
const fixtureAccessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: fixtureUserId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureSession = { access_token: fixtureAccessToken, refresh_token: "fixture-refresh-token", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: fixtureUser };

const mediaId = "fa100000-0000-4000-8000-000000000001";
const bannerId = "fa100000-0000-4000-8000-000000000002";
const canonicalHandle = "fixture-online-public";
const canonicalUrl = `https://elysiaecobotics.com/commons-circle/@${canonicalHandle}`;
const visibility = Object.fromEntries([
  "DisplayName", "Bio", "Interests", "Website", "Github", "Badges",
  "StewardshipRecognition", "SourceCollections", "CommunePosts",
  "DeveloperStatus", "MemberTier",
].map((name) => [`show${name}`, true]));
Object.assign(visibility, {
  showSavedAddons: false,
  showSavedSources: false,
  showWorkWithStatus: false,
});
const publicPresentation = {
  profile: {
    handle: canonicalHandle,
    displayName: "Fixture Online Public",
    avatarUrl: `/api/public/profile-avatars/${mediaId}`,
    shortPublicBio: "Synthetic browser-only public profile.",
    headline: "Ecological systems builder",
    organization: "Fixture Commons",
    interests: "Ecological robotics",
    websiteUrl: "https://example.invalid/profile",
    githubUrl: "https://example.invalid/code",
    isDeveloper: true,
    canonicalProfileUrl: canonicalUrl,
    updatedAt: "2026-07-22T12:00:00.000Z",
  },
  visibility,
  customization: {
    themeMode: "starlit_archive",
    accentColor: "#8ee8dc",
    backgroundStyle: "soft_cyber_garden",
    decalSet: "none",
    profileLayout: "classic_homebase",
    bannerZoom: 1,
    bannerPositionX: 50,
    bannerPositionY: 50,
  },
  media: {
    avatarMediaId: mediaId,
    avatarUrl: `/api/public/profile-avatars/${mediaId}`,
    bannerMediaId: bannerId,
    bannerUrl: `/api/public/profile-banners/${bannerId}`,
  },
  isOwner: false,
  publicBadges: [],
  publicLinks: [
    { label: "Fixture work", url: "https://example.invalid/work", kind: "website" },
  ],
  publicSourceCollections: [],
  publicCommunePosts: [],
  publicCommuneComments: [],
};
const serializedPresentation = JSON.stringify(publicPresentation);
for (const forbidden of [
  "userId", "email", "objectKey", "storageProvider", "privateReason",
]) assert(!serializedPresentation.includes(forbidden), `fixture leaked ${forbidden}`);

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
const safeImage = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#164b49"/></svg>',
);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    if (
      pathname === `/api/public/profile-avatars/${mediaId}`
      || pathname === `/api/public/profile-banners/${bannerId}`
    ) {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(safeImage);
      return;
    }
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

async function loadCase({ handle, viewport, expected, canonicalAfterLoad, signedIn = false, owner = false }) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 600,
  });
  if (signedIn) await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const sameOriginFailures = [];
  const badSameOriginResponses = [];
  const loadedScripts = [];
  const unknownSupabaseRequests = [];
  const rpcCalls = [];

  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin)) {
      sameOriginFailures.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on("response", (response) => {
    if (!response.url().startsWith(origin)) return;
    if (response.status() >= 400) {
      badSameOriginResponses.push(`${response.status()} ${response.url()}`);
    }
    if (response.request().resourceType() === "script") {
      loadedScripts.push(new URL(response.url()).pathname);
    }
  });

  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const corsHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }
    if (url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(fixtureUser) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/rpc/get_public_commons_profile_presentation")) {
      const body = request.postDataJSON();
      rpcCalls.push(`presentation:${body.p_handle}`);
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          body.p_handle === canonicalHandle ? { ...publicPresentation, isOwner: owner } : {},
        ),
      });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/rpc/resolve_online_public_profile_handle")) {
      const body = request.postDataJSON();
      rpcCalls.push(`resolution:${body.p_handle}`);
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          body.p_handle === "fixture-online-old"
            ? {
                requestedHandle: "fixture-online-old",
                currentHandle: canonicalHandle,
                canonicalProfileUrl: canonicalUrl,
                redirect: true,
              }
            : {},
        ),
      });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/badge_definitions")) {
      await route.fulfill({ status: 200, headers: corsHeaders, body: "[]" });
      return;
    }
    unknownSupabaseRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({
      status: 404,
      headers: corsHeaders,
      body: '{"message":"unexpected browser test request"}',
    });
  });

  const response = await page.goto(`${origin}/commons-circle/@${handle}`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  assert.equal(response?.status(), 200, "profile route must return the app document");
  await page.getByRole("heading", { name: expected, exact: true }).first().waitFor();
  if (canonicalAfterLoad) {
    assert.equal(
      page.url(),
      `${origin}/commons-circle/@${canonicalAfterLoad}`,
      "retired handle must replace-navigate to its canonical Online URL",
    );
  }
  assert.equal(await page.locator("header").count(), 1, "site header must render");
  assert.equal(await page.locator("footer").count(), 1, "site footer must render");
  if (handle === canonicalHandle) {
    if (owner) {
      await page.getByRole("link", { name: "Edit in Commons Circle", exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: "Message", exact: true }).count(), 0, "Own public profile must not offer self-messaging.");
      assert.equal(await page.getByRole("link", { name: "Messaging settings", exact: true }).getAttribute("href"), "/commons-circle/signals/inbox/settings");
      assert.equal(await page.getByText("Private messaging unavailable", { exact: true }).count(), 0, "Own public profile must not show an unavailable badge.");
    } else if (!signedIn) {
      const signIn = page.getByRole("link", { name: "Sign in to message", exact: true });
      await signIn.waitFor();
      assert.equal(await signIn.getAttribute("href"), `/commons-circle/signals/inbox/new?recipient=%40${canonicalHandle}`);
    } else {
      const messageLink = page.getByRole("link", { name: "Message", exact: true });
      await messageLink.waitFor();
      assert.equal(await messageLink.getAttribute("href"), `/commons-circle/signals/inbox/new?recipient=%40${canonicalHandle}`);
      assert.equal(await page.getByText("Private messaging unavailable", { exact: true }).count(), 0, "Public profiles must not pre-query or expose private availability.");
    }
    const messagingControlMarkup = await page.locator(".commons-profile-masthead__edit").innerHTML();
    assert(!messagingControlMarkup.includes(fixtureUser.email) && !messagingControlMarkup.includes(fixtureUserId), "Public-profile messaging controls must not render email or private account identity.");
  }
  assert(
    loadedScripts.some((asset) => /\/assets\/commons-circle-[^/]+\.js$/.test(asset)),
    "Commons Circle route chunk must load",
  );
  assert.deepEqual(unknownSupabaseRequests, [], "unexpected Supabase request");
  assert.deepEqual(sameOriginFailures, [], "same-origin request failed");
  assert.deepEqual(badSameOriginResponses, [], "same-origin response failed");
  assert.deepEqual(pageErrors, [], "uncaught browser error");
  assert.deepEqual(consoleErrors, [], "browser console error");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert(overflow <= 1, `profile route overflows by ${overflow}px`);
  await context.close();
  return rpcCalls;
}

try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const calls = await loadCase({
      handle: canonicalHandle,
      viewport,
      expected: "Fixture Online Public",
    });
    assert.deepEqual(calls, [`presentation:${canonicalHandle}`]);
  }
  const signedInCalls = await loadCase({
    handle: canonicalHandle,
    viewport: { width: 1280, height: 900 },
    expected: "Fixture Online Public",
    signedIn: true,
  });
  assert.deepEqual(signedInCalls, [`presentation:${canonicalHandle}`]);
  const ownerCalls = await loadCase({
    handle: canonicalHandle,
    viewport: { width: 1280, height: 900 },
    expected: "Fixture Online Public",
    signedIn: true,
    owner: true,
  });
  assert.deepEqual(ownerCalls, [`presentation:${canonicalHandle}`]);
  const aliasCalls = await loadCase({
    handle: "fixture-online-old",
    viewport: { width: 1280, height: 900 },
    expected: "Fixture Online Public",
    canonicalAfterLoad: canonicalHandle,
  });
  assert.deepEqual(aliasCalls, [
    "presentation:fixture-online-old",
    "resolution:fixture-online-old",
    `presentation:${canonicalHandle}`,
  ]);
  for (const handle of ["fixture-private", "fixture-missing"]) {
    const calls = await loadCase({
      handle,
      viewport: { width: 1024, height: 800 },
      expected: "Profile not found or not public",
    });
    assert.deepEqual(calls, [
      `presentation:${handle}`,
      `resolution:${handle}`,
    ]);
  }
  console.log(
    "Public Commons Profile browser regression passed for desktop, mobile, alias, private, and nonexistent states.",
  );
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
