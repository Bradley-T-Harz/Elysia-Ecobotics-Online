# Sandbox migration replay preparation

Stage: **PREPARED_NOT_APPLIED**. The latest user instruction authorizes deployment followed by migration/replay preparation only. No migration, schema change, seed, reset, runtime-mode change or payment activation was performed in this stage.

## Verified target

- Sandbox project: `kdtqyxlrkpmlpupzgmwv`, PostgreSQL 17.6.
- URL: `https://kdtqyxlrkpmlpupzgmwv.supabase.co`.
- Read-only inventory: no application relations in public/private, no migration ledger, zero auth users/storage objects/buckets; hosted auth.jwt() and storage.foldername(text) exist.
- Production project `qwmcstyfegvpzjmjrylc` is forbidden for this replay. The main repository's production link was not changed.
- An isolated CLI workdir was staged at `/tmp/elysia-stripe-sandbox-kdtqyxlrkpmlpupzgmwv` with its project-ref fixed to the sandbox, seeding disabled, and byte-identical copies of all 74 existing migrations. No credentials exist in the staged context.

## Prepared inputs

`sandbox-migration-plan.json` records exact order, filenames, bytes and SHA-256 for migrations 20260714010000 through 20260915070000. This reuses the already-qualified canonical 74-migration history; no new migration or fabricated migration-ledger entry was created. The first historical baseline recreates a fresh application schema and must never run against the existing production database or an occupied sandbox.

`sql/inspect-sandbox.sql` is the read-only freshness inspection already executed. `sql/post-replay-verification.sql` is prepared for after the later replay; it must report 74 applied versions, zero payment data, all money flags OFF, and preserved legal version hashes. Free allowance flags are distinct from paid-compute gates.

## Next execution stage for Codex

1. Reconfirm the sandbox Worker URL, all OFF gates, exact isolated project-ref, empty application schema and current manifest hashes. Refuse any target other than kdtqyxlrkpmlpupzgmwv. Do not relink the main checkout.
2. Replay the existing migrations in order through the isolated target, with migration history recorded transactionally. Use the already available Supabase management authentication path; do not extract/re-request the Worker's backend secret. Existing hosted auth/storage schemas must remain managed by Supabase; disposable-container stub schemas must not be replayed remotely.
3. Do not import production users, payment rows, storage objects, environment secrets, unrelated seed.sql, provider catalog IDs or test fixtures. Do not reset an occupied project or mark unapplied migrations as applied.
4. Reconcile a failure against actual migration history before retrying; never replay the non-idempotent baseline blindly. Preserve exact canonical source hashes in evidence.
5. Run post-replay verification, validate the existing readonly provider-readiness projection from the sandbox Worker, and record results. No Stripe catalog provisioning, live/test processing, qualifications, lane activation or production deployment is included in this preparation stage.

The backend secret was inspected only as a binding name. The Supabase inventory used existing management authentication and never read or printed that backend secret. There is no human credential handoff needed for this preparation.
