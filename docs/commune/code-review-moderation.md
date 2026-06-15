# Code review moderation

Code review moderation covers unsafe documents, unsafe annotations, secret/private-data reports, copyright/license concerns, harassment, spam, and suspicious code claims.

Canonical tables:

- `commune_code_documents`
- `commune_code_document_versions`
- `commune_code_annotations`
- `commune_code_sessions`
- `commune_code_reports`
- `commune_code_moderation_events`

Public users can read only published documents and published annotations on published documents. Drafts, submitted documents, hidden/removed content, reports, reviewer notes, and moderation events are private/RLS-gated.

Moderators can hide/remove documents or annotations and resolve reports. Reviewer notes stay private.
