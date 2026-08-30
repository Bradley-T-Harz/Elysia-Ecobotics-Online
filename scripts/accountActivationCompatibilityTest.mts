import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  IdentityApiError,
  loadIdentityBootstrap,
} from "../src/shared/participation/participationClient.ts";

const now = "2026-08-29T00:00:00.000Z";
const userId = "11111111-1111-4111-8111-111111111111";
const originalFetch = globalThis.fetch;

function currentProductionBootstrap() {
  return {
    communityAccess: {
      userId,
      participationState: "read_only",
      ageBand: "unknown",
      assuranceStatus: "not_collected",
      assuranceExpiresAt: null,
      jurisdictionCode: null,
      publicProfileEnabled: false,
      publicProfilePublished: false,
      canPublishPublicProfile: false,
      profileComplete: true,
      canJoinArtisan: false,
      canPostArtisan: false,
      canCommentArtisan: false,
      canAppreciateArtisan: false,
      canUploadImage: false,
      canSubmitChallenge: false,
      evaluatedAt: now,
    },
    membership: null,
    profileCard: null,
    guardianSummary: { relationships: [] },
    legalManifest: {
      documents: [],
      missingAcceptances: [],
      requiredDocumentsReady: true,
      complete: true,
    },
    notificationPreferences: {
      inAppEnabled: true,
      emailEnabled: false,
      mentionsEnabled: true,
      commentsEnabled: true,
      challengeUpdatesEnabled: true,
      moderationUpdatesEnabled: true,
      guardianUpdatesEnabled: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      updatedAt: now,
    },
    featureFlags: {},
  };
}

function respondWith(data: unknown) {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("current production bootstrap without accountActivation preserves exact behavior", async () => {
  const payload = currentProductionBootstrap();
  respondWith(payload);

  const decoded = await loadIdentityBootstrap("synthetic-access-token");

  assert.deepEqual(decoded, payload);
  assert.equal(Object.hasOwn(decoded, "accountActivation"), false);
});

test("bootstrap accepts the exact optional accountActivation contract", async () => {
  const payload = {
    ...currentProductionBootstrap(),
    accountActivation: {
      state: "temporarily_deactivated",
      temporarilyDeactivatedAt: now,
      reactivatedAt: null,
      updatedAt: now,
    },
  };
  respondWith(payload);

  const decoded = await loadIdentityBootstrap("synthetic-access-token");

  assert.deepEqual(decoded.accountActivation, payload.accountActivation);
  assert.equal(decoded.communityAccess.participationState, "read_only");
});

test("existing projection facts do not replace participation or server capabilities", async () => {
  const current = currentProductionBootstrap();
  const payload = {
    ...current,
    communityAccess: {
      ...current.communityAccess,
      participationState: "restricted",
      publicProfileEnabled: true,
      publicProfilePublished: true,
      canPublishPublicProfile: true,
      canAppreciateArtisan: true,
    },
  };
  respondWith(payload);

  const decoded = await loadIdentityBootstrap("synthetic-access-token");

  assert.equal(decoded.communityAccess.participationState, "restricted");
  assert.equal(decoded.communityAccess.canPostArtisan, false);
  assert.equal(decoded.communityAccess.canUploadImage, false);
  assert.equal(decoded.communityAccess.canSubmitChallenge, false);
});

for (const field of [
  "publicProfilePublished",
  "canPublishPublicProfile",
  "canAppreciateArtisan",
] as const) {
  test(`invalid ${field} type fails the strict bootstrap contract`, async () => {
    const current = currentProductionBootstrap();
    respondWith({
      ...current,
      communityAccess: { ...current.communityAccess, [field]: "false" },
    });

    await assert.rejects(
      loadIdentityBootstrap("synthetic-access-token"),
      (error) => error instanceof IdentityApiError && error.code === "identity_response_invalid",
    );
  });
}

test("invalid accountActivation fails the strict bootstrap contract", async () => {
  respondWith({
    ...currentProductionBootstrap(),
    accountActivation: {
      state: "paused",
      temporarilyDeactivatedAt: now,
      reactivatedAt: null,
      updatedAt: now,
    },
  });

  await assert.rejects(
    loadIdentityBootstrap("synthetic-access-token"),
    (error) => error instanceof IdentityApiError && error.code === "identity_response_invalid",
  );
});

test("unrelated unknown bootstrap fields remain rejected", async () => {
  respondWith({ ...currentProductionBootstrap(), unexpectedAuthority: true });

  await assert.rejects(
    loadIdentityBootstrap("synthetic-access-token"),
    (error) => error instanceof IdentityApiError && error.code === "identity_response_invalid",
  );
});
