import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexHtml = await fs.readFile(path.join(dist, "index.html"));
const headersSource = await fs.readFile(
  path.join(root, "public/_headers"),
  "utf8",
);
const csp = headersSource
  .match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]
  ?.trim();
assert(
  csp,
  "The production Content-Security-Policy must be available for the browser regression test.",
);
assert(
  !csp.includes("'unsafe-eval'"),
  "Developer Forge must work without weakening CSP with unsafe-eval.",
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
    const isSafeAsset =
      candidate.startsWith(`${dist}${path.sep}`) && pathname !== "/";
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
assert(
  address && typeof address === "object",
  "Local regression server did not start.",
);
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const observedSupabaseClientStates = new Set();
const visualProofRoot = process.env.ELYSIA_CAPTURE_VISUAL_PROOF === "1"
  ? await fs.mkdtemp(path.join(os.tmpdir(), "elysia-pass8d-visual-"))
  : null;
async function captureVisual(locator, name, viewport) {
  if (!visualProofRoot || viewport.width < 1000) return;
  await locator.screenshot({ path: path.join(visualProofRoot, `${name}.png`), animations: "disabled" });
}
const intakeZip = new JSZip();
intakeZip.file("manifest.json", JSON.stringify({
  schema_version: "1.0",
  addon_id: "developer.browser-intake",
  name: "Browser Intake",
  version: "0.1.0",
  description: "Synthetic browser regression package.",
  author: { name: "Regression Test", url: "https://example.com" },
  license: "MIT",
  entrypoints: [],
  permissions: ["public_docs_read"],
  compatibility: { elysia_min_version: "0.1.0", addon_api_version: "0.1" },
  runtime: { kind: "static", requires_network: false, requires_filesystem: false },
  security: { sandbox_required: false, network_domains: [], file_access: [] }
}, null, 2));
intakeZip.file("README.md", "# Browser Intake\n\nSynthetic regression package only.");
intakeZip.file("LICENSE", "MIT");
const intakeBytes = await intakeZip.generateAsync({ type: "nodebuffer" });
const blockedIntakeZip = new JSZip();
blockedIntakeZip.file("manifest.json", JSON.stringify({
  schema_version: "1.0",
  addon_id: "developer.blocked-browser-intake",
  name: "Blocked Browser Intake",
  version: "0.1.0"
}));
blockedIntakeZip.file(".env", "EXAMPLE_SECRET=must-not-transfer");
const blockedIntakeBytes = await blockedIntakeZip.generateAsync({ type: "nodebuffer" });
const folderFixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "elysia-forge-folder-picker-"));
const validFolderFixture = path.join(folderFixtureRoot, "valid-addon");
const blockedFolderFixture = path.join(folderFixtureRoot, "blocked-addon");
const privatePathFolderFixture = path.join(folderFixtureRoot, "private-path-addon");
const largeFolderFixture = path.join(folderFixtureRoot, "large-addon");
const marketplaceLargeFolderFixture = path.join(folderFixtureRoot, "marketplace-large-addon");
await Promise.all([
  fs.mkdir(path.join(validFolderFixture, "src"), { recursive: true }),
  fs.mkdir(path.join(validFolderFixture, "docs"), { recursive: true }),
  fs.mkdir(path.join(validFolderFixture, "assets"), { recursive: true }),
  fs.mkdir(blockedFolderFixture, { recursive: true }),
  fs.mkdir(path.join(privatePathFolderFixture, "docs"), { recursive: true }),
  fs.mkdir(path.join(largeFolderFixture, "src"), { recursive: true }),
  fs.mkdir(path.join(largeFolderFixture, "docs"), { recursive: true }),
  fs.mkdir(path.join(largeFolderFixture, "scripts"), { recursive: true }),
  fs.mkdir(path.join(largeFolderFixture, ".git"), { recursive: true }),
  fs.mkdir(path.join(marketplaceLargeFolderFixture, "src"), { recursive: true }),
  fs.mkdir(path.join(marketplaceLargeFolderFixture, "scripts"), { recursive: true })
]);
const folderManifest = JSON.stringify({
  schema_version: "1.0",
  addon_id: "developer.folder-picker-proof",
  name: "Folder Picker Proof",
  version: "0.1.0",
  description: "Harmless folder-picker regression fixture.",
  author: { name: "Regression Test", url: "https://example.com" },
  license: "MIT",
  entrypoints: [],
  permissions: ["public_docs_read"],
  compatibility: { elysia_min_version: "0.1.0", addon_api_version: "0.1" },
  runtime: { kind: "static", requires_network: false, requires_filesystem: false },
  security: { sandbox_required: false, network_domains: [], file_access: [] }
}, null, 2);
await Promise.all([
  fs.writeFile(path.join(validFolderFixture, "manifest.json"), folderManifest),
  fs.writeFile(path.join(validFolderFixture, "README.md"), "# Folder Picker Proof\n"),
  fs.writeFile(path.join(validFolderFixture, "LICENSE"), "MIT\n"),
  fs.writeFile(path.join(validFolderFixture, "src/index.ts"), "export const proof = true;\n"),
  fs.writeFile(path.join(validFolderFixture, "docs/review-boundary.md"), "No execution. Local selection only.\n"),
  fs.writeFile(path.join(validFolderFixture, "assets/icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>\n'),
  fs.writeFile(path.join(validFolderFixture, "package.json"), '{"name":"folder-picker-proof","private":true}\n'),
  fs.writeFile(path.join(blockedFolderFixture, "manifest.json"), folderManifest),
  fs.writeFile(path.join(blockedFolderFixture, ".env"), "EXAMPLE_SECRET=must-not-transfer\n"),
  fs.writeFile(path.join(privatePathFolderFixture, "manifest.json"), folderManifest),
  fs.writeFile(path.join(privatePathFolderFixture, "docs/private-path.txt"), "/home/example/private-vault/model.bin\n"),
  fs.writeFile(path.join(privatePathFolderFixture, "docs/private-windows-path.txt"), "C:\\Users\\example\\private-vault\\model.bin\n"),
  fs.writeFile(path.join(privatePathFolderFixture, "docs/private-file-uri.txt"), "file:///root/private-vault/model.bin\n"),
  fs.writeFile(path.join(largeFolderFixture, "package.json"), '{"name":"large-folder-proof","private":true}\n'),
  fs.writeFile(path.join(largeFolderFixture, "README.md"), "# Large folder proof\n"),
  fs.writeFile(path.join(largeFolderFixture, "src/index.ts"), "export const proof = true;\n"),
  fs.writeFile(path.join(largeFolderFixture, "docs/relative-paths.md"), "node_modules/ignore/README.md\nsrc/index.ts\ndocs/review-boundary.md\n"),
  fs.writeFile(path.join(largeFolderFixture, ".git/config"), "synthetic metadata excluded by default\n"),
  fs.writeFile(path.join(marketplaceLargeFolderFixture, "package.json"), '{"name":"marketplace-large-folder-proof","private":true}\n'),
  fs.writeFile(path.join(marketplaceLargeFolderFixture, "src/index.ts"), "export const proof = true;\n")
]);
for (let group = 0; group < 100; group += 1) {
  const directory = path.join(largeFolderFixture, "node_modules", `synthetic-package-${group}`);
  await fs.mkdir(directory, { recursive: true });
  await Promise.all(Array.from({ length: 100 }, (_, index) => fs.writeFile(path.join(directory, group === 0 && index === 0 ? "credentials.js" : `file-${index}.js`), "export default true;\n")));
}
await Promise.all(Array.from({ length: 30 }, (_, index) => fs.writeFile(path.join(largeFolderFixture, "scripts", index === 0 ? `${"long-path-segment-".repeat(8)}review-0.sh` : `review-${index}.sh`), "#!/bin/sh\necho review\n")));
for (let group = 0; group < 12; group += 1) {
  const directory = path.join(marketplaceLargeFolderFixture, "node_modules", `synthetic-package-${group}`);
  await fs.mkdir(directory, { recursive: true });
  await Promise.all(Array.from({ length: 100 }, (_, index) => fs.writeFile(path.join(directory, `file-${index}.js`), "export default true;\n")));
}
await Promise.all(Array.from({ length: 30 }, (_, index) => fs.writeFile(path.join(marketplaceLargeFolderFixture, "scripts", `review-${index}.sh`), "#!/bin/sh\necho review\n")));

try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
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
    const sandboxRequests = [];
    const gitFetchRequests = [];
    let currentPhase = "initial Developer Forge route";

    page.on("pageerror", (error) =>
      pageErrors.push(`${currentPhase}: ${error.stack || error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/sandbox/"))
        sandboxRequests.push(request.url());
      if (request.url().includes("code.example.invalid")) gitFetchRequests.push(request.url());
    });
    page.on("requestfailed", (request) => {
      if (request.url().startsWith(origin))
        failedRequests.push(
          `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
        );
    });
    page.on("response", (response) => {
      if (!response.url().startsWith(origin)) return;
      if (response.status() >= 400)
        badResponses.push(`${response.status()} ${response.url()}`);
      if (response.request().resourceType() === "script")
        loadedScripts.push({
          url: response.url(),
          status: response.status(),
          type: response.headers()["content-type"] ?? "",
        });
    });

    const response = await page.goto(`${origin}/developer-forge`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    assert.equal(
      response?.status(),
      200,
      "Developer Forge route must return the application document.",
    );
    await page
      .getByRole("heading", { name: "The Developer Forge", exact: true })
      .waitFor({ state: "visible" });
    assert.equal(
      await page.locator("header").count(),
      1,
      "The application header must render.",
    );
    assert(
      (await page.locator("nav").count()) >= 2,
      "Site and Developer Forge navigation must render.",
    );
    assert.equal(
      await page.locator("footer").count(),
      1,
      "The application footer must render.",
    );
    assert(
      await page
        .getByText("The website never runs uploaded add-on code", {
          exact: false,
        })
        .isVisible(),
      "The no-execution boundary must remain visible.",
    );
    await page.getByRole("heading", { name: "Create, import, package, or prepare review" }).waitFor({ state: "visible" });
    for (const intakePath of ["Create from template", "Import .elysia-addon", "Import ZIP / source bundle", "Import folder / repository", "Import manifest.json", "Use Git URL metadata", "Export inert .elysia-addon", "Prepare Marketplace review"]) {
      assert(await page.getByRole("heading", { name: intakePath, exact: true }).isVisible(), `Developer Forge landing page must expose ${intakePath}.`);
    }
    await captureVisual(page.locator(".forge-intake-map"), "developer-forge-intake-map", viewport);
    currentPhase = "create local draft";
    await page.goto(`${origin}/developer-forge/drafts/new`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Create, import, package, or prepare review" }).waitFor({ state: "visible" });
    await captureVisual(page.locator(".forge-intake-map"), "developer-forge-new-intake-map", viewport);
    await page.getByRole("button", { name: "Create blank manifest draft" }).click();
    await page.waitForFunction(() => {
      try { return (JSON.parse(localStorage.getItem("developerForge.localDrafts.v1") ?? "[]")?.length ?? 0) > 0; }
      catch { return false; }
    });
    currentPhase = "open draft workbench";
    await page.goto(`${origin}/developer-forge/drafts`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Package and repository intake" }).waitFor({ state: "visible" });
    for (const intakePath of ["Import .elysia-addon", "Import ZIP / source bundle", "Import folder / repository", "Import manifest.json"]) {
      assert(await page.getByText(intakePath, { exact: true }).last().isVisible(), `Forge workspace must expose ${intakePath}.`);
    }
    await captureVisual(page.locator("#forge-package"), "developer-forge-draft-intake", viewport);
    const packageInput = page.getByLabel("Import .elysia-addon").last();
    currentPhase = "inspect inert package";
    await packageInput.setInputFiles({ name: "browser-intake.elysia-addon", mimeType: "application/vnd.elysia-addon+zip", buffer: intakeBytes });
    await page.getByText("3 files selected locally", { exact: false }).first().waitFor({ state: "visible" });
    assert(await page.getByText("no remote transfer occurred", { exact: false }).isVisible(), "Selecting a Forge package must remain local until separate confirmation.");
    const transferButton = page.getByRole("button", { name: "Transfer selected package privately" });
    assert(await transferButton.isDisabled(), "Private package transfer must require explicit disclosure confirmation.");
    assert(await page.getByText("will leave my computer", { exact: false }).isVisible(), "Forge private transfer disclosure is missing.");
    currentPhase = "refuse credential-bearing package";
    await packageInput.setInputFiles({ name: "blocked-browser-intake.elysia-addon", mimeType: "application/vnd.elysia-addon+zip", buffer: blockedIntakeBytes });
    await page.getByText("credential_path", { exact: true }).first().waitFor({ state: "visible" });
    assert(await transferButton.isDisabled(), "A package with blocked credential-bearing material must not become transferable.");
    const folderInput = page.getByLabel("Import folder or repository").last();
    currentPhase = "inspect real folder picker fixture";
    await folderInput.setInputFiles(validFolderFixture);
    await page.getByText("7 files selected locally", { exact: false }).first().waitFor({ state: "visible" });
    await page.locator(".addon-intake-summary").getByText("Included file tree", { exact: false }).click();
    const includedRepositoryTree = page.getByRole("tree", { name: "Included add-on repository tree" });
    await includedRepositoryTree.getByRole("treeitem", { name: /src/ }).click();
    assert(await includedRepositoryTree.getByRole("treeitem", { name: /index\.ts/ }).isVisible(), "Folder intake must surface nested source files in the hierarchical repository tree.");
    const responsiveWorkspaceTree = page.locator("#forge-workbench").getByRole("tree", { name: "Add-on workspace repository tree" });
    const responsiveTreeOverflow = await responsiveWorkspaceTree.evaluate((element) => element.scrollWidth - element.clientWidth);
    assert(responsiveTreeOverflow <= 1, `Repository explorer must remain horizontally stable at ${viewport.width}px; observed ${responsiveTreeOverflow}px.`);
    assert(await page.getByText("legacy revalidation required", { exact: true }).isVisible(), "Folder intake must surface Local Elysia schema truth.");
    assert(await transferButton.isDisabled(), "Folder selection must remain local until explicit transfer acknowledgement.");
    currentPhase = "refuse true private absolute path content";
    await folderInput.setInputFiles(privatePathFolderFixture);
    await page.getByText("private_absolute_path", { exact: true }).waitFor({ state: "visible" });
    assert(await transferButton.isDisabled(), "True private absolute paths must block remote transfer.");
    currentPhase = "refuse credential-bearing folder";
    await folderInput.setInputFiles(blockedFolderFixture);
    await page.getByText("credential_path", { exact: true }).first().waitFor({ state: "visible" });
    assert(await transferButton.isDisabled(), "A folder containing .env must not become transferable.");
    if (viewport.width >= 1000) {
      currentPhase = "inspect large repository with generated exclusions";
      await folderInput.setInputFiles(largeFolderFixture, { timeout: 90_000 });
      await page.getByText("10035 files selected locally", { exact: false }).first().waitFor({ state: "visible", timeout: 90_000 });
      const intakeSummary = page.locator(".addon-intake-summary");
      assert(await intakeSummary.getByText("needs manifest", { exact: true }).first().isVisible(), "A large ordinary repository without root manifest.json must be classified as needs manifest.");
      const missingManifestGroup = intakeSummary.locator(".addon-intake-issue-group--needs_manifest");
      assert(await missingManifestGroup.isVisible() && (await missingManifestGroup.innerText()).includes("Needs manifest"), "Missing manifest findings must not be mislabeled as a generic blocked repository.");
      assert.equal(await intakeSummary.getByText("Blocked from transfer", { exact: true }).count(), 0, "A missing manifest alone must not make local repository selection look forbidden.");
      assert(await intakeSummary.getByText("Node project detected", { exact: false }).isVisible(), "A root package.json should produce concise Node-project guidance.");
      assert(await intakeSummary.getByText("Generated/vendor exclusions (10001 files)", { exact: true }).isVisible(), "Generated/vendor exclusions must be summarized, not rendered as files.");
      assert.equal(await intakeSummary.getByText("private_absolute_path", { exact: true }).count(), 0, "Relative dependency paths must not be flagged as private absolute paths.");
      assert.equal(await intakeSummary.getByText("credentials.js", { exact: false }).count(), 0, "Credential-looking filenames inside excluded dependencies must not flood the scan UI.");
      const scriptGroup = intakeSummary.locator(".addon-intake-issue-group").filter({ hasText: "script_file" });
      assert(await scriptGroup.isVisible(), "Repeated script findings must be grouped.");
      assert(await scriptGroup.getByText("30", { exact: true }).isVisible(), "The script finding group must retain its exact count.");
      const intakeFileTreeDetails = intakeSummary.locator(".addon-intake-file-tree");
      if ((await intakeFileTreeDetails.getAttribute("open")) === null) await intakeFileTreeDetails.getByText("Included file tree", { exact: false }).click();
      const intakeRepositoryTree = intakeSummary.getByRole("tree", { name: "Included add-on repository tree" });
      assert((await intakeRepositoryTree.getByRole("treeitem").count()) <= 200, "The visible repository tree must remain capped at 200 rows.");
      assert.equal(await intakeRepositoryTree.getByText("node_modules", { exact: false }).count(), 0, "Excluded dependency paths must not flood the visible tree.");
      const treeStyle = await intakeRepositoryTree.evaluate((element) => ({ overflowY: getComputedStyle(element).overflowY, maxHeight: getComputedStyle(element).maxHeight }));
      assert(["auto", "scroll"].includes(treeStyle.overflowY) && treeStyle.maxHeight !== "none", "The included repository tree must use a bounded embedded scroller.");
      const workbench = page.locator("#forge-workbench");
      const workspaceTree = workbench.getByRole("tree", { name: "Add-on workspace repository tree" });
      assert(await workbench.getByText("Repository explorer", { exact: true }).isVisible(), "The workbench must expose a repository explorer rather than a flat file dump.");
      const scriptsFolder = workspaceTree.getByRole("treeitem", { name: /scripts 30/ });
      assert.equal(await scriptsFolder.getAttribute("aria-expanded"), "false", "Repository folders should be collapsed by default.");
      await scriptsFolder.click();
      const selectedScript = workspaceTree.getByRole("treeitem", { name: /review-29\.sh/ });
      assert(await selectedScript.isVisible(), "Expanding a repository folder must reveal its files.");
      await selectedScript.click();
      assert(await workbench.locator(".forge-editor-tabs button.active").getByText("review-29.sh", { exact: true }).isVisible(), "Selecting a repository file must open it in the bounded editor.");
      assert((await workspaceTree.getByRole("treeitem").count()) <= 240, "The workbench repository tree must cap visible rows.");
      const workspaceTreeStyle = await workspaceTree.evaluate((element) => ({ overflowY: getComputedStyle(element).overflowY, maxHeight: getComputedStyle(element).maxHeight, horizontalOverflow: element.scrollWidth - element.clientWidth }));
      assert(["auto", "scroll"].includes(workspaceTreeStyle.overflowY) && workspaceTreeStyle.maxHeight !== "none", "The workbench repository explorer must own an embedded vertical scroller.");
      assert(workspaceTreeStyle.horizontalOverflow <= 1, `Long repository paths must not create horizontal overflow; observed ${workspaceTreeStyle.horizontalOverflow}px.`);
      const groupedWorkbenchDiagnostics = workbench.getByLabel("Grouped workbench diagnostics");
      assert.equal(await groupedWorkbenchDiagnostics.getByText(/intake_script_file/).count(), 1, "Repeated workbench diagnostics must collapse into one counted group.");
      assert((await groupedWorkbenchDiagnostics.innerText()).includes("30"), "Grouped workbench diagnostics must preserve the script finding count.");
      const validationPanel = page.locator("#forge-validation");
      const validationScroller = validationPanel.locator(".forge-result-list--bounded");
      const validationStyle = await validationScroller.evaluate((element) => ({ overflowY: getComputedStyle(element).overflowY, maxHeight: getComputedStyle(element).maxHeight }));
      assert(["auto", "scroll"].includes(validationStyle.overflowY) && validationStyle.maxHeight !== "none", "Validation/static scan must own a bounded embedded scroller.");
      await captureVisual(validationPanel, "developer-forge-large-validation", viewport);
      await captureVisual(page.locator("#forge-workbench"), "developer-forge-large-workbench", viewport);
      const largePageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      assert(largePageHeight < 25_000, `Large intake must not create an unbounded page wall; observed ${largePageHeight}px.`);
    }

    currentPhase = "open Marketplace Submit";
    await page.goto(`${origin}/marketplace/submit`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Submit a complete add-on source for review" }).waitFor({ state: "visible" });
    const supabaseConfigured = await page.getByText("Sign in to create a remote review submission.", { exact: true }).isVisible().catch(() => false);
    const supabaseUnconfigured = await page.getByText("Remote review storage is not configured.", { exact: false }).isVisible().catch(() => false);
    assert.notEqual(supabaseConfigured, supabaseUnconfigured, "Marketplace Submit must expose exactly one sanitized Supabase client-configuration state.");
    observedSupabaseClientStates.add(supabaseConfigured ? "configured_public_client_no_session" : "not_configured");
    for (const intakePath of ["Import .elysia-addon", "Import ZIP / source bundle", "Import folder / repository", "Import manifest.json"]) {
      assert(await page.getByText(intakePath, { exact: true }).isVisible(), `Marketplace Submit must expose ${intakePath}.`);
    }
    assert(await page.getByText("Paste or edit manifest JSON", { exact: true }).isVisible(), "Marketplace Submit must expose pasted manifest JSON intake.");
    assert(await page.getByRole("heading", { name: "Add Git repository URL as review metadata" }).isVisible(), "Marketplace Submit must expose Git metadata as a distinct path.");
    assert(await page.getByText("Git repository URL (metadata only)", { exact: true }).isVisible(), "Marketplace Submit must label Git URLs as metadata-only.");
    await page.getByLabel("Git repository URL (metadata only)").fill("https://code.example.invalid/repository.git");
    assert.deepEqual(gitFetchRequests, [], "Entering Git URL metadata must not fetch or clone the repository.");
    assert(await page.getByRole("button", { name: "Submit private pending review" }).isDisabled(), "Remote Marketplace submission must be blocked without sign-in and confirmation.");
    assert(await page.getByText("Admin review reduces risk but does not guarantee safety", { exact: false }).isVisible(), "Marketplace submission review disclaimer is missing.");
    if (viewport.width >= 1000) {
      currentPhase = "verify large repository behavior on Marketplace Submit";
      const marketplaceFolderInput = page.getByLabel("Import folder or repository").last();
      await marketplaceFolderInput.setInputFiles(marketplaceLargeFolderFixture, { timeout: 90_000 });
      const marketplaceSummary = page.locator(".addon-intake-summary");
      await marketplaceSummary.waitFor({ state: "visible", timeout: 90_000 });
      const marketplaceSummaryText = await marketplaceSummary.innerText();
      assert(marketplaceSummaryText.includes("1232"), `Marketplace large intake must retain selected file count; summary was: ${marketplaceSummaryText.slice(0, 600)}`);
      assert(await marketplaceSummary.getByText("Generated/vendor exclusions (1200 files)", { exact: true }).isVisible(), "Marketplace Submit must share generated/vendor exclusion truth.");
      assert(await marketplaceSummary.getByText("needs manifest", { exact: true }).first().isVisible(), "Marketplace Submit must distinguish needs-manifest from forbidden selection.");
      assert.equal(await marketplaceSummary.locator(".addon-intake-issue-group").filter({ hasText: "private_absolute_path" }).count(), 0, "Marketplace Submit must not flag relative dependency paths as private absolute paths.");
      const marketplaceFileTreeDetails = marketplaceSummary.locator(".addon-intake-file-tree");
      if ((await marketplaceFileTreeDetails.getAttribute("open")) === null) await marketplaceFileTreeDetails.getByText("Included file tree", { exact: false }).click();
      const marketplaceRepositoryTree = marketplaceSummary.getByRole("tree", { name: "Included add-on repository tree" });
      assert(await marketplaceRepositoryTree.getByRole("treeitem", { name: /scripts 30/ }).isVisible(), "Marketplace Submit must share the hierarchical repository tree.");
      const marketplaceTreeStyle = await marketplaceRepositoryTree.evaluate((element) => ({ overflowY: getComputedStyle(element).overflowY, maxHeight: getComputedStyle(element).maxHeight, horizontalOverflow: element.scrollWidth - element.clientWidth }));
      assert(["auto", "scroll"].includes(marketplaceTreeStyle.overflowY) && marketplaceTreeStyle.maxHeight !== "none" && marketplaceTreeStyle.horizontalOverflow <= 1, "Marketplace Submit repository tree must remain bounded without horizontal overflow.");
    }
    await captureVisual(page.locator(".submission-card"), "marketplace-submit-intake", viewport);

    currentPhase = "open Marketplace Browse";
    await page.goto(`${origin}/marketplace/browse`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Browse Elysia add-ons" }).waitFor({ state: "visible" });
    assert(await page.getByRole("heading", { name: "Codev" }).isVisible(), "Codev official candidate must appear in the local fallback catalog.");
    assert(await page.getByRole("button", { name: "Candidate · not installable" }).isDisabled(), "Codev candidate must not expose a working install action.");
    for (const staleListing of ["Advanced PDF Parser", "Ollama Local Models", "SearXNG Research"]) {
      assert.equal(await page.getByText(staleListing, { exact: true }).count(), 0, `${staleListing} must not appear in the v1 Marketplace catalog.`);
    }
    await captureVisual(page.locator(".catalog-page"), "marketplace-browse-truth", viewport);
    assert.equal(
      await page
        .getByRole("button", { name: /^(run|execute|install|enable)$/i })
        .count(),
      0,
      "Developer Forge must not expose code execution or installation controls.",
    );
    assert.equal(
      sandboxRequests.length,
      0,
      `Developer Forge must not call the sandbox: ${sandboxRequests.join(", ")}`,
    );
    assert(
      loadedScripts.some(
        (asset) =>
          /\/assets\/developer-forge-[^/]+\.js$/.test(
            new URL(asset.url).pathname,
          ) &&
          asset.status === 200 &&
          asset.type.includes("javascript"),
      ),
      "The Developer Forge chunk must load successfully as JavaScript.",
    );
    assert.deepEqual(
      failedRequests,
      [],
      `Same-origin requests failed: ${failedRequests.join("\n")}`,
    );
    assert.deepEqual(
      badResponses,
      [],
      `Same-origin responses failed: ${badResponses.join("\n")}`,
    );
    assert.deepEqual(
      pageErrors,
      [],
      `Uncaught browser errors occurred: ${pageErrors.join("\n")}\nConsole: ${consoleErrors.join("\n")}\nFailed requests: ${failedRequests.join("\n")}\nBad responses: ${badResponses.join("\n")}`,
    );
    assert.deepEqual(
      consoleErrors,
      [],
      `Browser console errors occurred: ${consoleErrors.join("\n")}`,
    );
    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    assert(
      horizontalOverflow <= 1,
      `Developer Forge overflows horizontally by ${horizontalOverflow}px at ${viewport.width}px.`,
    );
    await context.close();
  }
  console.log(
    "Developer Forge CSP browser regression test passed at desktop and mobile widths.",
  );
  console.log(`Sanitized Supabase browser state: ${[...observedSupabaseClientStates].join(", ")}.`);
  if (visualProofRoot) console.log(`Pass 8D visual proof written to ${visualProofRoot}.`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await fs.rm(folderFixtureRoot, { recursive: true, force: true });
}
