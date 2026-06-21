# Commune community posting policy

The Commune is for public/community-safe discussion, posts, troubleshooting, repository metadata, and review requests. It is not a place to paste secrets or private local Elysia material.

Do not post:

- credentials, passwords, tokens, API keys, or service-role keys
- `.env` contents
- private local Elysia memory, logs, vault data, credentials, files, or machine data
- private screenshots, receipts, resumes, identity documents, or sensitive personal data
- executable package requests, install commands, shell scripts, or instructions that imply the website will run submitted code

Realtime chat messages and collaborative code review documents are cloud-hosted public/community data when saved to the account-backed Commune. Forum-style posts, comments, repository showcases, media uploads, sandbox review requests, realtime messages, code review documents, snapshots, and annotations all follow moderation and visibility states where account-backed mode is active.

## Comments and replies

The intended thread model is room -> post/thread -> comments -> replies. The first contribution by a user on a specific post/thread should enter moderation. Once a moderator approves that first comment or reply, that user may keep participating in that same thread without manual pre-approval, while remaining subject to reporting, hiding, removal, and safety checks. A different post/thread requires a separate first-contribution approval.

This behavior depends on the `commune_thread_participant_approvals` table from the local migration `2026_06_21_commune_thread_participant_approvals.sql`. Until that migration is applied in Supabase, the site falls back to the stricter moderation path.

## Admin review history

Active admin review queues should show only items that still need action. Approved, rejected, and archived review items move out of the active queue and remain available through admin-only History/All review views and review events. Archive is an explicit admin state for saved reference; History is the audit timeline of what happened.

## Community signals

Published posts, comments, and replies may show simple community signals: `Helpful` and `Needs caution`. Signed-in users may add, change, or remove one signal per item. Anonymous visitors can read aggregate counts but cannot vote.

Signals help readers judge usefulness or caution. They do not verify truth, replace source checking, remove content automatically, or replace reports and moderator review.

## Moderator removal controls

Authorized administrators/moderators may flag posts, comments, and replies for removal, hide them from public views, or delete/remove them from the public workflow. Destructive delete/remove actions require explicit confirmation in the UI.

The current frontend uses the safe soft-removal path for delete/remove actions because moderator RLS grants support status updates while retaining admin-only evidence. Removed content should disappear from public feeds and comment threads, while `commune_moderation_events`, review events, and admin-only History preserve what happened where supported.

Collaborative code review is for discussion and review only. It does not create execution permission, run code, install dependencies, clone repositories, or connect to local Elysia.

Local Elysia remains separate and is the final authority for local runtime, installation, and sandbox decisions.
