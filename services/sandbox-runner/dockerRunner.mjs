import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendLimited, readJob, stderrPath, stdoutPath, writeJob } from "./jobStore.mjs";
import { defaultLimits, maxOutputBytes } from "./policy.mjs";
import { writeAuditEvent } from "./auditLog.mjs";

function runProcess(bin, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], shell: false, env: { PATH: process.env.PATH || "" }, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => resolve({ ok: false, code: null, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

export async function findContainerEngine() {
  for (const bin of ["docker", "podman"]) {
    const result = await runProcess(bin, ["--version"]);
    if (result.ok) return { bin, version: result.stdout.trim() || result.stderr.trim() };
  }
  return null;
}

export async function imageAvailable(bin, image) {
  const result = await runProcess(bin, ["image", "inspect", image]);
  return result.ok;
}

export function buildContainerArgs({ job, runtime, inputDirectory }) {
  const containerName = `elysia-sandbox-${job.job_id}`.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 120);
  const memory = job.resource_limits?.memory || defaultLimits.memory;
  const cpus = job.resource_limits?.cpus || defaultLimits.cpus;
  const args = [
    "run",
    "--rm",
    "--name", containerName,
    "--network", "none",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--pids-limit", defaultLimits.pidsLimit,
    "--memory", memory,
    "--cpus", cpus,
    "--user", "65534:65534",
    "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=64m",
    "--workdir", "/workspace",
    "-v", `${inputDirectory}:/workspace:ro`,
    runtime.image,
    ...runtime.allowedCommand
  ];
  return { args, containerName };
}

export async function runContainerJob(job, runtime, inputDirectory) {
  const engine = await findContainerEngine();
  if (!engine) {
    await writeAuditEvent(job.job_id, "validation_failed", "Docker/Podman unavailable; failed closed.");
    return { ...job, status: "validation_failed", result: "Docker or Podman is not available. The runner will not fall back to host execution." };
  }
  if (!(await imageAvailable(engine.bin, runtime.image))) {
    await writeAuditEvent(job.job_id, "validation_failed", `Required image ${runtime.image} missing; no automatic pull.`);
    return { ...job, status: "validation_failed", result: `Required local container image is not available: ${runtime.image}. The runner will not pull images automatically.` };
  }
  const { args, containerName } = buildContainerArgs({ job, runtime, inputDirectory });
  const started = new Date().toISOString();
  await writeJob({ ...job, status: "running", started_at: started, container_name: containerName, container_engine: engine.bin });
  await writeAuditEvent(job.job_id, "job_started", "Container job started with network disabled and read-only root filesystem.", { engine: engine.bin, image: runtime.image });
  const child = spawn(engine.bin, args, { stdio: ["ignore", "pipe", "pipe"], shell: false, env: { PATH: process.env.PATH || "" } });
  let timedOut = false;
  const timeoutMs = Math.max(1, Number(job.resource_limits.timeout_seconds || defaultLimits.timeoutSeconds)) * 1000;
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
  child.stdout?.on("data", (chunk) => { void appendLimited(stdoutPath(job.job_id), String(chunk), maxOutputBytes); });
  child.stderr?.on("data", (chunk) => { void appendLimited(stderrPath(job.job_id), String(chunk), maxOutputBytes); });
  const exitCode = await new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
  clearTimeout(timer);
  const finished = new Date().toISOString();
  const status = timedOut ? "timed_out" : exitCode === 0 ? "succeeded" : "failed";
  const finalJob = { ...await readJob(job.job_id), status, finished_at: finished, exit_code: exitCode, timed_out: timedOut, stdout_path: fileURLToPath(stdoutPath(job.job_id)), stderr_path: fileURLToPath(stderrPath(job.job_id)) };
  await writeJob(finalJob);
  await writeAuditEvent(job.job_id, status, timedOut ? "Job exceeded timeout and was killed." : "Container job completed.", { exit_code: exitCode });
  return finalJob;
}

export async function killJob(jobId) {
  const job = await readJob(jobId);
  if (!job.container_name || !job.container_engine || job.status !== "running") return { ok: false, message: "Job is not running or has no container handle." };
  const result = await runProcess(job.container_engine, ["kill", job.container_name]);
  const next = { ...job, status: result.ok ? "killed" : job.status, killed: result.ok, finished_at: result.ok ? new Date().toISOString() : job.finished_at };
  await writeJob(next);
  await writeAuditEvent(jobId, result.ok ? "job_killed" : "kill_failed", result.stderr || result.stdout || "Kill requested.");
  return { ok: result.ok, message: result.ok ? "Job killed." : `Kill failed: ${result.stderr || result.stdout}` };
}
