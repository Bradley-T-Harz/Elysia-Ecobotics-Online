export const sandboxSourceTypes = ["commune_post", "commune_code_document", "developer_forge_addon", "marketplace_addon_version", "manual", "other"] as const;
export const sandboxRequestStatuses = ["draft", "submitted", "changes_requested", "approved_for_local_handoff", "rejected", "security_hold", "archived", "revoked"] as const;
export const sandboxReviewStatuses = ["not_submitted", "pending_review", "changes_requested", "approved", "rejected", "security_hold"] as const;
export const sandboxHandoffStatuses = ["not_exported", "export_ready", "exported", "revoked", "expired"] as const;
export const sandboxNetworkPolicies = ["disabled", "declared_domains_only", "future_review_required"] as const;
export const sandboxFilesystemPolicies = ["none", "temporary_workspace_only", "declared_read_only_inputs", "future_review_required"] as const;

export type SandboxSourceType = typeof sandboxSourceTypes[number];
export type SandboxRequestStatus = typeof sandboxRequestStatuses[number];
export type SandboxReviewStatus = typeof sandboxReviewStatuses[number];
export type SandboxHandoffStatus = typeof sandboxHandoffStatuses[number];
export type SandboxNetworkPolicy = typeof sandboxNetworkPolicies[number];
export type SandboxFilesystemPolicy = typeof sandboxFilesystemPolicies[number];

export type SandboxValidationLevel = "error" | "warning" | "info";
export type SandboxRiskLevel = "low" | "medium" | "high" | "blocked";

export type SandboxValidationIssue = {
  level: SandboxValidationLevel;
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
};

export type SandboxValidationResult = {
  errors: SandboxValidationIssue[];
  warnings: SandboxValidationIssue[];
  info: SandboxValidationIssue[];
  risk_level: SandboxRiskLevel;
  ok: boolean;
};

export type SandboxRequestRecord = {
  id: string;
  user_id?: string | null;
  submitted_by?: string | null;
  source_type: SandboxSourceType;
  source_id?: string | null;
  title: string;
  request_title?: string | null;
  summary?: string | null;
  language?: string | null;
  code_text?: string | null;
  package_id?: string | null;
  addon_submission_id?: string | null;
  code_document_id?: string | null;
  expected_command?: string | null;
  declared_dependencies?: string[] | null;
  declared_network_policy: SandboxNetworkPolicy;
  declared_network_domains?: string[] | null;
  declared_filesystem_policy: SandboxFilesystemPolicy;
  declared_file_scopes?: string[] | null;
  requested_cpu_limit?: string | null;
  requested_memory_limit?: string | null;
  requested_timeout_seconds?: number | null;
  risk_notes?: string | null;
  user_acknowledged_no_execution: boolean;
  user_acknowledged_no_secrets: boolean;
  user_acknowledged_local_elysia_final_authority: boolean;
  request_status: SandboxRequestStatus;
  review_status: SandboxReviewStatus;
  handoff_status: SandboxHandoffStatus;
  handoff_bundle_json?: unknown;
  handoff_exported_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_public_feedback?: string | null;
  reviewer_private_note?: string | null;
  security_hold_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SandboxRequestInput = Pick<SandboxRequestRecord,
  "source_type" | "title" | "declared_network_policy" | "declared_filesystem_policy" | "user_acknowledged_no_execution" | "user_acknowledged_no_secrets" | "user_acknowledged_local_elysia_final_authority"
> & Partial<Omit<SandboxRequestRecord, "id" | "request_status" | "review_status" | "handoff_status" | "created_at" | "updated_at">>;

export type SandboxHandoffBundle = {
  schema_version: "elysia.sandbox_request.v1";
  handoff_kind: "local_elysia_sandbox_request";
  request_id: string;
  source: {
    source_type: SandboxSourceType;
    source_id: string | null;
    title: string;
    origin: "elysia_ecobotics_online";
  };
  execution_intent: {
    language: string | null;
    expected_command: string | null;
    declared_dependencies: string[];
    declared_network_policy: SandboxNetworkPolicy;
    declared_network_domains: string[];
    declared_filesystem_policy: SandboxFilesystemPolicy;
    declared_file_scopes: string[];
    requested_limits: {
      cpu: string | null;
      memory: string | null;
      timeout_seconds: number | null;
    };
  };
  payload: {
    code_text: string | null;
    package_reference: string | null;
    manifest_summary: Record<string, unknown> | null;
  };
  review: {
    review_status: "approved";
    approved_for_local_handoff: true;
    reviewed_at: string | null;
    reviewer_public_feedback: string | null;
    security_notes_public: string[];
  };
  safety_contract: {
    website_executed_code: false;
    requires_local_elysia_revalidation: true;
    requires_explicit_local_user_approval: true;
    network_default: "disabled";
    filesystem_default: "isolated_temporary_workspace";
    secrets_included: false;
    private_reviewer_notes_included: false;
  };
  integrity: {
    bundle_sha256: string;
    created_at: string;
    created_by: "elysia_ecobotics_online";
  };
};
