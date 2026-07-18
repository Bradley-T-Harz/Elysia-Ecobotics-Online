import assert from "node:assert/strict";

import { CloudflareEmailNotificationAdapter, DatabaseInAppNotificationAdapter } from "../services/identity-worker/_shared/notificationDelivery.ts";
import { IdentityHttpError } from "../services/identity-worker/_shared/http.ts";

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

for (const invalidConfig of [
  { email: undefined, senderEmail: "notifications@elysiaecobotics.com", senderName: "Elysia Artisan Collective", origin: "https://elysiaartisancollective.pages.dev" },
  { email: { send: async () => ({ messageId: "x" }) }, senderEmail: "attacker@example.com", senderName: "Elysia Artisan Collective", origin: "https://elysiaartisancollective.pages.dev" },
  { email: { send: async () => ({ messageId: "x" }) }, senderEmail: "notifications@elysiaecobotics.com", senderName: "Elysia Artisan Collective", origin: "https://attacker.example" },
]) {
  assert.throws(() => new CloudflareEmailNotificationAdapter(invalidConfig), IdentityHttpError);
}

console.log("Identity notification adapter smoke test passed: in-app and flag-gated Cloudflare transactional delivery are escaped, origin-bound, and hash-evidenced.");
