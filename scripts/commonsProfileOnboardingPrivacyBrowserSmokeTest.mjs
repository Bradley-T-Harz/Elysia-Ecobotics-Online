import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = process.env.ELYSIA_COMMONS_PROFILE_EVIDENCE_DIR || "";
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
assert(projectRef, "The built application must contain its configured public Supabase origin.");
if (evidenceDir) await fs.mkdir(evidenceDir, { recursive: true });

const accounts = {
  existing: {
    token: "fixture-existing-profile-token",
    user: {
      id: "a1000000-0000-4000-8000-000000000001",
      aud: "authenticated", role: "authenticated", email: "existing.account@example.invalid",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Private Existing Account Name" },
      created_at: "2026-08-08T12:00:00.000Z", updated_at: "2026-08-08T12:00:00.000Z",
    },
  },
  personal: {
    token: "fixture-personal-email-token",
    user: {
      id: "b2000000-0000-4000-8000-000000000002",
      aud: "authenticated", role: "authenticated", email: "personal.real.name@example.invalid",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {
        full_name: "Personal Real Name", name: "Private Account Name",
        preferred_username: "personal-email-derived", avatar_url: "https://private.example.invalid/avatar.png",
      },
      created_at: "2026-08-08T12:00:00.000Z", updated_at: "2026-08-08T12:00:00.000Z",
    },
  },
  google: {
    token: "fixture-google-auth-token",
    user: {
      id: "c3000000-0000-4000-8000-000000000003",
      aud: "authenticated", role: "authenticated", email: "google.identity@example.invalid",
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: {
        full_name: "Google Private Name", name: "Google Account Name", user_name: "google-private-handle",
        picture: "https://google.example.invalid/picture.png", avatar_url: "https://google.example.invalid/avatar.png",
        website: "https://private.example.invalid", organization: "Private Organization",
      },
      created_at: "2026-08-08T12:00:00.000Z", updated_at: "2026-08-08T12:00:00.000Z",
    },
  },
  fresh: {
    token: "fixture-third-fresh-token",
    user: {
      id: "d4000000-0000-4000-8000-000000000004",
      aud: "authenticated", role: "authenticated", email: "third.account@example.invalid",
      app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
      created_at: "2026-08-08T12:00:00.000Z", updated_at: "2026-08-08T12:00:00.000Z",
    },
  },
};

const existingProfile = {
  id: accounts.existing.user.id,
  username: "saved-commons-member",
  display_name: "Saved Commons Member",
  headline: "Saved public headline",
  bio: "Saved public biography.",
  interests: "Ecological restoration",
  website_url: "https://example.invalid/saved",
  github_url: "https://example.invalid/saved-code",
  avatar_url: null,
  organization: "Saved Commons Cooperative",
  featured_public_links: [{ label: "Saved work", url: "https://example.invalid/work", kind: "website" }],
  is_developer: false, is_admin: false,
  commons_onboarding_completed_at: "2026-08-01T12:00:00.000Z",
  stewardship_onboarding_skipped_at: null, work_with_onboarding_skipped_at: null,
};
const incompleteCompatibilityProfile = {
  id: accounts.google.user.id,
  username: "google.identity_compatibility",
  display_name: "Google Private Name",
  headline: "Private provider headline",
  bio: "Private provider biography",
  interests: "Private provider interests",
  website_url: "https://private.example.invalid",
  github_url: "https://private.example.invalid/code",
  avatar_url: "https://google.example.invalid/avatar.png",
  organization: "Private Organization",
  featured_public_links: [{ label: "Private", url: "https://private.example.invalid", kind: "website" }],
  is_developer: false, is_admin: false,
  commons_onboarding_completed_at: null,
  stewardship_onboarding_skipped_at: null, work_with_onboarding_skipped_at: null,
};
const existingFreeMemberAward = {
  badge_key: "free_member",
  awarded_at: existingProfile.commons_onboarding_completed_at,
  award_source: "system",
  visibility: "public",
  revoked_at: null,
};

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"], [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".png", "image/png"],
  [".svg", "image/svg+xml"], [".webmanifest", "application/manifest+json"],
]);
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const candidate = path.resolve(dist, `.${pathname}`);
    const isSafeAsset = candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/";
    let body = indexHtml;
    let extension = ".html";
    if (pathname === "/session-switch.html") {
      body = Buffer.from("<!doctype html><html><title>Session switch fixture</title></html>");
    } else if (isSafeAsset) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) { body = await fs.readFile(candidate); extension = path.extname(candidate); }
      } catch (error) {
        if (pathname.startsWith("/assets/")) throw error;
      }
    }
    response.writeHead(200, {
      "Cache-Control": "no-store", "Content-Security-Policy": csp,
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

function sessionFor(account) {
  return {
    access_token: account.token, refresh_token: `refresh-${account.user.id}`,
    token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: account.user,
  };
}
function accountForAuthorization(value = "") {
  return Object.values(accounts).find((account) => value === `Bearer ${account.token}`) ?? null;
}
function profileForUser(userId) {
  if (userId === accounts.existing.user.id) return existingProfile;
  if (userId === accounts.google.user.id) return incompleteCompatibilityProfile;
  return null;
}

async function installSession(page, account) {
  await page.goto(`${origin}/session-switch.html`, { waitUntil: "load" });
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: `sb-${projectRef}-auth-token`, session: sessionFor(account),
  });
  assert.equal(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null")?.user?.id, `sb-${projectRef}-auth-token`),
    account.user.id,
    "session-switch fixture must store the requested account",
  );
  const response = await page.goto(`${origin}/commons-circle/setup/profile`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, "account switch must return the profile setup document");
  assert.equal(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null")?.user?.id, `sb-${projectRef}-auth-token`),
    account.user.id,
    "the loaded application must retain the requested account session",
  );
}
async function waitForProfileForm(page, existing) {
  await page.getByRole("heading", { name: existing ? "Review Commons Profile draft" : "Draft Commons Profile" }).waitFor();
  await page.getByLabel("Username").waitFor();
}
const publicFieldLabels = [
  "Username", "Display name", "Headline, optional", "Bio", "Interests", "Website",
  "GitHub", "Organization, optional", "Featured public links, optional",
];
async function assertBlankNewProfile(page, expectedEmail) {
  await waitForProfileForm(page, false);
  assert.match(await page.getByText(`Signed in as ${expectedEmail}.`, { exact: true }).innerText(), /Signed in as/);
  for (const label of publicFieldLabels) {
    assert.equal(await page.getByLabel(label).inputValue(), "", `${label} must begin blank`);
  }
  assert.equal(await page.getByRole("checkbox", { name: /Request developer profile flag/ }).isChecked(), false, "developer flag must begin clear");
  assert.equal(await page.locator('.commons-profile-mantle img[alt="Public Commons profile picture"]').count(), 0, "new profile must not import a private avatar");
  assert.match(await page.locator(".commons-setup-form-card").innerText(), /Nothing here is copied from your private account email, account name, sign-in provider, or provider profile metadata\./);
  assert.equal(await page.getByLabel("Username").getAttribute("placeholder"), "Choose a public username");
  assert.equal(await page.getByLabel("Display name").getAttribute("placeholder"), "How you'd like to appear");
  const rendered = await page.locator(".commons-setup-form-card").innerText();
  for (const forbidden of ["Personal Real Name", "Private Account Name", "Google Private Name", "Google Account Name", "google-private-handle", "Private Organization"]) {
    assert(!rendered.includes(forbidden), `new public profile rendered private identity: ${forbidden}`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "new profile must not overflow horizontally");
}
async function capture(page, name, anchor, offset = -140) {
  if (!evidenceDir) return;
  await anchor.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }));
  await page.evaluate((amount) => window.scrollBy(0, amount), offset);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(evidenceDir, name), fullPage: false, animations: "disabled" });
}

const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, serviceWorkers: "block" });
await context.addInitScript(({ key, session, legacyDraft }) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
  if (!sessionStorage.getItem("commonsCircle.profileSetupDraft.v1")) {
    sessionStorage.setItem("commonsCircle.profileSetupDraft.v1", JSON.stringify(legacyDraft));
  }
}, {
  key: `sb-${projectRef}-auth-token`, session: sessionFor(accounts.personal),
  legacyDraft: {
    username: "another-accounts-legacy-draft", display_name: "Another Account",
    headline: "Leaked headline", bio: "Leaked bio", interests: "Leaked interests",
    website_url: "https://leaked.example.invalid", github_url: "https://leaked.example.invalid/code",
    organization: "Leaked Organization", featured_public_links: [{ label: "Leaked", url: "https://leaked.example.invalid" }],
    is_developer: true,
  },
});
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
const failedSameOriginRequests = [];
page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("requestfailed", (request) => { if (request.url().startsWith(origin)) failedSameOriginRequests.push(request.url()); });

await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const corsHeaders = {
    "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8",
  };
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
  const account = accountForAuthorization(request.headers().authorization);
  assert(account, `unexpected authorization for ${request.method()} ${url.pathname}`);
  if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(account.user) });
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.slice("/rest/v1/".length);
    assert.equal(request.method(), "GET", `privacy initialization must not mutate ${table}`);
    if (table === "profiles") {
      const profile = profileForUser(account.user.id);
      const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
      return route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(objectResponse ? profile : profile ? [profile] : []) });
    }
    if (table === "user_badges") {
      const awards = account.user.id === accounts.existing.user.id ? [existingFreeMemberAward] : [];
      return route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(awards) });
    }
    return route.fulfill({ status: 200, headers: corsHeaders, body: "[]" });
  }
  return route.fulfill({ status: 404, headers: corsHeaders, body: '{"message":"unexpected fixture request"}' });
});

try {
  let response = await page.goto(`${origin}/commons-circle/setup/profile`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200);
  await assertBlankNewProfile(page, accounts.personal.user.email);
  await page.reload({ waitUntil: "networkidle" });
  await assertBlankNewProfile(page, accounts.personal.user.email);
  await capture(page, "01-new-profile-blank-desktop-top.png", page.locator(".commons-setup-form-card"));
  await capture(page, "02-new-profile-blank-desktop-fields.png", page.getByLabel("Headline, optional"), -260);

  await page.getByLabel("Username").fill("personal-chosen-handle");
  await page.getByLabel("Display name").fill("Chosen Public Name");
  await page.getByLabel("Headline, optional").fill("Chosen public headline");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByLabel("Username").inputValue(), "personal-chosen-handle", "same-account username draft must survive reload");
  assert.equal(await page.getByLabel("Display name").inputValue(), "Chosen Public Name", "same-account display-name draft must survive reload");
  assert.equal(await page.getByLabel("Headline, optional").inputValue(), "Chosen public headline", "same-account headline draft must survive reload");

  await installSession(page, accounts.google);
  await assertBlankNewProfile(page, accounts.google.user.email);
  assert.equal(await page.locator('img[src*="google.example.invalid"]').count(), 0, "Google avatar metadata must not be imported");

  await installSession(page, accounts.existing);
  await waitForProfileForm(page, true);
  assert.equal(await page.getByLabel("Username").inputValue(), existingProfile.username, "existing profile must load its saved username");
  assert.equal(await page.getByLabel("Display name").inputValue(), existingProfile.display_name, "existing profile must load its saved display name");
  assert.equal(await page.getByLabel("Headline, optional").inputValue(), existingProfile.headline, "existing profile must load its saved headline");
  assert.equal(await page.getByLabel("Bio").inputValue(), existingProfile.bio, "existing profile must load its saved bio");
  assert.equal(await page.getByLabel("Organization, optional").inputValue(), existingProfile.organization, "existing profile must load its own saved organization");
  await capture(page, "03-existing-profile-own-values-desktop.png", page.locator(".commons-setup-form-card"));

  await installSession(page, accounts.personal);
  assert.equal(await page.getByLabel("Username").inputValue(), "personal-chosen-handle", "Account B must recover only Account B's own draft");
  assert.equal(await page.getByLabel("Display name").inputValue(), "Chosen Public Name", "Account B display-name draft must remain isolated");

  await installSession(page, accounts.fresh);
  await assertBlankNewProfile(page, accounts.fresh.user.email);

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "04-new-profile-blank-mobile-top.png", page.locator(".commons-setup-form-card"), -80);
  await capture(page, "05-new-profile-blank-mobile-fields.png", page.getByLabel("Username"), -260);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "mobile profile setup must not overflow");

  await installSession(page, accounts.existing);
  await waitForProfileForm(page, true);
  await capture(page, "06-existing-profile-own-values-mobile.png", page.getByLabel("Username"), -260);
  assert.equal(await page.getByLabel("Username").inputValue(), existingProfile.username);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "existing mobile profile must not overflow");

  assert.deepEqual(pageErrors, [], "profile onboarding must not throw browser errors");
  assert.deepEqual(consoleErrors, [], "profile onboarding must not emit console errors");
  assert.deepEqual(failedSameOriginRequests, [], "profile onboarding assets must load successfully");
  console.log("Commons Profile onboarding privacy regression passed for personal email, auth metadata, Google auth, completed-profile editing, account A/B/C isolation, same-account drafts, blank fields, avatar privacy, desktop, and mobile.");
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
