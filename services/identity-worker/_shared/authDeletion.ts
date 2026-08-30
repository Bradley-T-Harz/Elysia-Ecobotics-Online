import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Text } from "./crypto.ts";
import { IdentityHttpError } from "./http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function uuid(value: string): string {
  const normalized = value.toLowerCase();
  if (!UUID.test(normalized)) throw new IdentityHttpError(500, "auth_deletion_target_invalid");
  return normalized;
}

export type AuthDeletionConfirmation = Readonly<{
  provider: "supabase-auth-soft-delete-v1";
  targetUserId: string;
  providerReceiptSha256: string;
  confirmationEvidenceSha256: string;
}>;

export interface AuthDeletionAdapter {
  readonly name: AuthDeletionConfirmation["provider"];
  softDelete(targetUserId: string, lifecycleRequestId: string): Promise<AuthDeletionConfirmation>;
}

/**
 * Irreversibly soft-deletes the canonical Supabase Auth user so retained
 * foreign-key evidence can remain valid. It returns hashes only; email,
 * provider payloads, tokens, and the full Auth user never cross the adapter.
 */
export class SupabaseAuthSoftDeleteAdapter implements AuthDeletionAdapter {
  readonly name = "supabase-auth-soft-delete-v1" as const;
  readonly #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async softDelete(targetUserId: string, lifecycleRequestId: string): Promise<AuthDeletionConfirmation> {
    const userId = uuid(targetUserId);
    const requestId = uuid(lifecycleRequestId);
    const { data, error } = await this.#client.auth.admin.deleteUser(userId, true);
    if (error) throw new IdentityHttpError(502, "auth_deletion_provider_failed");
    const returnedUserId = data?.user?.id ? uuid(data.user.id) : null;
    if (returnedUserId !== userId) throw new IdentityHttpError(502, "auth_deletion_provider_response_invalid");

    const providerReceiptSha256 = await sha256Text(
      `supabase-auth-soft-delete-v1:${requestId}:${userId}:soft-delete-confirmed`
    );
    const confirmationEvidenceSha256 = await sha256Text(
      `community-auth-deletion-confirmed-v1:${requestId}:${providerReceiptSha256}`
    );
    return {
      provider: this.name,
      targetUserId: userId,
      providerReceiptSha256,
      confirmationEvidenceSha256
    };
  }
}

export async function authDeletionRequestEvidence(
  lifecycleRequestId: string,
  targetUserId: string
): Promise<string> {
  return await sha256Text(
    `community-auth-deletion-requested-v1:${uuid(lifecycleRequestId)}:${uuid(targetUserId)}:supabase-auth-soft-delete-v1`
  );
}

export async function observedAuthDeletionConfirmation(
  lifecycleRequestId: string,
  targetUserId: string
): Promise<AuthDeletionConfirmation> {
  const requestId = uuid(lifecycleRequestId);
  const userId = uuid(targetUserId);
  const providerReceiptSha256 = await sha256Text(
    `supabase-auth-soft-delete-v1:${requestId}:${userId}:soft-delete-confirmed`
  );
  return Object.freeze({
    provider: "supabase-auth-soft-delete-v1",
    targetUserId: userId,
    providerReceiptSha256,
    confirmationEvidenceSha256: await sha256Text(
      `community-auth-deletion-confirmed-v1:${requestId}:${providerReceiptSha256}`
    )
  });
}
