# Supabase Final Verification Checklist

This checklist is for the live Supabase project before public or beta testing. Do not run these checks with service-role credentials in frontend code, and do not expose raw query errors to public users.

## Required helpers

Confirm these helper functions exist and return the expected result for admin, reviewer, moderator, developer, and normal member accounts:

- `current_user_is_admin()`
- `current_user_has_role(text)`
- `current_user_can_review_domain(text)`

If a helper is missing, role-gated pages may show clean "backend table/policy not active yet" messages, but live review actions will not be fully operational.

## Core account and Commons tables

Verify these tables exist with RLS enabled:

- `profiles`
- `profile_customization`
- `profile_media`
- `badge_definitions`
- `user_badges`
- `badge_credit_events`
- `badge_audit_log`
- `user_roles`

Checks:

- normal users can read and update only their own private account/profile fields
- public profiles expose only public profile fields and public earned badges
- unearned badges are not public
- badges do not grant roles or permissions
- `free_member` is present in `badge_definitions`
- qualifying completed profiles have an active `free_member` row in `user_badges`

## Marketplace and Developer Forge

Verify these tables exist with RLS enabled:

- `developer_profiles`
- `addon_drafts`
- `addon_submissions`
- `addon_packages`
- `review_items`
- `review_events`
- `marketplace_listings`
- `marketplace_addon_versions`
- `marketplace_publication_events`
- `marketplace_revocations`
- `marketplace_install_intents`

Checks:

- public users can read only published, non-revoked Marketplace listings and public active revocation notices
- developers can read their own drafts/submissions, but cannot approve, publish, or revoke
- admins/reviewers can inspect submissions and package metadata
- private reviewer notes are not visible to developers or public visitors
- install intents cannot be created for revoked, hidden, removed, rejected, or security-hold listings/versions
- package signature status remains `unsigned` unless a real signing pipeline has completed

## Commune, realtime, code review, and sandbox handoff

Verify these tables exist with RLS enabled:

- `commune_posts`
- `commune_comments`
- `commune_reports`
- `commune_saved_posts`
- `commune_repository_showcases`
- `commune_media`
- `commune_realtime_rooms`
- `commune_realtime_messages`
- `commune_realtime_reports`
- `commune_room_moderation_events`
- `commune_code_documents`
- `commune_code_document_versions`
- `commune_code_annotations`
- `commune_code_reports`
- `commune_code_moderation_events`
- `commune_sandbox_review_requests`
- `sandbox_handoff_events`

Checks:

- public users read only `published` content
- draft, submitted, hidden, removed, rejected, security-hold, private report, private note, and audit records are not public
- signed-in users can create permitted records only as themselves
- admins/reviewers/moderators can hide/remove/review only through role-gated policies
- realtime chat messages are plain text only and reports remain private
- sandbox handoff exports exclude private reviewer notes and secrets

## Storage buckets

Confirm bucket policies match the public/private boundary:

- `profile-avatars`: public profile asset bucket for avatars only
- `profile-banners`: public profile asset bucket for banners only
- any package/upload/review buckets: private unless explicitly designed for public release artifacts

Do not store receipts, resumes, credentials, review evidence, private screenshots, local Elysia logs, or vault material in public buckets.

## Manual browser proof

Test these roles in separate browsers or clean sessions:

- anonymous visitor
- signed-in normal member
- developer
- reviewer/moderator
- admin

For each role, verify that unauthorized private routes show clean access-denied states and do not leak queue contents, private notes, emails, reports, drafts, hidden content, package paths, or audit rows.
