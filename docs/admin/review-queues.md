# Review Queues

Review queues are split by domain:

- `work_with`
- `stewardship`
- `commune`
- `living_library_source`
- `living_library_broken_link`
- `marketplace`

Shared review records live in `review_items` and `review_events`. Focused queues may also read domain tables such as `addon_submissions`, `developer_profiles`, `content_reports`, `library_source_submissions`, and `work_role_submissions`.

Queue visibility is role-gated. A reviewer should see only records for domains they are allowed to review. Submitters may see their own submitted status when policies allow it, but private reviewer notes remain internal.

Approving a review item means the website record can move forward. It does not install local add-ons, grant authority roles, award badges by itself, or expose private evidence.
