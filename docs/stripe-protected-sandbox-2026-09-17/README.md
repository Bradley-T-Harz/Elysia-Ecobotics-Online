# Protected sandbox UI and dynamic Stripe methods — September 17, 2026

**BLOCKED — owner Cloudflare Access setup and secure backend-key binding on the private sandbox identity Worker remain.**

The engineering and sandbox deployments described below are complete. The published frontend is intentionally locked, not yet usable through an actual owner Access session. Stripe provider acceptance has **NOT RUN** and was not started. No live credentials were requested or created.

## Exact origin and deployed candidate

**https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev**

The preferred custom hostname was already reserved/resolving for the existing compute sandbox and could not safely be repointed under the available DNS permissions. The stable Workers URL is separate from production and adds no new domain or paid plan.

All three deployments came from an exported clean copy of pushed source **`6735f7e48837a471279aa8c3474c5aeea8ae98f3`**. The frontend build has 226 individually hashed files, uses only sandbox Supabase, and inherits no production environment. See [asset manifest](evidence/sandbox-build.json) and deployment logs.

| Sandbox Worker | Version ID | Deployment ID |
|---|---|---|
| `elysia-ecobotics-online-sandbox` | `d9122959-93ee-4c88-a50f-bed9e6642623` | `fefe2d2a-e3f1-4068-887b-aaff5859cf18` |
| `elysia-first-party-billing-sandbox` | `17e43dc7-7b42-4758-8770-8526f7c38c60` | `61f3fc90-8c07-433d-b134-eeb0d8d15b17` |
| `elysia-shared-identity-sandbox` | `785f8361-e311-43af-9bea-9bebc0389166` | `492f3471-38de-410d-b70d-341fc01b323f` |

Version preview URLs are OFF. Identity has neither a workers.dev URL nor a public route. UI service bindings point only to the sandbox billing/identity Workers. The existing sandbox billing backend secret was preserved; presence-only inspection finds no Stripe credentials. The private identity Worker has no backend secret yet. The UI contains no secret binding.

## Implemented

- Separate reproducible sandbox build/deployment configs; exact sandbox auth return URLs configured through the existing secure management login; no users, production data or fixtures copied.
- Static assets, SPA routes and APIs are gated by signature-verified Cloudflare Access JWTs. Direct sandbox billing API requests receive the same protection. Blank team/AUD bindings fail closed. No production API fallback exists.
- Only exact POST `/api/billing/webhook`, with no query string, bypasses interactive Access. Raw bytes and signature reach the existing HMAC handler unchanged. Disabled billing currently returns 503; the webhook exception cannot authorize money movement.
- Replaced `.invalid` `BILLING_PUBLIC_ORIGIN` with the exact sandbox origin. Added a visible synthetic-data/payments-disabled banner, private/no-store/noindex responses and sandbox-only data CSP.
- Replaced Checkout's hard-coded card list with `payment_method_configuration`, validated per request. Added non-secret `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID`, direct own-account/mode checks and fail-closed policy enforcement.
- Idempotent provisioner creates/synchronizes a dedicated PMC from globally enabled, available own-account preferences while excluding BNPL, OXXO and crypto. Stripe determines currency/geography/session/recurring eligibility. No default or Connect config is edited. Read-only preflight rejects drift; unknown enabled future methods fail closed. No real Stripe object was created in this stage.
- Updated the exact permission matrix (PMC Read runtime / Write setup), binding templates, full Stripe runbook, acceptance plan, owner Access payloads and continuation helpers.

## Gates, database and production

**Every first-party money lane is OFF:** one-time Support, recurring Support, commercial Job Post payments, organization/professional-service payments and sponsorship payments. `BILLING_MODE=disabled`, `BILLING_ENABLED=false`; all 25 sandbox Worker enablement/confirmation flags remain false. Portal, fulfillment, refunds and retry processing are OFF. Access/edge/preflight qualification flags remain false.

**All third-party money remains hard-OFF:** Connect, connected sellers, KYC/bank onboarding, paid creator offers, third-party checkout, creator payouts/settlement, paid hosted compute, Support-to-compute credits and physical hardware commerce. Free creator routes were preserved and exercised in the isolated local browser.

No migration was added or applied this stage. The completed [sandbox replay](../stripe-sandbox-replay-2026-09-16/README.md) remains authoritative: 74 migrations, head **`20260915070000_free_compute_and_direct_grant_boundary.sql`**, project **`kdtqyxlrkpmlpupzgmwv`**. The database's canonical provider mode is `test`; that does not enable the disabled Worker. Settled RLS/schema/economic checks were not rerun. No production database was queried or modified; no data was imported.

Read-only Cloudflare metadata comparison confirms production unchanged:

- Pages deployment `57f69a36-caad-4959-8dfb-30aec839ec74`, source `ba75044d82aa676026cba37f828f7b559729ef77`.
- Production billing version `a043d182-a69e-451e-98a1-ae03b972ccd2`, deployment `3940a21e-f650-4521-91b4-e3d5eeff3e86`; all 25 flags still false.

No production build/deploy, visibility change, tag/release rewrite, paid plan change or live money movement occurred.

## Verification

| Check | Result |
|---|---|
| First-party suite (19 programs) | PASS; synthetic provider contracts only |
| Dynamic payment-method policy/provision/preflight tests | PASS; eligible non-card methods and exclusion/drift/mode boundaries |
| Signed Access/asset/API/raw webhook tests | PASS with synthetic local keys |
| Built sandbox browser routes | PASS; homepage, Forge, Creator Studio, account, Support, account billing; no production data or Stripe requests |
| App/function type checks; auth/Turnstile and Artisan contracts | PASS |
| Exact clean build, 226 asset hashes, three Worker dry runs | PASS |
| Deployed protection | 19/19 PASS; unauthenticated/forged requests denied; only exact webhook POST reaches disabled backend |
| Actual authorized remote Access login | PENDING owner setup; not claimed |
| Actual Stripe provider acceptance | NOT RUN by instruction |

One additional historical route-preservation snapshot check has a pre-existing mismatch: its exact header list predates the approved Creator Studio navigation entry. The route contract and navigation were not changed here; the current navigation suite and built route checks pass. This limitation is recorded rather than rewriting historical route evidence or claiming every historical test passed.

## Owner handoff and next work

Follow [SANDBOX_UI_RUNBOOK.md](SANDBOX_UI_RUNBOOK.md): create the owner-only root Access app and exact webhook bypass app, share only the public team domain/root AUD, and securely bind the existing sandbox `SUPABASE_SERVICE_ROLE_KEY` to `elysia-shared-identity-sandbox`. Cloudflare Access creation was attempted and denied with HTTP 403/code 1010. The secret cannot be read back from the existing billing Worker. These are the only immediate human configuration steps.

Codex then applies the non-secret bindings, deploys and verifies the owner login/isolated account routes with money OFF. No new live Stripe secrets are needed. The [Stripe runbook](STRIPE_DASHBOARD_HUMAN_RUNBOOK.md) and [acceptance plan](STRIPE_TEST_MODE_ACCEPTANCE.md) specify the later separate provider stage; do not begin it now.

## Durable history and evidence

Implementation checkpoints:

1. `e8c9a68f2e82a4e8f8b4ab4d2484b8854917239f` — dynamic PMC adapter, provisioner, preflight and tests.
2. `6735f7e48837a471279aa8c3474c5aeea8ae98f3` — isolated frontend, private identity and billing Access protection; exact deployed candidate.
3. This evidence/runbook/helper checkpoint follows those commits; its final hash is recorded in the external financial packet `Stripe_Protected_UI_2026-09-17/FINAL_STATUS.json` and the completion report.

Approved private refs: `online/main`, `online/stripe-first-party-2026-09-15` on `Bradley-T-Harz/Elysia-Ecobotics-Online`; `legacy/stripe-first-party-2026-09-15` on `Bradley-T-Harz/elysia-marketplace`. `origin` aliases the canonical online repository. Legacy `main` remains `c04260585e237e213d10e0220d964a09e4f0bbcf`.

`evidence/` contains sanitized before/after runtime metadata, Access permission result, auth URL change, deployed HTTP checks, build hashes and qualification/deployment logs. `SHA256SUMS.txt` covers this packet. No credential, JWT, cookie, customer data or full provider event payload is included. The [rollback section](SANDBOX_UI_RUNBOOK.md#rollback) preserves the Access guard and keeps the replayed database intact.
