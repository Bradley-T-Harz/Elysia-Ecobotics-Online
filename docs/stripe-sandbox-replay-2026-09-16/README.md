# Isolated sandbox migration replay — completed September 16, 2026

**All 74 canonical migrations are applied and verified in `Elysia-Ecobotics-Online-Sandbox` (`kdtqyxlrkpmlpupzgmwv`).** This packet supersedes the September 16 preparation-only status. Production was not queried, changed or copied. Stripe provider acceptance has not started, as instructed.

## Execution and remote ledger

- Sandbox URL: `https://kdtqyxlrkpmlpupzgmwv.supabase.co`; project identity `ACTIVE_HEALTHY`, region `us-west-2`, PostgreSQL 17.6.
- Native Supabase CLI v2.108.0 applied the existing migrations, unchanged, from source revision `7412bda8536ff01d0553ba2ba83ac7dcb392b53a`.
- Application window: **2026-09-17 05:39:10–05:39:24 UTC** (September 16 in Denver). Exit status 0. Every migration appeared exactly once in canonical order.
- First migration: `20260714010000_remote_public_schema_baseline.sql`.
- Head: `20260915070000_free_compute_and_direct_grant_boundary.sql`.
- Native remote migration list and an independent SQL ledger query match all 74 versions and names. Every ledger entry has stored statements; the structural snapshot includes their hashes.
- No new migration, repair, reset, seed command, production export or application-code change was needed. Canonical configuration/catalog-of-policy rows are created by the migrations themselves; no customer or financial data was imported.

Execution used an isolated CLI workspace whose project-ref was checked before every command:

```sh
supabase db push --linked --dry-run --workdir /tmp/elysia-stripe-sandbox-kdtqyxlrkpmlpupzgmwv
supabase db push --linked --yes --workdir /tmp/elysia-stripe-sandbox-kdtqyxlrkpmlpupzgmwv
supabase migration list --linked --workdir /tmp/elysia-stripe-sandbox-kdtqyxlrkpmlpupzgmwv
```

The main checkout remains linked to production and was never used as the working directory for these remote commands. The existing secure Supabase CLI login was sufficient. No backend secret was retrieved, requested or printed. `executed-sandbox-cli.py.txt` preserves the execution wrapper as audit source; its paths resolve from the external financial evidence packet, not from this archived copy.

## Verification results

| Check | Result |
|---|---|
| Public tables | 114/114 have RLS enabled |
| Private tables | 158; 157 have RLS, all deny direct anon/authenticated table access |
| Canonical ACL-only table | `private.sandbox_proxy_secrets`: postgres-owned, no client schema/table access; unchanged from migration `20260714030000` |
| Policies | 455: public 433, private 4, storage 18 |
| Functions | 708; all SECURITY DEFINER functions set an explicit search path |
| Function validation | 451 non-trigger PL/pgSQL routines checked, no errors/fatal findings; checker installation rolled back and confirmed absent afterward |
| Role boundaries | anon/authenticated private reads, money-helper execution and gate-write privileges denied; public readiness remains readable |
| Integer money arithmetic | Canonical fee and half-unit rounding assertions passed |
| Indexes / constraints | Zero invalid/unready indexes; zero unvalidated constraints |
| Storage | 12 canonical buckets, all private; zero objects |
| Users and financial rows | Zero auth users, orders, payments, events, customers, subscriptions or provider-catalog rows |
| Historical legal rows | Sandbox hashes unchanged by validation; production rows were never copied or queried |

Boundary/function checks ran in rolled-back transactions. No fixture rows were necessary. Function lint and role checks establish database replay integrity; they do not claim provider acceptance or repeat the full historical application audit. The schema snapshot retains the resulting policy predicates and grants for review.

## Runtime and isolation

The existing sandbox Worker now returns HTTP 200 with `ok=true` from `/api/billing/provider-readiness`, reading this isolated database. Its capabilities response also passes. Backend configuration is present; Stripe test/live credentials and signing-secret bindings are absent according to presence-only runtime checks.

- Worker: `elysia-first-party-billing-sandbox`.
- URL: `https://elysia-first-party-billing-sandbox.bradleytharz3407.workers.dev`.
- **`BILLING_MODE=disabled`, `BILLING_ENABLED=false`; all 25 Worker enablement/confirmation flags remain false.** All five first-party lanes, Portal and fulfillment remain OFF.
- Database provider mode is `test`, the canonical database mode for an isolated environment; this does not enable the Worker. Every money flag is OFF. Only the existing free `sandbox_credit_display` and `sandbox_credit_enforcement` controls are ON; neither enables paid compute or purchases.
- September 15 first-party provider approval was replayed as canonical evidence. Account reference and all webhook/event/receipt/Portal/preflight qualification timestamps remain empty. All five lane qualification/authorization fields remain false.
- **Third-party commerce remains hard-OFF:** Connect, seller onboarding, paid creator offers, third-party checkout, payouts and settlement. Free creator functionality was not changed.
- No new Worker deployment occurred during this database replay. Existing version **`31f96a20-91c6-458b-b707-34e9f1f618a0`**, deployment **`f3a856eb-2199-4c18-af22-e996a1af5deb`**, deployed source **`2391a70654bf50f94942d72450ced4aa94fadff2`** remain the prior deployment evidence.

## Evidence and checkpoint

`replay-summary.json` is the final machine-readable result. `apply-*` records execution; `ledger-*` and `verify-schema-*` prove the remote ledger/schema; `verify-boundaries-*`, `verify-functions-*` and `verify-final-state-*` record validation. `before-worker-http.json` / `after-worker-http.json` show the readiness change after replay. The `sql/` files contain the exact validation queries. `SHA256SUMS.txt` covers this packet.

`source-migration-manifest.json` is the original preparation manifest: its historical `PREPARED_NOT_APPLIED` field describes the source plan, not the completed replay. Its per-file SHA-256 hashes were rechecked against both canonical and staged files before execution and against canonical files afterward.

Durable replay checkpoint: **`52fe35c82037adc825ec96fbe1f965065772ca6c`**. Final evidence is committed afterward and pushed to the existing private `online/main`, `online/stripe-first-party-2026-09-15` and `legacy/stripe-first-party-2026-09-15` refs. Exact final commit/ref verification is in the external packet's `FINAL_STATUS.json`; historical tags/releases, visibility and legacy/main remain unchanged.

## Rollback and next boundary

The native replay completed without a failed migration. No rollback was required. Keep this populated sandbox and its ledger; do not run down migrations or drop schemas. Gates remain OFF if a future validation fails. A future full reset would require explicit destructive-action authorization and must target this isolated project only. The existing disabled Worker deployment is unchanged.

Database replay is complete with no remaining human credential step. See [remaining prerequisites](REMAINING_PREREQUISITES.md) before any separately resumed Stripe provider acceptance. The broader activation program remains blocked by missing Stripe configuration and unrun provider acceptance; this is not a live-secret-entry-only handoff.
