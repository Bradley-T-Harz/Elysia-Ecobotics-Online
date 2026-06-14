import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  buildPackageArchive,
  buildTemplateFiles,
  inspectArchiveBuffer,
  staticScanText,
  validateManifest
} from "../packages/addon-sdk/core.mjs";
import { runCli } from "./elysiaAddonCli.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "elysia-addon-test-"));

try {
  const initDir = path.join(temp, "safe-theme");
  assert(await runCli(["init", initDir, "--template", "theme-pack"]) === 0, "CLI init failed.");
  assert(await runCli(["doctor"]) === 0, "CLI doctor failed.");
  assert(await runCli(["validate", initDir]) === 0, "CLI validate failed for safe template.");
  assert(await runCli(["scan", initDir]) === 0, "CLI scan failed for safe template.");
  const packagePath = path.join(temp, "safe-theme.elysia-addon");
  assert(await runCli(["package", initDir, "--out", packagePath]) === 0, "CLI package failed for safe template.");
  assert(await runCli(["inspect", packagePath]) === 0, "CLI inspect failed for safe package.");

  const invalid = validateManifest({ schema_version: "1.0", addon_id: "bad", version: "one", permissions: ["vault_access"] });
  assert(invalid.results.some((item) => item.code === "blocked_permission"), "Validator did not catch blocked permission.");
  assert(invalid.results.some((item) => item.code === "missing_name"), "Validator did not catch missing fields.");

  const scanner = staticScanText({ path: "manifest.json", text: "SUPABASE_SERVICE_ROLE=redacted\npostinstall: never\nBEGIN PRIVATE KEY" });
  assert(scanner.some((item) => item.code === "secret_api_key"), "Scanner did not catch service-role text.");
  assert(scanner.some((item) => item.code === "secret_private_key"), "Scanner did not catch private key text.");
  assert(scanner.some((item) => item.code === "dangerous_shell_text"), "Scanner did not catch package hook text.");

  const files = buildTemplateFiles("Archive Smoke", "documentation-helper");
  const built = await buildPackageArchive(files);
  const inspected = await inspectArchiveBuffer(built.buffer);
  assert(inspected.status !== "fail", "Inspector failed safe generated archive.");
  assert(inspected.file_inventory.some((item) => item.path === "checksums.json"), "Package archive did not include checksums.json.");
  assert(inspected.manifest_summary?.addon_id, "Inspector did not report manifest summary.");

  const traversal = new JSZip();
  traversal.file("../evil.txt", "nope");
  traversal.file("manifest.json", JSON.stringify(files.find((file) => file.path === "manifest.json")?.contents ?? {}));
  const traversalBuffer = await traversal.generateAsync({ type: "nodebuffer" });
  const traversalResult = await inspectArchiveBuffer(traversalBuffer);
  assert(traversalResult.errors.some((item) => item.code === "unsafe_path"), "Inspector did not catch path traversal archive.");

  const envArchive = new JSZip();
  envArchive.file("manifest.json", files.find((file) => file.path === "manifest.json")?.contents ?? "{}");
  envArchive.file(".env", "TOKEN=redacted");
  const envResult = await inspectArchiveBuffer(await envArchive.generateAsync({ type: "nodebuffer" }));
  assert(envResult.errors.some((item) => item.code === "forbidden_filename" || item.code === "unsafe_path"), "Inspector did not catch .env archive.");

  const scriptsArchive = new JSZip();
  scriptsArchive.file("manifest.json", files.find((file) => file.path === "manifest.json")?.contents ?? "{}");
  scriptsArchive.file("package.json", JSON.stringify({ scripts: { preinstall: "do-not-run" } }));
  const scriptsResult = await inspectArchiveBuffer(await scriptsArchive.generateAsync({ type: "nodebuffer" }));
  assert(scriptsResult.errors.some((item) => item.code === "package_install_hook"), "Inspector did not catch package install hook.");

  const nonEmpty = path.join(temp, "non-empty");
  await fs.mkdir(nonEmpty);
  await fs.writeFile(path.join(nonEmpty, "keep.txt"), "keep");
  assert(await runCli(["init", nonEmpty, "--template", "theme-pack"]) === 1, "CLI init should refuse non-empty folder without --force.");

  console.log("Add-on SDK/CLI smoke test ok.");
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
