import assert from "node:assert/strict";

import {
  accountExportObjectKey,
  R2AccountExportStorage,
} from "../services/identity-worker/_shared/exportStorage.ts";
import { IdentityHttpError } from "../services/identity-worker/_shared/http.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
const operationId = "22222222-2222-4222-8222-222222222222";
const objectKey = accountExportObjectKey(requestId, operationId);
const encoder = new TextEncoder();
const objects = new Map();

function checksumBytes(hex) {
  return Uint8Array.from(hex.match(/../g).map((value) => Number.parseInt(value, 16))).buffer;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function metadata(key, stored) {
  return {
    key,
    version: "fixture-version",
    size: stored.bytes.byteLength,
    etag: "fixture-etag",
    httpEtag: '"fixture-etag"',
    uploaded: stored.uploaded,
    httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
    customMetadata: {},
    range: undefined,
    checksums: { sha256: checksumBytes(stored.sha256) },
    storageClass: "Standard",
    writeHttpMetadata() {},
  };
}

const bucket = {
  async head(key) {
    const stored = objects.get(key);
    return stored ? metadata(key, stored) : null;
  },
  async put(key, value, options) {
    assert.equal(options.onlyIf.etagDoesNotMatch, "*");
    assert.equal(options.httpMetadata.contentType, "application/json");
    if (objects.has(key)) return null;
    const bytes = value instanceof Uint8Array ? value.slice() : new Uint8Array(value);
    const digest = await sha256(bytes);
    assert.equal(options.sha256, digest);
    const stored = { bytes, sha256: digest, uploaded: new Date("2026-07-18T12:00:00.000Z") };
    objects.set(key, stored);
    return metadata(key, stored);
  },
  async get(key) {
    const stored = objects.get(key);
    if (!stored) return null;
    return {
      ...metadata(key, stored),
      body: new Blob([stored.bytes]).stream(),
      bodyUsed: false,
      arrayBuffer: async () => stored.bytes.buffer,
      text: async () => new TextDecoder().decode(stored.bytes),
      json: async () => JSON.parse(new TextDecoder().decode(stored.bytes)),
      blob: async () => new Blob([stored.bytes]),
    };
  },
  async delete(key) { objects.delete(key); },
};

const storage = new R2AccountExportStorage(bucket);
const bytes = encoder.encode(JSON.stringify({ version: 1, records: [] }));
const stored = await storage.put(objectKey, bytes);
assert.equal(stored.objectKey, objectKey);
assert.equal(stored.byteSize, bytes.byteLength);
assert.match(stored.sha256, /^[0-9a-f]{64}$/);
assert.equal((await storage.put(objectKey, bytes)).sha256, stored.sha256, "Exact retry was not idempotent.");
const downloaded = await storage.get(objectKey);
assert(downloaded && downloaded.etag === '"fixture-etag"');
assert.equal(new TextDecoder().decode(await new Response(downloaded.body).arrayBuffer()), new TextDecoder().decode(bytes));

let conflict;
try { await storage.put(objectKey, encoder.encode('{"different":true}')); }
catch (error) { conflict = error; }
assert(conflict instanceof IdentityHttpError && conflict.code === "account_export_object_conflict");

await storage.delete(objectKey);
assert.equal(await storage.get(objectKey), null);
assert.throws(() => accountExportObjectKey("../private", operationId), /account_export_object_key_invalid/);

console.log("Identity export storage smoke test passed: private create-only integrity, retry, conflict, streaming, and confirmed expiry deletion verified.");
