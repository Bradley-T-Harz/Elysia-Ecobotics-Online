# Deployment and rollback

Machine-readable migration and deployment records are finalized after execution. Do not infer deployment from a commit.

Pre-change Pages: `6ff21be6-50df-4578-beab-91548fe8c4aa`, commit `7cbdc35b2c26680bf1e3b10070aa8fcf7d2234b9`. Initial migration head: 20260913010000 (67 total). No billing Worker/Stripe secrets existed in the inspected production configuration. Financial acquisition flags and monetary tables were empty/OFF.

The six candidate migrations are 20260915010000 (rounding), 020000 (approval), 030000 (environment/provider runtime), 040000 (owned Job fee reduction), 050000 (prospective legal), 060000 (rollout/inbox/settlement retries). Apply exact hash-qualified SQL with migration-ledger records in one transaction. Schema/legal/flag dumps are private, permissions 0600; pg_restore list readability verified. Recovery files contain no exported auth credentials or general user content. This is scoped recovery, not a claim of full restore testing.

Rollback: keep acquisition OFF; pause affected lane/runtime; preserve management and reconciliation once in service. Revert Pages to the pre-change deployment if needed, after checking compatibility with new prospective legal pointers. The billing Worker was newly introduced and can have its route removed if the disabled deployment fails. Do not blindly drop append-only tables or restore old schema over financial activity. Forward-fix database defects, or restore scoped definitions under reviewed maintenance only after proving no dependent activity. Never delete payment, refund, dispute, event, consent or audit history to repair state.

## Verified initial deployment

Source `3208d9cbe9e5770071e3c4c7324d42f894cd5402`: Pages `6be8f512-c570-494f-9ce8-61753cfd60ef`; Worker version `74d0fa81-5a47-427e-b150-4a98f369cee8`, deployment `ad922cb3-3b84-41e3-94fd-2788a0679401`. All six migrations applied atomically, history hashes unchanged, no financial rows created and all money flags OFF. Ten public desktop/mobile route checks and seven endpoint checks passed. Initial artifact SHA-256 `bac2af1e44b791c2cfe59703ac56710df9dd3e95c012dde2cb58d4199fd0856c`.

A separately qualified forward migration `20260915070000` closes direct legacy monetary credit grants and keeps free allowances independent of Stripe headers. Final deployment/evidence records follow after that migration.
