import { sha256Bytes } from "./crypto.ts";
import { IdentityHttpError } from "./http.ts";

const EXPORT_MIME_TYPE = "application/json";
const MAXIMUM_EXPORT_BYTES = 100 * 1024 * 1024;
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const EXPORT_KEY_PATTERN = new RegExp(`^exports/(${UUID_PATTERN})/(${UUID_PATTERN})\\.json$`);

function bytesToHex(value: ArrayBuffer | undefined): string | null {
  if (!value) return null;
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validatedExportKey(value: string): string {
  if (value !== value.toLowerCase() || !EXPORT_KEY_PATTERN.test(value)) {
    throw new IdentityHttpError(500, "account_export_object_key_invalid");
  }
  return value;
}

function validatedBytes(value: Uint8Array): Uint8Array {
  if (value.byteLength < 1 || value.byteLength > MAXIMUM_EXPORT_BYTES) {
    throw new IdentityHttpError(413, "account_export_too_large");
  }
  return value;
}

export type StoredAccountExport = Readonly<{
  objectKey: string;
  byteSize: number;
  sha256: string;
  mimeType: typeof EXPORT_MIME_TYPE;
  uploadedAt: string;
}>;

export type DownloadableAccountExport = StoredAccountExport & Readonly<{
  body: ReadableStream<Uint8Array>;
  etag: string;
}>;

export interface AccountExportStorage {
  put(objectKey: string, bytes: Uint8Array): Promise<StoredAccountExport>;
  get(objectKey: string): Promise<DownloadableAccountExport | null>;
  delete(objectKey: string): Promise<void>;
}

function storedExport(objectKey: string, object: R2Object): StoredAccountExport {
  const sha256 = bytesToHex(object.checksums.sha256);
  if (
    object.key !== objectKey || object.size < 1 || object.size > MAXIMUM_EXPORT_BYTES
    || object.httpMetadata?.contentType !== EXPORT_MIME_TYPE
    || sha256 === null || !/^[0-9a-f]{64}$/.test(sha256)
  ) throw new IdentityHttpError(502, "account_export_storage_invalid");
  return {
    objectKey,
    byteSize: object.size,
    sha256,
    mimeType: EXPORT_MIME_TYPE,
    uploadedAt: object.uploaded.toISOString()
  };
}

/**
 * Dedicated private R2 export storage. R2 encrypts every object and its
 * metadata at rest with platform-managed AES-256-GCM. This adapter adds
 * content-addressed integrity, create-only writes, and no public URL.
 */
export class R2AccountExportStorage implements AccountExportStorage {
  readonly #bucket: R2Bucket;

  constructor(bucket: R2Bucket | undefined) {
    if (!bucket) throw new IdentityHttpError(503, "account_export_storage_unavailable");
    this.#bucket = bucket;
  }

  async put(objectKey: string, input: Uint8Array): Promise<StoredAccountExport> {
    const key = validatedExportKey(objectKey);
    const bytes = validatedBytes(input);
    const expectedSha256 = await sha256Bytes(bytes);
    const existing = await this.#bucket.head(key);
    if (existing) {
      const metadata = storedExport(key, existing);
      if (metadata.byteSize !== bytes.byteLength || metadata.sha256 !== expectedSha256) {
        throw new IdentityHttpError(409, "account_export_object_conflict");
      }
      return metadata;
    }
    const written = await this.#bucket.put(key, bytes, {
      httpMetadata: { contentType: EXPORT_MIME_TYPE, cacheControl: "no-store" },
      sha256: expectedSha256,
      onlyIf: { etagDoesNotMatch: "*" }
    });
    if (!written) {
      const raced = await this.#bucket.head(key);
      if (!raced) throw new IdentityHttpError(502, "account_export_storage_failed");
      const metadata = storedExport(key, raced);
      if (metadata.byteSize !== bytes.byteLength || metadata.sha256 !== expectedSha256) {
        throw new IdentityHttpError(409, "account_export_object_conflict");
      }
      return metadata;
    }
    const metadata = storedExport(key, written);
    if (metadata.byteSize !== bytes.byteLength || metadata.sha256 !== expectedSha256) {
      throw new IdentityHttpError(502, "account_export_storage_invalid");
    }
    return metadata;
  }

  async get(objectKey: string): Promise<DownloadableAccountExport | null> {
    const key = validatedExportKey(objectKey);
    const object = await this.#bucket.get(key);
    if (!object) return null;
    return { ...storedExport(key, object), body: object.body, etag: object.httpEtag };
  }

  async delete(objectKey: string): Promise<void> {
    const key = validatedExportKey(objectKey);
    await this.#bucket.delete(key);
    if (await this.#bucket.head(key)) throw new IdentityHttpError(502, "account_export_delete_unconfirmed");
  }
}

export function accountExportObjectKey(requestId: string, operationId: string): string {
  return validatedExportKey(`exports/${requestId.toLowerCase()}/${operationId.toLowerCase()}.json`);
}
