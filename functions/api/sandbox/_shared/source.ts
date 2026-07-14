import type { SupabaseClient } from "@supabase/supabase-js";
import { PublicHttpError } from "./http.ts";
import { SANDBOX_LANGUAGES, type AuthorizedSource, type SandboxLanguage, type SandboxRunRequest } from "./types.ts";

type Row = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function storedFileName(value: unknown): string | null {
  const result = text(value);
  if (result && (result.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result))) {
    throw new PublicHttpError(403, "source_file_unauthorized");
  }
  return result;
}

function language(value: unknown, fallback: SandboxLanguage): SandboxLanguage {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  const aliases: Record<string, SandboxLanguage> = {
    js: "javascript",
    jsx: "javascript",
    node: "javascript",
    ts: "typescript",
    py: "python",
    yml: "yaml",
    md: "markdown"
  };
  const resolved = aliases[normalized] ?? normalized;
  if (!SANDBOX_LANGUAGES.includes(resolved as SandboxLanguage)) {
    throw new PublicHttpError(403, "source_language_unauthorized");
  }
  return resolved as SandboxLanguage;
}

function rowOrDenied(data: unknown, error: unknown): Row {
  if (error || typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new PublicHttpError(403, "source_unauthorized");
  }
  return data as Row;
}

function base(input: SandboxRunRequest): AuthorizedSource {
  return {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    snapshotId: input.snapshotId,
    language: input.language,
    fileName: input.fileName,
    code: input.code,
    postId: null,
    codeDocumentId: null,
    codeVersionId: null
  };
}

function requireSnapshot(input: SandboxRunRequest, authoritativeSnapshotId: string): string {
  if (input.snapshotId !== authoritativeSnapshotId) {
    throw new PublicHttpError(409, "source_snapshot_changed");
  }
  return authoritativeSnapshotId;
}

export async function resolveAuthorizedSource(supabase: SupabaseClient, input: SandboxRunRequest): Promise<AuthorizedSource> {
  if (input.sourceType === "manual_snapshot") return base(input);
  const sourceId = input.sourceId;
  if (!sourceId) throw new PublicHttpError(400, "source_id_invalid");

  if (input.sourceType === "commune_post_snippet") {
    const { data, error } = await supabase
      .from("commune_code_snippets")
      .select("id,post_id,language,file_name,code_text,accepted_revision_id")
      .eq("id", sourceId)
      .single();
    const row = rowOrDenied(data, error);
    const authoritativeSnapshotId = text(row.accepted_revision_id) ?? text(row.id) ?? sourceId;
    return {
      ...base(input),
      snapshotId: requireSnapshot(input, authoritativeSnapshotId),
      language: language(row.language, input.language),
      fileName: storedFileName(row.file_name),
      code: text(row.code_text) ?? "",
      postId: text(row.post_id)
    };
  }

  if (input.sourceType === "commune_code_document") {
    const { data, error } = await supabase
      .from("commune_code_documents")
      .select("id,language,file_name,current_text,updated_at")
      .eq("id", sourceId)
      .single();
    const row = rowOrDenied(data, error);
    const authoritativeSnapshotId = `${text(row.id) ?? sourceId}:${text(row.updated_at) ?? "current"}`;
    return {
      ...base(input),
      snapshotId: requireSnapshot(input, authoritativeSnapshotId),
      language: language(row.language, input.language),
      fileName: storedFileName(row.file_name),
      code: text(row.current_text) ?? "",
      codeDocumentId: text(row.id)
    };
  }

  if (input.sourceType === "commune_code_version") {
    const versionQuery = await supabase
      .from("commune_code_document_versions")
      .select("id,document_id,snapshot_text")
      .eq("id", sourceId)
      .single();
    const version = rowOrDenied(versionQuery.data, versionQuery.error);
    const documentId = text(version.document_id);
    if (!documentId) throw new PublicHttpError(403, "source_unauthorized");
    const documentQuery = await supabase
      .from("commune_code_documents")
      .select("id,language,file_name")
      .eq("id", documentId)
      .single();
    const document = rowOrDenied(documentQuery.data, documentQuery.error);
    const authoritativeSnapshotId = text(version.id) ?? sourceId;
    return {
      ...base(input),
      snapshotId: requireSnapshot(input, authoritativeSnapshotId),
      language: language(document.language, input.language),
      fileName: storedFileName(document.file_name),
      code: text(version.snapshot_text) ?? "",
      codeDocumentId: documentId,
      codeVersionId: text(version.id)
    };
  }

  if (input.sourceType === "commune_code_revision_proposal") {
    const { data, error } = await supabase
      .from("commune_code_revision_proposals")
      .select("id,post_id,code_snippet_id,language,file_name,proposed_code_text")
      .eq("id", sourceId)
      .single();
    const row = rowOrDenied(data, error);
    const authoritativeSnapshotId = text(row.id) ?? sourceId;
    return {
      ...base(input),
      snapshotId: requireSnapshot(input, authoritativeSnapshotId),
      language: language(row.language, input.language),
      fileName: storedFileName(row.file_name),
      code: text(row.proposed_code_text) ?? "",
      postId: text(row.post_id)
    };
  }

  if (input.sourceType === "repository_showcase_artifact") {
    const { data, error } = await supabase
      .from("commune_repository_showcases")
      .select("id,post_id")
      .eq("id", sourceId)
      .single();
    const row = rowOrDenied(data, error);
    return { ...base(input), postId: text(row.post_id) };
  }

  if (input.sourceType === "iteration_showcase_artifact") {
    const { data, error } = await supabase
      .from("commune_iteration_showcases")
      .select("id,post_id")
      .eq("id", sourceId)
      .single();
    const row = rowOrDenied(data, error);
    return { ...base(input), postId: text(row.post_id) };
  }

  throw new PublicHttpError(403, "source_unauthorized");
}
