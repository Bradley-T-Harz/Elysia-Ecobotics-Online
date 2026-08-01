import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox } from "playwright";

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

const postId = "a1100000-0000-4000-8000-000000000001";
const snippetId = "a1200000-0000-4000-8000-000000000001";
const acceptedRevisionId = "a1300000-0000-4000-8000-000000000001";
const userId = "a1400000-0000-4000-8000-000000000001";
const routePath = `/commune/coding-cornucopia/review?post=${postId}&snippet=${snippetId}`;

let currentPost = publicPost();
let currentSnippet = snippetVersion(1);

function publicPost() {
  return {
    id: postId,
    user_id: "a1500000-0000-4000-8000-000000000001",
    post_type: "code_sharing",
    title: "Coding Workbench snapshot fixture",
    body: "Public code fixture.",
    excerpt: "Public code fixture.",
    tags: ["coding-cornucopia"],
    links: [],
    repository_url: null,
    status: "published",
    visibility: "public",
    visibility_state: "published",
    hidden_at: null,
    removed_at: null,
    archived_at: null,
    published_at: "2026-08-01T08:00:00.000Z",
    created_at: "2026-08-01T08:00:00.000Z",
  };
}

function snippetVersion(version) {
  const extension = version === 1 ? "js" : "ts";
  const language = version === 1 ? "javascript" : "typescript";
  return {
    id: snippetId,
    post_id: postId,
    language,
    file_name: `published-v${version}.${extension}`,
    code_text: `console.log('published-v${version}');\n`,
    secret_scan_status: "clear",
    sandbox_warning_acknowledged: true,
    accepted_revision_id: version === 1 ? null : acceptedRevisionId.replace(/1$/, String(version)),
    accepted_version_number: version,
    accepted_revision_summary: version === 1 ? null : `Published fixture v${version}`,
    accepted_at: version === 1 ? null : `2026-08-01T0${version + 8}:00:00.000Z`,
    created_at: "2026-08-01T08:00:00.000Z",
    updated_at: `2026-08-01T0${version + 8}:00:00.000Z`,
  };
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const accessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureUser = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "coding-workbench-fixture@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-01T08:00:00.000Z",
};
const fixtureSession = {
  access_token: accessToken,
  refresh_token: "fixture-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: fixtureUser,
};

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
assert(address && typeof address === "object", "Coding Workbench browser server did not start.");
const origin = `http://127.0.0.1:${address.port}`;

async function waitFor(check, message, timeout = 15_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  if (lastError) throw new Error(`${message}: ${lastError.message}`);
  assert.fail(message);
}

async function setEditorText(page, editor, value) {
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(value);
  await waitFor(async () => (await editor.textContent())?.includes(value.trim()), "CodeMirror did not accept the draft fixture text.");
}

async function executableAvailable(executablePath) {
  try {
    await fs.access(executablePath);
    return true;
  } catch {
    return false;
  }
}

async function installNetworkFixtures(context, networkState) {
  await context.route(`${origin}/api/sandbox/credits`, async (route) => {
    await route.fulfill({ status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "application/json" }, body: '{"ok":false,"error":"sandbox_disabled"}' });
  });
  await context.route(`${origin}/api/sandbox/run`, async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    networkState.sandboxRequests.push(body);
    const completed = networkState.nextSandboxStatus === "completed";
    await route.fulfill({
      status: 200,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: completed,
        status: completed ? "completed" : "failed",
        runId: `fixture-run-${networkState.sandboxRequests.length}`,
        language: body.language,
        file: body.fileName,
        snapshotId: body.snapshotId,
        stdout: completed ? "fixture-ok\n" : "",
        stderr: completed ? "" : "fixture-failure\n",
        exitCode: completed ? 0 : 1,
        durationMs: 5,
        diagnostics: [],
        message: completed ? "Fixture run completed." : "Fixture run failed safely.",
        recordingStatus: "recorded",
      }),
    });
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
    networkState.supabaseRequests.push({ method: request.method(), pathname: url.pathname });
    if (url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(fixtureUser) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/rpc/submit_commune_code_revision_proposal")) {
      networkState.proposalSubmissionRequests += 1;
      await route.fulfill({ status: 403, headers: corsHeaders, body: '{"message":"fixture proposal denial","code":"42501"}' });
      return;
    }
    const objectResponse = request.headers().accept?.includes("application/vnd.pgrst.object+json");
    if (url.pathname.endsWith("/rest/v1/commune_posts")) {
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(objectResponse ? currentPost : [currentPost]) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/commune_code_snippets")) {
      await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify([currentSnippet]) });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/user_roles")) {
      await route.fulfill({ status: 200, headers: corsHeaders, body: "[]" });
      return;
    }
    if (url.pathname.endsWith("/rest/v1/profiles")) {
      await route.fulfill({ status: 200, headers: corsHeaders, body: objectResponse ? '{"is_admin":false}' : "[]" });
      return;
    }
    await route.fulfill({ status: 200, headers: corsHeaders, body: objectResponse ? "null" : "[]" });
  });
}

async function loadWorkbench(browser, browserName, viewport, comprehensive) {
  currentPost = publicPost();
  currentSnippet = snippetVersion(1);
  const context = await browser.newContext({ viewport });
  const networkState = { sandboxRequests: [], supabaseRequests: [], proposalSubmissionRequests: 0, nextSandboxStatus: "completed" };
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    window.__elysiaCspViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => {
      window.__elysiaCspViolations.push({ blockedUri: event.blockedURI, directive: event.effectiveDirective });
    });
  }, { storageKey: `sb-${projectRef}-auth-token`, session: fixtureSession });
  await installNetworkFixtures(context, networkState);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(`${origin}${routePath}`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.equal(response?.status(), 200, `${browserName} workbench route should load.`);

  const workspace = page.locator("section.commune-proposal-workspace");
  await workspace.getByText("Current published snapshot v1", { exact: true }).waitFor({ timeout: 30_000 });
  const previewArticles = workspace.locator("article.commune-code-preview");
  assert.equal(await previewArticles.count(), 2, `${browserName} should show exactly one published and one draft preview.`);
  const left = previewArticles.nth(0);
  const right = previewArticles.nth(1);
  const leftEditor = left.locator(".cm-content");
  const rightEditor = right.locator(".cm-content");
  const leftInitial = await leftEditor.textContent();
  assert.match(leftInitial ?? "", /published-v1/);
  assert.equal(await left.getByRole("button", { name: "Run current published snapshot in sandbox" }).count(), 1);
  assert.equal(await right.getByRole("button", { name: "Reset draft to published snapshot" }).count(), 1);
  assert.equal(await right.getByRole("button", { name: "Run proposed revision in sandbox" }).count(), 1);
  assert.equal(await page.getByText("Current accepted snapshot", { exact: false }).count(), 0);

  const horizontalOverflow = await workspace.evaluate((element) => element.scrollWidth > element.clientWidth + 2);
  assert.equal(horizontalOverflow, false, `${browserName} ${viewport.width}px workbench should not overflow horizontally.`);
  assert.equal(pageErrors.length, 0, `${browserName} should have no page errors: ${pageErrors.join(" | ")}`);

  if (!comprehensive) {
    const violations = await page.evaluate(() => window.__elysiaCspViolations ?? []);
    assert.deepEqual(violations, [], `${browserName} visual smoke should not violate CSP.`);
    await context.close();
    return;
  }

  const language = right.getByLabel("Language");
  const filename = right.getByLabel("Filename");
  const summary = right.getByLabel("Change summary");
  const explanation = right.getByLabel("Optional explanation");
  for (const edit of [
    async () => language.selectOption("python"),
    async () => filename.fill("draft.py"),
    async () => summary.fill("Draft-only summary"),
    async () => explanation.fill("Draft-only explanation"),
    async () => setEditorText(page, rightEditor, "print('draft-only')\n"),
  ]) {
    await edit();
    assert.equal(await leftEditor.textContent(), leftInitial, "editing any draft field must leave the left snapshot unchanged");
  }

  await waitFor(async () => left.getByRole("button", { name: "Run current published snapshot in sandbox" }).isEnabled(), "Published sandbox action did not become enabled.");
  await left.getByRole("button", { name: "Run current published snapshot in sandbox" }).click();
  await waitFor(() => networkState.sandboxRequests.length === 1, "Published sandbox request was not captured.");
  assert.equal(networkState.sandboxRequests[0].sourceType, "commune_post_snippet");
  assert.equal(networkState.sandboxRequests[0].sourceId, snippetId);
  assert.equal(networkState.sandboxRequests[0].code, currentSnippet.code_text);
  assert.equal(networkState.sandboxRequests[0].language, currentSnippet.language);
  assert.equal(networkState.sandboxRequests[0].fileName, currentSnippet.file_name);
  assert.equal(await leftEditor.textContent(), leftInitial);
  assert.match(await rightEditor.textContent() ?? "", /draft-only/);

  networkState.nextSandboxStatus = "failed";
  await right.getByRole("button", { name: "Run proposed revision in sandbox" }).click();
  await waitFor(() => networkState.sandboxRequests.length === 2, "Draft sandbox request was not captured.");
  assert.equal(networkState.sandboxRequests[1].sourceType, "manual_snapshot");
  assert.equal(networkState.sandboxRequests[1].sourceId, null);
  assert.equal(networkState.sandboxRequests[1].code, "print('draft-only')\n");
  assert.equal(networkState.sandboxRequests[1].language, "python");
  assert.equal(networkState.sandboxRequests[1].fileName, "draft.py");
  assert.equal(await leftEditor.textContent(), leftInitial);
  assert.match(await rightEditor.textContent() ?? "", /draft-only/);

  const requestsBeforeReset = networkState.supabaseRequests.length;
  const sandboxRequestsBeforeReset = networkState.sandboxRequests.length;
  await right.getByRole("button", { name: "Reset draft to published snapshot" }).click();
  await workspace.getByText("Draft reset to the current published snapshot. Proposal summary and explanation were cleared.", { exact: true }).waitFor();
  await waitFor(async () => await filename.inputValue() === "published-v1.js", "Reset did not restore the published filename.");
  assert.equal(await language.inputValue(), "javascript");
  assert.equal(await summary.inputValue(), "");
  assert.equal(await explanation.inputValue(), "");
  await waitFor(async () => (await rightEditor.textContent())?.includes("published-v1"), "Reset did not restore the published code in CodeMirror.");
  assert.equal(await leftEditor.textContent(), leftInitial);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(networkState.supabaseRequests.length, requestsBeforeReset, "Reset must make zero Supabase requests.");
  assert.equal(networkState.sandboxRequests.length, sandboxRequestsBeforeReset, "Reset must not run the sandbox.");

  currentSnippet = snippetVersion(2);
  await workspace.getByRole("button", { name: "Refresh proposals" }).click();
  await workspace.getByText("Current published snapshot v2", { exact: true }).waitFor();
  await waitFor(async () => await filename.inputValue() === "published-v2.ts", "A clean draft did not refresh to published v2.");
  await waitFor(async () => (await rightEditor.textContent())?.includes("published-v2"), "A clean draft did not refresh the CodeMirror value to published v2.");

  await summary.fill("Preserve this summary");
  await explanation.fill("Preserve this explanation");
  currentSnippet = snippetVersion(3);
  await workspace.getByRole("button", { name: "Refresh proposals" }).click();
  await workspace.getByText("Current published snapshot v3", { exact: true }).waitFor();
  await workspace.getByRole("status").getByText("A newer published snapshot is available. Your current draft has been preserved.", { exact: true }).waitFor();
  assert.equal(await filename.inputValue(), "published-v2.ts");
  assert.equal(await summary.inputValue(), "Preserve this summary");
  assert.equal(await explanation.inputValue(), "Preserve this explanation");
  assert.match(await rightEditor.textContent() ?? "", /published-v2/);
  assert.match(await leftEditor.textContent() ?? "", /published-v3/);

  await right.getByRole("button", { name: "Reset draft to latest published snapshot" }).first().click();
  await waitFor(async () => await filename.inputValue() === "published-v3.ts", "Explicit latest reset did not use published v3.");
  assert.equal(await summary.inputValue(), "");
  assert.equal(await explanation.inputValue(), "");
  assert.match(await rightEditor.textContent() ?? "", /published-v3/);
  assert.equal(await workspace.getByRole("status").count(), 0);

  await setEditorText(page, rightEditor, "console.log('failed-submit-draft');\n");
  await summary.fill("Fixture failed submission");
  const publishedBeforeFailedSubmit = await leftEditor.textContent();
  const draftBeforeFailedSubmit = await rightEditor.textContent();
  const submitButton = right.getByRole("button", { name: "Submit proposed revision" });
  await waitFor(() => submitButton.isEnabled(), "Meaningful valid draft should enable proposal submission.");
  await submitButton.click();
  await waitFor(() => networkState.proposalSubmissionRequests === 1, "Failed proposal fixture was not attempted.");
  assert.equal(await leftEditor.textContent(), publishedBeforeFailedSubmit, "A failed submission must not mutate the published snapshot.");
  assert.equal(await rightEditor.textContent(), draftBeforeFailedSubmit, "A failed submission must not mutate the draft.");

  currentPost = { ...currentPost, status: "draft", visibility: "private", visibility_state: "draft" };
  await workspace.getByRole("button", { name: "Refresh proposals" }).click();
  await workspace.getByText("Current attached snapshot v3", { exact: true }).waitFor();
  assert.equal(await workspace.getByText("Current published snapshot v3", { exact: true }).count(), 0);
  assert.equal(await right.getByRole("button", { name: "Submit proposed revision" }).isDisabled(), true, "Nonpublic parent posts must not permit proposal submission.");

  const violations = await page.evaluate(() => window.__elysiaCspViolations ?? []);
  assert.deepEqual(violations, [], "Coding Workbench interactions should not violate CSP.");
  assert.equal(pageErrors.length, 0, `Chromium should have no page errors: ${pageErrors.join(" | ")}`);
  await context.close();
}

let activeBrowser;
try {
  activeBrowser = await chromium.launch({ headless: true });
  await loadWorkbench(activeBrowser, "Chromium", { width: 1440, height: 1000 }, true);
  await loadWorkbench(activeBrowser, "Chromium mobile", { width: 390, height: 844 }, false);
  await activeBrowser.close();
  activeBrowser = null;

  const braveExecutable = process.env.ELYSIA_BRAVE_EXECUTABLE ?? "/usr/bin/brave-browser-stable";
  if (await executableAvailable(braveExecutable)) {
    activeBrowser = await chromium.launch({ headless: true, executablePath: braveExecutable });
    await loadWorkbench(activeBrowser, "Brave", { width: 1366, height: 900 }, false);
    await activeBrowser.close();
    activeBrowser = null;
  } else {
    console.warn(`Brave visual check skipped because ${braveExecutable} is unavailable.`);
  }

  const firefoxExecutable = firefox.executablePath();
  if (await executableAvailable(firefoxExecutable)) {
    activeBrowser = await firefox.launch({ headless: true });
    await loadWorkbench(activeBrowser, "Firefox", { width: 1366, height: 900 }, false);
    await activeBrowser.close();
    activeBrowser = null;
  } else {
    console.warn(`Firefox visual check skipped because ${firefoxExecutable} is unavailable.`);
  }
  console.log("Coding Workbench production-build browser regression passed for five-field immutability, reset, sandbox input separation, failed submission, stale-version protection, publication truth, CSP, Chromium, mobile width, installed Brave when available, and Firefox when available.");
} finally {
  if (activeBrowser) await activeBrowser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
