# Community Posting Policy

The Elysia Commune is public-facing. Posts should be safe to show publicly, even when they begin as drafts or pending review records.

Do not post private local Elysia memory, vaults, logs, credentials, `.env` files, tokens, customer/user records, private screenshots, resumes, receipts, identity documents, or sensitive third-party data.

Public posts require moderation before publication where account-backed mode is active. Draft and submitted content is owner/reviewer-only by RLS and must not be public.

Canonical page paths for current account-backed Commune flows are `commune_posts`, `commune_comments`, `commune_threads`, `user_saved_commune_posts`, `user_followed_commune_threads`, `commune_repository_showcases`, `commune_sandbox_review_requests`, `commune_reports`, and `commune_media`. Older compatibility tables may remain for existing data or admin queues; new page behavior should prefer the canonical paths and preserve fallback reads only where needed.

Public feed queries should explicitly request published/public content in addition to relying on RLS. RLS remains the actual security boundary, but frontend queries should avoid implying pending, hidden, removed, or private draft content belongs in public feeds.
