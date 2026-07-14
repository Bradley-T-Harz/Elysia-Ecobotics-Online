import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve, sep } from "node:path";
import { loadRunnerConfig } from "./serviceConfig.mjs";
import { redactSecrets } from "./policy.mjs";

const JOB_ID_PATTERN = /^job-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function assertJobId(jobId) {
  if (typeof jobId !== "string" || !JOB_ID_PATTERN.test(jobId)) throw new Error("job_id_invalid");
  return jobId;
}

function safeChild(root, ...segments) {
  const path = resolve(root, ...segments);
  if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error("job_path_invalid");
  return path;
}

export function runtimePaths(config = loadRunnerConfig()) {
  return Object.freeze({ runtimeRoot: config.runtimeRoot, jobsRoot: config.jobsRoot, auditRoot: config.auditRoot });
}

async function ensurePrivateDirectory(path) {
  const expected = resolve(path);
  await fs.mkdir(expected, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(expected);
  const canonical = await fs.realpath(expected);
  if (!stat.isDirectory() || stat.isSymbolicLink() || canonical !== expected) throw new Error("runtime_path_invalid");
  await fs.chmod(expected, 0o700);
}

export async function ensureRuntime(config = loadRunnerConfig()) {
  await ensurePrivateDirectory(config.runtimeRoot);
  await ensurePrivateDirectory(config.jobsRoot);
  await ensurePrivateDirectory(config.auditRoot);
}

export function createJobId() { return `job-${randomUUID()}`; }
export function jobDir(jobId, config = loadRunnerConfig()) { return safeChild(config.jobsRoot, assertJobId(jobId)); }
export function jobPath(jobId, config = loadRunnerConfig()) { return safeChild(jobDir(jobId, config), "job.json"); }
export function stdoutPath(jobId, config = loadRunnerConfig()) { return safeChild(jobDir(jobId, config), "stdout.log"); }
export function stderrPath(jobId, config = loadRunnerConfig()) { return safeChild(jobDir(jobId, config), "stderr.log"); }

async function atomicWrite(path, contents, mode = 0o600) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, contents, { mode, flag: "wx" });
    await fs.chmod(temporary, mode);
    await fs.rename(temporary, path);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

export async function writeJob(job, config = loadRunnerConfig()) {
  assertJobId(job.job_id);
  await ensureRuntime(config);
  await fs.mkdir(jobDir(job.job_id, config), { recursive: true, mode: 0o700 });
  const jobStat = await fs.lstat(jobDir(job.job_id, config));
  const canonicalJobDirectory = await fs.realpath(jobDir(job.job_id, config));
  if (!jobStat.isDirectory() || jobStat.isSymbolicLink() || canonicalJobDirectory !== jobDir(job.job_id, config)) throw new Error("job_path_invalid");
  await fs.chmod(jobDir(job.job_id, config), 0o700);
  await atomicWrite(jobPath(job.job_id, config), `${JSON.stringify(job, null, 2)}\n`);
  return job;
}

export async function readJob(jobId, config = loadRunnerConfig()) {
  assertJobId(jobId);
  const text = await fs.readFile(jobPath(jobId, config), "utf8");
  const parsed = JSON.parse(text);
  if (parsed?.job_id !== jobId) throw new Error("job_record_invalid");
  return parsed;
}

export async function writeOutputFile(path, text) {
  await atomicWrite(path, redactSecrets(text), 0o600);
}

export async function removeJob(jobId, config = loadRunnerConfig()) {
  assertJobId(jobId);
  await fs.chmod(safeChild(jobDir(jobId, config), "input"), 0o700).catch(() => {});
  await fs.rm(jobDir(jobId, config), { recursive: true, force: true });
}

export async function cleanupExpiredJobs(config = loadRunnerConfig(), now = Date.now()) {
  await ensureRuntime(config);
  const entries = await fs.readdir(config.jobsRoot, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !JOB_ID_PATTERN.test(entry.name)) continue;
    const directory = join(config.jobsRoot, entry.name);
    const stat = await fs.stat(directory).catch(() => null);
    if (stat && now - stat.mtimeMs > config.jobRetentionMs) {
      await fs.chmod(join(directory, "input"), 0o700).catch(() => {});
      await fs.rm(directory, { recursive: true, force: true });
      removed += 1;
    }
  }
  return { removed };
}
