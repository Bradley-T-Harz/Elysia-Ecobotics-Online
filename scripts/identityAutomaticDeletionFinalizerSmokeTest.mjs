import assert from "node:assert/strict";

import { observedAuthDeletionConfirmation } from "../services/identity-worker/_shared/authDeletion.ts";
import { IdentityHttpError } from "../services/identity-worker/_shared/http.ts";
import { SupabaseOwnedStorageCleanupAdapter } from "../services/identity-worker/_shared/storageCleanup.ts";
import { processAutomaticDeletionFinalization } from "../services/identity-worker/worker.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
const leaseToken = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const objectId = "44444444-4444-4444-8444-444444444444";
const workerId = "identity-owner-deletion-finalizer-v1";
const sha = "a".repeat(64);

const enabledEnv = Object.freeze({
  IDENTITY_DELETION_FINALIZER_ENABLED: "true",
  IDENTITY_DELETION_FINALIZER_PROVIDER: "automatic-owner-deletion-v1",
  IDENTITY_DELETION_FINALIZER_BATCH_LIMIT: "2",
  IDENTITY_DELETION_FINALIZER_LEASE_SECONDS: "600",
  IDENTITY_DELETION_FINALIZER_RETRY_SECONDS: "300",
  IDENTITY_STORAGE_CLEANUP_ENABLED: "true",
  IDENTITY_STORAGE_CLEANUP_PROVIDER: "scoped-private-object-cleanup-v1",
  IDENTITY_AUTH_DELETION_ENABLED: "true",
  IDENTITY_AUTH_DELETION_PROVIDER: "supabase-auth-soft-delete-v1",
});

function job(phase, claimCount = 1) {
  return {
    requestId,
    leaseToken,
    phase,
    claimCount,
    leaseExpiresAt: "2099-08-30T12:00:00.000Z",
  };
}

function clientFixture(resolver) {
  return {
    async rpc(name, parameters) {
      try { return { data: await resolver(name, parameters), error: null }; }
      catch (error) { return { data: null, error: { code: error.code ?? "P0001" } }; }
    },
  };
}

{
  const calls = [];
  let storagePage = 0;
  const client = clientFixture(async (name, parameters) => {
    calls.push([name, parameters]);
    if (name === "claim_community_deletion_finalizer_jobs") return { workerId, items: [job("storage_inventory")] };
    if (name === "get_community_deletion_finalizer_storage_page") {
      storagePage += 1;
      return storagePage === 1
        ? {
            requestId, totalCount: 1, inventoryEvidenceSha256: sha,
            items: [{ objectId, bucket: "profile-avatars", name: `${userId}/avatars/source.webp` }],
            nextBucket: null, nextName: null,
          }
        : { requestId, totalCount: 0, inventoryEvidenceSha256: sha, items: [], nextBucket: null, nextName: null };
    }
    if (name === "record_community_deletion_finalizer_inventory") return {
      requestId, phase: "storage_cleanup", ownedStorageObjectCount: 1, inventoryEvidenceSha256: sha,
    };
    if (name === "complete_community_deletion_finalizer_storage") return {
      requestId, phase: "artisan_cleanup", storageCleanupEvidenceSha256: sha,
    };
    if (name === "enqueue_community_deletion_finalizer_artisan_cleanup") return {
      requestId, status: "completed", expectedAssetCount: 0, completedAssetCount: 0,
      completionEvidenceSha256: sha, ready: true,
    };
    if (name === "advance_community_deletion_finalizer_to_auth") return {
      requestId, phase: "auth_deletion", ready: true, status: "auth_deletion_ready",
    };
    if (name === "begin_community_deletion_finalizer_auth") return {
      requestId, userId, authDeleted: false, requestEvidenceSha256: sha,
    };
    if (name === "complete_community_deletion_finalizer_auth") return {
      requestId, status: "completed", completedAt: "2026-08-30T12:00:00.000Z",
    };
    assert.fail(`unexpected RPC ${name}`);
  });
  const removed = [];
  let authTarget = null;
  const result = await processAutomaticDeletionFinalization(enabledEnv, {
    client,
    storage: { async remove(objects, targetRequestId) { removed.push([objects, targetRequestId]); return { attemptedObjectCount: objects.length, cleanupEvidenceSha256: sha }; } },
    auth: {
      name: "supabase-auth-soft-delete-v1",
      async softDelete(targetUserId, targetRequestId) {
        authTarget = [targetUserId, targetRequestId];
        return await observedAuthDeletionConfirmation(targetRequestId, targetUserId);
      },
    },
  });
  assert.deepEqual(result, { claimed: 1, completed: 1, deferred: 0, failed: 0 });
  assert.equal(removed.length, 1);
  assert.equal(removed[0][0][0].objectId, objectId);
  assert.equal(removed[0][1], requestId);
  assert.deepEqual(authTarget, [userId, requestId]);
  assert.equal(calls.some(([name]) => name === "fail_community_deletion_finalizer_job"), false);
}

{
  let authCalls = 0;
  const client = clientFixture(async (name) => {
    if (name === "claim_community_deletion_finalizer_jobs") return { workerId, items: [job("auth_deletion", 2)] };
    if (name === "begin_community_deletion_finalizer_auth") return {
      requestId, userId, authDeleted: true, requestEvidenceSha256: sha,
    };
    if (name === "complete_community_deletion_finalizer_auth") return {
      requestId, status: "completed", completedAt: "2026-08-30T12:01:00.000Z",
    };
    assert.fail(`unexpected RPC ${name}`);
  });
  const result = await processAutomaticDeletionFinalization(enabledEnv, {
    client,
    storage: { async remove() { assert.fail("completed storage must not rerun"); } },
    auth: { name: "supabase-auth-soft-delete-v1", async softDelete() { authCalls += 1; assert.fail("observed Auth deletion must not execute twice"); } },
  });
  assert.deepEqual(result, { claimed: 1, completed: 1, deferred: 0, failed: 0 });
  assert.equal(authCalls, 0);
}

{
  let deferred = false;
  const client = clientFixture(async (name) => {
    if (name === "claim_community_deletion_finalizer_jobs") return { workerId, items: [job("artisan_cleanup")] };
    if (name === "enqueue_community_deletion_finalizer_artisan_cleanup") return {
      requestId, status: "processing", expectedAssetCount: 2, completedAssetCount: 1,
      completionEvidenceSha256: null, ready: false,
    };
    if (name === "defer_community_deletion_finalizer_job") {
      deferred = true;
      return { requestId, status: "pending", phase: "artisan_cleanup", availableAt: "2099-08-30T12:00:00.000Z" };
    }
    assert.fail(`unexpected RPC ${name}`);
  });
  assert.deepEqual(await processAutomaticDeletionFinalization(enabledEnv, { client }), {
    claimed: 1, completed: 0, deferred: 1, failed: 0,
  });
  assert.equal(deferred, true);
}

{
  let failure = null;
  const client = clientFixture(async (name, parameters) => {
    if (name === "claim_community_deletion_finalizer_jobs") return { workerId, items: [job("storage_cleanup")] };
    if (name === "get_community_deletion_finalizer_storage_page") return {
      requestId, totalCount: 1, inventoryEvidenceSha256: sha,
      items: [{ objectId, bucket: "profile-avatars", name: `${userId}/avatars/source.webp` }],
      nextBucket: null, nextName: null,
    };
    if (name === "fail_community_deletion_finalizer_job") {
      failure = parameters;
      return { requestId, status: "failed", phase: "storage_cleanup", failureCount: 1, availableAt: "2099-08-30T12:00:00.000Z" };
    }
    assert.fail(`unexpected RPC ${name}`);
  });
  assert.deepEqual(await processAutomaticDeletionFinalization(enabledEnv, {
    client,
    storage: { async remove() { throw new IdentityHttpError(502, "deletion_storage_cleanup_failed"); } },
  }), { claimed: 1, completed: 0, deferred: 0, failed: 1 });
  assert.equal(failure.p_request_id, requestId);
  assert.equal(failure.p_error_code, "deletion_storage_cleanup_failed");
  assert.match(failure.p_failure_evidence_sha256, /^[0-9a-f]{64}$/);
}

{
  const removed = [];
  const storageClient = {
    storage: {
      from(bucket) {
        return { async remove(names) { removed.push([bucket, names]); return { data: [], error: null }; } };
      },
    },
  };
  const adapter = new SupabaseOwnedStorageCleanupAdapter(storageClient);
  const result = await adapter.remove([
    { objectId, bucket: "profile-avatars", name: `${userId}/avatars/source.webp` },
  ], requestId);
  assert.deepEqual(removed, [["profile-avatars", [`${userId}/avatars/source.webp`]]]);
  assert.equal(result.attemptedObjectCount, 1);
  assert.match(result.cleanupEvidenceSha256, /^[0-9a-f]{64}$/);
  await assert.rejects(
    adapter.remove([{ objectId, bucket: "profile-avatars", name: `../${userId}` }], requestId),
    (error) => error instanceof IdentityHttpError && error.code === "deletion_storage_inventory_invalid",
  );
}

await assert.rejects(
  processAutomaticDeletionFinalization({ ...enabledEnv, IDENTITY_DELETION_FINALIZER_ENABLED: "false" }, {
    client: clientFixture(async () => assert.fail("disabled finalizer must not claim work")),
  }),
  (error) => error instanceof IdentityHttpError && error.code === "deletion_finalizer_disabled",
);

console.log("Automatic deletion finalizer smoke test passed: phased execution, durable retry, idempotent Auth completion, scoped Storage cleanup, and rollout gate verified.");
