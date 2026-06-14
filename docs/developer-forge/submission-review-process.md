# Submission and Review Process

A developer creates a draft, validates the manifest, explains permissions, prepares package metadata, previews the listing, and submits for Marketplace review.

Reviewers may request changes, reject, approve, place a security hold, publish approved versions through Marketplace tooling, or revoke listings/versions. Developers cannot approve, publish, or revoke their own submissions.

Developer-side submission now expects a non-suspended developer profile, no blocking manifest errors, saved permission reasons/risk acknowledgements, and package metadata/static scan for local-worker or connector drafts. These gates are preparation checks only. Reviewer approval and Marketplace publication remain separate actions, and local Elysia remains the final installer/runtime authority.

What is live: profile requests, drafts, manifest validation, permission design, private package metadata, inert package export, submission records, review status tracking, reviewer package inspection, Marketplace publication records, and revocation records. Local install/sandbox handoff remains a local Elysia authority boundary.

Publication does not mean installation, signing, or runtime trust. A published Marketplace listing can only prepare an install intent. Local Elysia must still validate, review permissions, and decide whether anything may be installed or enabled.

Private reviewer notes and package review evidence are not public. Developer-facing feedback is intentionally separate.
