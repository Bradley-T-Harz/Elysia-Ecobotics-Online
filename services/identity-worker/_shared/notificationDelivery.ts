import { sha256Text } from "./crypto.ts";
import { IdentityHttpError } from "./http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type NotificationDeliveryJob = Readonly<{
  notificationId: string;
  userId: string;
  type: string;
  actionPath: string | null;
  emailDeliveryAllowed: boolean;
}>;

export type NotificationDeliveryReceipt = Readonly<{
  provider: "database-in-app-v1" | "cloudflare-email-service-v1";
  deliveryEvidenceSha256: string;
}>;

export interface NotificationDeliveryAdapter {
  readonly name: NotificationDeliveryReceipt["provider"];
  deliver(job: NotificationDeliveryJob): Promise<NotificationDeliveryReceipt>;
}

export type EmailNotificationDeliveryJob = NotificationDeliveryJob & Readonly<{
  title: string;
  body: string;
  recipientEmail: string;
}>;

function safeJob(job: NotificationDeliveryJob): NotificationDeliveryJob {
  const notificationId = job.notificationId.toLowerCase();
  const userId = job.userId.toLowerCase();
  if (!UUID.test(notificationId) || !UUID.test(userId)) throw new IdentityHttpError(502, "notification_job_invalid");
  if (!/^[a-z][a-z0-9_]{2,99}$/.test(job.type)) throw new IdentityHttpError(502, "notification_job_invalid");
  if (
    job.actionPath !== null
    && (job.actionPath.length < 1 || job.actionPath.length > 500 || !job.actionPath.startsWith("/")
      || job.actionPath.startsWith("//") || /[\r\n\\]/.test(job.actionPath))
  ) throw new IdentityHttpError(502, "notification_job_invalid");
  return { ...job, notificationId, userId };
}

/**
 * Marks the already-created owner-scoped database notification as delivered.
 * It never claims to send email. Email-eligible work fails closed until a
 * separately reviewed provider adapter exists.
 */
export class DatabaseInAppNotificationAdapter implements NotificationDeliveryAdapter {
  readonly name = "database-in-app-v1" as const;

  async deliver(input: NotificationDeliveryJob): Promise<NotificationDeliveryReceipt> {
    const job = safeJob(input);
    if (job.emailDeliveryAllowed) throw new IdentityHttpError(503, "external_email_provider_unavailable");
    return {
      provider: this.name,
      deliveryEvidenceSha256: await sha256Text(
        `database-in-app-v1:${job.notificationId}:${job.userId}:${job.type}:${job.actionPath ?? "none"}`
      )
    };
  }
}

const ARTISAN_NOTIFICATION_ORIGINS = new Set([
  "https://elysiaartisancollective.pages.dev",
  "https://artisans.elysiaecobotics.com"
]);

function safeEmailAddress(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 3 || normalized.length > 254 || /[\s\r\n]/.test(normalized)
    || !/^[^@]+@[^@]+\.[^@]+$/.test(normalized)
  ) throw new IdentityHttpError(502, "notification_recipient_invalid");
  return normalized;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

/**
 * Transactional-only email projection for an already-created private
 * notification. The account email is resolved from Auth inside the Identity
 * Worker and never enters the outbox, browser, logs, or delivery evidence.
 */
export class CloudflareEmailNotificationAdapter {
  readonly name = "cloudflare-email-service-v1" as const;
  readonly #email: Pick<SendEmail, "send">;
  readonly #senderEmail: string;
  readonly #senderName: string;
  readonly #origin: string;

  constructor(input: {
    email: Pick<SendEmail, "send"> | undefined;
    senderEmail: string | undefined;
    senderName: string | undefined;
    origin: string | undefined;
  }) {
    if (!input.email) throw new IdentityHttpError(503, "notification_email_binding_missing");
    if (input.senderEmail !== "notifications@elysiaecobotics.com") {
      throw new IdentityHttpError(503, "notification_email_sender_invalid");
    }
    if (!input.senderName || input.senderName.length < 2 || input.senderName.length > 80 || /[\r\n]/.test(input.senderName)) {
      throw new IdentityHttpError(503, "notification_email_sender_invalid");
    }
    if (!input.origin || !ARTISAN_NOTIFICATION_ORIGINS.has(input.origin)) {
      throw new IdentityHttpError(503, "notification_email_origin_invalid");
    }
    this.#email = input.email;
    this.#senderEmail = input.senderEmail;
    this.#senderName = input.senderName;
    this.#origin = input.origin;
  }

  async deliver(input: EmailNotificationDeliveryJob): Promise<NotificationDeliveryReceipt> {
    const job = safeJob(input);
    if (!job.emailDeliveryAllowed) throw new IdentityHttpError(502, "notification_email_not_allowed");
    if (
      input.title.length < 1 || input.title.length > 200 || /[\u0000-\u001f\u007f]/.test(input.title)
      || input.body.length < 1 || input.body.length > 2_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.body)
    ) throw new IdentityHttpError(502, "notification_email_content_invalid");
    const recipientEmail = safeEmailAddress(input.recipientEmail);
    const actionUrl = job.actionPath === null ? null : new URL(job.actionPath, this.#origin).toString();
    const preferencesUrl = new URL("/notifications", this.#origin).toString();
    const text = `${input.body}${actionUrl ? `\n\nOpen this notice: ${actionUrl}` : ""}\n\nNotification controls: ${preferencesUrl}`;
    const htmlBody = escapeHtml(input.body).replace(/\r?\n/g, "<br>");
    const result = await this.#email.send({
      to: recipientEmail,
      from: { email: this.#senderEmail, name: this.#senderName },
      subject: input.title,
      text,
      html: `<p>${htmlBody}</p>${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}">Open this notice</a></p>` : ""}<p><a href="${escapeHtml(preferencesUrl)}">Manage notification controls</a></p>`
    });
    if (!result.messageId || result.messageId.length > 500 || /[\r\n]/.test(result.messageId)) {
      throw new IdentityHttpError(502, "notification_email_receipt_invalid");
    }
    return {
      provider: this.name,
      deliveryEvidenceSha256: await sha256Text(
        `cloudflare-email-service-v1:${job.notificationId}:${job.userId}:${result.messageId}`
      )
    };
  }
}
