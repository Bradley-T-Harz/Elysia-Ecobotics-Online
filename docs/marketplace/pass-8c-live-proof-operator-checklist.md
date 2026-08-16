# Pass 8C Live Marketplace Proof Checklist

This checklist closes the live Supabase evidence gap without placing credentials, sessions, private paths, user IDs, private storage object names, or raw auth payloads in Git or a public report.

## Preconditions

- Use a dedicated harmless Marketplace test account with a Developer Forge profile. Do not reuse a private administrator browser profile.
- Use the canonical production or approved staging site and confirm its hostname before signing in.
- Prepare an inert package containing only `manifest.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, `PERMISSIONS.md`, and one harmless text/TypeScript placeholder. Include no `.env`, credentials, customer data, private repository content, or executable binary.
- Record evidence in a private operator location. In a shared report, retain only shortened record identifiers and hashes.

## Signed-in submission proof

1. Open `/marketplace/submit` while signed out and verify remote submission is disabled.
2. Sign in with the dedicated test account and confirm a Developer Forge profile is present.
3. Select the inert `.elysia-addon` or folder fixture. Confirm selection says it remains in browser memory and does not upload or execute.
4. Confirm the file tree, file count, total size, manifest state, Local Elysia compatibility state, license state, and static findings.
5. Verify the Git repository field is metadata-only and no fetch/clone request occurs.
6. Verify the remote transfer/submission action remains disabled until the explicit “files leave my computer” acknowledgement is checked.
7. Submit once. Do not retry blindly after an ambiguous network result.
8. In the submitter view, verify the draft is locked and the submission state is `pending`/`pending_review`.
9. In an authorized reviewer view, verify the same exact submission has an immutable snapshot and a private package object, if a package was transferred.
10. Query public Marketplace browse as signed out and verify the test add-on is absent. Confirm there is no `marketplace_listings` published row for the test slug.

Record privately:

- shortened submission ID and review-item ID;
- package SHA-256 and shortened private object identifier, never the full private path or URL;
- submission/review state;
- proof that public listing count for the test slug is zero;
- time, site hostname, app commit, reviewer, and cleanup owner.

## Test-record cleanup

Prefer withdrawal/archive through an existing governed UI or reviewer workflow. Do not hard-delete evidence. If no reversible cleanup action exists, label the private submission clearly as a Pass 8C test record and assign an administrator to withdraw/archive it later.

## Legacy listing inventory

An authorized database operator supplies a dedicated read-only PostgreSQL URL only in process memory and runs:

```bash
SUPABASE_READONLY_DATABASE_URL='postgresql://READ_ONLY_ROLE:REDACTED@HOST:5432/postgres?sslmode=require' \
  node scripts/marketplaceV1LegacyInventory.mjs --execute \
  --output /private/operator/location/marketplace-v1-inventory.json
```

The output is mode `0600`, must remain outside the repository, and contains exact stale listing/add-on IDs plus only the status, version, publisher-presence, timestamp, and linked-record counts needed for a reversible decision.

Create a non-mutating cleanup plan:

```bash
node scripts/marketplaceV1CleanupPlan.mjs \
  --inventory /private/operator/location/marketplace-v1-inventory.json \
  --output /private/operator/location/marketplace-v1-cleanup-plan.json
```

The planner never connects to Supabase and has no `--apply` mode. A Marketplace administrator must compare exact IDs and current values immediately before any separately reviewed mutation. The preferred reversible states are `marketplace_listings.listing_status = revoked` with a clear retirement reason and legacy `addons.status/trust_tier = deprecated`. Preserve the inventory as rollback evidence. Never modify unrelated rows.
