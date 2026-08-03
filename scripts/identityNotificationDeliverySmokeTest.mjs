import assert from "node:assert/strict";

import { CloudflareEmailNotificationAdapter, DatabaseInAppNotificationAdapter } from "../services/identity-worker/_shared/notificationDelivery.ts";
import { IdentityHttpError } from "../services/identity-worker/_shared/http.ts";
import {
  claimAccountNotificationDeliveryJobs,
  completeAccountNotificationDelivery,
  failAccountNotificationDelivery,
} from "../services/identity-worker/_shared/database.ts";
import { handleIdentityScheduledMaintenance } from "../services/identity-worker/worker.ts";

const adapter = new DatabaseInAppNotificationAdapter();
const job = {
  notificationId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  type: "moderation_notice",
  actionPath: "/account/activity",
  emailDeliveryAllowed: false,
};
const receipt = await adapter.deliver(job);
assert.equal(receipt.provider, "database-in-app-v1");
assert.match(receipt.deliveryEvidenceSha256, /^[0-9a-f]{64}$/);
assert.equal((await adapter.deliver(job)).deliveryEvidenceSha256, receipt.deliveryEvidenceSha256);

for (const invalid of [
  { ...job, emailDeliveryAllowed: true },
  { ...job, notificationId: "not-a-uuid" },
  { ...job, actionPath: "https://attacker.example" },
  { ...job, actionPath: "//attacker.example" },
]) {
  let caught;
  try { await adapter.deliver(invalid); }
  catch (error) { caught = error; }
  assert(caught instanceof IdentityHttpError);
}

let sentMessage = null;
const emailAdapter = new CloudflareEmailNotificationAdapter({
  email: { send: async (message) => { sentMessage = message; return { messageId: "fixture-cloudflare-email-message-id" }; } },
  senderEmail: "notifications@elysiaecobotics.com",
  senderName: "Elysia Artisan Collective",
  origin: "https://elysiaartisancollective.pages.dev",
});
const emailReceipt = await emailAdapter.deliver({
  ...job,
  emailDeliveryAllowed: true,
  title: "A moderation update",
  body: "Your work has an update. <img src=x onerror=alert(1)>",
  recipientEmail: "OWNER@EXAMPLE.COM",
});
assert.equal(emailReceipt.provider, "cloudflare-email-service-v1");
assert.match(emailReceipt.deliveryEvidenceSha256, /^[0-9a-f]{64}$/);
assert.equal(sentMessage.to, "owner@example.com");
assert.deepEqual(sentMessage.from, { email: "notifications@elysiaecobotics.com", name: "Elysia Artisan Collective" });
assert.match(sentMessage.text, /https:\/\/elysiaartisancollective\.pages\.dev\/account\/activity/);
assert.match(sentMessage.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(sentMessage.html, /<img|javascript:/i);
assert.doesNotMatch(emailReceipt.deliveryEvidenceSha256, /owner|example/i);

let onlineMessage = null;
const onlineAdapter = new CloudflareEmailNotificationAdapter({
  email: { send: async (message) => { onlineMessage = message; return { messageId: "fixture-online-message-id" }; } },
  senderEmail: "notifications@elysiaecobotics.com",
  senderName: "Elysia Ecobotics",
  origin: "https://elysiaecobotics.com",
});
await onlineAdapter.deliver({
  ...job,
  actionPath: "/commons-circle/inbox",
  emailDeliveryAllowed: true,
  title: "An account action is ready",
  body: "Open your account to review this action.",
  recipientEmail: "owner@example.com",
});
assert.match(onlineMessage.text, /https:\/\/elysiaecobotics\.com\/commons-circle\/inbox/);
assert.match(onlineMessage.text, /https:\/\/elysiaecobotics\.com\/commons-circle\/signals\/notifications/);
assert.doesNotMatch(onlineMessage.text, /artisans|pages\.dev/i);

const rpcCalls = [];
const rpcClient = {
  rpc: async (name, parameters) => {
    rpcCalls.push({ name, parameters });
    return { data: {}, error: null };
  },
};
await claimAccountNotificationDeliveryJobs(rpcClient, { leaseToken: job.notificationId, limit: 25 });
await completeAccountNotificationDelivery(rpcClient, {
  deliveryId: job.notificationId,
  leaseToken: job.userId,
  evidenceSha256: "a".repeat(64),
});
await failAccountNotificationDelivery(rpcClient, {
  deliveryId: job.notificationId,
  leaseToken: job.userId,
  errorCode: "delivery_failed",
  evidenceSha256: "b".repeat(64),
});
assert.deepEqual(rpcCalls, [
  {
    name: "claim_account_delivery_outbox",
    parameters: { p_lease_token: job.notificationId, p_limit: 25 },
  },
  {
    name: "complete_account_delivery_v2",
    parameters: {
      p_delivery_id: job.notificationId,
      p_lease_token: job.userId,
      p_delivery_evidence_sha256: "a".repeat(64),
    },
  },
  {
    name: "fail_account_delivery_v2",
    parameters: {
      p_delivery_id: job.notificationId,
      p_lease_token: job.userId,
      p_error_code: "delivery_failed",
      p_failure_evidence_sha256: "b".repeat(64),
    },
  },
]);

const scheduledDeliveryId = "33333333-3333-4333-8333-333333333333";
const scheduledEventId = "44444444-4444-4444-8444-444444444444";
const scheduledRecipientId = "55555555-5555-4555-8555-555555555555";
const scheduledFetchCalls = [];
const scheduledEmailCalls = [];
const scheduledLogs = [];
const originalFetch = globalThis.fetch;
const originalConsoleInfo = console.info;
const scheduledEnv = {
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-credential",
  IDENTITY_NOTIFICATION_DELIVERY_ENABLED: "false",
  IDENTITY_NOTIFICATION_DELIVERY_PROVIDER: "disabled",
  IDENTITY_ACCOUNT_NOTIFICATION_DELIVERY_ENABLED: "true",
  IDENTITY_ACCOUNT_NOTIFICATION_DELIVERY_PROVIDER: "cloudflare-email-service-v1",
  IDENTITY_NOTIFICATION_SENDER_EMAIL: "notifications@elysiaecobotics.com",
  IDENTITY_ACCOUNT_NOTIFICATION_SENDER_NAME: "Elysia Ecobotics",
  IDENTITY_ACCOUNT_NOTIFICATION_PUBLIC_ORIGIN: "https://elysiaecobotics.com",
  IDENTITY_EXPORT_RETENTION_ENABLED: "false",
  IDENTITY_EXPORT_RETENTION_PROVIDER: "disabled",
  IDENTITY_EMAIL: {
    send: async (message) => {
      scheduledEmailCalls.push(message);
      return { messageId: "fixture-scheduled-account-message" };
    },
  },
};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const requestBody = typeof init.body === "string" ? JSON.parse(init.body) : null;
  scheduledFetchCalls.push({ pathname: url.pathname, requestBody });
  if (url.pathname === "/rest/v1/rpc/claim_account_delivery_outbox") {
    return Response.json({
      deliveries: [{
        deliveryId: scheduledDeliveryId,
        eventId: scheduledEventId,
        recipientUserId: scheduledRecipientId,
        channel: "email",
        attemptCount: 1,
        leaseExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        category: "account_security",
        mandatory: true,
        title: "Account notice",
        preview: null,
        deepLink: "/commons-circle/notifications",
      }],
    }, { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === `/auth/v1/admin/users/${scheduledRecipientId}`) {
    return Response.json({
      id: scheduledRecipientId,
      email: "confirmed@example.com",
      email_confirmed_at: "2026-08-02T12:00:00.000Z",
    }, { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/rest/v1/rpc/complete_account_delivery_v2") {
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected scheduled-delivery request: ${url.pathname}`);
};
console.info = (value) => scheduledLogs.push(String(value));
try {
  await handleIdentityScheduledMaintenance(scheduledEnv);
} finally {
  globalThis.fetch = originalFetch;
  console.info = originalConsoleInfo;
}
assert.equal(scheduledEmailCalls.length, 1);
assert.match(scheduledEmailCalls[0].text, /required account notice/i);
assert.match(scheduledEmailCalls[0].text, /https:\/\/elysiaecobotics\.com\/commons-circle\/notifications/);
assert.match(scheduledEmailCalls[0].text, /https:\/\/elysiaecobotics\.com\/commons-circle\/signals\/notifications/);
assert.deepEqual(
  scheduledFetchCalls.map((call) => call.pathname),
  [
    "/rest/v1/rpc/claim_account_delivery_outbox",
    `/auth/v1/admin/users/${scheduledRecipientId}`,
    "/rest/v1/rpc/complete_account_delivery_v2",
  ]
);
assert.match(
  scheduledFetchCalls[0].requestBody.p_lease_token,
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
);
assert.equal(scheduledFetchCalls[0].requestBody.p_limit, 25);
assert.equal(scheduledFetchCalls[2].requestBody.p_delivery_id, scheduledDeliveryId);
assert.equal(scheduledFetchCalls[2].requestBody.p_lease_token, scheduledFetchCalls[0].requestBody.p_lease_token);
assert.match(scheduledFetchCalls[2].requestBody.p_delivery_evidence_sha256, /^[0-9a-f]{64}$/);
assert(
  scheduledLogs.some((entry) => entry.includes('"identity.account_notification_delivery"') && entry.includes('"completed":1')),
  "Scheduled account delivery did not report its bounded completion count."
);
assert(
  scheduledLogs.every((entry) => !entry.includes("confirmed@example.com") && !entry.includes("fixture-scheduled-account-message")),
  "Scheduled account delivery logged an address or provider receipt."
);

const failedDeliveryId = "66666666-6666-4666-8666-666666666666";
const failureFetchCalls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const requestBody = typeof init.body === "string" ? JSON.parse(init.body) : null;
  failureFetchCalls.push({ pathname: url.pathname, requestBody });
  if (url.pathname === "/rest/v1/rpc/claim_account_delivery_outbox") {
    return Response.json({
      deliveries: [{
        deliveryId: failedDeliveryId,
        eventId: scheduledEventId,
        recipientUserId: scheduledRecipientId,
        channel: "email",
        attemptCount: 2,
        leaseExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        category: "work_reviews",
        mandatory: false,
        title: "Review update",
        preview: "A review status changed.",
        deepLink: "/commons-circle/notifications",
      }],
    }, { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === `/auth/v1/admin/users/${scheduledRecipientId}`) {
    return Response.json({
      id: scheduledRecipientId,
      email: "confirmed@example.com",
      email_confirmed_at: "2026-08-02T12:00:00.000Z",
    }, { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/rest/v1/rpc/fail_account_delivery_v2") {
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected failed-delivery request: ${url.pathname}`);
};
console.info = () => undefined;
try {
  await handleIdentityScheduledMaintenance({
    ...scheduledEnv,
    IDENTITY_EMAIL: { send: async () => { throw new Error("private provider detail"); } },
  });
} finally {
  globalThis.fetch = originalFetch;
  console.info = originalConsoleInfo;
}
assert.deepEqual(
  failureFetchCalls.map((call) => call.pathname),
  [
    "/rest/v1/rpc/claim_account_delivery_outbox",
    `/auth/v1/admin/users/${scheduledRecipientId}`,
    "/rest/v1/rpc/fail_account_delivery_v2",
  ]
);
assert.equal(failureFetchCalls[2].requestBody.p_delivery_id, failedDeliveryId);
assert.equal(failureFetchCalls[2].requestBody.p_lease_token, failureFetchCalls[0].requestBody.p_lease_token);
assert.equal(failureFetchCalls[2].requestBody.p_error_code, "account_notification_delivery_failed");
assert.match(failureFetchCalls[2].requestBody.p_failure_evidence_sha256, /^[0-9a-f]{64}$/);

for (const invalidConfig of [
  { email: undefined, senderEmail: "notifications@elysiaecobotics.com", senderName: "Elysia Artisan Collective", origin: "https://elysiaartisancollective.pages.dev" },
  { email: { send: async () => ({ messageId: "x" }) }, senderEmail: "attacker@example.com", senderName: "Elysia Artisan Collective", origin: "https://elysiaartisancollective.pages.dev" },
  { email: { send: async () => ({ messageId: "x" }) }, senderEmail: "notifications@elysiaecobotics.com", senderName: "Elysia Artisan Collective", origin: "https://attacker.example" },
]) {
  assert.throws(() => new CloudflareEmailNotificationAdapter(invalidConfig), IdentityHttpError);
}

console.log("Identity notification adapter smoke test passed: in-app and flag-gated Cloudflare transactional delivery are escaped, origin-bound, and hash-evidenced.");
