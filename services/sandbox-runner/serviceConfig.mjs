import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defaultLimits } from "./policy.mjs";

const DIGEST_IMAGE = /^[a-z0-9][a-z0-9._/-]*(?::[a-z0-9._-]+)?@sha256:[0-9a-f]{64}$/;

function integer(value, fallback, minimum, maximum, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name}_invalid`);
  return parsed;
}

function token(value, required, name) {
  const result = String(value ?? "");
  if (required && (result.length < 32 || result.length > 512)) throw new Error(`${name}_invalid`);
  return result;
}

export function safeEngineEnvironment(engine, env = process.env) {
  const result = {
    PATH: "/usr/local/bin:/usr/bin:/bin",
    HOME: String(env.HOME || "")
  };
  for (const key of ["XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"]) {
    if (env[key]) result[key] = String(env[key]);
  }
  if (engine === "docker" && env.DOCKER_HOST) result.DOCKER_HOST = String(env.DOCKER_HOST);
  return Object.freeze(result);
}

export function loadRunnerConfig(env = process.env) {
  const mode = env.ELYSIA_SANDBOX_MODE === "production" ? "production" : "development";
  const production = mode === "production";
  const engine = String(env.ELYSIA_SANDBOX_ENGINE || (production ? "podman" : "podman"));
  if (!new Set(["podman", "docker"]).has(engine)) throw new Error("container_engine_invalid");
  const host = String(env.ELYSIA_SANDBOX_HOST || "127.0.0.1");
  if (host !== "127.0.0.1") throw new Error("runner_host_must_be_loopback");
  const pythonImage = String(env.ELYSIA_SANDBOX_PYTHON_IMAGE || "docker.io/library/python:3.12-alpine");
  const nodeImage = String(env.ELYSIA_SANDBOX_NODE_IMAGE || "docker.io/library/node:22-alpine");
  if (production && (!DIGEST_IMAGE.test(pythonImage) || !DIGEST_IMAGE.test(nodeImage))) {
    throw new Error("immutable_image_digest_required");
  }
  const defaultRuntimeRoot = fileURLToPath(new URL("./runtime/", import.meta.url));
  const runtimeRoot = resolve(String(env.ELYSIA_SANDBOX_RUNTIME_ROOT || defaultRuntimeRoot));
  return Object.freeze({
    mode,
    production,
    enabled: env.ELYSIA_SANDBOX_ENABLED === "true",
    confirmServiceExecution: env.ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION === "true",
    host,
    port: integer(env.ELYSIA_SANDBOX_PORT || env.PORT, 8788, 1024, 65_535, "runner_port"),
    engine,
    engineEnv: safeEngineEnvironment(engine, env),
    images: Object.freeze({ python: pythonImage, node: nodeImage }),
    serviceToken: token(env.ELYSIA_SANDBOX_SERVICE_TOKEN, production, "service_token"),
    runtimeRoot,
    jobsRoot: resolve(runtimeRoot, "jobs"),
    auditRoot: resolve(runtimeRoot, "audit"),
    limits: defaultLimits,
    retryAfterSeconds: 4,
    jobRetentionMs: integer(env.ELYSIA_SANDBOX_JOB_RETENTION_SECONDS, 3600, 60, 86_400, "job_retention") * 1000,
    auditRetentionMs: integer(env.ELYSIA_SANDBOX_AUDIT_RETENTION_DAYS, 14, 1, 30, "audit_retention") * 86_400_000
  });
}

export function publicConfigReady(config) {
  return config.enabled && config.confirmServiceExecution && Boolean(config.serviceToken);
}
