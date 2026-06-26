# Repository Showcase Data And API Contract

Repository Showcase submissions create or link a normal commune_posts row with post_type = repository_showcase, a normal commune_threads row for public comments/replies, and a structured commune_repository_showcases metadata row.

The structured metadata row may include:

- repository_url, repository_host, provider
- project_name, project_summary, short_description
- default_branch, commit_sha, license
- manifest_status, elysia_compatibility
- readme_preview, file_tree_preview, screenshot_notes_or_urls
- risk_flags, redaction_notes
- sandbox_review_requested, sandbox_review_status, sandbox_review_request_id
- import_source, imported_metadata, imported_at

Normal users submit for Commune review. Administrators may direct-publish as existing Commune doctrine allows. Moderation of the linked post and repository row must stay consistent: approving/publishing the post should approve the repository row, and repository queue actions should update the linked post/review state.

Public readers may read Repository Showcase metadata only when linked to a published public Commune post. Owners and Commune reviewers may read their own/reviewable rows while pending.

The Repository Showcase sandbox request route uses /commune/repository-showcase/sandbox-request?post=<post_id>&showcase=<showcase_id>. It accepts a pasted selected artifact/snippet. It must not clone, install, build, test, or execute the whole repository.

Signal Console may show direct commune_repository_showcases activity for the owner, reviewer queue, and selected-artifact sandbox status. Notification rows remain supported when they exist.
