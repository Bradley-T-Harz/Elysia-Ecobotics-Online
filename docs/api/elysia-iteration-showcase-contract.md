# Elysia Iteration Showcase API Contract

This contract describes the repo-side data path for Elysia Iteration Showcase.

## Tables

`commune_posts` remains the canonical public thread/post row.

`commune_iteration_showcases` stores structured iteration metadata and references `commune_posts.id` through `post_id`.

`commune_media` stores screenshots/demo attachments through the existing Commune media flow.

`commune_sandbox_review_requests` stores selected-artifact sandbox review requests. Iteration metadata may link to one request through `sandbox_review_request_id`.

`user_notifications` may contain submission or review signals, but Signal Console also reads direct iteration rows so activity remains visible even when a notification row is not created.

## Submit Flow

1. Validate signed-in account and public-safe fields.
2. Reject secret-like material, private paths, local Elysia data, `.env` content, credentials, private prompts, sealed memory, or hidden notes.
3. Create a normal `commune_posts` row with `post_type = 'elysia_iteration_showcase'`.
4. Create a `commune_threads` row for comments/replies.
5. Insert `commune_iteration_showcases` structured metadata.
6. Upload optional screenshot/demo attachment through the Commune media path.
7. Create review records for normal users, or publish directly for admins while retaining audit/history behavior.
8. Optionally create a selected-artifact sandbox review request. This request does not run a whole repository.

## Public Detail Flow

The post detail route loads `commune_posts`, `commune_media`, comments, and `commune_iteration_showcases`. Public detail rendering prefers structured metadata and falls back to body sections for older posts.

## Trust Boundary

The API must never convert an iteration showcase into an Official Update, Developer Forge approval, Marketplace readiness claim, installability claim, safety claim, or compatibility certification. Those workflows remain separate.
