#!/usr/bin/env node
import http from "node:http";
import { createAndRunSnapshotRun, doctor } from "./runner.mjs";

const args = new Set(process.argv.slice(2));
const confirmServiceExecution = args.has("--confirm-service-execution") || process.env.ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION === "true";
const port = Number(process.env.PORT || process.env.ELYSIA_SANDBOX_PORT || 8788);
const host = process.env.ELYSIA_SANDBOX_HOST || "127.0.0.1";
const allowedOrigins = String(process.env.ELYSIA_SANDBOX_ALLOWED_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean);
const maxBodyBytes = 160 * 1024;

function headers(request) {
  const origin = request.headers.origin || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : "";
  return {
    "content-type": "application/json; charset=utf-8",
    ...(corsOrigin ? { "access-control-allow-origin": corsOrigin, "vary": "origin" } : {}),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function send(request, response, status, payload) {
  response.writeHead(status, headers(request));
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        request.destroy();
        reject(new Error("Request body exceeds Coding Cornucopia sandbox limit."));
      }
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("Request body must be valid JSON.")); }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "sandbox.local"}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers(request));
    response.end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/health") {
    send(request, response, 200, { service: "coding-cornucopia-sandbox-runner", local_only: host === "127.0.0.1", confirm_service_execution: confirmServiceExecution, ...(await doctor()) });
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/runs") {
    if (!confirmServiceExecution) {
      send(request, response, 403, { ok: false, status: "denied", message: "Sandbox service is fail-closed. Restart with --confirm-service-execution after reviewing deployment isolation, rate limits, and origin policy.", diagnostics: [] });
      return;
    }
    try {
      const payload = await readJson(request);
      const result = await createAndRunSnapshotRun(payload, { confirmLocalExecution: true });
      send(request, response, result.ok ? 200 : result.status === "policy_blocked" ? 422 : 500, result);
    } catch (error) {
      send(request, response, 400, { ok: false, status: "failed", message: error instanceof Error ? error.message : "Sandbox request failed.", diagnostics: [] });
    }
    return;
  }
  send(request, response, 404, { ok: false, message: "Unknown sandbox runner endpoint." });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    service: "coding-cornucopia-sandbox-runner",
    host,
    port,
    confirm_service_execution: confirmServiceExecution,
    note: "This service must run outside the website/browser/Supabase. Network is disabled inside containers; deployment must add rate limits and origin controls."
  }, null, 2));
});
