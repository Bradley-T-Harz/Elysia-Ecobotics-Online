# Moderation System

The admin moderation system is the private review layer for public-facing Elysia Ecobotics Online content.

Moderation may cover Commune content, Marketplace listings, Developer Forge submissions, Living Library source submissions, public profile reports, and Work With or role-interest records. The public website must not expose reports, private reviewer notes, private packages, resumes, receipts, review evidence, contact emails, or moderation records.

Badges, membership tiers, donation recognition, developer profile visibility, and contribution interest do not grant moderation authority. Authority comes from assigned roles in `user_roles` and Supabase RLS.

Reviewers may hide, reject, archive, request changes, or approve content only inside their role scope. Public users and normal developers cannot approve, publish, revoke, hide, remove, or verify their own submissions.

The website never runs submitted code. Developer Forge and Marketplace review inspect metadata, manifests, permissions, package metadata, and scan summaries only. Local Elysia remains final installer and permission authority.
