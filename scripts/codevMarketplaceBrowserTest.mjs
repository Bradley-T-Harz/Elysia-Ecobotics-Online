import { runCodevForgeBrowserScenarios } from "./codevForgeBrowserScenarios.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { chromium, firefox } from "playwright";
import JSZip from "jszip";
import {
  createWorkspacePageFixture,
  ids,
} from "./fixtures/browserWorkspacePageFixture.mjs";
assert(
  process.env.ELYSIA_QA_ROOT?.startsWith("/tmp/elysia-pass10d-i-"),
  "Use Elysia disposable-XDG backend test runner.",
);
const root = process.cwd(),
  dist = path.join(root, "dist"),
  origin = "https://elysiaecobotics.com";
const browserFamily = process.env.ELYSIA_CODEV_BROWSER_FAMILY || "chromium";
assert(["chromium", "firefox"].includes(browserFamily), "Unsupported Codev qualification browser");
const output =
  process.env.ELYSIA_CODEV_MARKETPLACE_EVIDENCE ||
  "/tmp/elysia-codev-marketplace-browser";
await fs.mkdir(output, { recursive: true });
const source = await Promise.all(
  (await fs.readdir(path.join(dist, "assets")))
    .filter((name) => name.endsWith(".js"))
    .map((name) => fs.readFile(path.join(dist, "assets", name), "utf8")),
);
assert(
  source.some((value) =>
    value.includes("https://readiness-fixture.supabase.co"),
  ),
);
assert(
  !source.some((value) =>
    /https:\/\/(?!readiness-fixture\.)[a-z0-9-]+\.supabase\.co/.test(value),
  ),
  "Synthetic build only",
);
const csp = (await fs.readFile("public/_headers", "utf8")).match(
  /^\s*Content-Security-Policy:\s*(.+)$/m,
)[1];
const helper = await build({
  stdin: {
    contents:
      'import * as workspace from "./src/shared/codev/workspace";import * as recovery from "./src/shared/codev/workspaceRecovery";import * as patch from "./src/shared/codev/patchRecovery";window.codevPageTest={...workspace,...recovery,...patch};',
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
});
const child = spawn(
  process.env.ELYSIA_TEST_PYTHON || "python",
  ["-u", "-m", "tests.codev_browser_fixture"],
  {
    cwd: path.resolve(root, "../Elysia"),
    env: process.env,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  },
);
let stderr = "";
child.stderr.on("data", (chunk) => (stderr += chunk));
const queue = [],
  waiters = [];
createInterface({ input: child.stdout }).on("line", (line) => {
  if (!line.startsWith("{")) return;
  const data = JSON.parse(line);
  if (data.disposable_xdg) return;
  const waiter = waiters.shift();
  if (waiter) waiter(data);
  else queue.push(data);
});
const next = () =>
  queue.length
    ? Promise.resolve(queue.shift())
    : new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Native fixture timeout: " + stderr)),
          20000,
        );
        waiters.push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
let commands = Promise.resolve();
const command = (data) => {
  const result = commands.then(() => {
    child.stdin.write(JSON.stringify(data) + "\n");
    return next();
  });
  commands = result.catch(() => {});
  return result;
};
const mime = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".html": "text/html",
  ".json": "application/json",
};
const pageErrors = [],
  forbidden = [],
  evidence = [],
  cloud = [];
let activePage, browser;
async function serve(route, { session, controls }) {
  const request = route.request(),
    url = new URL(request.url());
  if (url.pathname === "/codev-page-helper.js")
    return route.fulfill({
      contentType: "application/javascript",
      body: helper.outputFiles[0].text,
    });
  if (url.pathname.startsWith("/api/codev/")) {
    assert.equal(
      request.headers().authorization,
      "Bearer " + session.access_token,
    );
    assert.equal(request.method(), "POST");
    const data = request.postDataJSON();
    cloud.push({ route: url.pathname, fields: Object.keys(data) });
    const result = url.pathname.endsWith("/create")
      ? await command({
          op: "create",
          account_id: session.user.id,
          surface: data.surface,
          browser_id: data.browser_session_id,
          key: data.browser_public_key,
        })
      : await command({
          op: "browser",
          account_id: session.user.id,
          browser_id: data.browser_session_id,
          pairing_id: data.pairing_id,
          action: data.action,
        });
    if (url.pathname.endsWith("/create") && controls.delayPairCreate) {
      const delay = controls.delayPairCreate;
      controls.delayPairCreate = null;
      await delay;
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  }
  const servingDist = controls.baseline || dist;
  const pathname = decodeURIComponent(url.pathname),
    file = path.resolve(servingDist, "." + pathname);
  assert(file.startsWith(servingDist + path.sep));
  let body, type;
  try {
    body = await fs.readFile(file);
    type = mime[path.extname(file)] || "application/octet-stream";
  } catch {
    body = await fs.readFile(path.join(servingDist, "index.html"));
    type = "text/html";
  }
  return route.fulfill({
    headers: {
      "content-type": type,
      "cache-control": "no-store",
      "content-security-policy": csp,
      "permissions-policy": "loopback-network=(self), local-network=()",
    },
    body,
  });
}
async function allowLoopback(f) {
  if (browserFamily === "firefox") return; // Qualify Firefox's default security posture.
  const cdp = await f.context.newCDPSession(f.page);
  const browserContextId = (await cdp.send("Target.getTargetInfo")).targetInfo
    .browserContextId;
  await cdp.send("Browser.setPermission", {
    permission: { name: "loopback-network" },
    setting: "granted",
    origin,
    browserContextId,
  });
}
async function capture(f, name) {
  activePage = f.page;
  if (!(await f.page.locator(".codev-dialog[open]").count())) {
    await f.page.locator("[data-codev-slot]").scrollIntoViewIfNeeded();
    await f.page.evaluate(() => scrollBy(0, -90));
  }
  await f.page.screenshot({ path: path.join(output, name + ".png") });
  const overflow = await f.page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert(overflow <= 1);
  evidence.push({ name, overflow, route: new URL(f.page.url()).pathname });
}
async function inspectWorkspace(f) {
  await f.page.addScriptTag({ url: origin + "/codev-page-helper.js" });
  return f.page.evaluate(async (accountId) => {
    const x = window.codevPageTest;
    const owner = {
      accountId,
      browserId: x.browserWorkspaceId(),
      surface: "marketplace",
      draftId: null,
    };
    const recovered = await x.loadWorkspaceRecovery(owner);
    const capture = await recovered.workspace.capture();
    return {
      revision: capture.revision,
      files: capture.files,
      backups: await x.listCodevPatchBackups(owner),
    };
  }, f.session.user.id);
}
async function clickFinish(f) {
  await Promise.all([
    f.page.waitForEvent("load"),
    f.page
      .getByRole("button", { name: "Finish sync and refresh", exact: true })
      .click(),
  ]);
  await f.page
    .getByText("Codev · connected locally", { exact: true })
    .waitFor();
}
try {
  assert((await next()).fixture_ready);
  browser = await ({ chromium, firefox }[browserFamily]).launch({ headless: true });
  const fixture = createWorkspacePageFixture({
    browser,
    origin,
    pageErrors,
    forbidden,
    serve,
    allowLoopback: true,
  });
  const visitor = await fixture("visitor");
  activePage = visitor.page;
  await visitor.page.goto(origin + "/marketplace/submit");
  await visitor.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  assert.equal((await command({ op: "counts" })).requests, 0);
  assert.equal(cloud.length, 0);
  assert.equal(await visitor.page.locator(".codev-dialog").count(), 0);
  await visitor.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .click();
  await visitor.page
    .getByText("Sign in to the website before syncing Codev.", { exact: true })
    .waitFor();
  assert.equal(cloud.length, 0);
  await visitor.page
    .getByRole("button", { name: "Close Codev", exact: true })
    .click();
  await capture(visitor, "marketplace-visitor-unsynced");
  await visitor.context.close();
  const f = await fixture("manager");
  activePage = f.page;
  await allowLoopback(f);
  await f.page.goto(origin + "/marketplace/submit");
  await f.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  await f.page.waitForTimeout(700);
  assert.equal(cloud.length, 0);
  assert.equal((await command({ op: "counts" })).requests, 0);
  await capture(f, "marketplace-signed-in-unsynced");
  const baselineDirectory = process.env.ELYSIA_CODEV_BEFORE_SYNC;
  if (baselineDirectory) {
    const baseline = await fixture("manager");
    baseline.controls.baseline = baselineDirectory;
    await baseline.page.goto(origin + "/marketplace/submit");
    await baseline.page.getByLabel("Add-on name", { exact: true }).waitFor();
    await baseline.page.waitForTimeout(700);
    const normalize = () => {
      const value = document.querySelector(".submission-card").cloneNode(true);
      value.querySelector("[data-codev-slot]")?.remove();
      value
        .querySelectorAll('[style=""]')
        .forEach((element) => element.removeAttribute("style"));
      return value.outerHTML;
    };
    const oldDOM = await baseline.page.evaluate(normalize),
      newDOM = await f.page.evaluate(normalize);
    await fs.writeFile(path.join(output, "unsynced-before.html"), oldDOM);
    await fs.writeFile(
      path.join(output, "unsynced-after-minus-sync.html"),
      newDOM,
    );
    assert.equal(
      newDOM,
      oldDOM,
      "Unsynced submission DOM may change only by the Sync Codev slot",
    );
    await baseline.page
      .locator(".submission-card")
      .screenshot({ path: path.join(output, "before-sync-submission.png") });
    // Remove only the new slot in a separate baseline-comparison document.
    await f.page
      .locator("[data-codev-slot]")
      .evaluate((value) => value.remove());
    await f.page.locator(".submission-card").screenshot({
      path: path.join(output, "after-minus-sync-submission.png"),
    });
    assert.deepEqual(
      await fs.readFile(path.join(output, "before-sync-submission.png")),
      await fs.readFile(path.join(output, "after-minus-sync-submission.png")),
      "Rendered ordinary form must be pixel-identical without the one Sync slot",
    );
    evidence.push({
      name: "unsynced-baseline-preservation",
      domIdentical: true,
      screenshotBytesIdentical: true,
    });
    await baseline.context.close();
    await f.page.reload();
    await f.page
      .getByRole("button", { name: "Sync Codev", exact: true })
      .waitFor();
  }

  await f.page
    .getByLabel("Publisher account", { exact: true })
    .selectOption(ids.publisher);
  await f.page
    .getByRole("button", { name: "Use my Commons Profile display name" })
    .click();
  const manifest = JSON.parse(
    await f.page
      .getByLabel("Paste or edit manifest JSON", { exact: true })
      .inputValue(),
  );
  const license =
    "Full synthetic license\nPermission is granted to preserve this exact text.\nNo warranty.\n";
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("LICENSE", license);
  zip.file("src/main.ts", "export const answer = 1;\n");
  zip.file("assets/data.bin", new Uint8Array([0, 255, 128, 42]));
  await f.page.getByLabel("Import .elysia-addon").setInputFiles({
    name: "codev-fixture.elysia-addon",
    mimeType: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await f.page.getByText("Included file tree", { exact: false }).waitFor();
  await f.page
    .getByLabel("Add-on name", { exact: true })
    .fill("Dirty name preserved by Sync");
  await f.page.getByRole("button", { name: "Sync Codev", exact: true }).click();
  const code = await f.page.getByLabel("Codev pairing code").inputValue();
  assert.equal(
    (await command({ op: "counts" })).requests,
    0,
    "Creating an intent must not probe loopback",
  );
  await f.page
    .getByRole("button", { name: "Finish sync and refresh", exact: true })
    .click();
  await f.page
    .getByText(
      "Open local Elysia’s Codev workroom, review this code, and approve the displayed website account first.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    (await command({ op: "counts" })).requests,
    0,
    "Unapproved pairing must not reach the broker",
  );
  await command({ op: "configure", installed: false });
  const absent = await command({ op: "approve", code });
  assert.equal(absent.ok, false);
  assert.equal((await command({ op: "counts" })).requests, 0);
  await command({ op: "configure", installed: true });
  assert((await command({ op: "approve", code })).ok);
  await capture(f, "marketplace-native-approval-required-refresh");
  assert.equal(
    await f.page
      .getByText("Codev · connected locally", { exact: true })
      .count(),
    0,
  );
  await clickFinish(f);
  assert.equal(
    await f.page.getByLabel("Add-on name", { exact: true }).inputValue(),
    "Dirty name preserved by Sync",
  );
  assert.equal(
    await f.page
      .getByRole("button", { name: "Sync Codev", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await f.page.locator('[data-codev-slot="marketplace"]').count(),
    1,
  );
  assert.equal(
    await f.page.getByText("No workspace shared", { exact: true }).count(),
    1,
  );
  assert.deepEqual((await command({ op: "counts" })).workspaces, []);
  assert.equal(f.writes.length, 0);
  const recovered = await inspectWorkspace(f);
  assert.equal(
    recovered.files.find((file) => file.path === "LICENSE").text,
    license,
  );
  assert.equal(recovered.files.length, 4);
  assert.deepEqual(recovered.backups, []);
  await capture(f, "marketplace-connected-no-workspace");
  const beforeClone = await command({ op: "counts" });
  const popupPromise = f.context.waitForEvent("page");
  await f.page.evaluate(() => window.open("/marketplace/submit", "_blank"));
  const popup = await popupPromise;
  await popup
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  assert.equal(
    await popup.getByText("Codev · connected locally", { exact: true }).count(),
    0,
  );
  assert.equal(
    (await command({ op: "counts" })).requests,
    beforeClone.requests,
    "A cloned tab must not inherit or probe the preceding tab’s authority",
  );
  await popup.reload();
  await popup
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  assert.equal(
    (await command({ op: "counts" })).requests,
    beforeClone.requests,
    "Reloading a cloned tab must still require its own explicit Sync",
  );
  await popup.close();

  await f.page
    .locator('[data-codev-slot="marketplace"]')
    .getByRole("button", { name: "Open", exact: true })
    .click();
  assert.equal(
    await f.page.locator(".codev-file-selection input:checked").count(),
    0,
  );
  await f.page
    .locator(".codev-file-selection label")
    .filter({ hasText: "manifest.json" })
    .locator("input")
    .check();
  await f.page
    .getByRole("button", { name: "Share selected context (1)", exact: true })
    .click();
  await f.page
    .getByText("Workspace: read only", { exact: false })
    .first()
    .waitFor();
  assert.deepEqual((await command({ op: "counts" })).workspaces[0].files, [
    "manifest.json",
  ]);
  await f.page
    .getByRole("button", { name: "Conversation", exact: true })
    .click();
  await f.page
    .getByLabel("Ask Codev", { exact: true })
    .fill("Review only the selected manifest.");
  await f.page
    .getByRole("button", { name: "Send to local Codev", exact: true })
    .click();
  await f.page
    .getByText("Synthetic provider review:", { exact: false })
    .waitFor();
  assert.equal(
    await f.page
      .getByRole("button", { name: "Review proposed edits", exact: true })
      .count(),
    0,
    "Read grant must not expose an edit approval",
  );
  assert.deepEqual((await command({ op: "counts" })).model_contexts[0].files, [
    "manifest.json",
  ]);
  await f.page.getByRole("button", { name: "Context", exact: true }).click();
  await f.page
    .locator(".codev-file-selection label")
    .filter({ hasText: "src/main.ts" })
    .locator("input")
    .check();
  await f.page
    .getByLabel(
      "Allow proposals for selected files; each patch still needs exact approval.",
    )
    .check();
  await f.page
    .getByRole("button", { name: "Share selected context (2)", exact: true })
    .click();
  await f.page
    .getByText("Workspace: read / propose edits", { exact: false })
    .first()
    .waitFor();
  const currentManifest = JSON.parse(
    recovered.files.find((file) => file.path === "manifest.json").text,
  );
  currentManifest.name = "Accepted Codev manifest edit";
  await command({
    op: "configure",
    edits: {
      "manifest.json": JSON.stringify(currentManifest, null, 2),
      "src/main.ts": "export const answer = 2;\n",
    },
  });
  await f.page
    .getByRole("button", { name: "Conversation", exact: true })
    .click();
  await f.page
    .getByLabel("Ask Codev", { exact: true })
    .fill("Propose the focused changes as JSON.");
  await f.page
    .getByRole("button", { name: "Send to local Codev", exact: true })
    .click();
  await f.page
    .getByText("Synthetic provider proposes a focused improvement", {
      exact: false,
    })
    .waitFor();
  await f.page
    .getByRole("button", { name: "Review proposed edits", exact: true })
    .last()
    .click();
  await f.page
    .getByRole("button", { name: "Apply these 2 changes", exact: true })
    .waitFor();
  await capture(f, "marketplace-exact-manifest-and-source-diff");
  // Editing while the drawer is closed must make the visible exact proposal stale.
  await f.page
    .getByRole("button", { name: "Close Codev", exact: true })
    .click();
  await f.page
    .getByLabel("Add-on name", { exact: true })
    .fill("A newer local revision");
  await f.page
    .getByLabel("Add-on name", { exact: true })
    .fill("Dirty name preserved by Sync");
  await f.page
    .locator('[data-codev-slot="marketplace"]')
    .getByRole("button", { name: "Open", exact: true })
    .click();
  assert(
    await f.page
      .getByRole("button", { name: "Apply these 2 changes", exact: true })
      .isDisabled(),
  );
  await f.page.getByText("This proposal is stale.", { exact: false }).waitFor();
  await f.page.getByRole("button", { name: "Context", exact: true }).click();
  await f.page
    .getByRole("button", { name: "Share selected context (2)", exact: true })
    .click();
  await f.page
    .getByText("Workspace: read / propose edits", { exact: false })
    .first()
    .waitFor();
  await f.page
    .getByRole("button", { name: "Conversation", exact: true })
    .click();
  await f.page
    .getByLabel("Ask Codev", { exact: true })
    .fill("Propose those changes against this newer revision.");
  await f.page
    .getByRole("button", { name: "Send to local Codev", exact: true })
    .click();
  await f.page
    .getByRole("button", { name: "Review proposed edits", exact: true })
    .last()
    .click();
  await f.page
    .getByRole("button", { name: "Apply these 2 changes", exact: true })
    .waitFor();
  await f.page
    .getByRole("button", { name: "Apply these 2 changes", exact: true })
    .click();
  await f.page
    .getByText("Accepted changes are in the browser workspace.", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    await f.page.getByLabel("Add-on name", { exact: true }).inputValue(),
    "Accepted Codev manifest edit",
  );
  const accepted = await inspectWorkspace(f);
  assert.equal(accepted.revision, recovered.revision + 3);
  assert.equal(
    accepted.files.find((file) => file.path === "src/main.ts").text,
    "export const answer = 2;\n",
  );
  assert.equal(
    accepted.files.find((file) => file.path === "LICENSE").content_hash,
    recovered.files.find((file) => file.path === "LICENSE").content_hash,
  );
  assert.equal(
    accepted.files.find((file) => file.path === "assets/data.bin").content_hash,
    recovered.files.find((file) => file.path === "assets/data.bin")
      .content_hash,
  );
  assert.equal(accepted.backups.length, 1);
  assert.equal(f.writes.length, 0);
  await f.page
    .getByRole("button", { name: "Trace & recovery", exact: true })
    .click();
  await capture(f, "marketplace-browser-patch-recovery");
  await f.page
    .getByRole("button", { name: "Close Codev", exact: true })
    .click();
  await f.page.reload();
  await f.page
    .getByText("Codev · connected locally", { exact: true })
    .waitFor();
  await f.page.getByText("No workspace shared", { exact: true }).waitFor();
  assert.deepEqual((await command({ op: "counts" })).workspaces, []);
  assert.equal(
    await f.page.getByLabel("Add-on name", { exact: true }).inputValue(),
    "Accepted Codev manifest edit",
  );
  await f.page
    .locator('[data-codev-slot="marketplace"]')
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await f.page
    .getByRole("button", { name: "Trace & recovery", exact: true })
    .click();
  await f.page
    .getByRole("button", { name: "Restore original text", exact: true })
    .click();
  await f.page
    .getByText("Original browser text restored at revision", { exact: false })
    .waitFor();
  assert.equal(
    await f.page.getByLabel("Add-on name", { exact: true }).inputValue(),
    "Dirty name preserved by Sync",
  );
  await f.page
    .getByRole("button", { name: "Disconnect Codev", exact: true })
    .click();
  await f.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  assert.equal(f.writes.length, 0);
  // Accepted source after disconnect still uses the ordinary explicit private transfer.
  await f.page
    .locator("label.checkbox-line")
    .filter({
      hasText: "manifest and any selected package files will leave my computer",
    })
    .locator("input")
    .check();
  await f.page
    .getByRole("button", { name: "Submit private pending review", exact: true })
    .click();
  await f.page.waitForFunction(
    () =>
      document.body.textContent.includes(
        "private Developer Forge review queue",
      ) ||
      document.body.textContent.includes(
        "private submission record was created",
      ),
  );
  assert.equal(f.storedBytes.length, 1);
  const sent = await JSZip.loadAsync(f.storedBytes[0]);
  assert.equal(await sent.file("LICENSE").async("string"), license);
  assert.equal(
    await sent.file("src/main.ts").async("string"),
    "export const answer = 1;\n",
  );
  assert.deepEqual(
    [...(await sent.file("assets/data.bin").async("uint8array"))],
    [0, 255, 128, 42],
  );
  await capture(f, "marketplace-existing-private-submission-after-disconnect");
  await f.context.close();
  const mobile = await fixture("manager", { mobile: true });
  activePage = mobile.page;
  await allowLoopback(mobile);
  await mobile.page.goto(origin + "/marketplace/submit");
  await mobile.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .click();
  const mobileCode = await mobile.page
    .getByLabel("Codev pairing code")
    .inputValue();
  await capture(mobile, "marketplace-mobile-sync");
  await command({ op: "approve", code: mobileCode });
  await clickFinish(mobile);
  await mobile.page
    .locator('[data-codev-slot="marketplace"]')
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await capture(mobile, "marketplace-mobile-connected-context");
  await mobile.page
    .getByRole("button", { name: "Disconnect Codev", exact: true })
    .click();
  await mobile.context.close();
  if (process.env.ELYSIA_CODEV_FORGE_BROWSER === "1")
    await runCodevForgeBrowserScenarios({
      fixture,
      command,
      origin,
      output,
      capture,
      allowLoopback,
      clickFinish,
      evidence,
      setActivePage: (page) => {
        activePage = page;
      },
    });
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(forbidden, []);
  const result = {
    marker: "actual_marketplace_codev_browser_ok",
    syntheticIdentityInstallationProvider: true,
    realSignedBroker: true,
    browser: browser.version(),
    securityFlagsDisabled: false,
    evidence,
    cloud,
    pageErrors,
    forbidden,
  };
  await fs.writeFile(
    path.join(output, "results.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, "failure.png") });
    await fs.writeFile(
      path.join(output, "failure.txt"),
      await activePage.locator("body").innerText(),
    );
  }
  throw error;
} finally {
  await browser?.close();
  child.stdin.write('{"op":"stop"}\n');
  child.stdin.end();
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
