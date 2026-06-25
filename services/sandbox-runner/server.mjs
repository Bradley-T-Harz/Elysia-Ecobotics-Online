#!/usr/bin/env node
import http from "node:http";
import { pathToFileURL } from "node:url";
import { createAndRunSnapshotRun, doctor } from "./runner.mjs";

const args = new Set(process.argv.slice(2));
const confirmServiceExecution = args.has("--confirm-service-execution") || process.env.ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION === "true";
const port = Number(process.env.PORT || process.env.ELYSIA_SANDBOX_PORT || 8788);
const host = process.env.ELYSIA_SANDBOX_HOST || "127.0.0.1";
const maxBodyBytes = 160 * 1024;

function clientRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export const defaultAllowedOrigins = Object.freeze([
  "https://elysiaecobotics.com",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
]);

function configuredAllowedOrigins() {
  const envOrigins = String(process.env.ELYSIA_SANDBOX_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "*");
  return Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));
}

export function isAllowedCorsOrigin(origin, allowedOrigins = configuredAllowedOrigins()) {
  if (!origin || origin === "*") return false;
  if (allowedOrigins.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.elysia-ecobotics-online\.pages\.dev$/i.test(origin);
}

export function headers(request, config = {}) {
  const origin = request.headers.origin || "";
  const allowedOrigins = config.allowedOrigins ?? configuredAllowedOrigins();
  const corsOrigin = isAllowedCorsOrigin(origin, allowedOrigins) ? origin : "";
  return {
    "Content-Type": "application/json; charset=utf-8",
    ...(corsOrigin ? { "Access-Control-Allow-Origin": corsOrigin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600"
  };
}

function send(request, response, status, payload, config) {
  response.writeHead(status, headers(request, config));
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

export function httpStatusForRunResult(result) {
  if (result?.status === "policy_blocked") return 422;
  if (result?.status === "denied") return 403;
  if (result?.status === "sandbox_unavailable") return 503;
  if (result?.status === "completed" || result?.status === "failed") return 200;
  return result?.ok ? 200 : 500;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        request.destroy();
        reject(clientRequestError("Request body exceeds Coding Cornucopia sandbox limit."));
      }
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(clientRequestError("Request body must be valid JSON.")); }
    });
    request.on("error", reject);
  });
}

export async function handleSandboxRunnerRequest(request, response, config = {}) {
  const runnerConfig = {
    confirmServiceExecution,
    host,
    allowedOrigins: configuredAllowedOrigins(),
    runSnapshot: createAndRunSnapshotRun,
    ...config
  };
  const url = new URL(request.url || "/", `http://${request.headers.host || "sandbox.local"}`);
  if (request.method === "OPTIONS") {
    if (url.pathname === "/health" || url.pathname === "/v1/runs") {
      response.writeHead(204, headers(request, runnerConfig));
      response.end();
      return;
    }
    send(request, response, 404, { ok: false, message: "Unknown sandbox runner endpoint." }, runnerConfig);
    return;
  }
  if (request.method === "GET" && url.pathname === "/health") {
    send(request, response, 200, { service: "coding-cornucopia-sandbox-runner", local_only: runnerConfig.host === "127.0.0.1", confirm_service_execution: runnerConfig.confirmServiceExecution, ...(await doctor()) }, runnerConfig);
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/runs") {
    if (!runnerConfig.confirmServiceExecution) {
      send(request, response, 403, { ok: false, status: "denied", message: "Sandbox service is fail-closed. Restart with --confirm-service-execution after reviewing deployment isolation, rate limits, and origin policy.", diagnostics: [] }, runnerConfig);
      return;
    }
    try {
      const payload = await readJson(request);
      const result = await runnerConfig.runSnapshot(payload, { confirmLocalExecution: true });
      send(request, response, httpStatusForRunResult(result), result, runnerConfig);
    } catch (error) {
      const status = error?.statusCode === 400 ? 400 : 500;
      send(request, response, status, {
        ok: false,
        status: status === 400 ? "failed" : "sandbox_unavailable",
        message: error instanceof Error ? error.message : "Sandbox service failed before returning a run result.",
        diagnostics: status === 400 ? [] : [{
          severity: "error",
          phase: "sandbox",
          category: "sandbox_internal_failure",
          language: null,
          file: null,
          line: null,
          column: null,
          message: "Sandbox service failed before returning a run result.",
          source: "Sandbox runner"
        }]
      }, runnerConfig);
    }
    return;
  }
  send(request, response, 404, { ok: false, message: "Unknown sandbox runner endpoint." }, runnerConfig);
}

export function createSandboxRunnerServer(config = {}) {
  return http.createServer((request, response) => {
    void handleSandboxRunnerRequest(request, response, config);
  });
}

export function startSandboxRunnerServer(config = {}) {
  const runnerConfig = {
    confirmServiceExecution,
    port,
    host,
    allowedOrigins: configuredAllowedOrigins(),
    ...config
  };
  const server = createSandboxRunnerServer(runnerConfig);
  server.listen(runnerConfig.port, runnerConfig.host, () => {
    console.log(JSON.stringify({
      service: "coding-cornucopia-sandbox-runner",
      host: runnerConfig.host,
      port: runnerConfig.port,
      confirm_service_execution: runnerConfig.confirmServiceExecution,
      allowed_origins: runnerConfig.allowedOrigins,
      pages_preview_origins: "https://*.elysia-ecobotics-online.pages.dev",
      note: "This service must run outside the website/browser/Supabase. Network is disabled inside containers; deployment must add rate limits and origin controls."
    }, null, 2));
  });
  return server;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  startSandboxRunnerServer();
}
