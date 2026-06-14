#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  buildPackageArchive,
  buildTemplateFiles,
  inspectArchiveBuffer,
  isUnsafePackagePath,
  permissionCatalog,
  staticScanText,
  templateNames,
  validateManifest
} from "../packages/addon-sdk/core.mjs";

const excludedDirs = new Set(["node_modules", ".git", "dist", ".DS_Store"]);
const allowedPackageExtensions = new Set([".json", ".md", ".txt", ".css", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".yml", ".yaml", ".toml", ".csv", ".svg", ".png", ".jpg", ".jpeg", ".webp"]);

function usage() {
  return `elysia-addon local CLI\n\nCommands:\n  init <folder> [--template name] [--force]\n  validate <folder|manifest.json>\n  scan <folder|file>\n  package <folder> --out <file.elysia-addon>\n  inspect <file.elysia-addon|file.zip>\n  doctor\n\nNo command executes add-on code, installs dependencies, clones repositories, or uploads files.`;
}

function option(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? true;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function printIssues(groups) {
  for (const [label, issues] of Object.entries(groups)) {
    if (!issues?.length) continue;
    console.log(`\n${label.toUpperCase()}`);
    for (const item of issues) console.log(`- [${item.code}] ${item.path ? `${item.path}: ` : ""}${item.message}`);
  }
}

async function pathExists(target) {
  try { await fs.stat(target); return true; } catch { return false; }
}

async function assertSafeOutputFolder(target, force = false) {
  const resolved = path.resolve(target);
  const parent = path.dirname(resolved);
  if (resolved === path.parse(resolved).root) throw new Error("Refusing to initialize into filesystem root.");
  if (!(await pathExists(parent))) throw new Error(`Parent folder does not exist: ${parent}`);
  if (await pathExists(resolved)) {
    const entries = await fs.readdir(resolved);
    if (entries.length && !force) throw new Error("Output folder exists and is not empty. Use --force deliberately if you really want to add starter files.");
  }
  return resolved;
}

async function findManifest(target) {
  const resolved = path.resolve(target);
  const stat = await fs.stat(resolved);
  return stat.isDirectory() ? path.join(resolved, "manifest.json") : resolved;
}

async function readManifest(target) {
  const manifestPath = await findManifest(target);
  return { manifestPath, text: await fs.readFile(manifestPath, "utf8") };
}

async function listFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (excludedDirs.has(entry.name)) continue;
    const full = path.join(current, entry.name);
    const relative = path.relative(root, full).replaceAll(path.sep, "/");
    if (isUnsafePackagePath(relative)) continue;
    if (entry.isDirectory()) files.push(...await listFiles(root, full));
    else files.push({ full, relative });
  }
  return files;
}

async function commandInit(args) {
  const folder = args[0];
  if (!folder) throw new Error("Missing output folder.");
  const template = String(option(args, "--template", "theme-pack"));
  if (!templateNames.includes(template)) throw new Error(`Unknown template ${template}. Known templates: ${templateNames.join(", ")}`);
  const target = await assertSafeOutputFolder(folder, hasFlag(args, "--force"));
  await fs.mkdir(target, { recursive: true });
  const files = buildTemplateFiles(path.basename(target), template);
  for (const file of files) {
    const unsafe = isUnsafePackagePath(file.path);
    if (unsafe) throw new Error(`Template produced unsafe path ${file.path}: ${unsafe}`);
    const full = path.join(target, file.path);
    await fs.mkdir(path.dirname(full), { recursive: true });
    if ((await pathExists(full)) && !hasFlag(args, "--force")) continue;
    await fs.writeFile(full, file.contents, "utf8");
  }
  console.log(`Created inert Elysia add-on starter at ${target}. No dependencies installed. No network calls made.`);
}

async function commandValidate(args) {
  const target = args[0] ?? ".";
  const { manifestPath, text } = await readManifest(target);
  const { results } = validateManifest(text);
  printIssues({ errors: results.filter((item) => item.level === "error"), warnings: results.filter((item) => item.level === "warning"), info: results.filter((item) => item.level === "info") });
  const errors = results.filter((item) => item.level === "error").length;
  console.log(`\nValidated ${manifestPath}: ${errors ? `${errors} blocking issue(s)` : "no blocking manifest issues"}.`);
  return errors ? 1 : 0;
}

async function commandScan(args) {
  const target = path.resolve(args[0] ?? ".");
  const stat = await fs.stat(target);
  const files = stat.isDirectory() ? await listFiles(target) : [{ full: target, relative: path.basename(target) }];
  const all = [];
  for (const file of files) {
    if (!allowedPackageExtensions.has(path.extname(file.relative)) && path.basename(file.relative) !== "LICENSE") continue;
    const statFile = await fs.stat(file.full);
    if (statFile.size > 512 * 1024) continue;
    const text = await fs.readFile(file.full, "utf8");
    all.push(...staticScanText({ path: file.relative, text }));
  }
  printIssues({ errors: all.filter((item) => item.level === "error"), warnings: all.filter((item) => item.level === "warning"), info: all.filter((item) => item.level === "info") });
  console.log(`\nScanned ${files.length} file(s). Static scan does not prove safety and executed nothing.`);
  return all.some((item) => item.level === "error") ? 1 : 0;
}

async function commandPackage(args) {
  const folder = args[0];
  const out = option(args, "--out");
  if (!folder || !out || out === true) throw new Error("Usage: elysia-addon package <folder> --out <file.elysia-addon>");
  const validateCode = await commandValidate([folder]);
  const scanCode = await commandScan([folder]);
  if (validateCode || scanCode) throw new Error("Refusing to package while blocking validation/static scan issues exist.");
  const root = path.resolve(folder);
  const files = [];
  for (const file of await listFiles(root)) {
    if (!allowedPackageExtensions.has(path.extname(file.relative)) && path.basename(file.relative) !== "LICENSE") continue;
    const contents = await fs.readFile(file.full);
    files.push({ path: file.relative, contents });
  }
  const { buffer, sha256 } = await buildPackageArchive(files);
  const outPath = path.resolve(String(out));
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buffer);
  console.log(`\nCreated inert package ${outPath}`);
  console.log(`SHA-256: ${sha256}`);
  console.log("No build scripts, dependency installs, or add-on code were executed.");
}

async function commandInspect(args) {
  const target = args[0];
  if (!target) throw new Error("Missing archive path.");
  const buffer = await fs.readFile(path.resolve(target));
  const inspection = await inspectArchiveBuffer(buffer);
  console.log(`Status: ${inspection.status}`);
  console.log(`Risk: ${inspection.risk_level}`);
  console.log(`Summary: ${inspection.summary}`);
  console.log(`SHA-256: ${inspection.sha256}`);
  if (inspection.manifest_summary) console.log(`Manifest: ${inspection.manifest_summary.addon_id ?? "unknown"} ${inspection.manifest_summary.version ?? ""}`.trim());
  console.log(`Files: ${inspection.file_inventory.length}`);
  printIssues({ errors: inspection.errors, warnings: inspection.warnings, info: inspection.info });
  return inspection.status === "fail" ? 1 : 0;
}

async function commandDoctor() {
  console.log("Elysia add-on CLI doctor");
  console.log(`Node: ${process.version}`);
  console.log(`Templates: ${templateNames.join(", ")}`);
  console.log(`Permissions: ${permissionCatalog.length} catalog entries`);
  console.log("Archive support: JSZip-backed inert ZIP/.elysia-addon inspection available");
  console.log("Submit: disabled in this local CLI pass. No authenticated upload/API submission is performed.");
  console.log("Safety: commands read only paths you provide; no package code is executed.");
}

export async function runCli(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  try {
    if (!command || command === "--help" || command === "help") { console.log(usage()); return 0; }
    if (command === "init") return await commandInit(args) ?? 0;
    if (command === "validate") return await commandValidate(args);
    if (command === "scan") return await commandScan(args);
    if (command === "package") return await commandPackage(args) ?? 0;
    if (command === "inspect") return await commandInspect(args);
    if (command === "doctor") return await commandDoctor() ?? 0;
    throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await runCli();
  process.exitCode = code;
}
