# Deployment and rollback — candidate qualification

Fresh starting source: 28833c52e0fe0aaeb15a8e64806fd2bdda883fc5. Initial runtime inventory is in evidence/before-runtime.json. Pre-change Pages deployment 66d46ab1-64c9-4956-9ecf-df075178a89f; production Worker version 9a130f76-dab4-46df-a348-2f564ed649d4; sandbox Worker version ed3ad36e-35e9-42c3-96af-63d4626e8bd1. These are rollback references, not proof of the new deployment.

No new production migration is required. Existing production migration head 20260915070000 (74 total); Sept15 activation migrations 20260915010000 through 20260915070000 remain applied. Supabase rejected schema-only sandbox branching; no branch ID/migration application exists for the attempted sandbox.

Deploy only the clean candidate after focused tests/types and canonical private-ref alignment. Keep both runtimes disabled and all five lane gates OFF. Post-deployment IDs, hashes, HTTP/browser verification and final refs are appended after execution. The final evidence commit may follow the deployed source commit without code changes.

Rollback: keep acquisition OFF, revert Pages to the pre-change deployment and Worker code to the prior compatible version if necessary. Do not drop ledger tables, remove evidence, rewrite legal history or restore schema over money activity. After any future activation, maintain verified webhooks/retries/Portal/refunds during acquisition pause. Current scoped recovery archives and Sept15 migration replay evidence remain available in the prior private packet; this session makes no claim of a new full database restore drill.
