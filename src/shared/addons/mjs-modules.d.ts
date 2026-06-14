declare module "*.mjs" {
  export type ArchiveInspectionIssue = {
    level?: "error" | "warning" | "info";
    severity?: "error" | "warning" | "info";
    code: string;
    message: string;
    path?: string;
    suggestion?: string;
  };

  export type ArchiveInspectionResult = {
    status: "pass" | "warning" | "fail";
    risk_level: "low" | "medium" | "high" | "blocked";
    summary: string;
    errors: ArchiveInspectionIssue[];
    warnings: ArchiveInspectionIssue[];
    info: ArchiveInspectionIssue[];
    file_inventory: Array<{ path: string; kind: "file" | "directory"; size: number; scanned_as_text: boolean; sha256?: string }>;
    manifest_summary: null | { addon_id?: string; name?: string; version?: string; runtime_kind?: string; permissions?: string[]; declared_domains?: string[] };
    checksums_summary: null | { algorithm?: string; file_count?: number; package_format_version?: string };
    sha256: string;
    archive_size: number;
    total_uncompressed_size: number;
  };

  export function inspectArchiveFile(file: File | Uint8Array | Buffer, options?: Record<string, unknown>): Promise<ArchiveInspectionResult>;
}
