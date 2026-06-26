# Official Update Data Contract

Canonical migration: `supabase/migrations/2026_06_26_official_update_structured_workflow.sql`.

Primary tables:

- `commune_posts`: the public Commune post/thread shell with `post_type = 'official_update'`.
- `commune_official_updates`: structured Official Update metadata and lifecycle state.
- `commune_official_update_code_snippets`: public read-only official code examples attached to an Official Update.
- `commune_official_update_events`: admin/reviewer-visible audit events for lifecycle changes.
- `commune_threads`: discussion thread, locked when `comments_enabled = false`.

Frontend helpers:

- `submitOfficialUpdate()` creates the published post, thread, structured metadata, optional official code snippet, optional attachment, review-history record, event row, and admin self-notification.
- `updateOfficialUpdateMetadata()` updates lifecycle metadata, pin/important state, correction/retraction/archive state, and comment lock state.
- `createOfficialCodeSnippet()` adds a read-only official code snippet.
- `updateOfficialCodeSnippet()` edits or hides a read-only official code snippet and records a correction-aware event.
- `loadOfficialUpdateForPost()` loads structured metadata and official code for a post.

Public rendering rules:

- Display the official badge/identity and structured metadata.
- Display official code as read-only/copy-only text.
- Do not show Coding Cornucopia workbench, proposal, sandbox run, diagnostics run, Local Elysia handoff, install, deploy, or Marketplace controls.
- Respect `comments_enabled` by hiding comment submission for locked notices.

Signal Console behavior:

- Existing `user_notifications` remain supported.
- The console also reads `commune_official_updates` directly for admin-authored notices and urgent/corrected/retracted/monitoring notices visible to reviewers/admins.

Manual setup:

- Apply `2026_06_26_official_update_structured_workflow.sql` manually in Supabase.
- Do not apply the migration through the site or browser.
- Do not grant non-admin insert/update policies for official metadata or official code.
