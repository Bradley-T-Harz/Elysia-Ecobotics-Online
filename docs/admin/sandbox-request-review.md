# Sandbox Request Review

Sandbox request review is available to assigned administrators, moderators, and Commune reviewers. It is not public and must remain RLS-gated.

Reviewers can inspect metadata only: source type, source id, title, language, expected command text, declared dependencies, network policy/domains, filesystem policy/scopes, requested limits, acknowledgements, validation results, and risk notes.

Allowed actions:

- Request changes
- Approve for local handoff
- Reject
- Security hold
- Revoke handoff
- Archive

Private reviewer notes are internal records and must never appear in exported handoff bundles or public UI. Developer-facing feedback may be shown to the request owner.

Approving a request prepares an exportable handoff bundle only. It does not run code, grant sandbox permission, install dependencies, clone repositories, or call Local Elysia.
