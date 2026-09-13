import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { ids } from "./fixtures/browserWorkspacePageFixture.mjs";

export async function runCodevForgeBrowserScenarios({
  fixture,
  command,
  origin,
  output,
  capture,
  allowLoopback,
  clickFinish,
  evidence,
  setActivePage,
}) {
  async function active(f) {
    setActivePage(f.page);
    return f;
  }
  async function open(f) {
    await f.page
      .locator('[data-codev-slot="forge"]')
      .getByRole("button", { name: "Open", exact: true })
      .click();
  }
  async function sync(f) {
    await f.page
      .getByRole("button", { name: "Sync Codev", exact: true })
      .click();
    const code = await f.page.getByLabel("Codev pairing code").inputValue();
    assert((await command({ op: "approve", code })).ok);
    await clickFinish(f);
  }
  async function editor(f, name, text) {
    await f.page
      .locator(".forge-editor-tabs")
      .getByRole("button", { name, exact: true })
      .click();
    const input = f.page.locator('.monaco-editor [role="textbox"]').first();
    await input.waitFor({ state: "attached" });
    await input.focus();
    await input.press("ControlOrMeta+A");
    // Real keyboard events keep Monaco's Firefox input bookkeeping in sync.
    await f.page.keyboard.type(text);
    await f.page.waitForTimeout(80);
  }
  async function exported(f) {
    const [file] = await Promise.all([
      f.page.waitForEvent("download"),
      f.page
        .getByRole("button", {
          name: "Export current inert .elysia-addon",
          exact: true,
        })
        .click(),
    ]);
    return JSZip.loadAsync(await fs.readFile(await file.path()));
  }
  async function currentSession(f, session) {
    Object.assign(f.session, session);
    await f.page.evaluate((value) => {
      localStorage.setItem(
        "sb-readiness-fixture-auth-token",
        JSON.stringify(value),
      );
      const channel = new BroadcastChannel("sb-readiness-fixture-auth-token");
      channel.postMessage({ event: "TOKEN_REFRESHED", session: value });
      setTimeout(() => channel.close(), 50);
    }, session);
  }
  async function proposal(f, text) {
    await f.page
      .getByRole("button", { name: "Conversation", exact: true })
      .click();
    await f.page.getByLabel("Ask Codev", { exact: true }).fill(text);
    await f.page
      .getByRole("button", { name: "Send to local Codev", exact: true })
      .click();
    await f.page
      .getByRole("button", { name: "Review proposed edits", exact: true })
      .last()
      .waitFor();
    await f.page
      .getByRole("button", { name: "Review proposed edits", exact: true })
      .last()
      .click();
  }
  const before = await command({ op: "counts" });
  const visitor = await active(await fixture("visitor"));
  await visitor.page.goto(origin + "/developer-forge/drafts");
  await visitor.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  assert.equal(await visitor.page.locator(".codev-dialog").count(), 0);
  assert.equal((await command({ op: "counts" })).requests, before.requests);
  await capture(visitor, "forge-visitor-unsynced");
  await visitor.context.close();
  const f = await active(await fixture("manager"));
  await allowLoopback(f);
  await f.page.goto(origin + "/developer-forge/drafts/new");
  await f.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  await f.page.waitForTimeout(500);
  const baselineDirectory = process.env.ELYSIA_CODEV_BEFORE_FORGE;
  if (baselineDirectory) {
    const previous = await fixture("manager");
    previous.controls.baseline = baselineDirectory;
    await previous.page.goto(origin + "/developer-forge/drafts/new");
    await previous.page
      .getByRole("heading", { name: "Create a blank draft", exact: true })
      .waitFor();
    await previous.page.waitForTimeout(500);
    const normalized = () => {
      const copy = document
        .querySelector(".developer-forge-page")
        .cloneNode(true);
      copy.querySelector("[data-codev-slot]")?.remove();
      copy
        .querySelectorAll('[style=""]')
        .forEach((value) => value.removeAttribute("style"));
      return copy.outerHTML;
    };
    const oldDOM = await previous.page.evaluate(normalized),
      newDOM = await f.page.evaluate(normalized);
    await fs.writeFile(path.join(output, "forge-before.html"), oldDOM);
    await fs.writeFile(
      path.join(output, "forge-after-minus-sync.html"),
      newDOM,
    );
    assert.equal(
      newDOM,
      oldDOM,
      "Unsynced Forge DOM may differ only by Sync Codev",
    );
    await previous.page
      .locator(".developer-forge-page")
      .screenshot({ path: path.join(output, "forge-before-sync.png") });
    await f.page
      .locator("[data-codev-slot]")
      .evaluate((value) => value.remove());
    await f.page
      .locator(".developer-forge-page")
      .screenshot({ path: path.join(output, "forge-after-minus-sync.png") });
    assert.deepEqual(
      await fs.readFile(path.join(output, "forge-before-sync.png")),
      await fs.readFile(path.join(output, "forge-after-minus-sync.png")),
    );
    evidence.push({
      name: "forge-unsynced-preservation",
      domIdentical: true,
      screenshotBytesIdentical: true,
    });
    await previous.context.close();
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
  await f.page
    .getByLabel("Add-on name", { exact: true })
    .fill("Forge name preserved by Sync");
  const writesBefore = f.writes.length;
  await sync(f);
  assert.equal(
    await f.page.getByLabel("Add-on name", { exact: true }).inputValue(),
    "Forge name preserved by Sync",
  );
  assert.equal(
    await f.page.getByLabel("Publisher account", { exact: true }).inputValue(),
    ids.publisher,
  );
  assert.equal(
    await f.page
      .getByLabel("Creator / Organization", { exact: true })
      .inputValue(),
    "Synthetic Commons Name",
  );
  assert.equal(f.writes.length, writesBefore);
  await open(f);
  await f.page
    .getByText("Choose a draft on this page to select development context.", {
      exact: false,
    })
    .waitFor();
  assert.equal(await f.page.locator(".codev-file-selection").count(), 0);
  await capture(f, "forge-connected-before-draft-selection");
  await f.page
    .getByRole("button", { name: "Close Codev", exact: true })
    .click();
  await f.page
    .getByRole("button", { name: "Create blank manifest draft", exact: true })
    .click();
  await f.page.getByText("Blank draft created.", { exact: true }).waitFor();
  await f.page.getByRole("link", { name: "Drafts", exact: true }).click();
  await f.page
    .getByRole("heading", {
      name: "Package and repository intake",
      exact: true,
    })
    .waitFor();
  const firstDraft = f.drafts[0];
  const license =
    "Synthetic Forge full license\nAll exact license lines must survive.\nNo warranty.\n";
  const readme = "# Forge fixture\n\nUnsaved README edits before Sync.\n";
  const archive = new JSZip();
  archive.file(
    "manifest.json",
    JSON.stringify(firstDraft.manifest_json, null, 2),
  );
  archive.file("README.md", "# Initial readme\n");
  archive.file("LICENSE", license);
  archive.file("src/main.ts", "export const answer = 1;\n");
  archive.file("assets/data.bin", new Uint8Array([0, 255, 128, 42]));
  await f.page
    .getByLabel("Import .elysia-addon")
    .last()
    .setInputFiles({
      name: "forge-codev-fixture.elysia-addon",
      mimeType: "application/zip",
      buffer: await archive.generateAsync({ type: "nodebuffer" }),
    });
  await f.page
    .getByText("5 files selected locally", { exact: false })
    .first()
    .waitFor();
  await open(f);
  await f.page
    .getByRole("button", { name: "Disconnect Codev", exact: true })
    .click();
  await editor(f, "README.md", readme);
  assert.equal(await (await exported(f)).file("README.md").async("string"), readme);
  const beforeDirtySync = f.writes.length;
  await sync(f);
  assert.equal(
    await f.page.locator(".forge-editor-tabs button.active").innerText(),
    "README.md",
  );
  assert.equal(new URL(f.page.url()).pathname, "/developer-forge/drafts");
  assert.equal(f.writes.length, beforeDirtySync);
  await f.page.getByText("No workspace shared", { exact: true }).waitFor();
  const recovered = await exported(f);
  assert.equal(await recovered.file("README.md").async("string"), readme);
  assert.equal(await recovered.file("LICENSE").async("string"), license);
  assert.deepEqual(
    [...(await recovered.file("assets/data.bin").async("uint8array"))],
    [0, 255, 128, 42],
  );
  await open(f);
  assert.equal(
    await f.page.locator(".codev-file-selection input:checked").count(),
    0,
  );
  await f.page.getByText("Active file: README.md", { exact: true }).waitFor();
  for (const name of ["README.md", "src/main.ts"])
    await f.page
      .locator(".codev-file-selection label")
      .filter({ hasText: name })
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
  await command({
    op: "configure",
    edits: {
      "README.md": "# Proposed README text\n",
      "src/main.ts": "export const answer = 2;\n",
    },
  });
  await proposal(f, "Propose focused changes to these two selected files.");
  await f.page
    .getByRole("button", { name: "Apply these 2 changes", exact: true })
    .waitFor();
  await capture(f, "forge-file-by-file-proposal-review");
  await f.page
    .locator("details.codev-diff")
    .filter({ hasText: "README.md" })
    .getByRole("button", { name: "Reject this file", exact: true })
    .click();
  await f.page
    .getByRole("button", { name: "Apply these 1 changes", exact: true })
    .waitFor();
  assert.equal(await f.page.locator("details.codev-diff").count(), 1);
  await f.page
    .getByRole("button", { name: "Apply these 1 changes", exact: true })
    .click();
  await f.page
    .getByText("Accepted changes are in the browser workspace.", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    f.writes.length,
    beforeDirtySync,
    "Codev must not save remote draft metadata or packages",
  );
  await f.page
    .getByRole("button", { name: "Close Codev", exact: true })
    .click();
  const edited = await exported(f);
  assert.equal(
    await edited.file("src/main.ts").async("string"),
    "export const answer = 2;\n",
  );
  assert.equal(await edited.file("README.md").async("string"), readme);
  assert.equal(await edited.file("LICENSE").async("string"), license);
  await f.page.getByRole("button", { name: "Save draft", exact: true }).click();
  await f.page
    .getByText("Current files are saved in this browser", { exact: false })
    .waitFor();
  assert.equal(firstDraft.license, "MIT");
  await open(f);
  await f.page.getByRole("button", { name: "Context", exact: true }).click();
  await f.page
    .getByRole("button", { name: "Share selected context (2)", exact: true })
    .click();
  await f.page
    .getByText("Workspace: read / propose edits", { exact: false })
    .first()
    .waitFor();
  await command({
    op: "configure",
    edits: { "README.md": "# Review must not mutate a locked draft\n" },
  });
  await proposal(f, "Propose a README-only revision.");
  await f.page
    .getByRole("button", { name: "Apply these 1 changes", exact: true })
    .waitFor();
  await f.page
    .getByRole("button", { name: "Close Codev", exact: true })
    .click();
  firstDraft.locked_at = new Date().toISOString();
  firstDraft.review_status = "pending_review";
  const refreshed = {
    ...f.session,
    access_token: f.session.access_token.replace(".synthetic", ".refreshed"),
  };
  await currentSession(f, refreshed);
  await f.page
    .getByText(
      "This submitted draft is locked to protect the review snapshot.",
      { exact: false },
    )
    .waitFor();
  await open(f);
  assert(
    await f.page
      .getByRole("button", { name: "Apply these 1 changes", exact: true })
      .isDisabled(),
  );
  await capture(f, "forge-submitted-draft-refuses-codev-patch");
  await f.page.getByRole("button", { name: "Context", exact: true }).click();
  assert(
    await f.page
      .getByLabel(
        "Allow proposals for selected files; each patch still needs exact approval.",
      )
      .isDisabled(),
  );
  await f.page
    .getByRole("button", { name: "Close Codev", exact: true })
    .click();
  const locked = await exported(f);
  assert.equal(await locked.file("README.md").async("string"), readme);
  await f.page
    .getByRole("button", { name: "Duplicate draft for revision", exact: true })
    .click();
  await f.page
    .getByText("Revision draft created with the current workspace files.", {
      exact: false,
    })
    .waitFor();
  assert.equal(f.drafts.length, 2);
  assert.equal(f.drafts[1].version, firstDraft.version);
  await f.page
    .locator(
      `.forge-draft-card a[href="/developer-forge/drafts/${f.drafts[1].id}"]`,
    )
    .click();
  assert.equal(
    new URL(f.page.url()).pathname,
    `/developer-forge/drafts/${f.drafts[1].id}`,
  );
  await f.page
    .getByRole("heading", {
      name: "Package and repository intake",
      exact: true,
    })
    .waitFor();
  await open(f);
  await f.page
    .getByText("No workspace shared", { exact: false })
    .first()
    .waitFor();
  assert.equal(
    await f.page.locator(".codev-file-selection input:checked").count(),
    0,
    "Revision copy may not inherit its source draft’s Codev grant",
  );
  await f.page
    .locator(".codev-file-selection label")
    .filter({ hasText: "src/main.ts" })
    .locator("input")
    .check();
  await f.page
    .getByRole("button", { name: "Share selected context (1)", exact: true })
    .click();
  await f.page
    .getByText("Workspace: read only", { exact: false })
    .first()
    .waitFor();
  await capture(f, "forge-revision-draft-new-explicit-scope");
  const beforeAccount = f.writes.length;
  const sessionA = structuredClone(f.session);
  f.controls.otherAccount = true;
  const otherToken =
    Buffer.from('{"alg":"none"}').toString("base64url") +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: ids.other,
        role: "authenticated",
        aud: "authenticated",
        session_id: "f5600000-0000-4000-8000-000000000002",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".synthetic";
  await currentSession(f, {
    ...f.session,
    access_token: otherToken,
    user: { ...f.session.user, id: ids.other },
  });
  await f.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  assert.equal(await f.page.locator(".codev-dialog").count(), 0);
  assert.equal(f.writes.length, beforeAccount);
  const deadline = Date.now() + 7000;
  let remaining;
  do {
    remaining = (await command({ op: "counts" })).workspaces;
    if (!remaining.length) break;
    await f.page.waitForTimeout(100);
  } while (Date.now() < deadline);
  assert.deepEqual(
    remaining,
    [],
    "Account change must revoke old source grants at the native broker",
  );
  await capture(f, "forge-account-switch-removes-codev-authority");
  const sessionB = structuredClone(f.session);
  f.controls.otherAccount = false;
  await currentSession(f, sessionA);
  await f.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  assert.equal(
    await f.page
      .getByText("Codev · connected locally", { exact: true })
      .count(),
    0,
    "Returning to A must not restore the revoked pairing",
  );
  // A late intent response after A -> B -> A cannot revive the old operation.
  let releaseIntent;
  f.controls.delayPairCreate = new Promise((resolve) => {
    releaseIntent = resolve;
  });
  await f.page.getByRole("button", { name: "Sync Codev", exact: true }).click();
  const intentDeadline = Date.now() + 5000;
  while (f.controls.delayPairCreate && Date.now() < intentDeadline)
    await f.page.waitForTimeout(20);
  assert.equal(f.controls.delayPairCreate, null);
  f.controls.otherAccount = true;
  await currentSession(f, sessionB);
  await f.page.waitForTimeout(80);
  f.controls.otherAccount = false;
  await currentSession(f, sessionA);
  releaseIntent();
  await f.page.waitForTimeout(200);
  assert.equal(
    await f.page.getByLabel("Codev pairing code").count(),
    0,
    "A stale response must not create an active Sync attempt after account changes",
  );
  await f.page
    .getByRole("button", { name: "Sync Codev", exact: true })
    .waitFor();
  await f.context.close();
  const mobile = await active(await fixture("manager", { mobile: true }));
  await allowLoopback(mobile);
  await mobile.page.goto(origin + "/developer-forge/drafts/new");
  await sync(mobile);
  await open(mobile);
  await capture(mobile, "forge-mobile-connected-no-workspace");
  await mobile.page
    .getByRole("button", { name: "Disconnect Codev", exact: true })
    .click();
  await mobile.context.close();
  evidence.push({
    name: "actual_forge_codev_browser_ok",
    dirtyFilesAndActiveFileRestored: true,
    partialProposalGetsNewPlan: true,
    lockedDraftRefused: true,
    duplicateRequiresNewGrant: true,
    accountChangeRevokesNativeSource: true,
    lateAccountRoundTripIntentBlocked: true,
  });
}
