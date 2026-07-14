import { assertPrivateOutputPath, finalizerTokenHash, renderFinalizerSql, validateFinalizerToken } from "./sandboxFinalizerTokenTool.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fakeToken = "elysia_sandbox_finalizer_v1_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
assert(validateFinalizerToken(fakeToken), "The obvious synthetic finalizer fixture should satisfy the production format without being generated secret material.");
assert(!validateFinalizerToken("replace-with-production-token"), "Placeholder finalizer values must be rejected.");
assert(!validateFinalizerToken("elysia_sandbox_finalizer_v1_" + "a".repeat(64)), "Low-diversity predictable finalizer values must be rejected.");
const digest = finalizerTokenHash(fakeToken);
assert(/^[0-9a-f]{64}$/.test(digest), "Finalizer tooling must derive a SHA-256 hex digest.");
const rotationSql = renderFinalizerSql(fakeToken);
assert(rotationSql.includes(digest) && !rotationSql.includes(fakeToken) && rotationSql.includes("sandbox_finalizer_rotation_not_verified"), "Rotation SQL must contain only the hash, never the raw token, and fail if the singleton update was not verified.");
const revocationSql = renderFinalizerSql("", "revoke");
assert(revocationSql.includes("secret_hash_hex = null") && !revocationSql.includes(digest) && revocationSql.includes("sandbox_finalizer_revocation_not_verified"), "Revocation SQL must clear and verify the singleton without embedding token material.");
assert(assertPrivateOutputPath("/tmp/elysia-finalizer-synthetic-test") === "/tmp/elysia-finalizer-synthetic-test", "Absolute paths outside the repository should be eligible for explicit operator output.");
let repositoryPathRejected = false;
try { assertPrivateOutputPath(new URL("../synthetic-secret", import.meta.url).pathname); }
catch { repositoryPathRejected = true; }
assert(repositoryPathRejected, "Finalizer material must never be written inside the repository.");

console.log("Sandbox finalizer tooling smoke test ok (synthetic data only; no secret material created).");
