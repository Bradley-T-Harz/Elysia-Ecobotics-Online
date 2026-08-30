import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  IdentityApiError,
  loadIdentityBootstrap,
} from "../src/shared/participation/participationClient.ts";

const now = "2026-08-29T00:00:00.000Z";
const userId = "11111111-1111-4111-8111-111111111111";
const originalFetch = globalThis.fetch;

function legacyBootstrap() {
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

test("legacy bootstrap without accountActivation preserves the exact current behavior", async () => {
  const payload = legacyBootstrap();
  respondWith(payload);

  const decoded = await loadIdentityBootstrap("synthetic-access-token");

  assert.deepEqual(decoded, payload);
  assert.equal(Object.hasOwn(decoded, "accountActivation"), false);
});

test("bootstrap accepts the exact optional accountActivation contract", async () => {
  const payload = {
    ...legacyBootstrap(),
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

test("invalid accountActivation fails the strict bootstrap contract", async () => {
  respondWith({
    ...legacyBootstrap(),
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
  respondWith({ ...legacyBootstrap(), unexpectedAuthority: true });

  await assert.rejects(
    loadIdentityBootstrap("synthetic-access-token"),
    (error) => error instanceof IdentityApiError && error.code === "identity_response_invalid",
  );
});
