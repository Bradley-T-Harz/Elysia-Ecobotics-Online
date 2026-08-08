import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = process.env.ELYSIA_LINKS_EVIDENCE_DIR
  ? path.resolve(process.env.ELYSIA_LINKS_EVIDENCE_DIR)
  : path.join("/tmp", "elysia-room-links-browser-evidence");
await fs.mkdir(evidenceDir, { recursive: true });
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
assert(projectRef, "The production-equivalent build must include its configured public Supabase origin.");

function base64Url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
const fixtureUserId = "fb900000-0000-4000-8000-000000000001";
const fixtureUser = {
  id: fixtureUserId,
  aud: "authenticated",
  role: "authenticated",
  email: "commune-links-fixture@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-08-08T12:00:00.000Z",
  updated_at: "2026-08-08T12:00:00.000Z",
};
const fixtureAccessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: fixtureUserId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureSession = { access_token: fixtureAccessToken, refresh_token: "fixture-refresh-token", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: fixtureUser };
const fixtureRowId = "fb100000-0000-4000-8000-000000000001";
const fixtureThreadId = "fb200000-0000-4000-8000-000000000001";
const links = [
  "https://example.com/first?keep=One%20Two",
  "http://example.org/second#fragment",
  "https://example.net/third/path",
];

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

function jsonHeaders() {
  return {
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };
}

async function installSupabaseFixtures(context, { admin = false, postCaptures = [], renderedPost = null } = {}) {
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = jsonHeaders();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers, body: "" });
      return;
    }
    const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
    if (url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(fixtureUser) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/user_roles")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(admin ? [{ role: "administrator" }] : []) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/profiles")) {
      const profile = { username: "commune-links-fixture", is_admin: admin };
      await route.fulfill({ status: 200, headers, body: JSON.stringify(objectResponse ? profile : [profile]) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/commune_posts")) {
      if (request.method() === "POST") {
        const payload = request.postDataJSON();
        const rows = Array.isArray(payload) ? payload : [payload];
        postCaptures.push(...rows);
        await route.fulfill({ status: 201, headers, body: JSON.stringify(objectResponse ? { id: fixtureRowId } : []) });
        return;
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(renderedPost ? [renderedPost] : []) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/commune_threads")) {
      const body = request.method() === "GET"
        ? (renderedPost ? [{ id: fixtureThreadId, post_id: renderedPost.id, room_id: null, title: renderedPost.title, status: "open", visibility: "public", last_reply_at: renderedPost.created_at }] : [])
        : (objectResponse ? { id: fixtureThreadId } : []);
      await route.fulfill({ status: request.method() === "POST" ? 201 : 200, headers, body: JSON.stringify(body) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/rpc/resolve_public_commune_attributions")) {
      const body = renderedPost ? [{ target_type: "post", target_id: renderedPost.id, author_handle: "commune-links-fixture", canonical_profile_url: "https://elysiaecobotics.com/commons-circle/@commune-links-fixture", viewer_is_owner: false }] : [];
      await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
      return;
    }
    if (url.pathname.includes("/rest/v1/rpc/")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(objectResponse ? { id: fixtureRowId } : []) });
      return;
    }
    const mutation = ["POST", "PATCH", "DELETE"].includes(request.method());
    await route.fulfill({
      status: mutation ? 201 : 200,
      headers,
      body: JSON.stringify(objectResponse ? (mutation ? { id: fixtureRowId } : null) : []),
    });
  });
}

async function createSignedInContext(browser, { admin, viewport }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600 });
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
  return context;
}

async function fillSafeRequiredFields(page, slug) {
  if (slug === "job-post") {
    await page.getByLabel("Opportunity type *").selectOption("paid_employment");
    await page.getByLabel("Poster / organization type *").selectOption("business_company");
    await page.getByLabel("Compensation status *").selectOption("paid");
    await page.getByLabel("Salary").check();
    await page.getByLabel("Currency *").fill("USD");
    await page.getByLabel("Amount / minimum *").fill("100");
    await page.getByLabel("Amount basis *").selectOption("year");
    await page.getByLabel("Work arrangement *").selectOption("remote");
    await page.getByLabel("Time basis *").selectOption("full_time");
    await page.getByLabel("Duration *").selectOption("ongoing");
    await page.getByLabel("Application route type *").selectOption("official_application_webpage");
  }
  const textInputs = page.locator('input:visible:not([type="file"]):not([type="checkbox"]):not([type="date"]):not([type="datetime-local"]):not(#commune-post-links):not(#commune-vote-links)');
  for (let index = 0; index < await textInputs.count(); index += 1) {
    const input = textInputs.nth(index);
    const labelText = (await input.locator("xpath=ancestor::label[1]").innerText().catch(() => "")).toLowerCase();
    if (labelText.includes("official update post id")) continue;
    if ((await input.inputValue()).trim()) continue;
    const inputType = await input.getAttribute("type");
    const value = inputType === "number"
      ? "100"
      : /website|url|link|contact|application (?:path|destination)/.test(labelText)
      ? `https://example.com/${slug}/reference`
      : labelText.includes("filename")
        ? "fixture.txt"
        : `Fixture ${slug}`;
    await input.fill(value);
  }
  const textareas = page.locator('textarea:visible:not(#commune-post-links):not(#commune-vote-links)');
  for (let index = 0; index < await textareas.count(); index += 1) {
    const textarea = textareas.nth(index);
    const labelText = (await textarea.locator("xpath=ancestor::label[1]").innerText().catch(() => "")).toLowerCase();
    const current = await textarea.inputValue();
    if (labelText.includes("options") && current.trim()) continue;
    const value = /url|link/.test(labelText) ? `https://example.com/${slug}/related` : `Fixture public content for ${slug}.`;
    await textarea.fill(value);
  }
  const composerAcknowledgements = page.locator('#commune-post-composer > .commune-checklist input[type="checkbox"]:visible');
  const acknowledgements = await composerAcknowledgements.count()
    ? composerAcknowledgements
    : page.locator('.commune-checklist input[type="checkbox"]:visible').first();
  for (let index = 0; index < await acknowledgements.count(); index += 1) {
    const checkbox = acknowledgements.nth(index);
    const text = await checkbox.locator("xpath=ancestor::label[1]").innerText().catch(() => "");
    if (!/request sandbox review/i.test(text)) await checkbox.check();
  }
}

const roomCases = [
  { slug: "media-garden", postType: "media_garden", submitName: /Submit for moderation/ },
  { slug: "troubleshooting-grove", postType: "troubleshooting", submitName: /Submit for moderation/ },
  { slug: "coding-cornucopia", postType: "code_sharing", submitName: /Submit for moderation/ },
  { slug: "community-network", postType: "community_network", submitName: /Submit for moderation/ },
  { slug: "job-post", postType: "job_post", submitName: /Submit for moderation/ },
  { slug: "research-notes", postType: "research_note", submitName: /Submit for moderation/ },
  { slug: "elysia-iteration-showcase", postType: "elysia_iteration_showcase", submitName: /Submit for moderation/ },
  { slug: "community-vote", postType: "community_vote", submitName: /Create community vote/, admin: true },
  { slug: "official-updates", postType: "official_update", submitName: /Publish Official Update/, admin: true },
];

async function verifyRoom(browser, room, viewport, captureScreenshot = false) {
  const context = await createSignedInContext(browser, { admin: Boolean(room.admin), viewport });
  const postCaptures = [];
  await installSupabaseFixtures(context, { admin: Boolean(room.admin), postCaptures });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(`${origin}/commune/rooms/${room.slug}/new`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, `${room.slug} route should load`);
  const linkField = page.getByRole("textbox", { name: "Links", exact: true });
  await linkField.waitFor({ timeout: 30_000 });
  assert.equal(await linkField.evaluate((element) => element.tagName), "TEXTAREA", `${room.slug} Links must be a textarea`);
  assert.equal(await linkField.evaluate((element) => element.labels?.length), 1, `${room.slug} Links must retain one associated label`);
  assert.equal(await linkField.getAttribute("aria-describedby"), `${room.postType === "community_vote" ? "commune-vote" : "commune-post"}-links-description`, `${room.slug} helper association`);
  assert.equal(await page.getByText("One link per line.", { exact: true }).count(), 1, `${room.slug} helper text`);

  const singleLine = room.postType === "community_vote"
    ? page.getByRole("textbox", { name: "Question", exact: true })
    : page.getByRole("textbox", { name: "Title", exact: true });
  await singleLine.fill(`Fixture ${room.slug}`);
  await singleLine.press("Enter");
  assert.equal(postCaptures.length, 0, `${room.slug} Enter in another single-line field must not unexpectedly submit`);
  assert.equal((await singleLine.inputValue()).includes("\n"), false, `${room.slug} single-line field must stay single-line`);

  await linkField.fill(links[0]);
  await linkField.press("Enter");
  await linkField.press("Enter");
  await linkField.type(links[1]);
  await linkField.press("Shift+Enter");
  await linkField.type(links[2]);
  assert.equal(await linkField.inputValue(), `${links[0]}\n\n${links[1]}\n${links[2]}`, `${room.slug} must preserve Enter, blank line, Shift+Enter, and order`);
  assert.equal(postCaptures.length, 0, `${room.slug} keyboard entry must not submit`);
  const preview = page.locator('[aria-label="Links preview"]');
  assert.deepEqual(await preview.locator("li").allTextContents().then((items) => items.map((item) => item.trim())), links, `${room.slug} preview must ignore blanks and preserve all links`);
  assert.equal(await preview.locator("a").count(), 3, `${room.slug} preview must expose valid HTTP(S) links as anchors`);
  if (captureScreenshot) {
    await linkField.scrollIntoViewIfNeeded();
    const suffix = viewport.width < 600 ? "mobile" : "desktop";
    await page.screenshot({ path: path.join(evidenceDir, `${suffix}-three-links.png`), fullPage: true });
  }

  await fillSafeRequiredFields(page, room.slug);
  assert.equal(await linkField.inputValue(), `${links[0]}\n\n${links[1]}\n${links[2]}`, `${room.slug} form completion must preserve Links value`);
  if (room.slug === "media-garden" && viewport.width >= 1000) {
    await page.getByRole("button", { name: "Save local draft", exact: true }).click();
    const drafts = await page.evaluate(() => JSON.parse(localStorage.getItem("commune.postDrafts.v1") ?? "[]"));
    assert.equal(drafts[0]?.sourceLinks, `${links[0]}\n\n${links[1]}\n${links[2]}`, "local draft must preserve the multiline Links value exactly");
    assert.equal(postCaptures.length, 0, "saving a local draft must not submit the post");
  }
  await page.getByRole("button", { name: room.submitName }).click();
  for (let attempt = 0; attempt < 100 && postCaptures.length === 0; attempt += 1) await page.waitForTimeout(50);
  assert(postCaptures.length > 0, `${room.slug} intended submit action did not reach commune_posts: ${(await page.locator(".message").allTextContents()).join(" | ")}`);
  const payload = postCaptures.at(-1);
  assert.equal(payload.post_type, room.postType, `${room.slug} submitted wrong post type`);
  assert.deepEqual(payload.links.slice(0, 3), links, `${room.slug} downstream text[] payload must preserve order and remove blank lines`);
  assert(!payload.links.includes(""), `${room.slug} payload must not contain blank entries`);
  assert.deepEqual(pageErrors, [], `${room.slug} uncaught browser errors`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${room.slug} overflowed ${viewport.width}px viewport by ${overflow}px`);
  await context.close();
}

async function verifyOneLinkAndValidationCompatibility(browser) {
  const oneLinkContext = await createSignedInContext(browser, { admin: false, viewport: { width: 1280, height: 900 } });
  const oneLinkCaptures = [];
  await installSupabaseFixtures(oneLinkContext, { postCaptures: oneLinkCaptures });
  const oneLinkPage = await oneLinkContext.newPage();
  await oneLinkPage.goto(`${origin}/commune/rooms/media-garden/new`, { waitUntil: "networkidle", timeout: 45_000 });
  await oneLinkPage.getByRole("textbox", { name: "Links", exact: true }).fill(links[0]);
  await fillSafeRequiredFields(oneLinkPage, "one-link");
  await oneLinkPage.getByRole("button", { name: "Submit for moderation" }).click();
  for (let attempt = 0; attempt < 100 && oneLinkCaptures.length === 0; attempt += 1) await oneLinkPage.waitForTimeout(50);
  assert.deepEqual(oneLinkCaptures.at(-1)?.links, [links[0]], "existing one-link submissions must keep their downstream text[] shape");
  await oneLinkContext.close();

  const validationContext = await createSignedInContext(browser, { admin: true, viewport: { width: 1280, height: 900 } });
  const validationCaptures = [];
  await installSupabaseFixtures(validationContext, { admin: true, postCaptures: validationCaptures });
  const validationPage = await validationContext.newPage();
  await validationPage.goto(`${origin}/commune/rooms/community-vote/new`, { waitUntil: "networkidle", timeout: 45_000 });
  await validationPage.getByRole("textbox", { name: "Links", exact: true }).fill(`${links[0]}\njavascript:alert(1)\n${links[1]}`);
  await fillSafeRequiredFields(validationPage, "validated-links");
  await validationPage.getByRole("button", { name: "Create community vote" }).click();
  for (let attempt = 0; attempt < 100 && validationCaptures.length === 0; attempt += 1) await validationPage.waitForTimeout(50);
  assert.deepEqual(validationCaptures.at(-1)?.links, [links[0], links[1]], "existing per-link HTTP(S) validation must apply independently without disturbing valid-link order");
  await validationContext.close();
}

async function verifyRepositoryException(browser) {
  const context = await createSignedInContext(browser, { admin: false, viewport: { width: 1280, height: 900 } });
  await installSupabaseFixtures(context);
  const page = await context.newPage();
  await page.goto(`${origin}/commune/rooms/repository-showcase/new`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(await page.getByRole("textbox", { name: "Links", exact: true }).count(), 0, "Repository Showcase must not invent a generic Links field");
  const repoUrl = page.getByRole("textbox", { name: "Repo URL", exact: true });
  assert.equal(await repoUrl.evaluate((element) => element.tagName), "INPUT", "Repository Showcase's purpose-specific Repo URL must remain single-line");
  await context.close();
}

async function verifyRenderedPost(browser) {
  const renderedPost = {
    id: "fb300000-0000-4000-8000-000000000001",
    post_type: "community_network",
    title: "Submitted multiline links fixture",
    body: "Public browser-only rendering fixture.",
    excerpt: "Public browser-only rendering fixture.",
    tags: [],
    links,
    repository_url: null,
    status: "published",
    visibility: "public",
    visibility_state: "published",
    hidden_at: null,
    removed_at: null,
    archived_at: null,
    published_at: "2026-08-08T12:00:00.000Z",
    last_activity_at: "2026-08-08T12:00:00.000Z",
    created_at: "2026-08-08T12:00:00.000Z",
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installSupabaseFixtures(context, { renderedPost });
  const page = await context.newPage();
  await page.goto(`${origin}/commune/posts/${renderedPost.id}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByRole("heading", { name: renderedPost.title }).waitFor();
  const renderedLinks = page.locator('.commune-post-detail [aria-label="Links"]');
  assert.deepEqual(await renderedLinks.locator("li").allTextContents().then((items) => items.map((item) => item.trim())), links, "final post detail must render all submitted links in order");
  assert.equal(await renderedLinks.locator("a").count(), 3, "final post detail must render all valid submitted links as anchors");
  await renderedLinks.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceDir, "submitted-post-three-links.png"), fullPage: true });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const room of roomCases) {
    await verifyRoom(browser, room, { width: 1440, height: 1000 }, room.slug === "media-garden");
  }
  for (const room of roomCases) {
    await verifyRoom(browser, room, { width: 390, height: 844 }, room.slug === "media-garden");
  }
  await verifyRepositoryException(browser);
  await verifyOneLinkAndValidationCompatibility(browser);
  await verifyRenderedPost(browser);
  console.log(`Commune multiline Links browser regression passed for ${roomCases.length} applicable rooms at desktop and mobile widths. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
