# Troubleshooting Grove Data And API Contract

Troubleshooting Grove submissions create or link:

- a normal commune_posts row with post_type = troubleshooting
- a normal commune_threads row for public comments and replies
- a structured commune_troubleshooting_posts row for issue metadata
- optional commune_code_snippets rows for redacted code/reproduction snippets
- optional commune_media rows for moderated attachments

The structured metadata row may include:

- issue_type and affected_area
- environment_os, environment_browser, app_version, and environment_notes
- steps_to_reproduce, expected_result, actual_result, error_message, redacted_logs, and workaround
- troubleshooting_status
- accepted_comment_id, accepted_proposal_id, accepted_resolution_kind, accepted_summary, accepted_by, and accepted_at
- resolved_at, closed_at, and archived_at

Normal users submit for Commune review. Administrators may direct-publish. Public readers may read structured troubleshooting metadata only when linked to a published public Commune post. Owners and Commune reviewers may read their own/reviewable rows while pending.

Code/reproduction snippets reuse the shared commune_code_snippets and commune_code_revision_proposals workflow. Troubleshooting Grove labels that flow as proposed fixes. A proposed fix never updates the public reproduction snippet until the original post author accepts it. Rejected or needs-changes proposals keep the public snippet unchanged.

Sandbox diagnostics reuse VITE_CODING_SANDBOX_ENDPOINT and the Coding Cornucopia sandbox client. Runs are snapshot-based, policy-gated, and may be recorded in commune_sandbox_runs / commune_code_diagnostics when those migrations are active. The sandbox contract never permits browser execution, Supabase/Postgres execution, Local Elysia execution, shell execution, package install, or repository clone/run.

Signal Console may show direct commune_troubleshooting_posts activity for owners, reviewers, and accepted fix/workaround resolution. Existing user_notifications rows remain supported when they exist.
