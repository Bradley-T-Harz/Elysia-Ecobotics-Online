# Job Post API Contract

Job Post uses the existing Commune post/thread/comment backbone plus a structured sidecar table.

## Stable Identifiers

- User-facing room name: Job Post.
- Route slug: `job-post`.
- Internal post type: `job_post`.
- Sidecar table: `commune_job_posts`.

## Submit Flow

`submitJobPost` creates:

1. `commune_posts` with `post_type = 'job_post'`.
2. `commune_threads` for public questions/comments.
3. `commune_job_posts` for structured opportunity metadata.
4. Optional `commune_media` attachment through the shared Commune media pipeline.
5. Review items/history/user notification rows where the current account-backed systems support them.

Normal users submit into `pending_review`; their Job Posts are not public until admin approval. Admin users can publish directly.

## Sidecar Fields

`commune_job_posts` includes:

- `post_id`
- `thread_id`
- `author_user_id`
- `role_title`
- `organization_project`
- `role_type`
- `paid_volunteer_status`
- `location_mode`
- `location_text`
- `time_commitment`
- `deadline`
- `compensation_clarity`
- `contact_path`
- `requirements_skills`
- `safety_notes`
- `role_summary`
- `application_status`
- `anti_scam_review_status`
- `work_with_link_enabled`
- `private_application_note`
- `public_correction_note`
- reviewer and lifecycle timestamps

Hidden reviewer notes must stay in private review/admin systems. Public correction notes may be displayed when they clarify a listing safely.

## Review and Status Helpers

- `updateJobPostApplicationStatus` updates public listing lifecycle state.
- `updateJobPostReviewStatus` updates anti-scam review state and requires a reviewer/admin role.
- `loadJobPostForPost` and the general Commune loader read sidecar rows by linked post id.

Author listing-status updates use `update_own_commune_job_post_application_status`, a narrow RPC that updates only lifecycle fields. It cannot set `reviewed_clear`, anti-scam state, hidden reviewer notes, or trust/safety labels.

## Public Rendering

The public post detail page should render a Job Post detail panel with role title, organization/project, role type, pay/volunteer clarity, location, status, anti-scam state, role summary, compensation, contact path, requirements, safety notes, Work With private intake bridge, tags, links, attachments, reactions, reports, comments, and admin controls.

## Signal Console

Signal Console loads Job Post activity from both `user_notifications` rows and direct `commune_job_posts` rows. It separates:

- my Job Posts
- listings needing admin approval or anti-scam follow-up
- filled/closed/needs-clarification/status activity

Empty states should only show when there are no notification rows and no relevant Job Post rows.

## Search

Room/feed filtering should include structured Job Post values in addition to title, summary, body, tags, and generic Commune fields:

- role title
- organization/project
- role type
- paid/volunteer status
- location mode/details
- time commitment
- deadline
- compensation clarity
- contact path
- requirements/skills
- role summary
- application status
- anti-scam review state

## Work With Bridge

Job Post links to Work With Elysia Ecobotics for private application/intake material. Work With links back to the public Job Post board. Neither side should expose the other side's private data.
