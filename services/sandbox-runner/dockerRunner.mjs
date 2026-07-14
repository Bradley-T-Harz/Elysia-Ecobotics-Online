import { spawn } from "node:child_process";
import { writeAuditEvent } from "./auditLog.mjs";
import { readJob, stderrPath, stdoutPath, writeJob, writeOutputFile } from "./jobStore.mjs";
import { decodeUtf8Prefix, hardOutputBytes, maxOutputBytes, sanitizeOutput } from "./policy.mjs";
import { loadRunnerConfig } from "./serviceConfig.mjs";

const activeContainers = new Map();

export function runProcess(bin, args, options = {}) {
  const spawnImpl = options.spawnImpl || spawn;
  const maximumBytes = options.maximumBytes || 8_192;
  return new Promise((resolve) => {
    let settled = false;
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timer;
    let child;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };
    try {
      child = spawnImpl(bin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        env: options.env || {},
        cwd: options.cwd
      });
    } catch {
      finish({ ok: false, code: null, stdout: "", stderr: "engine_process_failed" });
      return;
    }
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, code: null, stdout: stdout.toString("utf8"), stderr: "engine_process_timeout" });
    }, options.timeoutMs || 5_000);
    child.stdout?.on("data", (chunk) => { stdout = Buffer.concat([stdout, Buffer.from(chunk)]).subarray(0, maximumBytes); });
    child.stderr?.on("data", (chunk) => { stderr = Buffer.concat([stderr, Buffer.from(chunk)]).subarray(0, maximumBytes); });
    child.once("error", () => finish({ ok: false, code: null, stdout: stdout.toString("utf8"), stderr: "engine_process_failed" }));
    child.once("close", (code) => finish({ ok: code === 0, code, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8") }));
  });
}

export async function findContainerEngine(config = loadRunnerConfig(), options = {}) {
  const result = await runProcess(config.engine, ["--version"], { ...options, env: config.engineEnv });
  return result.ok ? { bin: config.engine, version: sanitizeOutput(result.stdout || result.stderr, 200) } : null;
}

export async function findContainerEngines(config = loadRunnerConfig(), options = {}) {
  const engine = await findContainerEngine(config, options);
  return engine ? [engine] : [];
}

export async function imageAvailable(bin, image, config = loadRunnerConfig(), options = {}) {
  if (bin !== config.engine) return false;
  const result = await runProcess(bin, ["image", "inspect", image], { ...options, env: config.engineEnv });
  return result.ok;
}

export function engineInfoSupportsIsolation(engine, info) {
  if (engine === "podman") {
    return info?.host?.security?.rootless === true && String(info?.host?.cgroupVersion) === "v2";
  }
  return Array.isArray(info?.SecurityOptions)
    && info.SecurityOptions.some((entry) => /rootless/i.test(String(entry)))
    && String(info?.CgroupVersion) === "2";
}

export async function verifyRootlessEngine(config = loadRunnerConfig(), options = {}) {
  if (config.engine === "podman") {
    const result = await runProcess(config.engine, ["info", "--format", "json"], { ...options, env: config.engineEnv, maximumBytes: 65_536 });
    if (!result.ok) return false;
    try {
      const info = JSON.parse(result.stdout);
      return engineInfoSupportsIsolation("podman", info);
    } catch { return false; }
  }
  const result = await runProcess(config.engine, ["info", "--format", "{{json .}}"], { ...options, env: config.engineEnv, maximumBytes: 65_536 });
  if (!result.ok) return false;
  try {
    const info = JSON.parse(result.stdout);
    return engineInfoSupportsIsolation("docker", info);
  } catch { return false; }
}

export function buildContainerArgs({ job, runtime, config = loadRunnerConfig() }) {
  const containerName = `elysia-sandbox-${job.job_id}`;
  const image = config.images[runtime.imageKey];
  if (!image) throw new Error("runtime_image_missing");
  const args = [
    "run",
    "--rm",
    "--interactive",
    "--name", containerName,
    "--label", "io.elysia.sandbox=true",
    "--label", `io.elysia.sandbox.job-id=${job.job_id}`,
    "--pull=never",
    "--network=none",
    "--read-only",
    ...(config.engine === "podman" ? ["--read-only-tmpfs=false"] : []),
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit", config.limits.pidsLimit,
    "--memory", config.limits.memory,
    "--memory-swap", config.limits.memorySwap,
    "--cpus", config.limits.cpus,
    "--ulimit", "core=0:0",
    "--ulimit", `nofile=${config.limits.fileDescriptors}:${config.limits.fileDescriptors}`,
    "--ulimit", `nproc=${config.limits.pidsLimit}:${config.limits.pidsLimit}`,
    "--ulimit", `fsize=${config.limits.fileSizeBytes}:${config.limits.fileSizeBytes}`,
    "--user", "65534:65534",
    "--pid=private",
    "--ipc=none",
    "--tmpfs", `/tmp:rw,nosuid,nodev,noexec,size=${config.limits.tmpfsSize},mode=1777`,
    "--tmpfs", `/workspace:rw,nosuid,nodev,noexec,size=${config.limits.tmpfsSize},mode=1777`,
    "--env", "HOME=/tmp",
    "--env", "PATH=/usr/local/bin:/usr/bin:/bin",
    "--workdir", "/workspace",
    image,
    ...runtime.allowedCommand
  ];
  return { args, containerName, image };
}

async function forceRemoveContainer(config, containerName, options = {}) {
  const result = await runProcess(config.engine, [
    "rm", "--force", ...(config.engine === "podman" ? ["--time", "0"] : []), containerName
  ], { ...options, env: config.engineEnv });
  const inspect = await runProcess(config.engine, ["container", "inspect", containerName], { ...options, env: config.engineEnv });
  const absenceConfirmed = (check) => !check.ok
    && check.code !== null
    && /(no such (container|object)|no container with name or id|does not exist|not found)/i.test(check.stderr);
  return !inspect.ok && absenceConfirmed(inspect) && (result.ok || absenceConfirmed(result));
}

export async function cleanupOrphanContainers(config = loadRunnerConfig(), options = {}) {
  const engine = await findContainerEngine(config, options);
  if (!engine || !(await verifyRootlessEngine(config, options))) {
    return { ok: false, engineAvailable: false, removed: 0, skippedRecent: 0 };
  }
  const listed = await runProcess(config.engine, [
    "ps", "--all", "--filter", "label=io.elysia.sandbox=true", "--format", "{{.Names}}"
  ], { ...options, env: config.engineEnv, maximumBytes: 65_536 });
  if (!listed.ok) return { ok: false, engineAvailable: true, removed: 0, skippedRecent: 0 };

  const names = listed.stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  let removed = 0;
  let skippedRecent = 0;
  for (const containerName of names.slice(0, 64)) {
    const match = containerName.match(/^elysia-sandbox-(job-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/);
    if (!match) continue;
    if (options.preserveRecent !== false) {
      const job = await readJob(match[1], config).catch(() => null);
      const started = Date.parse(job?.started_at || "");
      if (job?.status === "running" && Number.isFinite(started) && Date.now() - started < 30_000) {
        skippedRecent += 1;
        continue;
      }
    }
    if (!(await forceRemoveContainer(config, containerName, options))) {
      return { ok: false, engineAvailable: true, removed, skippedRecent };
    }
    removed += 1;
  }
  return { ok: true, engineAvailable: true, removed, skippedRecent };
}

function appendBounded(state, channel, chunk, terminate) {
  const buffer = Buffer.from(chunk);
  state.totalBytes += buffer.byteLength;
  if (state.totalBytes > maxOutputBytes) state.outputTruncated = true;
  const storedBytes = state.stdoutBytes + state.stderrBytes;
  if (storedBytes < maxOutputBytes) {
    const kept = buffer.subarray(0, maxOutputBytes - storedBytes);
    state[channel].push(kept);
    state[`${channel}Bytes`] += kept.byteLength;
  }
  if (state.totalBytes > hardOutputBytes && !state.outputOverflow) {
    state.outputOverflow = true;
    void terminate("output_overflow");
  }
}

export async function runContainerJob(job, runtime, sourceCode, options = {}) {
  const config = options.config || loadRunnerConfig();
  const spawnImpl = options.spawnImpl || spawn;
  const processOptions = { spawnImpl };
  if (typeof sourceCode !== "string" || Buffer.byteLength(sourceCode, "utf8") > 65_536) {
    throw new Error("source_code_invalid");
  }
  if (options.signal?.aborted) {
    return { ...job, status: "cancelled", killed: true, cleanup_ok: true, result: "Sandbox request was cancelled before execution." };
  }
  const engine = await findContainerEngine(config, processOptions);
  if (!engine || !(await verifyRootlessEngine(config, processOptions))) {
    await writeAuditEvent(job.job_id, "validation_failed", "Configured rootless container engine is unavailable.", {}, config);
    return { ...job, status: "validation_failed", result: "Sandbox runtime unavailable." };
  }
  const orphanCleanup = await cleanupOrphanContainers(config, { ...processOptions, preserveRecent: false });
  if (!orphanCleanup.ok) {
    await writeAuditEvent(job.job_id, "cleanup_failed", "Existing sandbox container cleanup could not be verified.", { cleanup_ok: false }, config);
    return { ...job, status: "cleanup_failed", cleanup_ok: false, result: "Sandbox cleanup unavailable." };
  }
  const image = config.images[runtime.imageKey];
  if (!(await imageAvailable(config.engine, image, config, processOptions))) {
    await writeAuditEvent(job.job_id, "validation_failed", "Required immutable image is unavailable; automatic pulls are disabled.", {}, config);
    return { ...job, status: "validation_failed", result: "Sandbox runtime image unavailable." };
  }
  if (options.signal?.aborted) {
    return { ...job, status: "cancelled", killed: true, cleanup_ok: true, result: "Sandbox request was cancelled before execution." };
  }

  const { args, containerName } = buildContainerArgs({ job, runtime, config });
  const startedAt = new Date().toISOString();
  await writeJob({ ...job, status: "running", started_at: startedAt, container_name: containerName }, config);
  await writeAuditEvent(job.job_id, "job_started", "Rootless container job started with fixed isolation controls.", {}, config);

  const child = spawnImpl(config.engine, args, {
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    env: config.engineEnv
  });
  const output = { stdout: [], stderr: [], stdoutBytes: 0, stderrBytes: 0, totalBytes: 0, outputTruncated: false, outputOverflow: false };
  let timedOut = false;
  let cancelled = false;
  let killed = false;
  let terminationPromise = null;
  const terminate = (reason) => {
    if (!terminationPromise) {
      if (reason === "timeout") timedOut = true;
      if (reason === "request_cancelled") cancelled = true;
      killed = true;
      child.kill("SIGKILL");
      terminationPromise = forceRemoveContainer(config, containerName, processOptions);
    }
    return terminationPromise;
  };
  activeContainers.set(job.job_id, { terminate });
  const cancelRun = () => { void terminate("request_cancelled"); };
  options.signal?.addEventListener("abort", cancelRun, { once: true });
  if (options.signal?.aborted) cancelRun();
  child.stdin?.on("error", () => {});
  child.stdin?.end(sourceCode, "utf8");
  child.stdout?.on("data", (chunk) => appendBounded(output, "stdout", chunk, terminate));
  child.stderr?.on("data", (chunk) => appendBounded(output, "stderr", chunk, terminate));

  const timeoutMs = config.limits.timeoutSeconds * 1000;
  const timer = setTimeout(() => { void terminate("timeout"); }, timeoutMs);
  const exitCode = await new Promise((resolve) => {
    let settled = false;
    const finish = (code) => { if (!settled) { settled = true; resolve(code); } };
    child.once("error", () => finish(1));
    child.once("close", (code) => finish(code ?? 1));
  });
  clearTimeout(timer);
  const cleanupOk = terminationPromise ? await terminationPromise : await forceRemoveContainer(config, containerName, processOptions);
  options.signal?.removeEventListener("abort", cancelRun);
  activeContainers.delete(job.job_id);

  const stdout = sanitizeOutput(decodeUtf8Prefix(Buffer.concat(output.stdout)));
  const stderr = sanitizeOutput(decodeUtf8Prefix(Buffer.concat(output.stderr)));
  await Promise.all([
    writeOutputFile(stdoutPath(job.job_id, config), stdout),
    writeOutputFile(stderrPath(job.job_id, config), stderr)
  ]);

  const finishedAt = new Date().toISOString();
  const status = !cleanupOk
    ? "cleanup_failed"
    : cancelled
      ? "cancelled"
      : output.outputOverflow
        ? "output_overflow"
        : timedOut
          ? "timed_out"
          : exitCode === 0
            ? "succeeded"
            : "failed";
  const finalJob = {
    ...await readJob(job.job_id, config),
    status,
    finished_at: finishedAt,
    exit_code: exitCode,
    timed_out: timedOut,
    killed,
    output_truncated: output.outputTruncated,
    output_overflow: output.outputOverflow,
    cleanup_ok: cleanupOk
  };
  await writeJob(finalJob, config);
  await writeAuditEvent(job.job_id, status, "Container job finalized and cleanup was verified.", {
    status,
    exit_code: exitCode,
    timed_out: timedOut,
    output_overflow: output.outputOverflow,
    cleanup_ok: cleanupOk
  }, config);
  return finalJob;
}

export async function killJob(jobId, options = {}) {
  const config = options.config || loadRunnerConfig();
  const active = activeContainers.get(jobId);
  if (!active) return { ok: false, message: "Job is not active." };
  const ok = await active.terminate("operator_kill");
  return { ok, message: ok ? "Job killed and container removal verified." : "Container cleanup could not be verified." };
}

export async function terminateAllActiveContainers() {
  const results = await Promise.allSettled(Array.from(activeContainers.values(), (entry) => entry.terminate("service_shutdown")));
  return results.every((result) => result.status === "fulfilled" && result.value === true);
}
