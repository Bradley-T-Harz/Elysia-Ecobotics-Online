import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defaultLimits } from "./policy.mjs";

const DIGEST_IMAGE = /^[a-z0-9][a-z0-9._/-]*(?::[a-z0-9._-]+)?@sha256:[0-9a-f]{64}$/;
const ACCESS_AUDIENCE = /^[A-Za-z0-9_-]{16,256}$/;
const ACCESS_TEAM_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;
const PRODUCTION_RUNTIME_ROOT = "/home/elysia-sandbox/.local/state/elysia-sandbox-runner";

function integer(value, fallback, minimum, maximum, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name}_invalid`);
  return parsed;
}

function token(value, required, name) {
  const result = String(value ?? "");
  if (required && (result.length < 32 || result.length > 512 || /(replace|placeholder|changeme|enter[_ -]?directly)/i.test(result))) {
    throw new Error(`${name}_invalid`);
  }
  return result;
}

function accessConfiguration(env, production) {
  const rawDomain = String(env.ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN || "").replace(/\/$/, "");
  const audience = String(env.ELYSIA_SANDBOX_ACCESS_AUDIENCE || "");
  const configured = Boolean(rawDomain || audience);
  if (production || configured) {
    let url;
    try { url = new URL(rawDomain); }
    catch { throw new Error("access_team_domain_invalid"); }
    if (
      url.protocol !== "https:"
      || !ACCESS_TEAM_HOST.test(url.hostname)
      || url.port
      || url.username
      || url.password
      || (url.pathname !== "/" && url.pathname !== "")
      || url.search
      || url.hash
      || /REPLACE_WITH/i.test(rawDomain)
    ) throw new Error("access_team_domain_invalid");
    if (!ACCESS_AUDIENCE.test(audience) || /REPLACE_WITH/i.test(audience)) throw new Error("access_audience_invalid");
  }
  return Object.freeze({
    accessRequired: production || configured,
    accessTeamDomain: rawDomain,
    accessAudience: audience
  });
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
  if (production && runtimeRoot !== PRODUCTION_RUNTIME_ROOT) throw new Error("runtime_root_invalid");
  const access = accessConfiguration(env, production);
  const engineEnv = safeEngineEnvironment(engine, env);
  if (production && engine === "docker") {
    const expectedDockerHost = `unix:///run/user/${process.getuid?.()}/docker.sock`;
    if (engineEnv.DOCKER_HOST !== expectedDockerHost) throw new Error("rootless_docker_host_invalid");
  }
  return Object.freeze({
    mode,
    production,
    enabled: env.ELYSIA_SANDBOX_ENABLED === "true",
    confirmServiceExecution: env.ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION === "true",
    host,
    port: integer(env.ELYSIA_SANDBOX_PORT || env.PORT, 8788, 1024, 65_535, "runner_port"),
    engine,
    engineEnv,
    images: Object.freeze({ python: pythonImage, node: nodeImage }),
    serviceToken: token(env.ELYSIA_SANDBOX_SERVICE_TOKEN, production, "service_token"),
    ...access,
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
  return config.enabled
    && config.confirmServiceExecution
    && Boolean(config.serviceToken)
    && (!config.accessRequired || Boolean(config.accessTeamDomain && config.accessAudience));
}
