# Submission and Review Process

A developer creates a draft, edits the inert Forge workspace, validates the manifest, explains permissions, prepares package metadata, previews the listing, and submits for Marketplace review.

Reviewers may request changes, reject, approve, place a security hold, publish approved versions through Marketplace tooling, or revoke listings/versions. Developers cannot approve, publish, or revoke their own submissions.

Developer-side submission now expects a non-suspended developer profile, no blocking manifest errors, saved permission reasons/risk acknowledgements, and package metadata/static scan for local-worker or connector drafts. Submission creates an immutable review snapshot containing the manifest, permissions, package facts, scan/validation findings, and Marketplace preview as they existed at submission time. These gates are preparation checks only. Reviewer approval and Marketplace publication remain separate actions, and local Elysia remains the final installer/runtime authority.

Submitted drafts are locked against ordinary owner edits. If a developer needs to respond to requested changes, they should duplicate the draft or create an explicit revision draft, change that revision, and resubmit. Reviewers evaluate snapshots, not silently mutable draft state.

What is live: profile requests, drafts, Monaco-backed inert workspace editing with text fallback, Ajv/semver manifest validation, permission design, private package metadata, inert package export, immutable submission snapshots, review status tracking, reviewer package inspection, Marketplace publication records, and revocation records. Local install/sandbox handoff remains a local Elysia authority boundary.

Publication does not mean installation, signing, or runtime trust. A published Marketplace listing can only prepare an install intent. Local Elysia must still validate, review permissions, and decide whether anything may be installed or enabled.

Private reviewer notes and package review evidence are not public. Developer-facing feedback is intentionally separate.
