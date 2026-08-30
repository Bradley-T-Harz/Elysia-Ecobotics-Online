import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Text } from "./crypto.ts";
import { IdentityHttpError } from "./http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BUCKET = /^[a-z0-9][a-z0-9._-]{0,99}$/;

export type OwnedStorageObject = Readonly<{
  objectId: string;
  bucket: string;
  name: string;
}>;

function safeObject(value: OwnedStorageObject): OwnedStorageObject {
  const objectId = value.objectId.toLowerCase();
  if (!UUID.test(objectId) || !BUCKET.test(value.bucket)) {
    throw new IdentityHttpError(502, "deletion_storage_inventory_invalid");
  }
  if (
    value.name.length < 1 || value.name.length > 500
    || /[\\\u0000-\u001f\u007f]/.test(value.name)
    || /(^|\/)\.\.($|\/)/.test(value.name)
    || value.name.startsWith("/")
  ) throw new IdentityHttpError(502, "deletion_storage_inventory_invalid");
  return Object.freeze({ objectId, bucket: value.bucket, name: value.name });
}

export class SupabaseOwnedStorageCleanupAdapter {
  readonly name = "scoped-private-object-cleanup-v1" as const;
  readonly #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async remove(objects: readonly OwnedStorageObject[], lifecycleRequestId: string): Promise<Readonly<{
    attemptedObjectCount: number;
    cleanupEvidenceSha256: string;
  }>> {
    if (!UUID.test(lifecycleRequestId.toLowerCase()) || objects.length > 10_000) {
      throw new IdentityHttpError(502, "deletion_storage_inventory_invalid");
    }
    const safe = objects.map(safeObject).sort((left, right) =>
      left.bucket.localeCompare(right.bucket)
      || left.name.localeCompare(right.name)
      || left.objectId.localeCompare(right.objectId)
    );
    const unique = new Set(safe.map((item) => `${item.bucket}\u0000${item.name}`));
    if (unique.size !== safe.length) throw new IdentityHttpError(502, "deletion_storage_inventory_invalid");

    const byBucket = new Map<string, string[]>();
    for (const item of safe) {
      const names = byBucket.get(item.bucket) ?? [];
      names.push(item.name);
      byBucket.set(item.bucket, names);
    }
    for (const [bucket, names] of byBucket) {
      for (let offset = 0; offset < names.length; offset += 100) {
        const { error } = await this.#client.storage.from(bucket).remove(names.slice(offset, offset + 100));
        if (error) throw new IdentityHttpError(502, "deletion_storage_cleanup_failed");
      }
    }
    return Object.freeze({
      attemptedObjectCount: safe.length,
      cleanupEvidenceSha256: await sha256Text(
        `community-online-storage-cleanup-adapter-v1:${lifecycleRequestId.toLowerCase()}:`
        + safe.map((item) => `${item.objectId}:${item.bucket}:${item.name}`).join("\n")
      )
    });
  }
}
