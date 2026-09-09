import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = process.env.ELYSIA_JOB_OPPORTUNITY_EVIDENCE_DIR
  ? path.resolve(process.env.ELYSIA_JOB_OPPORTUNITY_EVIDENCE_DIR)
  : "/tmp/elysia-job-opportunity-browser-evidence";
await fs.mkdir(evidenceDir, { recursive: true });
const readableEvidenceDir = process.env.ELYSIA_JOB_OPPORTUNITY_READABLE_EVIDENCE_DIR
  ? path.resolve(process.env.ELYSIA_JOB_OPPORTUNITY_READABLE_EVIDENCE_DIR)
  : null;
if (readableEvidenceDir) {
  await fs.mkdir(path.join(readableEvidenceDir, "desktop"), { recursive: true });
  await fs.mkdir(path.join(readableEvidenceDir, "tablet"), { recursive: true });
  await fs.mkdir(path.join(readableEvidenceDir, "mobile"), { recursive: true });
}
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(path.join(root, "public/_headers"), "utf8");
const csp = headersSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]?.trim();
assert(csp, "production CSP missing");
const assetNames = await fs.readdir(path.join(dist, "assets"));
let projectRef = "";
for (const name of assetNames.filter((item) => item.endsWith(".js"))) {
  const source = await fs.readFile(path.join(dist, "assets", name), "utf8");
  const match = source.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (match) { projectRef = match[1]; break; }
}
assert.equal(projectRef, "readiness-fixture", "Job browser tests require the isolated synthetic build");

const ids = {
  user: "c1000000-0000-4000-8000-000000000001",
  admin: "c1000000-0000-4000-8000-000000000002",
  post: "c2000000-0000-4000-8000-000000000001",
  legacyPost: "c2000000-0000-4000-8000-000000000002",
  thread: "c2100000-0000-4000-8000-000000000001",
  job: "c3000000-0000-4000-8000-000000000001",
  legacyJob: "c3000000-0000-4000-8000-000000000002",
  reviewPost: "c4000000-0000-4000-8000-000000000001",
  reviewJob: "c4000000-0000-4000-8000-000000000002",
};
const links = ["https://example.org/opportunity", "https://github.com/example/restoration", "https://docs.example.org/team"];
const labeledLinks = [
  "The Elysia Commune | https://elysiaecobotics.com/commune",
  "Community Guidelines | https://elysiaecobotics.com/legal/community-guidelines",
  "Work With Elysia Ecobotics | https://elysiaecobotics.com/work-with-elysia-ecobotics",
  "Unsafe example | javascript:alert(1)",
];
const tagStressCases = [
  { id: "3-ordinary", value: "restoration, moderation, privacy", count: 3 },
  { id: "4-ordinary", value: "restoration, moderation, privacy, accessibility", count: 4 },
  { id: "8-ordinary", value: "restoration, moderation, privacy, accessibility, governance, documentation, local-first, public-commons", count: 8 },
  { id: "12-ordinary", value: "restoration, moderation, privacy, accessibility, governance, documentation, local-first, commons, safety, research, ecology, participation", count: 12 },
  { id: "12-mixed", value: "community-stewardship, moderation, privacy, anti-spam, anti-scam, public-commons, community-participation, future-moderator, documentation, local-first, accessibility, governance", count: 12 },
  { id: "long-valid", value: "crosscommunitystewardshippathxxx, moderation, privacy, anti-scam, accessibility, governance", count: 6 },
  { id: "empty", value: "", count: 0 },
  { id: "simple-words", value: "wetlands qgis local-ai governance", count: 4 },
  { id: "mixed-delimiters", value: "wetlands, qgis; local first; governance", count: 4 },
];
const fixtureUser = (admin = false) => ({
  id: admin ? ids.admin : ids.user,
  aud: "authenticated", role: "authenticated", email: `${admin ? "admin" : "member"}@example.invalid`,
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
  created_at: "2026-08-08T12:00:00.000Z", updated_at: "2026-08-08T12:00:00.000Z",
});
function base64Url(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function fixtureSession(admin = false) {
  const user = fixtureUser(admin);
  const token = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: user.id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
  return { access_token: token, refresh_token: "fixture-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };
}

const publishedPost = {
  id: ids.post, user_id: ids.user, post_type: "job_post", title: "Ecological software engineer",
  body: "Build accessible public restoration tools with a small cooperative team.", excerpt: "Build accessible public restoration tools.",
  tags: ["restoration", "typescript"], links, repository_url: null, status: "published", visibility: "public", visibility_state: "published",
  moderation_status: "approved", hidden_at: null, removed_at: null, archived_at: null, published_at: "2026-08-08T12:00:00.000Z",
  created_at: "2026-08-08T12:00:00.000Z", updated_at: "2026-08-08T12:00:00.000Z", last_activity_at: "2026-08-08T12:00:00.000Z",
};
const legacyPost = {
  ...publishedPost, id: ids.legacyPost, title: "Legacy watershed contract", body: "A pre-v2 public listing.", excerpt: "A pre-v2 public listing.", links: [links[0]],
};
const v2Job = {
  id: ids.job, post_id: ids.post, thread_id: ids.thread, author_user_id: ids.user,
  role_title: "Ecological software engineer", organization_project: "Example Restoration Cooperative", role_summary: "Build accessible public restoration tools with a small cooperative team.",
  role_type: "paid_role", paid_volunteer_status: "paid", location_mode: "remote", location_text: "Remote within North American time zones", time_commitment: "32–40 hours per week", deadline: "2026-10-15",
  compensation_clarity: "Paid · Salary · USD 64,000–82,000 / year", contact_path: "https://jobs.example.org/apply", requirements_skills: "TypeScript, accessibility, and collaborative ecological practice.", safety_notes: "No fee to apply. Never send sensitive documents through public comments.",
  application_status: "open", anti_scam_review_status: "not_reviewed", work_with_link_enabled: false, public_correction_note: null,
  model_version: 2, opportunity_type: "paid_employment", opportunity_details: null, poster_type: "cooperative", organization_website: "https://example.org",
  compensation_status: "paid", compensation_models: ["salary"], compensation_currency: "USD", compensation_min_amount: 64000, compensation_max_amount: 82000, compensation_period: "year", compensation_details: null, benefits_summary: "Health support, flexible scheduling, and professional development.",
  work_arrangement: "remote", time_basis: "full_time", duration_type: "ongoing", experience_level: "entry_early_career",
  application_route_type: "official_application_webpage", application_destination: "https://jobs.example.org/apply", application_instructions: null, testing_privacy_note: null, future_interest_acknowledged: false,
  created_at: "2026-08-08T12:00:00.000Z", updated_at: "2026-08-08T12:00:00.000Z",
};
const futureRolePost = {
  ...publishedPost,
  title: "Community Stewardship Participation & Future Moderator Interest",
  body: `The Elysia Commune should be able to have personality without becoming a mess.

This is the unique public narrative and must remain visible exactly once.

## Opportunity type

Future-role interest / talent pool

## Poster / organization type

Company / business

## Organization website

https://ecosyneva-commons-llc.pages.dev/

## Compensation status

Future compensation not established

## Work arrangement

Remote

## Time basis

Other

## Duration

Other

## Experience / eligibility

Not specified

## Application route

Private Work With flow

## Application destination

/work-with-elysia-ecobotics

## Future-role notice

Confirmed: no current opening, offer, or promise of work.`,
  excerpt: "A public-safe future-role interest notice.",
  tags: ["community-stewardship", "moderation", "community-safety", "privacy", "anti-spam", "anti-scam", "public-commons", "community-participation", "future-moderator"],
  links: labeledLinks,
};
const futureRoleJob = {
  ...v2Job,
  role_title: "Community Stewardship Participant / Future Moderator Interest",
  organization_project: "Elysia Ecobotics Online — The Elysia Commune",
  opportunity_type: "future_role_interest_talent_pool",
  poster_type: "business_company",
  organization_website: "https://ecosyneva-commons-llc.pages.dev/",
  compensation_status: "future_compensation_not_established",
  compensation_models: [],
  compensation_currency: null,
  compensation_min_amount: null,
  compensation_max_amount: null,
  compensation_period: null,
  compensation_details: null,
  compensation_clarity: "Future compensation not established",
  benefits_summary: null,
  work_arrangement: "remote",
  time_basis: "other",
  duration_type: "other",
  experience_level: null,
  deadline: null,
  location_text: "Remote and asynchronous; any future formal opportunity will state its own location requirements.",
  time_commitment: "No current role or required commitment; ordinary stewardship is optional and self-directed.",
  requirements_skills: "Patience, sound judgment, privacy awareness, calm communication, and respect for user dignity.",
  safety_notes: "Ordinary participation grants no moderator authority, private records, credentials, or private-system access.",
  application_route_type: "private_work_with",
  application_destination: "/work-with-elysia-ecobotics",
  contact_path: "/work-with-elysia-ecobotics",
  future_interest_acknowledged: true,
  public_correction_note: "Public clarification: use only the stated Private Work With route.",
};
const legacyJob = {
  id: ids.legacyJob, post_id: ids.legacyPost, thread_id: null, author_user_id: ids.user,
  role_title: "Watershed contract", organization_project: "Legacy Field Group", role_summary: "A pre-v2 contract listing.",
  role_type: "contract", paid_volunteer_status: "must_clarify", location_mode: "unspecified", location_text: "See description", time_commitment: null, deadline: null,
  compensation_clarity: null, contact_path: "Contact the organization", requirements_skills: "Field experience", safety_notes: null,
  application_status: "open", anti_scam_review_status: "not_reviewed", work_with_link_enabled: false, public_correction_note: null,
  model_version: 1, created_at: "2026-07-01T12:00:00.000Z", updated_at: "2026-07-01T12:00:00.000Z",
};
const reviewPost = { ...publishedPost, status: "pending_review", visibility: "private_draft", visibility_state: "draft", moderation_status: "pending_review", published_at: null };
const riskyReviewJob = {
  ...v2Job, poster_type: "business_company", opportunity_type: "internship", compensation_status: "unpaid_volunteer", compensation_models: ["unpaid_volunteer"], compensation_currency: null, compensation_min_amount: null, compensation_max_amount: null, compensation_period: null,
  compensation_clarity: "Unpaid / volunteer · Unpaid / volunteer", paid_volunteer_status: "unpaid",
  organization_website: "https://example.org", application_destination: "https://different.example/apply", contact_path: "https://different.example/apply",
  role_summary: "Act now. Buy equipment with our check. Guaranteed job; WhatsApp only.", requirements_skills: "Send SSN and bank account details.", safety_notes: "Application fee requested.",
};

const contentTypes = new Map([[".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"], [".js", "application/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".png", "image/png"], [".svg", "image/svg+xml"], [".webmanifest", "application/manifest+json"]]);
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const candidate = path.resolve(dist, `.${pathname}`);
    let body = indexHtml;
    let extension = ".html";
    if (candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/") {
      try { const stat = await fs.stat(candidate); if (stat.isFile()) { body = await fs.readFile(candidate); extension = path.extname(candidate); } }
      catch (error) { if (pathname.startsWith("/assets/")) throw error; }
    }
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Security-Policy": csp, "Content-Type": contentTypes.get(extension) ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    response.end(body);
  } catch { response.writeHead(404, { "Content-Type": "text/plain" }); response.end("Not found"); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const jsonHeaders = { "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };

async function installFixtures(context, options = {}) {
  const { admin = false, viewerIsOwner = false, posts = [], jobs = [], review = false, feeRequests = false, captures = { posts: [], jobs: [], reviews: [], comments: [] } } = options;
  let reviewInsert = 0;
  let feeRequest = null;
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: jsonHeaders, body: "" });
    const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
    const fulfill = (body, status = 200) => route.fulfill({ status, headers: jsonHeaders, body: JSON.stringify(body) });
    if (pathname.endsWith("/auth/v1/user")) return fulfill(fixtureUser(admin));
    if (pathname.endsWith("/rest/v1/user_roles")) return fulfill(admin ? [{ role: "administrator", revoked_at: null }] : []);
    if (pathname.endsWith("/rest/v1/profiles")) {
      const row = { username: admin ? "opportunity-admin" : "opportunity-member", display_name: admin ? "Opportunity Admin" : "Opportunity Member", is_admin: admin, commons_onboarding_completed_at: "2026-08-08T12:00:00.000Z" };
      return fulfill(objectResponse ? row : [row]);
    }
    if (pathname.endsWith("/rest/v1/commune_posts")) {
      if (request.method() === "POST") { const value = request.postDataJSON(); captures.posts.push(...(Array.isArray(value) ? value : [value])); return fulfill(objectResponse ? { id: ids.post } : [], 201); }
      return fulfill(posts);
    }
    if (pathname.endsWith("/rest/v1/commune_job_posts")) {
      if (request.method() === "POST") { const value = request.postDataJSON(); captures.jobs.push(...(Array.isArray(value) ? value : [value])); return fulfill(objectResponse ? { id: ids.job } : [], 201); }
      return fulfill(jobs);
    }
    if (pathname.endsWith("/rest/v1/commune_threads")) {
      if (request.method() === "POST") return fulfill(objectResponse ? { id: ids.thread } : [], 201);
      return fulfill(posts.map((post) => ({ id: ids.thread, post_id: post.id, room_id: null, title: post.title, status: "open", visibility: "public", last_reply_at: post.created_at })));
    }
    if (pathname.endsWith("/rest/v1/review_items")) {
      if (request.method() === "POST") { captures.reviews.push(request.postDataJSON()); reviewInsert += 1; return fulfill(objectResponse ? { id: reviewInsert === 1 ? ids.reviewPost : ids.reviewJob } : [], 201); }
      return fulfill(review ? [
        { id: ids.reviewPost, domain: "commune", source_table: "commune_posts", source_id: ids.post, submitted_by: ids.user, status: "pending_review", priority: "normal", title: publishedPost.title, summary: publishedPost.excerpt, submitted_at: "2026-08-08T12:00:00.000Z" },
        { id: ids.reviewJob, domain: "commune", source_table: "commune_job_posts", source_id: ids.job, submitted_by: ids.user, status: "pending_review", priority: "normal", title: publishedPost.title, summary: "Structured opportunity", submitted_at: "2026-08-08T12:00:00.000Z" },
      ] : []);
    }
    if (pathname.endsWith("/rest/v1/review_comments")) {
      if (request.method() === "POST") { captures.comments.push(request.postDataJSON()); return fulfill([], 201); }
      return fulfill(review ? [{ id: "c5000000-0000-4000-8000-000000000001", review_item_id: ids.reviewPost, actor_id: ids.admin, body: "Internal domain mismatch follow-up; do not expose to submitter.", visibility: "internal", created_at: "2026-08-08T12:30:00.000Z" }] : []);
    }
    if (pathname.endsWith("/rest/v1/rpc/resolve_public_commune_attributions")) return fulfill(posts.map((post) => ({ target_type: "post", target_id: post.id, author_handle: "opportunity-member", canonical_profile_url: "https://elysiaecobotics.com/commons-circle/@opportunity-member", viewer_is_owner: viewerIsOwner })));
    if (pathname.endsWith("/rest/v1/rpc/review_commune_job_post")) return fulfill({
      jobPostId: ids.job,
      postId: ids.post,
      action: "approve",
      contentApproved: true,
      contentStatus: "approved",
      economicStatus: "not_assessed",
      publicationStatus: "approved",
      published: false,
      feeEnforcement: false,
    });
    if (feeRequests && pathname.endsWith("/rest/v1/rpc/current_user_job_post_fee_workspace")) return fulfill({ items: captures.jobs.length ? [{ jobPostId: ids.job, postId: captures.jobs[0].post_id, authorUserId: null, title: captures.posts[0].title, classification: "not_assessed", conditionStatus: "not_assessed", contentStatus: "pending_review", request: feeRequest }] : [], canReview: false, canAssess: false, hasMore: false, cursor: null, paymentsCollected: false });
    if (feeRequests && pathname.endsWith("/rest/v1/rpc/submit_job_post_fee_request_command")) {
      const command = request.postDataJSON().p_command;
      assert.equal(command.action, "submit"); assert.equal(command.jobPostId, ids.job); assert.equal(command.expectedRevision, 0);
      captures.feeRequests ||= []; captures.feeRequests.push(command);
      feeRequest = { category: command.category, explanation: command.explanation, status: "submitted", response: "", revision: 1, updatedAt: new Date().toISOString() };
      return fulfill({ jobPostId: ids.job, commandId: command.commandId, revision: 1 });
    }
    if (pathname.includes("/rest/v1/rpc/")) return fulfill(objectResponse ? { id: ids.post } : []);
    if (["POST", "PATCH", "DELETE"].includes(request.method())) return fulfill(objectResponse ? { id: ids.post } : [], 201);
    return fulfill([]);
  });
}

async function contextFor(browser, { admin = false, signedIn = true, viewport = { width: 1440, height: 1000 }, ...fixtures } = {}) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 600,
    acceptDownloads: true,
    deviceScaleFactor: readableEvidenceDir ? 2 : 1,
  });
  if (signedIn) await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${projectRef}-auth-token`, session: fixtureSession(admin) });
  await installFixtures(context, { admin, ...fixtures });
  return context;
}
async function open(page, pathname) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, `${pathname} must load`);
  return errors;
}
async function screenshot(page, name, options = {}) {
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: options.fullPage !== false });
}
async function readableScreenshot(page, folder, name, anchor = null, offset = -150) {
  if (!readableEvidenceDir) return;
  if (anchor) {
    await anchor.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
    await page.evaluate((amount) => window.scrollBy(0, amount), offset);
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(120);
  await page.screenshot({
    path: path.join(readableEvidenceDir, folder, `${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
}
async function readableSelectOptions(page, folder, name, select, width = null) {
  if (!readableEvidenceDir) return;
  await select.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await page.waitForTimeout(120);
  await select.evaluate((element, evidenceWidth) => {
    const rect = element.getBoundingClientRect();
    const listbox = element.cloneNode(true);
    listbox.dataset.evidenceSelectOptions = "true";
    listbox.setAttribute("aria-hidden", "true");
    listbox.setAttribute("inert", "");
    listbox.setAttribute("size", String(element.options.length));
    Object.assign(listbox.style, {
      position: "fixed",
      zIndex: "2147483647",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: evidenceWidth || `${rect.width}px`,
      maxWidth: `calc(100vw - ${Math.max(16, rect.left)}px - 16px)`,
      maxHeight: `${Math.max(240, Math.min(570, window.innerHeight - rect.top - 16))}px`,
      margin: "0",
      boxShadow: "0 18px 48px rgba(0, 0, 0, 0.72)",
    });
    document.body.append(listbox);
  }, width);
  await page.screenshot({
    path: path.join(readableEvidenceDir, folder, `${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
  await page.locator('[data-evidence-select-options="true"]').evaluate((element) => element.remove());
}
async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${label} horizontal overflow: ${overflow}px`);
}
async function measureTagStress(page, caseName) {
  const field = page.locator(".commune-job-tags-field");
  const result = await field.evaluate((element) => {
    const grid = element.parentElement;
    const input = element.querySelector("input");
    const preview = element.querySelector(".commune-job-live-tag-preview");
    const row = preview?.querySelector(".tag-row");
    const chips = [...(row?.querySelectorAll("span") ?? [])];
    const rect = element.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const previewRect = preview?.getBoundingClientRect();
    const chipRects = chips.map((chip) => {
      const chipRect = chip.getBoundingClientRect();
      return { left: chipRect.left, right: chipRect.right, top: chipRect.top, bottom: chipRect.bottom, width: chipRect.width };
    });
    const peerCards = [...(grid?.children ?? [])].slice(0, 2).map((peer) => {
      const peerRect = peer.getBoundingClientRect();
      const peerInputRect = peer.querySelector("input")?.getBoundingClientRect();
      return { height: peerRect.height, inputHeight: peerInputRect?.height ?? 0 };
    });
    return {
      field: { left: rect.left, right: rect.right, width: rect.width, height: rect.height, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth },
      grid: grid ? { clientWidth: grid.clientWidth, scrollWidth: grid.scrollWidth } : null,
      input: inputRect ? { left: inputRect.left, right: inputRect.right, width: inputRect.width } : null,
      preview: preview && previewRect ? { left: previewRect.left, right: previewRect.right, width: previewRect.width, clientWidth: preview.clientWidth, scrollWidth: preview.scrollWidth } : null,
      row: row ? { clientWidth: row.clientWidth, scrollWidth: row.scrollWidth, flexWrap: getComputedStyle(row).flexWrap } : null,
      chips: chipRects,
      peerCards,
      rows: new Set(chipRects.map((chip) => Math.round(chip.top))).size,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert(result.input, `${caseName}: Tags input missing`);
  assert(result.input.left >= result.field.left - 1 && result.input.right <= result.field.right + 1, `${caseName}: Tags input escaped its card`);
  assert(result.field.scrollWidth <= result.field.clientWidth + 1, `${caseName}: Tags card acquired horizontal overflow`);
  assert(!result.grid || result.grid.scrollWidth <= result.grid.clientWidth + 1, `${caseName}: composer grid acquired horizontal overflow`);
  assert(result.peerCards.every((peer) => peer.height < 160 && peer.inputHeight >= 40 && peer.inputHeight <= 60), `${caseName}: Title/Summary stretched with the tag preview`);
  assert(result.documentOverflow <= 1, `${caseName}: page acquired horizontal overflow`);
  if (result.preview) {
    assert.equal(result.row?.flexWrap, "wrap", `${caseName}: preview row must wrap`);
    assert(result.preview.scrollWidth <= result.preview.clientWidth + 1, `${caseName}: preview acquired horizontal overflow`);
    assert((result.row?.scrollWidth ?? 0) <= (result.row?.clientWidth ?? 0) + 1, `${caseName}: tag row acquired horizontal overflow`);
    assert(result.chips.every((chip) => chip.left >= result.field.left - 1 && chip.right <= result.field.right + 1), `${caseName}: a chip escaped the Tags card`);
  }
  return result;
}
const label = (page, name) => page.getByLabel(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));

async function baseComposer(page, opportunityType, compensationStatus) {
  await label(page, "Title").fill("Restoration collaboration opportunity");
  await label(page, "Summary").fill("A clear, public-safe opportunity summary.");
  await label(page, "Role title").fill("Restoration collaborator");
  await label(page, "Organization / project").fill("Example Restoration Cooperative");
  await label(page, "Opportunity type").selectOption(opportunityType);
  await label(page, "Poster / organization type").selectOption("cooperative");
  await label(page, "Organization website").fill("https://example.org");
  await label(page, "Compensation status").selectOption(compensationStatus);
  await label(page, "Work arrangement").selectOption("remote");
  await label(page, "Time basis").selectOption("part_time");
  await label(page, "Duration").selectOption("project_based");
  await label(page, "Application route type").selectOption("official_application_webpage");
  await label(page, "Application destination").fill("https://jobs.example.org/apply");
  await label(page, "Role summary").fill("Work with a cooperative on public restoration tooling and documentation.");
}
async function chooseModel(page, model, amount = "") {
  await page.getByLabel(model, { exact: true }).check();
  if (amount) {
    await label(page, "Currency").fill("USD");
    await label(page, "Amount / minimum").fill(amount);
    await label(page, "Maximum optional").fill(String(Number(amount) + Math.max(5, Number(amount) * 0.2)));
    await label(page, "Amount basis").selectOption(model === "Hourly" ? "hour" : model.includes("project") ? "project" : "year");
  }
}
async function checkAcknowledgements(page) {
  const boxes = page.locator('#commune-post-composer > .commune-checklist input[type="checkbox"]');
  assert((await boxes.count()) >= 2, "independent route and opportunity acknowledgements missing");
  for (let index = 0; index < await boxes.count(); index += 1) await boxes.nth(index).check();
}

async function populateOpportunityCase(page, item) {
  await baseComposer(page, item.opportunity, item.status);
  if (item.model) await chooseModel(page, item.model, item.amount);
  if (item.details) {
    const details = label(page, "Compensation details");
    if (await details.count() === 0) {
      const checkedModels = await page.locator('.job-compensation-models input:checked + span').allTextContents();
      throw new Error(`${item.file}: compensation details did not appear; checked models: ${checkedModels.join(", ") || "none"}`);
    }
    await details.fill(item.details);
  }
  if (item.privacy) await label(page, "Participation and privacy note").fill(item.privacy);
  if (item.future) await page.getByLabel(/I confirm this is an interest or talent-pool notice/).check();
  if (item.other) {
    await label(page, "Explain the opportunity type").fill("A clearly described mutual-aid opportunity outside the standard categories.");
    await label(page, "Application route type").selectOption("other_legitimate");
    await label(page, "Application / contribution instructions").fill("Use the organization's public contact page and reference this listing.");
  }
  if (item.repository) {
    await label(page, "Application route type").selectOption("repository_contribution_instructions");
    await label(page, "Repository / contribution URL").fill("https://github.com/example/restoration/contributing");
    await label(page, "Application / contribution instructions").fill("Read CONTRIBUTING and open a scoped issue before proposing changes.");
  }
}

const browserEngineName = process.env.ELYSIA_BROWSER_ENGINE === "firefox" ? "firefox" : "chromium";
const browserEngine = browserEngineName === "firefox" ? firefox : chromium;
const browser = await browserEngine.launch({ headless: true });
const measurements = {};
try {
  {
    const context = await contextFor(browser, { posts: [publishedPost, legacyPost], jobs: [v2Job, legacyJob] });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post");
    await page.getByRole("heading", { name: /Broad ways to collaborate/ }).waitFor();
    assert.equal(await page.getByText(/Opportunity Commons/i).count(), 0, "Job Post hub must not expose internal redesign terminology");
    await assertNoOverflow(page, "desktop Job Post hub");
    await screenshot(page, "01-job-post-hub");
    await readableScreenshot(page, "desktop", "01-job-post-hub-desktop");
    await readableScreenshot(page, "desktop", "02-job-post-hub-published-items-desktop", page.getByRole("heading", { name: /published items/ }), -300);
    await context.close();
  }
  if (readableEvidenceDir) {
    const context = await contextFor(browser, { posts: [publishedPost, legacyPost], jobs: [v2Job, legacyJob] });
    const page = await context.newPage();
    await open(page, "/commune");
    assert.equal(await page.locator(".page-hero-block").count(), 1, "the Commune landing page must retain its full hero");
    assert.equal(await page.locator(".commune-doctrine-grid").count(), 1, "the Commune landing page must retain its doctrine cards");
    await assertNoOverflow(page, "desktop Commune landing page");
    await readableScreenshot(page, "desktop", "00-commune-landing-full-hero-preserved-desktop");
    await context.close();
  }
  {
    const context = await contextFor(browser);
    const page = await context.newPage();
    const errors = await open(page, "/commune/rooms/job-post/new");
    await page.getByRole("heading", { name: /Create a Job Post post/ }).waitFor();
    assert.equal(await page.locator(".field-error").count(), 0, "clean initial composer must not shout validation errors before interaction");
    const opportunityOptions = await label(page, "Opportunity type").locator("option").allTextContents();
    const compensationOptions = await label(page, "Compensation status").locator("option").allTextContents();
    assert.equal(opportunityOptions.length, 12, "placeholder plus eleven approved opportunity types expected");
    assert.equal(compensationOptions.length, 8, "future-only status must be hidden until future-interest is selected");
    measurements.desktopInitialHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    measurements.desktopInitialControls = await page.locator('#commune-post-composer input:visible, #commune-post-composer select:visible, #commune-post-composer textarea:visible, #commune-post-composer button:visible').count();
    assert(measurements.desktopInitialHeight < 5067, `desktop initial composer should improve on audited 5,067px baseline; got ${measurements.desktopInitialHeight}`);
    const desktopBasicsLayout = await page.locator(".job-opportunity-basics-grid").evaluate((grid) => {
      const labels = [...grid.children].slice(0, 2);
      const cards = labels.map((element) => element.getBoundingClientRect());
      const selects = labels.map((element) => element.querySelector("select").getBoundingClientRect());
      return { cards: cards.map(({ x, y, width, height }) => ({ x, y, width, height })), selects: selects.map(({ y, width, height }) => ({ y, width, height })) };
    });
    assert(Math.abs(desktopBasicsLayout.cards[0].y - desktopBasicsLayout.cards[1].y) <= 1, "Opportunity basics cards must begin at the same desktop y position");
    assert(Math.abs(desktopBasicsLayout.cards[0].width - desktopBasicsLayout.cards[1].width) <= 1, "Opportunity basics cards must have balanced desktop widths");
    assert(Math.abs(desktopBasicsLayout.selects[0].y - desktopBasicsLayout.selects[1].y) <= 1, "Opportunity basics controls must align vertically");
    assert(desktopBasicsLayout.selects.every((item) => item.height >= 40 && item.height <= 56), "closed Opportunity basics selects must retain normal control height");
    const tagsField = page.locator(".commune-job-tags-field");
    assert.equal(await tagsField.locator(".commune-job-live-tag-preview").count(), 0, "empty Job Post tags must not render a junk preview");
    await label(page, "Tags").fill("community stewardship, #moderation, privacy, moderation");
    assert.deepEqual(await tagsField.locator(".tag-row span").allTextContents(), ["#community-stewardship", "#moderation", "#privacy"], "Job Post live tags must use canonical ordered, deduplicated normalization");
    assert.equal(await page.locator("#commune-post-composer .tag-row").count(), 1, "Job Post composer must render exactly one live tag preview");
    assert(await tagsField.evaluate((field) => Boolean(field.querySelector("input") && field.querySelector(".commune-job-live-tag-preview"))), "live tag preview must be attached to the Tags field");
    await label(page, "Tags").evaluate((input) => {
      input.blur();
      input.scrollLeft = 0;
    });
    await assertNoOverflow(page, "desktop initial composer");
    await screenshot(page, "02-clean-initial-composer");
    await readableScreenshot(page, "desktop", "03-clean-initial-composer-desktop-top", page.getByRole("heading", { name: /Create a Job Post post/ }), -170);
    await readableScreenshot(page, "desktop", "04-clean-initial-composer-desktop-middle", label(page, "Opportunity type"), -310);
    await readableScreenshot(page, "desktop", "31-opportunity-basics-closed-desktop", page.locator(".job-opportunity-basics"), -180);
    await readableScreenshot(page, "desktop", "05-clean-initial-composer-desktop-bottom", page.getByRole("button", { name: "Submit for moderation" }), -120);
    await readableScreenshot(page, "desktop", "36-job-tags-live-preview-desktop", tagsField, -260);
    await label(page, "Opportunity type").focus();
    await screenshot(page, "03-opportunity-type-dropdown", { fullPage: false });
    await readableSelectOptions(page, "desktop", "06-opportunity-type-options-desktop", label(page, "Opportunity type"));
    await readableSelectOptions(page, "desktop", "32-opportunity-type-open-desktop", label(page, "Opportunity type"));
    await readableSelectOptions(page, "desktop", "33-poster-organization-type-open-desktop", label(page, "Poster / organization type"));
    await label(page, "Opportunity type").selectOption("paid_employment");
    await readableScreenshot(page, "desktop", "37-job-post-publication-warning-desktop", page.getByText(/^Job Post is a moderated public listing board/), -260);
    await label(page, "Compensation status").focus();
    await screenshot(page, "04-compensation-status-dropdown", { fullPage: false });
    await readableSelectOptions(page, "desktop", "07-compensation-status-options-desktop", label(page, "Compensation status"));
    await label(page, "Tags").fill("");
    assert.equal(await tagsField.locator(".commune-job-live-tag-preview").count(), 0, "clearing Job Post tags must remove the live preview");
    assert.deepEqual(errors, []);
    await context.close();
  }

  measurements.tagStress = {};
  for (const viewportCase of [
    { folder: "desktop", width: 1440, height: 1000, screenshots: new Map([["3-ordinary", "42-tag-stress-3-desktop"], ["8-ordinary", "43-tag-stress-8-desktop"], ["12-mixed", "44-tag-stress-12-mixed-desktop"], ["long-valid", "45-tag-stress-long-desktop"]]) },
    { folder: "tablet", width: 900, height: 1000, screenshots: new Map([["12-mixed", "01-tag-stress-12-mixed-tablet"], ["long-valid", "02-tag-stress-long-tablet"]]) },
    { folder: "mobile", width: 390, height: 844, screenshots: new Map([["3-ordinary", "21-tag-stress-3-mobile"], ["8-ordinary", "22-tag-stress-8-mobile"], ["long-valid", "23-tag-stress-long-mobile"]]) },
  ]) {
    const context = await contextFor(browser, { viewport: { width: viewportCase.width, height: viewportCase.height } });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    const tagsInput = label(page, "Tags");
    const tagField = page.locator(".commune-job-tags-field");
    const baselineWidth = (await tagField.boundingBox())?.width ?? 0;
    const caseMeasurements = {};
    for (const item of tagStressCases) {
      await tagsInput.fill(item.value);
      const chips = tagField.locator(".tag-row span");
      assert.equal(await chips.count(), item.count, `${viewportCase.folder}/${item.id}: canonical parser count changed`);
      assert.equal(await page.locator("#commune-post-composer .tag-row").count(), item.count ? 1 : 0, `${viewportCase.folder}/${item.id}: exactly one non-empty composer preview expected`);
      await tagsInput.evaluate((input) => {
        input.blur();
        input.scrollLeft = 0;
      });
      const layout = await measureTagStress(page, `${viewportCase.folder}/${item.id}`);
      assert(Math.abs(layout.field.width - baselineWidth) <= 1, `${viewportCase.folder}/${item.id}: Tags card width changed with tag count`);
      if (item.count >= 8) assert(layout.rows >= 2, `${viewportCase.folder}/${item.id}: many tags should wrap onto additional rows`);
      caseMeasurements[item.id] = layout;
      const screenshotName = viewportCase.screenshots.get(item.id);
      if (screenshotName) {
        const offset = item.id === "12-mixed" && viewportCase.folder !== "mobile" ? 100 : viewportCase.folder === "mobile" ? -120 : -240;
        await readableScreenshot(page, viewportCase.folder, screenshotName, tagField, offset);
      }
    }
    assert(caseMeasurements["12-mixed"].field.height > caseMeasurements["3-ordinary"].field.height, `${viewportCase.folder}: many tags should grow the card downward`);
    if (viewportCase.folder === "desktop") {
      assert(caseMeasurements["3-ordinary"].field.width >= 700, `wide desktop Tags region should use the available row; got ${caseMeasurements["3-ordinary"].field.width}px`);
      assert(caseMeasurements["3-ordinary"].rows <= 2, "three ordinary tags should flow horizontally on wide desktop");
      assert(caseMeasurements["12-mixed"].rows <= 4, "twelve mixed tags should remain a compact wrapped cluster on wide desktop");
    }
    if (viewportCase.folder === "tablet") assert(caseMeasurements["3-ordinary"].field.width < 400, "half-screen Tags should preserve the compact grid track");
    measurements.tagStress[viewportCase.folder] = caseMeasurements;
    await context.close();
  }

  const cases = [
    { file: "05-paid-employment", opportunity: "paid_employment", status: "paid", model: "Salary", amount: "64000" },
    { file: "06-contract-freelance", opportunity: "contract_freelance", status: "paid", model: "Fixed project fee", amount: "12000" },
    { file: "07-internship", opportunity: "internship", status: "academic_credit_only", details: "Academic credit through the participant's approved institution." },
    { file: "08-fellowship-funded-placement", opportunity: "fellowship_funded_placement", status: "stipend_funded", model: "Stipend", amount: "24000" },
    { file: "09-research-opportunity", opportunity: "research_opportunity", status: "stipend_funded", model: "Fellowship funding", amount: "36000" },
    { file: "10-volunteer-community", opportunity: "volunteer_community_service", status: "unpaid_volunteer" },
    { file: "11-open-source-contribution", opportunity: "community_open_source_contribution", status: "unpaid_volunteer", repository: true },
    { file: "12-testing-feedback", opportunity: "testing_feedback_call", status: "paid", model: "Honorarium", amount: "150", details: "A fixed honorarium after completing the feedback session.", privacy: "Participants share task feedback and optional accessibility observations; no credentials or sensitive identifiers are collected." },
    { file: "13-future-role-interest", opportunity: "future_role_interest_talent_pool", status: "future_compensation_not_established", future: true },
    { file: "14-other-opportunity", opportunity: "other", status: "other", details: "Compensation consists of a clearly described nonstandard exchange.", other: true },
  ];
  for (const item of cases) {
    const context = await contextFor(browser);
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await populateOpportunityCase(page, item);
    if (item.file === "05-paid-employment") {
      await label(page, "Benefits / additional support").fill("Health support, flexible scheduling, and professional development.");
      measurements.desktopExpandedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    }
    await assertNoOverflow(page, item.file);
    await screenshot(page, item.file);
    const readableNames = {
      "05-paid-employment": "08-paid-employment-desktop",
      "06-contract-freelance": "09-contract-freelance-desktop",
      "07-internship": "10-internship-desktop",
      "08-fellowship-funded-placement": "11-fellowship-funded-placement-desktop",
      "09-research-opportunity": "12-research-opportunity-desktop",
      "10-volunteer-community": "13-volunteer-community-desktop",
      "11-open-source-contribution": "14-open-source-contribution-desktop",
      "12-testing-feedback": "15-testing-feedback-desktop-compensation",
      "13-future-role-interest": "17-future-role-interest-desktop",
      "14-other-opportunity": "18-other-opportunity-desktop",
    };
    await readableScreenshot(page, "desktop", readableNames[item.file], label(page, "Compensation status"), -280);
    if (item.model || ["academic_credit_only", "unpaid_volunteer", "other"].includes(item.status)) {
      await readableScreenshot(page, "desktop", `${readableNames[item.file]}-conditional-fields`, page.locator(".job-compensation-models"), -80);
    }
    if (item.repository) await readableScreenshot(page, "desktop", "14b-open-source-contribution-desktop-application", label(page, "Repository / contribution URL"), -260);
    if (item.privacy) await readableScreenshot(page, "desktop", "16-testing-feedback-desktop-privacy", label(page, "Participation and privacy note"), -430);
    if (item.future) await readableScreenshot(page, "desktop", "17b-future-role-interest-desktop-acknowledgement", page.getByLabel(/I confirm this is an interest or talent-pool notice/), -300);
    if (item.other) await readableScreenshot(page, "desktop", "18b-other-opportunity-desktop-explanation", label(page, "Explain the opportunity type"), -260);
    await context.close();
  }

  if (readableEvidenceDir) {
    const mobileCases = cases.filter((item) => [
      "05-paid-employment", "10-volunteer-community", "12-testing-feedback", "13-future-role-interest",
    ].includes(item.file));
    for (const item of mobileCases) {
      const context = await contextFor(browser, { viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await open(page, "/commune/rooms/job-post/new");
      await populateOpportunityCase(page, item);
      await assertNoOverflow(page, `mobile ${item.file}`);
      const mobileNames = {
        "05-paid-employment": "04-paid-employment-mobile-compensation",
        "10-volunteer-community": "06-volunteer-community-mobile",
        "12-testing-feedback": "07-testing-feedback-mobile-compensation",
        "13-future-role-interest": "09-future-role-interest-mobile",
      };
      await readableScreenshot(page, "mobile", mobileNames[item.file], label(page, "Compensation status"), -100);
      if (item.model) await readableScreenshot(page, "mobile", `${mobileNames[item.file]}-conditional-fields`, page.locator(".job-compensation-models"), -40);
      if (item.file === "05-paid-employment") await readableScreenshot(page, "mobile", "05-paid-employment-mobile-application", label(page, "Application route type"), -220);
      if (item.privacy) {
        const privacyNote = label(page, "Participation and privacy note");
        await privacyNote.evaluate((element) => {
          element.blur();
          element.scrollTop = 0;
          element.style.height = `${element.scrollHeight}px`;
        });
        await readableScreenshot(page, "mobile", "08-testing-feedback-mobile-privacy", privacyNote, -220);
      }
      if (item.future) await readableScreenshot(page, "mobile", "09b-future-role-interest-mobile-acknowledgement", page.getByLabel(/I confirm this is an interest or talent-pool notice/), -120);
      await context.close();
    }
  }

  {
    const context = await contextFor(browser);
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "community_open_source_contribution", "unpaid_volunteer");
    const routeOptions = await label(page, "Application route type").locator("option").allTextContents();
    assert(!routeOptions.includes("Private Work With flow"), "ordinary users must not be offered first-party private Work With");
    assert.deepEqual(routeOptions, ["Choose route", "Official application webpage", "Organization contact", "Repository / contribution instructions", "Other legitimate route"]);
    const applicationRouteLayout = await label(page, "Application route type").locator("..").evaluate((field) => {
      const fieldRect = field.getBoundingClientRect();
      const selectRect = field.querySelector("select").getBoundingClientRect();
      const gridRect = field.parentElement.getBoundingClientRect();
      return { fieldWidth: fieldRect.width, selectWidth: selectRect.width, gridWidth: gridRect.width };
    });
    assert(applicationRouteLayout.fieldWidth >= 700, `desktop Application route type should be meaningfully wide; got ${applicationRouteLayout.fieldWidth}px`);
    assert(applicationRouteLayout.fieldWidth <= applicationRouteLayout.gridWidth + 1, "Application route type must remain inside its grid");
    assert(Math.abs(applicationRouteLayout.fieldWidth - applicationRouteLayout.selectWidth) <= 30, "Application route select should fit its field container");
    await screenshot(page, "15-application-route-choices");
    await readableScreenshot(page, "desktop", "34-application-route-closed-desktop", label(page, "Application route type"), -280);
    await readableSelectOptions(page, "desktop", "19-application-route-options-desktop", label(page, "Application route type"), "680px");
    await readableSelectOptions(page, "desktop", "35-application-route-type-open-desktop", label(page, "Application route type"), "680px");
    await context.close();
  }
  {
    const captures = { posts: [], jobs: [], reviews: [], comments: [] };
    const context = await contextFor(browser, { admin: true, captures });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "future_role_interest_talent_pool", "future_compensation_not_established");
    await label(page, "Poster / organization type").selectOption("business_company");
    await label(page, "Organization / project").fill("EcoSyneva Commons LLC — Elysia Ecobotics Online");
    await label(page, "Time basis").selectOption("other");
    await label(page, "Duration").selectOption("other");
    await label(page, "Experience / eligibility").selectOption("");
    await label(page, "Application route type").selectOption("private_work_with");
    await page.getByLabel(/I confirm this is an interest or talent-pool notice/).check();
    assert.equal(await label(page, "Private Work With route").inputValue(), "/work-with-elysia-ecobotics", "admin private route must be canonical and read-only");
    assert(await page.getByText(/Selecting Private Work With declares/).count(), "admin must see the explicit first-party provenance boundary");
    await checkAcknowledgements(page);
    await page.getByRole("button", { name: "Submit through governed review" }).click();
    for (let attempt = 0; attempt < 100 && captures.jobs.length === 0; attempt += 1) await page.waitForTimeout(50);
    assert.equal(captures.jobs.length, 1, "authorized administrator private Work With listing must reach the structured request flow");
    assert.equal(captures.jobs[0].application_route_type, "private_work_with");
    assert.equal(captures.jobs[0].application_destination, "/work-with-elysia-ecobotics");
    assert.equal(captures.posts[0].status, "pending_review", "administrator must not bypass governed Job Post subject state");
    assert(!/Private Work With is reserved/.test(await page.locator(".message").innerText()), "authorized administrator must not receive the false Work With denial");
    await readableScreenshot(
      page,
      "desktop",
      "38-admin-private-work-with-accepted-desktop",
      page.getByText(/Selecting Private Work With declares/),
      -420,
    );
    await context.close();
  }
  {
    const captures = { posts: [], jobs: [], reviews: [], comments: [] };
    const context = await contextFor(browser, { captures });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "paid_employment", "paid");
    await chooseModel(page, "Salary", "64000");
    const routeSelect = label(page, "Application route type");
    await routeSelect.evaluate((element) => {
      const option = document.createElement("option");
      option.value = "private_work_with";
      option.textContent = "Private Work With flow";
      element.append(option);
      element.value = option.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await checkAcknowledgements(page);
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    await page.getByText(/Private Work With is reserved for authorized/).waitFor();
    assert.equal(captures.posts.length, 0, "manipulated ordinary-user Work With state must fail before any write");
    assert.equal(captures.jobs.length, 0, "manipulated ordinary-user Work With state must not create a sidecar");
    await readableScreenshot(page, "desktop", "39-unauthorized-private-work-with-rejected-desktop", routeSelect, -310);
    await context.close();
  }
  {
    const context = await contextFor(browser);
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "paid_employment", "paid");
    await chooseModel(page, "Hourly", "32");
    await label(page, "Maximum optional").fill("46");
    await label(page, "Amount basis").selectOption("hour");
    await screenshot(page, "16-compensation-range-model");
    await readableScreenshot(page, "desktop", "20-compensation-range-model-desktop", page.locator(".job-compensation-models"), -80);
    await context.close();
  }
  {
    const context = await contextFor(browser, { viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    measurements.mobileInitialHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    assert(measurements.mobileInitialHeight < 8693, `mobile initial composer should improve on audited 8,693px baseline; got ${measurements.mobileInitialHeight}`);
    await assertNoOverflow(page, "mobile initial composer");
    const mobileBasicsLayout = await page.locator(".job-opportunity-basics-grid").evaluate((grid) => {
      const gridRect = grid.getBoundingClientRect();
      const labels = [...grid.children].slice(0, 2).map((element) => element.getBoundingClientRect());
      return { gridWidth: gridRect.width, labels: labels.map(({ x, y, width }) => ({ x, y, width })) };
    });
    assert(mobileBasicsLayout.labels[1].y > mobileBasicsLayout.labels[0].y, "Opportunity basics must stack on mobile");
    assert(mobileBasicsLayout.labels.every((item) => Math.abs(item.width - mobileBasicsLayout.gridWidth) <= 1), "Opportunity basics fields must use the mobile width cleanly");
    await screenshot(page, "17-mobile-progressive-disclosure");
    await readableScreenshot(page, "mobile", "01-clean-initial-composer-mobile-top", page.getByRole("heading", { name: /Create a Job Post post/ }), -100);
    await readableScreenshot(page, "mobile", "02-clean-initial-composer-mobile-middle", label(page, "Opportunity type"), -100);
    await readableScreenshot(page, "mobile", "18-opportunity-basics-closed-mobile", page.locator(".job-opportunity-basics"), -70);
    await readableScreenshot(page, "mobile", "03-clean-initial-composer-mobile-bottom", page.getByRole("button", { name: "Submit for moderation" }), -80);
    await label(page, "Tags").fill("community stewardship, moderation, privacy");
    assert.deepEqual(await page.locator(".commune-job-tags-field .tag-row span").allTextContents(), ["#community-stewardship", "#moderation", "#privacy"]);
    assert.equal(await page.locator("#commune-post-composer .tag-row").count(), 1, "mobile Job Post composer must render one adjacent tag preview");
    await label(page, "Tags").evaluate((input) => {
      input.blur();
      input.scrollLeft = 0;
    });
    await readableScreenshot(page, "mobile", "20-job-tags-live-preview-mobile", page.locator(".commune-job-tags-field"), -120);
    await assertNoOverflow(page, "mobile Job Post live tags");
    await context.close();
  }
  if (readableEvidenceDir) {
    const context = await contextFor(browser, { viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "community_open_source_contribution", "unpaid_volunteer");
    const mobileRouteWidths = await label(page, "Application route type").locator("..").evaluate((field) => {
      const fieldRect = field.getBoundingClientRect();
      const gridRect = field.parentElement.getBoundingClientRect();
      return { fieldWidth: fieldRect.width, gridWidth: gridRect.width };
    });
    assert(Math.abs(mobileRouteWidths.fieldWidth - mobileRouteWidths.gridWidth) <= 1, "Application route type must use the available mobile grid width");
    await assertNoOverflow(page, "mobile Application route layout");
    await readableScreenshot(page, "mobile", "19-application-route-closed-mobile", label(page, "Application route type"), -160);
    await context.close();
  }
  {
    const context = await contextFor(browser);
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    const acknowledgementBoxes = page.locator('#commune-post-composer > .commune-checklist input[type="checkbox"]');
    assert.equal(await acknowledgementBoxes.count(), 5, "four public-sharing acknowledgements plus one opportunity-truth acknowledgement expected");
    await acknowledgementBoxes.first().check();
    assert.equal(await page.locator('#commune-post-composer > .commune-checklist input[type="checkbox"]:checked').count(), 1, "checking one acknowledgement must not check semantically separate acknowledgements");
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    assert((await page.locator(".field-error").count()) >= 7, "attempted submission should expose actionable structured validation errors");
    await screenshot(page, "18-validation-errors");
    await readableScreenshot(page, "desktop", "21-validation-errors-desktop", label(page, "Opportunity type"), -350);
    await context.close();
  }
  if (readableEvidenceDir) {
    const context = await contextFor(browser, { viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    await readableScreenshot(page, "mobile", "10-validation-errors-mobile", label(page, "Opportunity type"), -220);
    await assertNoOverflow(page, "mobile validation errors");
    await context.close();
  }
  {
    const captures = { posts: [], jobs: [], reviews: [], comments: [] };
    const context = await contextFor(browser, { captures, feeRequests: true });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "paid_employment", "paid");
    await chooseModel(page, "Salary", "64000");
    await label(page, "Maximum optional").fill("82000");
    await label(page, "Tags").fill("community stewardship, moderation, privacy");
    const linksBox = page.getByRole("textbox", { name: "Links", exact: true });
    await linksBox.fill(links[0]); await linksBox.press("Enter"); await linksBox.type(links[1]); await linksBox.press("Shift+Enter"); await linksBox.type(links[2]);
    const title = label(page, "Title");
    await title.press("Enter");
    assert.equal(captures.posts.length, 0, "Enter in a single-line field must not submit");
    await checkAcknowledgements(page);
    await page.getByRole("button", { name: "Save local draft" }).click();
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("commune.postDrafts.v1") ?? "[]")[0]);
    assert.equal(draft.schemaVersion, "job_opportunity.v2");
    assert.equal(draft.jobOpportunity.opportunityType, "paid_employment");
    assert.deepEqual(draft.jobOpportunity.compensationModels, ["salary"]);
    assert.equal(draft.tags, "#community-stewardship, #moderation, #privacy", "local draft tags must retain canonical semantics after preview placement changes");
    assert.equal(draft.sourceLinks, links.join("\n"));
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Markdown" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    assert(downloadPath);
    const markdown = await fs.readFile(downloadPath, "utf8");
    assert(markdown.includes("## Opportunity type\nPaid employment") && markdown.includes("## Compensation status\nPaid"), "Markdown export must carry v2 structured representation");
    assert(markdown.includes("#community-stewardship, #moderation, #privacy"), "Markdown export tags must remain unchanged");
    await screenshot(page, "19-draft-export-representation");
    await readableScreenshot(page, "desktop", "40-lower-composer-without-duplicate-tags-desktop", page.locator("#commune-post-composer > .commune-checklist"), -360);
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    for (let attempt = 0; attempt < 100 && captures.jobs.length === 0; attempt += 1) await page.waitForTimeout(50);
    for (let attempt = 0; attempt < 100 && captures.reviews.length < 2; attempt += 1) await page.waitForTimeout(50);
    assert.equal(captures.posts.length, 1, "intended action must create one generic post payload");
    assert.deepEqual(captures.posts[0].links, links, "multiline Links must survive complete v2 request flow in order");
    assert.equal(captures.jobs.length, 1, "structured Job sidecar payload missing");
    assert.equal(captures.jobs[0].model_version, 2);
    assert.equal(captures.jobs[0].opportunity_type, "paid_employment");
    assert.deepEqual(captures.jobs[0].compensation_models, ["salary"]);
    assert.equal(captures.jobs[0].role_type, "paid_role", "new v2 writes must retain deterministic legacy compatibility");
    assert.equal(captures.jobs[0].private_application_note, undefined, "public-row pseudo-private note must never be written");
    assert.equal(captures.reviews.length, 2, "existing two-record review history must remain intact underneath the joined presentation");
    await page.getByRole("heading", { name: "Job Post saved", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Submit for moderation", exact: true }).count(), 0, "a saved opportunity must not offer duplicate creation");
    await page.getByText("Request a fee waiver or assistance", { exact: true }).click();
    await page.getByLabel("Short explanation", { exact: true }).fill("PRIVATE synthetic assistance after saving the opportunity.");
    await page.getByRole("button", { name: "Send private request", exact: true }).click();
    await page.getByText("submitted", { exact: true }).waitFor();
    assert.equal(captures.feeRequests.length, 1, "private request must reference the saved structured Job Post");
    assert(!JSON.stringify([captures.posts, captures.jobs, captures.reviews]).includes("PRIVATE synthetic assistance"), "private assistance leaked into public content or moderation");
    assert(!await page.evaluate(() => JSON.stringify(localStorage).includes("PRIVATE synthetic assistance")), "private request leaked into local drafts");
    const submittedExport = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export submitted draft", exact: true }).click();
    const exportPath = await (await submittedExport).path();
    assert(exportPath); assert(!(await fs.readFile(exportPath, "utf8")).includes("PRIVATE synthetic assistance"), "private assistance leaked into exported public draft");
    await screenshot(page, "20-saved-opportunity-private-assistance");

    await context.close();
  }
  {
    const context = await contextFor(browser, { admin: true, posts: [reviewPost], jobs: [riskyReviewJob], review: true });
    const page = await context.newPage();
    await open(page, "/admin/review/commune");
    await page.getByText("Joined Job Post case", { exact: true }).waitFor({ timeout: 30_000 });
    assert.equal(await page.locator(".review-list-item").filter({ hasText: /joined opportunity case/ }).count(), 1, "generic and sidecar review records must collapse into one visible case");
    assert(await page.getByText(/applicant payment request/i).count(), "advisory high-risk payment signal missing");
    assert(await page.getByText(/sensitive information request/i).count(), "advisory sensitive-information signal missing");
    assert(await page.getByText(/Internal domain mismatch follow-up/).count(), "protected internal reviewer note missing");
    await screenshot(page, "20-reviewer-joined-case");
    await readableScreenshot(page, "desktop", "22-reviewer-joined-case-desktop", page.getByText("Joined Job Post case", { exact: true }), -320);
    await readableScreenshot(page, "desktop", "22b-reviewer-structured-metadata-desktop", page.locator(".admin-job-opportunity-case .mini-facts"), -250);
    await page.locator(".admin-job-risk-flags").scrollIntoViewIfNeeded();
    await screenshot(page, "21-reviewer-advisory-flags");
    await readableScreenshot(page, "desktop", "23-reviewer-advisory-flags-desktop", page.locator(".admin-job-risk-flags"), -330);
    await context.close();
  }
  if (readableEvidenceDir) {
    const context = await contextFor(browser, { admin: true, posts: [reviewPost], jobs: [riskyReviewJob], review: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, "/admin/review/commune");
    await page.getByText("Joined Job Post case", { exact: true }).waitFor({ timeout: 30_000 });
    await assertNoOverflow(page, "mobile joined reviewer case");
    await readableScreenshot(page, "mobile", "11-reviewer-joined-case-mobile", page.getByText("Joined Job Post case", { exact: true }), -220);
    await readableScreenshot(page, "mobile", "11b-reviewer-structured-metadata-mobile", page.locator(".admin-job-opportunity-case .mini-facts"), -100);
    await readableScreenshot(page, "mobile", "12-reviewer-advisory-flags-mobile", page.locator(".admin-job-risk-flags"), -400);
    await context.close();
  }
  {
    const context = await contextFor(browser, { posts: [publishedPost, legacyPost], jobs: [v2Job, legacyJob] });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/posts");
    await page.getByRole("heading", { name: "Ecological software engineer" }).waitFor();
    assert(await page.getByText("Paid employment", { exact: true }).count(), "compact v2 opportunity badge missing");
    assert.equal(await page.locator('.commune-job-discovery-filters select').count(), 3, "only the approved three public filters may be present");
    await screenshot(page, "22-public-job-card");
    await readableScreenshot(page, "desktop", "24-public-job-card-desktop", page.locator(".commune-post-card").filter({ hasText: "Ecological software engineer" }).first(), -100);
    await label(page, "Opportunity type").selectOption("paid_employment");
    assert.equal(await page.getByRole("heading", { name: "Legacy watershed contract" }).count(), 0, "opportunity filter should exclude unrelated/ambiguous legacy row");
    await screenshot(page, "25-job-post-filters");
    await readableScreenshot(page, "desktop", "28-job-post-filters-desktop", label(page, "Opportunity type"), -350);
    await context.close();
  }
  if (readableEvidenceDir) {
    const context = await contextFor(browser, { posts: [publishedPost, legacyPost], jobs: [v2Job, legacyJob], viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/posts");
    await page.getByRole("heading", { name: "Ecological software engineer" }).waitFor();
    await assertNoOverflow(page, "mobile public filters");
    await readableScreenshot(page, "mobile", "17-job-post-filters-mobile", label(page, "Opportunity type"), -230);
    await readableScreenshot(page, "mobile", "17b-job-post-filters-mobile-continuation", label(page, "Work arrangement"), -230);
    await context.close();
  }
  {
    const context = await contextFor(browser, { posts: [futureRolePost], jobs: [futureRoleJob] });
    const page = await context.newPage();
    await open(page, `/commune/posts/${ids.post}`);
    await page.getByRole("heading", { level: 2, name: futureRolePost.title }).waitFor();
    assert.equal(await page.locator(".page-hero-block").count(), 0, "individual post detail must not repeat the full Commune landing hero");
    assert.equal(await page.locator(".commune-doctrine-grid").count(), 0, "individual post detail must not repeat the landing doctrine grid");
    assert.equal(await page.locator(".commune-status-card").count(), 0, "individual post detail must not prepend the generic account-mode panel");
    assert.equal(await page.locator(".commune-post-context-header").count(), 1, "individual post detail needs one compact Commune context header");
    const detailTop = await page.getByRole("heading", { level: 2, name: futureRolePost.title }).evaluate((element) => element.getBoundingClientRect().top);
    assert(detailTop < 750, `published post should begin in the first desktop viewport; got ${detailTop}px`);
    assert.equal(await page.getByRole("heading", { level: 3, name: "Time basis" }).count(), 0, "future-interest detail should omit meaningless Other time basis");
    assert.equal(await page.getByRole("heading", { level: 3, name: "Duration" }).count(), 0, "future-interest detail should omit meaningless Other duration");
    assert.equal(await page.getByRole("heading", { level: 3, name: "Application route" }).count(), 1, "application route must have one authoritative public presentation");
    assert.equal(await page.getByText("Private Work With Elysia Ecobotics", { exact: true }).count(), 1, "public Private Work With label must be reader-facing");
    assert.equal(await page.getByRole("link", { name: "Open Work With Elysia Ecobotics" }).getAttribute("href"), "/work-with-elysia-ecobotics", "first-party route must remain canonical");
    assert.equal(await page.getByText("Confirmed: no current opening, offer, or promise of work.", { exact: true }).count(), 1, "future-role notice must remain concise and unique");
    assert.equal(await page.getByText("This is the unique public narrative and must remain visible exactly once.", { exact: true }).count(), 1, "unique authored body content must survive v2 metadata suppression");
    const postBodyText = await page.locator(".commune-post-body").innerText();
    for (const duplicate of ["Opportunity type", "Compensation status", "Application destination", "Future-role notice"]) assert(!postBodyText.includes(duplicate), `${duplicate} leaked into the generic body dump`);
    assert.equal(await page.locator(".commune-job-facts-grid").count(), 1, "compact opportunity facts grid missing");
    assert.equal(await page.locator(".commune-job-narrative-grid").count(), 1, "wide opportunity narrative grid missing");
    const detailLayout = await page.locator(".commune-job-native-details").evaluate((root) => {
      const facts = [...root.querySelectorAll(".commune-job-facts-grid > article")].map((element) => element.getBoundingClientRect());
      const narrative = [...root.querySelectorAll(".commune-job-narrative-grid > article")].map((element) => element.getBoundingClientRect());
      return {
        facts: facts.map(({ width, height }) => ({ width, height })),
        narrative: narrative.map(({ width, height }) => ({ width, height })),
        overflow: root.scrollWidth - root.clientWidth,
      };
    });
    assert(detailLayout.overflow <= 1, "structured opportunity detail acquired horizontal overflow");
    assert(detailLayout.facts.every((item) => item.height < 180), "compact fact cards inherited a long prose-card height");
    assert(detailLayout.narrative.every((item) => item.width >= 500), "long narrative cards should receive wide desktop columns");
    assert.equal(await page.locator(".commune-job-review-controls").count(), 0, "ordinary member must not receive Job Post operator controls");
    assert.equal(await page.locator("#posting-fees").count(), 0, "non-owner member must not receive owner economic UI");
    assert.equal(await page.getByText("Public clarification: use only the stated Private Work With route.", { exact: true }).count(), 1, "ordinary members must retain public read access to the author's public-safe clarification");
    assert.equal(await page.getByLabel(/^Public correction \/ clarification note/).count(), 0, "ordinary members must not receive another author's correction editor");
    const linkItems = page.locator('[aria-label="Links"] li');
    assert.deepEqual(await linkItems.allTextContents().then((values) => values.map((value) => value.trim())), ["The Elysia Commune", "Community Guidelines", "Work With Elysia Ecobotics", "Unsafe example | javascript:alert(1)"]);
    assert.equal(await linkItems.nth(0).locator("a").getAttribute("href"), "https://elysiaecobotics.com/commune", "labeled link destination changed");
    assert.equal(await linkItems.nth(1).locator("a").getAttribute("href"), "https://elysiaecobotics.com/legal/community-guidelines", "Community Guidelines must use its canonical same-origin route");
    assert.equal(await linkItems.nth(2).locator("a").getAttribute("href"), "https://elysiaecobotics.com/work-with-elysia-ecobotics", "Work With must use its canonical same-origin route");
    assert.equal(await linkItems.nth(3).locator("a").count(), 0, "unsafe labeled link must remain inert text");
    assert.equal(await page.getByRole("link", { name: "https://ecosyneva-commons-llc.pages.dev/" }).getAttribute("href"), "https://ecosyneva-commons-llc.pages.dev/", "current authoritative EcoSyneva website should render as a safe link");
    assert.deepEqual(await page.locator(".commune-post-detail .tag-row span").allTextContents(), futureRolePost.tags.map((tag) => `#${tag}`), "published Job Post tags must remain in the post-detail location");
    await screenshot(page, "23-public-job-detail");
    await readableScreenshot(page, "desktop", "25-public-job-detail-desktop-top", page.locator(".commune-post-context-header"), -120);
    await readableScreenshot(page, "desktop", "26-public-job-detail-desktop-metadata", page.locator(".commune-job-facts-grid"), -220);
    await readableScreenshot(page, "desktop", "26b-public-job-detail-desktop-long-form", page.locator(".commune-job-narrative-grid"), -220);
    await readableScreenshot(page, "desktop", "26c-public-job-detail-desktop-application", page.locator(".commune-job-application-route"), -260);
    await readableScreenshot(page, "desktop", "26d-public-job-detail-desktop-labeled-links", page.locator('[aria-label="Links"]'), -260);
    await readableScreenshot(page, "desktop", "26e-public-job-detail-authored-body-no-duplicates", page.locator(".commune-post-body"), -260);
    await page.getByText(/Publication is not endorsement or verification/).scrollIntoViewIfNeeded();
    await screenshot(page, "24-publication-not-verification");
    await readableScreenshot(page, "desktop", "27-publication-not-verification-desktop", page.getByText(/Publication is not endorsement or verification/), 0);
    await readableScreenshot(page, "desktop", "41-published-job-post-tags-desktop", page.locator(".commune-post-detail .tag-row"), -300);
    await readableScreenshot(page, "desktop", "46-member-public-detail-no-operator-controls", page.locator(".commune-job-application-route"), -250);
    await readableScreenshot(page, "desktop", "46b-member-public-detail-lower-read-only", page.getByText("Public application privacy", { exact: true }), 260);
    assert.equal(await page.getByText(/Opportunity Commons/i).count(), 0, "public Job Post detail must not expose internal redesign terminology");
    await context.close();
  }
  {
    const context = await contextFor(browser, { admin: true, posts: [futureRolePost], jobs: [futureRoleJob] });
    const page = await context.newPage();
    await open(page, `/commune/posts/${ids.post}`);
    await page.locator(".commune-job-review-controls").waitFor();
    assert.equal(await page.getByLabel(/^Anti-scam review/).count(), 1, "reviewer/admin must retain anti-scam controls");
    assert.equal(await page.getByLabel(/^Application status/).count(), 1, "reviewer/admin must retain listing-status controls");
    assert.equal(await page.getByLabel(/^Public correction \/ clarification note/).count(), 1, "reviewer/admin must retain the public-safe clarification editor");
    assert.equal(await page.getByRole("button", { name: "Save listing status" }).count(), 1, "reviewer/admin listing-status mutation control missing");
    assert.equal(await page.getByRole("button", { name: "Save anti-scam review" }).count(), 1, "reviewer/admin anti-scam mutation control missing");
    assert.equal(await page.locator("#posting-fees").count(), 0, "non-owner admin must not receive another author's economic UI");
    await readableScreenshot(page, "desktop", "47-admin-public-detail-operator-controls", page.locator(".commune-job-review-controls"), -220);
    await readableScreenshot(page, "desktop", "47b-admin-public-detail-operator-actions", page.getByRole("button", { name: "Save anti-scam review" }), -360);
    await context.close();
  }
  {
    const context = await contextFor(browser, { viewerIsOwner: true, posts: [futureRolePost], jobs: [futureRoleJob] });
    const page = await context.newPage();
    await open(page, `/commune/posts/${ids.post}`);
    await page.locator(".commune-job-review-controls").waitFor();
    assert.equal(await page.getByLabel(/^Application status/).count(), 1, "the post owner must retain listing-status controls");
    assert.equal(await page.getByLabel(/^Anti-scam review/).count(), 0, "an ordinary post owner must not receive reviewer-only anti-scam controls");
    assert.equal(await page.getByLabel(/^Public correction \/ clarification note/).count(), 1, "the post owner must retain their public-safe clarification editor");
    assert.equal(await page.getByRole("button", { name: "Save listing status" }).count(), 1, "the post owner listing-status mutation control missing");
    assert.equal(await page.getByRole("button", { name: "Save anti-scam review" }).count(), 0, "the post owner must never receive the reviewer anti-scam mutation action");
    assert.equal(await page.locator("#posting-fees").count(), 1, "the post owner must retain only their own listing's economic-condition panel");
    await readableScreenshot(page, "desktop", "48-owner-public-detail-listing-controls", page.locator(".commune-job-review-controls"), -220);
    await context.close();
  }
  {
    const context = await contextFor(browser, { signedIn: false, posts: [futureRolePost], jobs: [futureRoleJob], viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, `/commune/posts/${ids.post}`);
    await page.getByRole("heading", { level: 2, name: futureRolePost.title }).waitFor();
    assert.equal(await page.locator(".commune-job-review-controls").count(), 0, "logged-out reader must not receive Job Post operator controls");
    assert.equal(await page.locator("#posting-fees").count(), 0, "logged-out reader must not receive economic UI");
    assert.equal(await page.getByLabel(/^Anti-scam review/).count(), 0, "logged-out reader must not receive anti-scam controls");
    assert.equal(await page.getByLabel(/^Public correction \/ clarification note/).count(), 0, "logged-out readers must not receive a public-correction editor");
    assert.equal(await page.getByText("Public clarification: use only the stated Private Work With route.", { exact: true }).count(), 1, "logged-out readers must retain public read access to public-safe clarification text");
    await assertNoOverflow(page, "logged-out mobile public Job detail");
    await readableScreenshot(page, "mobile", "24-logged-out-public-detail-no-private-controls", page.locator(".commune-post-context-header"), -80);
    await readableScreenshot(page, "mobile", "25-logged-out-public-detail-structured", page.locator(".commune-job-native-details"), -80);
    await readableScreenshot(page, "mobile", "25b-logged-out-public-detail-lower-read-only", page.getByText("Public application privacy", { exact: true }), 220);
    await context.close();
  }
  if (readableEvidenceDir) {
    const context = await contextFor(browser, { posts: [futureRolePost], jobs: [futureRoleJob], viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, `/commune/posts/${ids.post}`);
    await page.getByRole("heading", { level: 2, name: futureRolePost.title }).waitFor();
    await assertNoOverflow(page, "mobile public Job detail");
    await readableScreenshot(page, "mobile", "13-public-job-detail-mobile-top", page.locator(".commune-post-context-header"), -80);
    await readableScreenshot(page, "mobile", "14-public-job-detail-mobile-metadata", page.locator(".commune-job-facts-grid"), -100);
    await readableScreenshot(page, "mobile", "14b-public-job-detail-mobile-long-form", page.locator(".commune-job-narrative-grid"), -100);
    await readableScreenshot(page, "mobile", "14c-public-job-detail-mobile-links", page.locator('[aria-label="Links"]'), -120);
    await readableScreenshot(page, "mobile", "15-publication-not-verification-mobile", page.getByText(/Publication is not endorsement or verification/), -260);
    await context.close();
  }
  {
    const context = await contextFor(browser);
    const page = await context.newPage();
    await open(page, "/legal/community-guidelines");
    await page.getByText(/Publication is not endorsement or verification/).waitFor();
    await screenshot(page, "26-community-guidelines-coordination");
    await open(page, "/legal/terms-of-use");
    assert(await page.getByText(/Opportunity labels do not determine legal employment or worker status/).count(), "classification disclaimer missing from Legal");
    await screenshot(page, "26-legal-terms-coordination");
    await readableScreenshot(page, "desktop", "29-legal-policy-desktop", page.getByText(/Opportunity labels do not determine legal employment or worker status/), -430);
    await context.close();
  }
  {
    const context = await contextFor(browser, { posts: [legacyPost], jobs: [legacyJob] });
    const page = await context.newPage();
    await open(page, `/commune/posts/${ids.legacyPost}`);
    await page.getByText(/Legacy Job Post/).waitFor();
    assert(await page.getByText(/Deterministic labels are shown where possible; compensation or relationship details may still need clarification/i).count(), "legacy ambiguity notice missing");
    await screenshot(page, "27-legacy-job-rendering");
    await readableScreenshot(page, "desktop", "30-legacy-job-rendering-desktop", page.getByText(/Legacy Job Post/), -350);
    await context.close();
  }
  {
    const context = await contextFor(browser);
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "paid_employment", "paid");
    await chooseModel(page, "Salary", "64000");
    await screenshot(page, "28-final-desktop-overview");
    await context.close();
  }
  {
    const context = await contextFor(browser, { viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await open(page, "/commune/rooms/job-post/new");
    await baseComposer(page, "testing_feedback_call", "paid");
    await chooseModel(page, "Honorarium", "150");
    await label(page, "Compensation details").fill("Fixed honorarium after the session.");
    await label(page, "Participation and privacy note").fill("Feedback only; no sensitive identifiers are collected.");
    await assertNoOverflow(page, "final mobile expanded composer");
    await screenshot(page, "29-final-mobile-overview");
    await context.close();
  }
  await fs.writeFile(path.join(evidenceDir, "measurements.json"), `${JSON.stringify(measurements, null, 2)}\n`);
  console.log(`Opportunity Commons v2 ${browserEngineName} browser, payload, draft/export, review, public, Legal, desktop, and mobile checks passed. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
