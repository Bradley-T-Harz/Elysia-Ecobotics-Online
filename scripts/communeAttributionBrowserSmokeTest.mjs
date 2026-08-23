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
const csp = headersSource.match(
  /^\s*Content-Security-Policy:\s*(.+)$/m,
)?.[1]?.trim();
assert(csp, "The production Content-Security-Policy must be available.");

const postId = "fc100000-0000-4000-8000-000000000001";
const threadId = "fc200000-0000-4000-8000-000000000001";
const commentId = "fc300000-0000-4000-8000-000000000001";
const replyId = "fc300000-0000-4000-8000-000000000002";
const oldHandle = "fixture-author-a";
const currentHandle = "fixture-author-b";
const canonicalProfileUrl =
  `https://elysiaecobotics.com/commons-circle/@${currentHandle}`;

const post = {
  id: postId,
  post_type: "community_network",
  title: "Canonical attribution fixture",
  body: "An existing post retains its content while its author changes handle.",
  excerpt: "An existing post retains its content.",
  tags: [],
  links: [],
  repository_url: null,
  status: "published",
  visibility: "public",
  visibility_state: "published",
  hidden_at: null,
  removed_at: null,
  archived_at: null,
  published_at: "2026-07-01T12:00:00.000Z",
  last_activity_at: "2026-07-01T12:00:00.000Z",
  created_at: "2026-07-01T12:00:00.000Z",
};
const comments = [
  {
    id: commentId,
    thread_id: threadId,
    post_id: postId,
    parent_comment_id: null,
    body: "Fixture comment",
    status: "published",
    created_at: "2026-07-01T12:01:00.000Z",
    published_at: "2026-07-01T12:01:00.000Z",
  },
  {
    id: replyId,
    thread_id: threadId,
    post_id: postId,
    parent_comment_id: commentId,
    body: "Fixture reply",
    status: "published",
    created_at: "2026-07-01T12:02:00.000Z",
    published_at: "2026-07-01T12:02:00.000Z",
  },
];
const attributions = [
  {
    target_type: "post",
    target_id: postId,
    author_handle: currentHandle,
    canonical_profile_url: canonicalProfileUrl,
    viewer_is_owner: false,
  },
  ...comments.map((comment) => ({
    target_type: "comment",
    target_id: comment.id,
    author_handle: currentHandle,
    canonical_profile_url: canonicalProfileUrl,
    viewer_is_owner: false,
  })),
];
const serializedPublicPayload = JSON.stringify({ post, comments, attributions });
for (const forbidden of [
  "user_id",
  "author_user_id",
  "email",
  "storage_key",
  "object_key",
  "credential",
  oldHandle,
]) {
  assert(
    !serializedPublicPayload.toLowerCase().includes(forbidden),
    `browser fixture leaked ${forbidden}`,
  );
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
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    const candidate = path.resolve(dist, `.${pathname}`);
    const isSafeAsset = candidate.startsWith(`${dist}${path.sep}`)
      && pathname !== "/";
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
assert(address && typeof address === "object", "Browser server did not start.");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

async function loadCase(viewport) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 600,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const loadedScripts = [];
  const postSelections = [];
  const commentSelections = [];
  const attributionRequests = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin)) failedRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (!response.url().startsWith(origin)) return;
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
    if (response.request().resourceType() === "script") {
      loadedScripts.push(new URL(response.url()).pathname);
    }
  });

  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers, body: "" });
      return;
    }
    let body = [];
    if (url.pathname.endsWith("/rest/v1/commune_posts")) {
      postSelections.push(url.searchParams.get("select") ?? "");
      body = [post];
    } else if (url.pathname.endsWith("/rest/v1/commune_threads")) {
      body = [{
        id: threadId,
        post_id: postId,
        room_id: null,
        title: post.title,
        status: "open",
        visibility: "public",
        last_reply_at: "2026-07-01T12:02:00.000Z",
      }];
    } else if (url.pathname.endsWith("/rest/v1/commune_comments")) {
      commentSelections.push(url.searchParams.get("select") ?? "");
      body = comments;
    } else if (
      url.pathname.endsWith(
        "/rest/v1/rpc/resolve_public_commune_attributions",
      )
    ) {
      const payload = request.postDataJSON();
      attributionRequests.push(payload);
      body = attributions;
    } else if (
      url.pathname.endsWith("/rest/v1/commune_categories")
      || url.pathname.endsWith("/rest/v1/commune_rooms")
    ) {
      body = [];
    } else if (url.pathname.includes("/rest/v1/rpc/")) {
      body = [];
    }
    await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });

  const response = await page.goto(`${origin}/commune/posts/${postId}`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  assert.equal(response?.status(), 200, "Commune route document status");
  await page.getByRole("heading", { name: post.title }).waitFor();
  assert.equal(await page.locator("header").count(), 1, "site header missing");
  assert.equal(await page.locator("footer").count(), 1, "site footer missing");
  const currentLinks = page.locator(
    `a[href="/commons-circle/@${currentHandle}"]`,
  );
  assert(
    await currentLinks.count() >= 3,
    "post, comment, and reply must link to the current handle",
  );
  assert.equal(
    await page.getByText(`@${oldHandle}`, { exact: true }).count(),
    0,
    "historical snapshot handle remained visible",
  );
  assert(
    loadedScripts.some((asset) => /\/assets\/safe-assets-v1-commune-[^/]+\.js$/.test(asset)),
    "Commune route chunk did not load",
  );
  assert(
    postSelections.every(
      (selection) =>
        !selection.includes("user_id")
        && !selection.includes("author_username"),
    ),
    "public post query requested account UUID or snapshot handle",
  );
  assert(
    commentSelections.every(
      (selection) =>
        !selection.includes("user_id")
        && !selection.includes("author_username"),
    ),
    "public comment query requested account UUID or snapshot handle",
  );
  assert(
    attributionRequests.some(
      (payload) =>
        payload.p_post_ids?.includes(postId)
        && payload.p_comment_ids?.includes(commentId)
        && payload.p_comment_ids?.includes(replyId),
    ),
    "bounded canonical attribution RPC was not called for authored content",
  );
  assert.deepEqual(pageErrors, [], "uncaught browser error");
  assert.deepEqual(consoleErrors, [], "browser console error");
  assert.deepEqual(failedRequests, [], "same-origin request failure");
  assert.deepEqual(badResponses, [], "bad same-origin response");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth
      - document.documentElement.clientWidth,
  );
  assert(overflow <= 1, `Commune attribution route overflowed by ${overflow}px`);
  await context.close();
}

try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await loadCase(viewport);
  }
  console.log(
    "Canonical Commune attribution browser regression passed at desktop and mobile widths.",
  );
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
