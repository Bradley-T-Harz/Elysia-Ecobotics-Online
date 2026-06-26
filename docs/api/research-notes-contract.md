# Research Notes API Contract

Research Notes uses the existing Commune post/thread/comment backbone plus a structured sidecar table.

## Stable Identifiers

- User-facing room name: Research Notes.
- Route slug: `research-notes`.
- Internal post type: `research_note`.
- Sidecar table: `commune_research_notes`.

## Submit Flow

`submitResearchNotesPost` creates:

1. `commune_posts` with `post_type = 'research_note'`.
2. `commune_threads` for comments/replies.
3. `commune_research_notes` for structured evidence metadata.
4. Optional `commune_media` attachment through the shared Commune media pipeline.
5. Review history/user notification rows where the current account-backed systems support them.

Admin users can publish directly through the Commune admin path. Normal users submit for moderation.

## Sidecar Fields

`commune_research_notes` includes:

- `post_id`
- `thread_id`
- `author_user_id`
- `research_question`
- `domain`
- `evidence_strength`
- `living_library_source_link`
- `related_living_library_source_id`
- `citation_notes`
- `evidence_summary`
- `observation`
- `interpretation`
- `uncertainty`
- `context_discussion`
- `source_links`
- `geographic_scope`
- `ecological_subsystem`
- `method_type`
- `data_type`
- `ethics_note`
- `review_status`
- `correction_note`
- reviewer and timestamp fields

Hidden reviewer notes must stay in private review/admin systems, not in public sidecar fields.

## Review Statuses

Allowed statuses:

- `submitted`
- `published`
- `needs_citation`
- `needs_clarification`
- `source_issue`
- `overclaiming_evidence`
- `corrected`
- `archived`

`updateResearchNotesReviewStatus` updates the public sidecar review state and optional public correction note. It requires a reviewer/admin role.

## Public Rendering

The public post detail page should render a Research Notes detail panel with evidence, observation, interpretation, uncertainty, citation, Living Library source link, source links, method/context, ethics, and review status. It should keep tags, links, attachments, comments, reports, reactions, and admin controls from the shared Commune model.

## Signal Console

Signal Console loads Research Notes activity from both `user_notifications` rows and direct `commune_research_notes` rows. It separates:

- my Research Notes posts
- notes needing citation or clarification
- citation/source/overclaiming/correction activity

Empty states should only show when there are no notification rows and no relevant Research Notes rows.

## Search

Room/feed filtering should include structured Research Notes values in addition to title, summary, body, tags, and generic Commune fields:

- research question
- domain
- evidence strength
- Living Library source link
- citation notes
- evidence summary
- observation
- interpretation
- uncertainty
- geographic scope
- ecological subsystem
- method type
- data type
- ethics note

