// Synthetic account fixture; used only with intercepted localhost browser tests.
const userId = "a2900000-0000-4000-8000-000000000001";
const now = "2026-08-29T18:00:00.000Z";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const accessToken = `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
const fixtureUser = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "account-owner@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: now,
  updated_at: now,
};
const fixtureSession = {
  access_token: accessToken,
  refresh_token: "fixture-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: fixtureUser,
};
const fixtureProfile = {
  id: userId,
  username: "account-owner",
  display_name: "Account Owner",
  headline: "Stewarding shared ecological tools",
  bio: "A private account fixture used only by the local browser evidence harness.",
  interests: "ecobotics, shared tools",
  website_url: null,
  github_url: null,
  public_profile_enabled: true,
  short_public_bio: "Stewarding shared ecological tools.",
  commons_onboarding_completed_at: now,
  stewardship_onboarding_skipped_at: null,
  work_with_onboarding_skipped_at: null,
  saved_addon_ids: [],
  is_admin: false,
  created_at: now,
  updated_at: now,
};
const eventPreferences = {
  taxonomyVersion: 1,
  preferences: [
    { category: "account_security", taxonomyVersion: 1, preferenceVersion: 1, inAppEnabled: true, emailEnabled: true, quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: "UTC" },
    { category: "community_mentions", taxonomyVersion: 1, preferenceVersion: 1, inAppEnabled: true, emailEnabled: false, quietHoursStart: "22:00:00", quietHoursEnd: "08:00:00", quietHoursTimezone: "UTC" },
    { category: "private_messages", taxonomyVersion: 1, preferenceVersion: 1, inAppEnabled: true, emailEnabled: false, quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: "UTC" },
  ],
};

function bootstrap(deactivated) {
  return {
    accountActivation: {
      state: deactivated ? "temporarily_deactivated" : "active",
      temporarilyDeactivatedAt: deactivated ? now : null,
      reactivatedAt: null,
      updatedAt: now,
    },
    communityAccess: {
      userId,
      participationState: "restricted",
      ageBand: "18_plus",
      assuranceStatus: "restricted",
      assuranceExpiresAt: null,
      jurisdictionCode: "US-CO",
      publicProfileEnabled: true,
      publicProfilePublished: !deactivated,
      canPublishPublicProfile: !deactivated,
      profileComplete: true,
      canJoinArtisan: false,
      canPostArtisan: false,
      canCommentArtisan: false,
      canAppreciateArtisan: false,
      canUploadImage: false,
      canSubmitChallenge: false,
      evaluatedAt: now,
    },
    membership: {
      status: "active",
      joinedAt: now,
      defaultCreditLine: null,
      defaultCreationMethod: null,
      defaultLicenseCode: null,
    },
    profileCard: {
      userId,
      handle: "account-owner",
      displayName: "Account Owner",
      avatarUrl: null,
      shortPublicBio: "Stewarding shared ecological tools.",
      canonicalProfileUrl: "https://elysiaecobotics.com/commons-circle/@account-owner",
      publicProfileEnabled: true,
      updatedAt: now,
    },
    guardianSummary: { relationships: [] },
    legalManifest: { documents: [], missingAcceptances: [], requiredDocumentsReady: true, complete: true },
    notificationPreferences: {
      inAppEnabled: true,
      emailEnabled: true,
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


export { userId, fixtureUser, fixtureSession, fixtureProfile, bootstrap, now };
