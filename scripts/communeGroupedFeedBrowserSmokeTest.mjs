import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const evidenceDir = path.resolve(process.env.ELYSIA_COMMUNE_GROUPED_FEED_EVIDENCE_DIR || "/tmp/elysia-commune-grouped-feed-browser-evidence");
await fs.mkdir(evidenceDir, { recursive: true });

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
assert(projectRef, "configured Supabase public origin missing from production-equivalent build");

const roomOrder = [
  ["media_garden", "media-garden", "Media Garden"],
  ["troubleshooting", "troubleshooting-grove", "Troubleshooting Grove"],
  ["code_sharing", "coding-cornucopia", "Coding Cornucopia"],
  ["repository_showcase", "repository-showcase", "Repository Showcase"],
  ["community_network", "community-network", "Community Network"],
  ["job_post", "job-post", "Job Post"],
  ["research_note", "research-notes", "Research Notes"],
  ["elysia_iteration_showcase", "elysia-iteration-showcase", "Elysia Iteration Showcase"],
  ["community_vote", "community-vote", "Community Voting Room"],
  ["official_update", "official-updates", "Official Update"],
];

function makePost(idNumber, postType, title, publishedAt, tags = []) {
  const id = `d2000000-0000-4000-8000-${String(idNumber).padStart(12, "0")}`;
  return {
    id,
    post_type: postType,
    title,
    body: `${title} keeps its room-native public context while the Commune index supplies a clear room-level hierarchy.`,
    excerpt: `${title} representative public summary.`,
    tags,
    links: [],
    repository_url: null,
    status: "published",
    visibility: "public",
    visibility_state: "published",
    hidden_at: null,
    removed_at: null,
    archived_at: null,
    published_at: publishedAt,
    last_activity_at: publishedAt,
    created_at: publishedAt,
  };
}

const posts = [
  makePost(1, "media_garden", "Wetland restoration field gallery", "2026-08-01T12:00:00.000Z", ["field-notes", "wetlands"]),
  makePost(2, "troubleshooting", "Installation diagnostics without private logs", "2026-08-02T12:00:00.000Z", ["installation", "privacy"]),
  makePost(3, "code_sharing", "Accessible watershed map component", "2026-08-03T12:00:00.000Z", ["typescript", "accessibility"]),
  makePost(4, "community_network", "Community watershed mapping circle", "2026-08-04T12:00:00.000Z", ["collaboration"]),
  makePost(5, "job_post", "Older habitat data fellowship", "2026-08-05T12:00:00.000Z", ["research", "community-vote"]),
  makePost(6, "job_post", "Middle ecological testing call", "2026-08-06T12:00:00.000Z", ["testing", "media-garden"]),
  makePost(7, "job_post", "Newest community stewardship opportunity", "2026-08-07T12:00:00.000Z", ["research", "troubleshooting"]),
  makePost(8, "research_note", "Earlier local-first research note", "2026-08-05T18:00:00.000Z", ["evidence"]),
  makePost(9, "research_note", "Newest ecological evidence synthesis", "2026-08-08T12:00:00.000Z", ["sources", "uncertainty"]),
  makePost(10, "elysia_iteration_showcase", "Elysia iteration accessibility update", "2026-08-09T12:00:00.000Z", ["iteration"]),
  makePost(11, "community_vote", "Which public guide should be prepared next?", "2026-08-10T12:00:00.000Z", ["advisory-vote"]),
];
const jobPosts = posts.filter((post) => post.post_type === "job_post").map((post, index) => ({
  id: `d3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  post_id: post.id,
  role_title: post.title,
  organization_project: "Fixture Ecological Cooperative",
  role_type: index === 0 ? "research_role" : index === 1 ? "contributor_call" : "volunteer_call",
  paid_volunteer_status: index === 0 ? "stipend" : "unpaid",
  location_mode: "remote",
  location_text: "Remote",
  compensation_clarity: index === 0 ? "Stipend clearly stated" : "Unpaid / volunteer",
  role_summary: post.excerpt,
  application_status: "open",
  anti_scam_review_status: "not_reviewed",
  work_with_link_enabled: false,
  model_version: 2,
  opportunity_type: index === 0 ? "fellowship_funded_placement" : index === 1 ? "testing_feedback_call" : "community_open_source_contribution",
  compensation_status: index === 0 ? "stipend" : "unpaid_volunteer",
  compensation_models: [index === 0 ? "stipend" : "unpaid_volunteer"],
  work_arrangement: "remote",
  time_basis: "flexible_as_needed",
  duration_type: "project_based",
  poster_type: "community_organization",
  application_route_type: "official_application_webpage",
  application_destination: "https://example.org/apply",
  future_interest_acknowledged: false,
}));
const researchRows = posts.filter((post) => post.post_type === "research_note").map((post, index) => ({
  id: `d4000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  post_id: post.id,
  research_question: post.title,
  domain: "Ecological systems and responsible technology",
  evidence_strength: index ? "strong" : "moderate",
  evidence_summary: post.excerpt,
  uncertainty: "Public evidence remains open to careful correction and additional sources.",
  ecological_subsystem: "general",
  source_links: [],
  review_status: "published",
}));
const troubleshootingRows = [{
  id: "d5000000-0000-4000-8000-000000000001",
  post_id: posts.find((post) => post.post_type === "troubleshooting").id,
  issue_type: "install_issue",
  affected_area: "public installation guide",
  troubleshooting_status: "resolved",
  accepted_resolution_kind: "workaround",
  accepted_summary: "Use the redacted diagnostic path and keep private logs local.",
}];
const votePost = posts.find((post) => post.post_type === "community_vote");
const voteRows = [{
  post_id: votePost.id,
  question: votePost.title,
  context: "A representative advisory vote retains its native result panel inside its canonical room.",
  decision_type: "single_choice_guidance",
  vote_status: "open",
  visibility: "public",
  results_visibility: "always",
  allow_comments: true,
}];
const voteOptions = [
  { id: "d6000000-0000-4000-8000-000000000001", vote_post_id: votePost.id, option_label: "Installation guide", option_description: "Prioritize installation safety.", display_order: 0 },
  { id: "d6000000-0000-4000-8000-000000000002", vote_post_id: votePost.id, option_label: "Privacy guide", option_description: "Prioritize public privacy boundaries.", display_order: 1 },
];
const voteResults = voteOptions.map((option, index) => ({ vote_post_id: votePost.id, option_id: option.id, ballot_count: index === 0 ? 2 : 1, total_ballots: 3, percentage: index === 0 ? 66.7 : 33.3 }));

const contentTypes = new Map([[".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"], [".js", "application/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".png", "image/png"], [".svg", "image/svg+xml"], [".webmanifest", "application/manifest+json"]]);
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const candidate = path.resolve(dist, `.${pathname}`);
    let body = indexHtml;
    let extension = ".html";
    if (candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/") {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) { body = await fs.readFile(candidate); extension = path.extname(candidate); }
      } catch (error) {
        if (pathname.startsWith("/assets/")) throw error;
      }
    }
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Security-Policy": csp, "Content-Type": contentTypes.get(extension) ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const address = server.address();
assert(address && typeof address === "object", "browser server did not start");
const origin = `http://127.0.0.1:${address.port}`;
const jsonHeaders = { "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };

async function installFixtures(context) {
  const feedPostRequests = [];
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: jsonHeaders, body: "" });
    let body = [];
    if (pathname.endsWith("/rest/v1/commune_posts")) { feedPostRequests.push(url); body = posts; }
    else if (pathname.endsWith("/rest/v1/commune_threads")) body = posts.map((post, index) => ({ id: `d7000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, post_id: post.id, room_id: null, title: post.title, status: "open", visibility: "public", last_reply_at: post.published_at }));
    else if (pathname.endsWith("/rest/v1/commune_troubleshooting_posts")) body = troubleshootingRows;
    else if (pathname.endsWith("/rest/v1/commune_job_posts")) body = jobPosts;
    else if (pathname.endsWith("/rest/v1/commune_research_notes")) body = researchRows;
    else if (pathname.endsWith("/rest/v1/commune_vote_posts")) body = voteRows;
    else if (pathname.endsWith("/rest/v1/commune_vote_options")) body = voteOptions;
    else if (pathname.endsWith("/rest/v1/rpc/commune_vote_result_summary")) body = voteResults;
    else if (pathname.endsWith("/rest/v1/rpc/resolve_public_commune_attributions")) body = posts.map((post) => ({ target_type: "post", target_id: post.id, author_handle: "fixture-community-member", canonical_profile_url: "https://elysiaecobotics.com/commons-circle/@fixture-community-member", viewer_is_owner: false }));
    await route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify(body) });
  });
  return feedPostRequests;
}

async function verifyViewport(browser, label, viewport) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, deviceScaleFactor: 2 });
  const feedPostRequests = await installFixtures(context);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => { if (request.url().startsWith(origin)) failedRequests.push(request.url()); });
  const response = await page.goto(`${origin}/commune`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, `${label}: route document status`);
  await page.locator(".commune-feed-room-section").first().waitFor();
  assert.equal(feedPostRequests.length, 1, `${label}: complete fixture feed should load in one bounded page`);
  assert.equal(feedPostRequests[0].searchParams.get("limit"), "250", `${label}: lobby request must use the bounded pagination page size`);
  assert.equal(feedPostRequests[0].searchParams.get("offset"), "0", `${label}: first lobby page must start at offset zero`);
  assert(feedPostRequests[0].searchParams.get("order")?.includes("published_at.desc.nullslast"), `${label}: lobby request must use canonical publication order`);

  const sections = page.locator(".commune-feed-room-section");
  assert.equal(await sections.count(), 10, `${label}: every canonical room must render one section`);
  assert.deepEqual(await sections.evaluateAll((items) => items.map((item) => item.getAttribute("data-room-slug"))), roomOrder.map((item) => item[1]), `${label}: room sections must use canonical directory order`);
  assert.deepEqual(await sections.evaluateAll((items) => items.map((item) => item.getAttribute("data-post-type"))), roomOrder.map((item) => item[0]), `${label}: section membership must expose the authoritative post_type`);
  assert.equal(await page.locator(".commune-feed-room-jumps a").count(), 10, `${label}: jump navigation must include all ten rooms`);
  for (const [, slug] of roomOrder) {
    assert.equal(await page.locator(`.commune-feed-room-jumps a[href="#commune-feed-room-${slug}"]`).count(), 1, `${label}: missing room jump for ${slug}`);
    assert.equal(await page.locator(`#commune-feed-room-${slug} a[href="/commune/rooms/${slug}"]`).count(), 1, `${label}: missing canonical View room path for ${slug}`);
  }
  assert.equal(await page.locator(".commune-feed-room-grid .commune-post-card").count(), posts.length, `${label}: represented card count must equal the published fixture count`);
  for (const post of posts) {
    const owningSection = page.locator(`[data-post-type="${post.post_type}"]`);
    assert.equal(await owningSection.getByRole("heading", { name: post.title }).count(), 1, `${label}: ${post.title} must appear once in its authoritative room`);
    assert.equal(await page.getByRole("heading", { name: post.title }).count(), 1, `${label}: ${post.title} must not be duplicated elsewhere`);
  }
  assert.deepEqual(await page.locator('[data-post-type="job_post"] .commune-post-card h3').allTextContents(), [
    "Newest community stewardship opportunity",
    "Middle ecological testing call",
    "Older habitat data fellowship",
  ], `${label}: Job Post cards must be newest-first by published_at`);
  assert.equal(await page.locator('[data-post-type="repository_showcase"] .commune-feed-room-empty').count(), 1, `${label}: empty Repository Showcase must remain visible`);
  assert.equal(await page.locator('[data-post-type="official_update"] .commune-feed-room-empty').count(), 1, `${label}: empty Official Update must remain visible`);
  assert.equal(await page.locator('[data-post-type="community_vote"] .commune-vote-card').count(), 1, `${label}: Community Voting Room must retain its native vote panel`);
  assert.equal(await page.locator('[data-post-type="research_note"] .boundary-note').count() >= 2, true, `${label}: Research Notes must retain uncertainty context`);
  assert.equal(await page.locator('[data-post-type="job_post"] .boundary-note').count() >= 3, true, `${label}: Job Post must retain compensation/work context`);
  assert.equal(await page.getByRole("heading", { name: `${posts.length} published items` }).count(), 1, `${label}: total feed count must equal represented posts`);
  assert.equal(await page.getByText(/unsupported room identifier/).count(), 0, `${label}: valid fixtures must not trigger an integrity warning`);
  assert.equal(await page.getByText("#research", { exact: true }).count() > 0, true, `${label}: misleading hashtags remain ordinary discovery metadata`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${label}: horizontal overflow ${overflow}px`);
  assert.deepEqual(pageErrors, [], `${label}: uncaught browser error`);
  assert.deepEqual(consoleErrors, [], `${label}: browser console error`);
  assert.deepEqual(failedRequests, [], `${label}: same-origin request failure`);

  await page.screenshot({ path: path.join(evidenceDir, `${label}-full-overview.png`), fullPage: true, animations: "disabled" });
  await page.locator("#commune-feed").evaluate((element) => {
    const stickyHeader = document.querySelector("header");
    const headerHeight = stickyHeader?.getBoundingClientRect().height ?? 0;
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - headerHeight - 20));
  });
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(evidenceDir, `${label}-01-feed-heading-and-jumps.png`), fullPage: false, animations: "disabled" });
  const primarySections = label.startsWith("desktop")
    ? roomOrder.map(([, slug]) => slug)
    : ["media-garden", "coding-cornucopia", "repository-showcase", "job-post", "research-notes", "elysia-iteration-showcase", "community-vote", "official-updates"];
  for (const [index, slug] of primarySections.entries()) {
    const section = page.locator(`#commune-feed-room-${slug}`);
    await section.evaluate((element) => {
      const stickyHeader = document.querySelector("header");
      const headerHeight = stickyHeader?.getBoundingClientRect().height ?? 0;
      const top = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - headerHeight - 20));
    });
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(evidenceDir, `${label}-${String(index + 2).padStart(2, "0")}-${slug}.png`), fullPage: false, animations: "disabled" });
  }
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await verifyViewport(browser, "desktop-1600", { width: 1600, height: 1000 });
  await verifyViewport(browser, "half-screen-900", { width: 900, height: 900 });
  await verifyViewport(browser, "mobile-390", { width: 390, height: 844 });
  console.log(`Commune room-grouped feed browser regression passed. Evidence: ${evidenceDir}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
