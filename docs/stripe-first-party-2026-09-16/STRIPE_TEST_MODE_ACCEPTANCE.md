# Acceptance evidence

## Current application checks

The current suite runs 18 programs covering money arithmetic, all five provider flows, recurring metadata/settlement, restricted provisioning, GET-only preflight, edge rate limiting, raw signatures/event parsing, environment isolation, Job Post/organization/sponsorship boundaries, operator/lifecycle/observability, legal integrity and navigation. Separate UI/function type checks and the focused readiness browser test pass. Build, public-route and production endpoint verification are recorded in the deployment report.

Previous trusted qualification remains applicable: all 74 migrations replayed with historical and clean fixtures; plpgsql_check reported zero errors across 590 governed function names. No SQL changes in this session justify rerunning that historical audit.

## Actual Stripe sandbox: NOT RUN

Missing Stripe sandbox credentials/signing secret and isolated economic database prevent actual provider requests. Automated Supabase branch creation was attempted without copying data and rejected because branching requires Pro. Do not manufacture timestamps or mark synthetic fixtures as provider acceptance.

Execute the complete [canonical sandbox case list](../stripe-first-party-2026-09-15/STRIPE_TEST_MODE_ACCEPTANCE.md) after secure configuration exists, including success/cancel/decline/replay/invalid signatures/refund/dispute, recurring renewal and cancellation, correct lane ownership, free/waived/reduced Job Posts, denied unauthorized agreements, and strict test/live isolation. Native rate limiting was verified on the disabled production Worker (429 at attempt 62); runtime restricted-key permissions still need actual provider integration evidence. Card is the sole requested payment method; async handling fixtures do not qualify ACH or BNPL.
