# Production readiness — September 16

This packet extends the qualified September 15 implementation. Current state: **BLOCKED** by missing secure Stripe configuration and isolated test database; Supabase branch creation returned Pro-plan-required. Real Stripe acceptance has not run. All first-party gates remain OFF.

Fresh work: recurring-created PaymentIntents without inherited metadata now reach the verified durable inbox; recurring Checkout settlement enrichment accepts missing inherited metadata while rejecting conflicting order metadata. Economic ownership remains resolved by exact durable payment/subscription references. The existing SQL processor retains unmatched events for retry and never infers ownership by customer alone.

Readiness now distinguishes test/live binding presence, disabled runtime, unknown runtime response, database/server configuration and last recorded preflight. Presence is not proof of permission or provider acceptance. Public Support remains disabled. The native Cloudflare rate limiter protects the five Checkout lanes, Portal and refund execution, with failure closed in enabled modes and separate namespaces. Webhook delivery and free creator operations remain independent.

Provisioning uses a separate restricted setup key, mode-specific return origin, bounded provider responses, full Portal policy checks and deterministic object references. A new GET-only preflight verifies account, exact webhook contract, catalog and Portal without enabling any lane. Runtime API version is pinned to 2025-02-24.acacia.

No database schema changed in this session. Do not repeat the already-qualified 74-migration replay merely for these TypeScript/script/UI changes. See the carried-forward [implementation and database evidence](../stripe-first-party-2026-09-15/STRIPE_FIRST_PARTY_PRODUCTION_READINESS_REPORT.md).
