#!/usr/bin/env node
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  beginRunnerShutdown,
  cleanupRunnerState,
  createAndRunSnapshotRun,
  doctor,
  runnerState,
  shutdownRunner
} from "./runner.mjs";
import { loadRunnerConfig, publicConfigReady } from "./serviceConfig.mjs";

const MAX_BODY_BYTES = 70_000;
const RESPONSE_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
});

function send(response, status, payload, retryAfter = null) {
  const headers = { ...RESPONSE_HEADERS };
  if (retryAfter !== null) headers["retry-after"] = String(retryAfter);
  const body = `${JSON.stringify(payload)}\n`;
  headers["content-length"] = String(Buffer.byteLength(body));
  response.writeHead(status, headers);
  response.end(body);
}

function tokenMatches(authorization, expectedToken) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ") || authorization.length > 600) return false;
  const presented = authorization.slice(7);
  if (!presented || /[\s,]/.test(presented) || !expectedToken) return false;
  const left = createHash("sha256").update(presented).digest();
  const right = createHash("sha256").update(expectedToken).digest();
  return timingSafeEqual(left, right);
}

function authenticated(request, config) {
  return tokenMatches(request.headers.authorization, config.serviceToken);
}

function contentTypeIsJson(request) {
  const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  return contentType === "application/json";
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const declared = String(request.headers["content-length"] || "");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
      request.resume();
      reject(new Error("request_too_large"));
      return;
    }
    const chunks = [];
    let bytes = 0;
    let settled = false;
    const fail = (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(code));
    };
    request.setTimeout(7_000, () => fail("request_timeout"));
    request.on("data", (chunk) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        request.pause();
        fail("request_too_large");
        return;
      }
      chunks.push(chunk);
    });
    request.once("end", () => {
      if (settled) return;
      settled = true;
      try {
        const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("json_invalid");
        resolve(parsed);
      } catch { reject(new Error("json_invalid")); }
    });
    request.once("aborted", () => fail("request_aborted"));
    request.once("error", () => fail("request_failed"));
  });
}

export function httpStatusForRunResult(result) {
  if (result?.busy) return 429;
  if (result?.status === "policy_blocked") return 422;
  if (result?.status === "denied") return 503;
  if (result?.status === "sandbox_unavailable") return 503;
  if (result?.status === "completed" || result?.status === "failed") return 200;
  return 500;
}

export async function handleSandboxRunnerRequest(request, response, options) {
  const { config, runSnapshot = createAndRunSnapshotRun, healthCheck = doctor } = options;
  let url;
  try { url = new URL(request.url || "/", "http://sandbox.local"); }
  catch { send(response, 400, { ok: false, error: "request_invalid" }); return; }

  if (request.headers.origin) {
    send(response, 403, { ok: false, error: "origin_denied" });
    return;
  }
  if (!authenticated(request, config)) {
    send(response, 401, { ok: false, error: "authentication_invalid" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/health" && !url.search) {
    try {
      const detail = await healthCheck(config);
      send(response, detail.ready ? 200 : 503, {
        ok: detail.ready === true,
        service: "elysia-sandbox-runner",
        state: runnerState(),
        detail
      });
    } catch {
      send(response, 503, { ok: false, service: "elysia-sandbox-runner", state: runnerState() });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/runs" && !url.search) {
    if (!publicConfigReady(config)) {
      request.resume();
      send(response, 503, { ok: false, status: "denied", diagnostics: [], message: "Sandbox execution is disabled." });
      return;
    }
    if (!contentTypeIsJson(request)) {
      request.resume();
      send(response, 415, { ok: false, error: "json_required" });
      return;
    }
    let payload;
    try {
      payload = await readJson(request);
    } catch (error) {
      const code = error instanceof Error ? error.message : "request_failed";
      const status = code === "request_too_large" ? 413 : code === "request_timeout" ? 408 : 400;
      send(response, status, { ok: false, error: status === 413 ? "request_too_large" : "request_invalid" });
      return;
    }
    try {
      const result = await runSnapshot(payload, { confirmLocalExecution: true, config });
      const status = httpStatusForRunResult(result);
      send(response, status, result, result.retryAfter ?? (result.busy ? config.retryAfterSeconds : null));
    } catch {
      send(response, 503, {
        ok: false,
        status: "sandbox_unavailable",
        diagnostics: [],
        message: "Sandbox execution is temporarily unavailable."
      });
    }
    return;
  }

  request.resume();
  send(response, request.method === "GET" || request.method === "POST" ? 404 : 405, { ok: false, error: "endpoint_not_found" });
}

export function createSandboxRunnerServer(options = {}) {
  const config = options.config || loadRunnerConfig();
  const server = http.createServer({
    maxHeaderSize: 8_192,
    headersTimeout: 5_000,
    requestTimeout: 10_000,
    keepAliveTimeout: 1_000
  }, (request, response) => {
    void handleSandboxRunnerRequest(request, response, { ...options, config }).catch(() => {
      if (!response.headersSent) send(response, 500, { ok: false, error: "sandbox_request_failed" });
      else response.destroy();
    });
  });
  server.maxHeadersCount = 32;
  server.maxConnections = 16;
  return server;
}

export async function startSandboxRunnerServer(options = {}) {
  const config = options.config || loadRunnerConfig();
  await cleanupRunnerState(config, { removeAllOrphans: true });
  const server = createSandboxRunnerServer({ ...options, config });
  server.listen(config.port, config.host, () => {
    console.log(JSON.stringify({ service: "elysia-sandbox-runner", listening: true, enabled: publicConfigReady(config) }));
  });
  const stop = async () => {
    beginRunnerShutdown();
    server.closeIdleConnections?.();
    await shutdownRunner();
    await new Promise((resolve) => server.close(resolve));
  };
  process.once("SIGTERM", () => { void stop(); });
  process.once("SIGINT", () => { void stop(); });
  return server;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  startSandboxRunnerServer().catch(() => {
    console.error(JSON.stringify({ service: "elysia-sandbox-runner", started: false, error: "startup_failed" }));
    process.exitCode = 1;
  });
}
