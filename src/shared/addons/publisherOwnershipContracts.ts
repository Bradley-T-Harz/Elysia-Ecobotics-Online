import { z } from "zod";

const uuid = z.string().uuid();
const text = z.string().min(1).max(200);
const https = z.string().url().refine(value => value.startsWith("https://"));
export const ownershipSelectionSchema = z.object({ creatorAttribution: z.string().trim().min(1).max(200), publisherId: uuid }).strict();
export type OwnershipSelection = { creatorAttribution: string; publisherId: string | null };
export const emptyOwnership: OwnershipSelection = { creatorAttribution: "", publisherId: null };
export const publisherWorkspaceSchema = z.object({
  publishers: z.array(z.object({ id: uuid, displayName: text, entityKind: z.enum(["individual", "organization"]), legalName: text.nullable(), verified: z.boolean() }).strict()).max(1000),
  commonsDisplayName: z.string().max(200).nullable(),
  releaseReferences: z.array(z.object({ id: uuid, addonKey: z.string().max(160), version: z.string().max(80), creatorAttribution: text,
    publisherId: uuid, publisherDisplayName: text, packageUrl: https, packageSha256: z.string().regex(/^[a-f0-9]{64}$/), releaseReferenceUrl: https,
    official: z.boolean(), distributionKind: z.literal("free"), recordedAt: z.string(), kind: z.literal("external_release_reference") }).strict()).max(1000),
  listings: z.array(z.object({ id: uuid, addonKey: z.string(), slug: z.string(), name: z.string(), version: z.string().nullable(), status: z.string(), publisherId: uuid,
    creatorAttribution: text.nullable(), publisherDisplayName: text.nullable() }).strict()).max(1000)
}).strict();
export type PublisherWorkspace = z.infer<typeof publisherWorkspaceSchema>;

