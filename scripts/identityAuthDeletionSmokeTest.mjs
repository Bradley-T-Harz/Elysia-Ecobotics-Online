import assert from "node:assert/strict";

import {
  authDeletionRequestEvidence,
  SupabaseAuthSoftDeleteAdapter,
} from "../services/identity-worker/_shared/authDeletion.ts";
import { IdentityHttpError } from "../services/identity-worker/_shared/http.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
let invocation;
const adapter = new SupabaseAuthSoftDeleteAdapter({
  auth: {
    admin: {
      async deleteUser(targetUserId, shouldSoftDelete) {
        invocation = { targetUserId, shouldSoftDelete };
        return { data: { user: { id: targetUserId, email: "must-not-leave-adapter@example.invalid" } }, error: null };
      },
    },
  },
});

const result = await adapter.softDelete(userId, requestId);
assert.deepEqual(invocation, { targetUserId: userId, shouldSoftDelete: true });
assert.equal(result.provider, "supabase-auth-soft-delete-v1");
assert.equal(result.targetUserId, userId);
assert.match(result.providerReceiptSha256, /^[0-9a-f]{64}$/);
assert.match(result.confirmationEvidenceSha256, /^[0-9a-f]{64}$/);
assert.equal(Object.hasOwn(result, "email"), false);
assert.equal(await authDeletionRequestEvidence(requestId, userId), await authDeletionRequestEvidence(requestId, userId));

for (const response of [
  { data: null, error: { message: "provider detail must not escape" } },
  { data: { user: { id: requestId } }, error: null },
  { data: { user: null }, error: null },
]) {
  const failing = new SupabaseAuthSoftDeleteAdapter({
    auth: { admin: { deleteUser: async () => response } },
  });
  let caught;
  try { await failing.softDelete(userId, requestId); }
  catch (error) { caught = error; }
  assert(caught instanceof IdentityHttpError);
  assert(!caught.message.includes("provider detail"));
}

console.log("Identity Auth deletion smoke test passed: verified target, mandatory soft delete, hashed receipt, and fail-closed provider responses verified.");
