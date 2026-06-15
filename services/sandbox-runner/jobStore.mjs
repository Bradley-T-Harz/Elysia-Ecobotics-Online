import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { jobsRoot, redactSecrets, runtimeRoot } from "./policy.mjs";

export async function ensureRuntime() {
  await fs.mkdir(runtimeRoot, { recursive: true });
  await fs.mkdir(jobsRoot, { recursive: true });
}

export function createJobId() { return `job-${randomUUID()}`; }
export function jobDir(jobId) { return new URL(`${jobId}/`, jobsRoot); }
export function jobPath(jobId) { return new URL("job.json", jobDir(jobId)); }
export function inputDir(jobId) { return new URL("input/", jobDir(jobId)); }
export function stdoutPath(jobId) { return new URL("stdout.log", jobDir(jobId)); }
export function stderrPath(jobId) { return new URL("stderr.log", jobDir(jobId)); }

export async function writeJob(job) {
  await ensureRuntime();
  await fs.mkdir(jobDir(job.job_id), { recursive: true });
  await fs.writeFile(jobPath(job.job_id), `${JSON.stringify(job, null, 2)}\n`);
  return job;
}

export async function readJob(jobId) {
  const text = await fs.readFile(jobPath(jobId), "utf8");
  return JSON.parse(text);
}

export async function appendLimited(fileUrl, text, limitBytes) {
  const existing = await fs.readFile(fileUrl, "utf8").catch(() => "");
  const next = `${existing}${redactSecrets(text)}`.slice(0, limitBytes);
  await fs.writeFile(fileUrl, next);
}

export async function writeInputFile(jobId, fileName, contents) {
  await fs.mkdir(inputDir(jobId), { recursive: true });
  await fs.writeFile(new URL(fileName, inputDir(jobId)), contents, { mode: 0o444 });
  return fileURLToPath(new URL(fileName, inputDir(jobId)));
}
