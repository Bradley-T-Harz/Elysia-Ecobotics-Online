# Marketplace v1 Catalog Cleanup Record

## Website-source action completed

The former static seed catalog represented Core/profile dependencies and planned integrations as if they were Marketplace add-ons. The website source now removes that pseudo-catalog and retains only Codev as a clearly labeled official v1-finalization candidate. Codev is `pending_review` and not installable.

The website catalog loader also suppresses these exact legacy identifiers/names if returned by either supported remote catalog projection:

| Slug | Name | Website behavior |
| --- | --- | --- |
| `advanced-pdf-parser` | Advanced PDF Parser | Hidden |
| `ollama-local-models` | Ollama Local Models | Hidden |
| `searxng-research` | SearXNG Research | Hidden |

This is presentation cleanup, not a database mutation. No Supabase rows were changed, hidden, or deleted in Pass 8B through Pass 10A.

The Pass 10A anonymous hosted check confirmed that the legacy `addons` table still exposes the three rows as `approved` / `official`, while the modern `marketplace_listings` table exposes no matching public listing. Source seeding no longer creates these pseudo-add-ons. Migration `20260818010000_legacy_marketplace_publication_boundary.sql` also narrows the legacy public policy so retained `deprecated` rows are not catalog-readable after the migration is applied. Neither source change mutates the hosted rows by itself.

## Separate database cleanup gate

If any of the three records exist in Supabase, an authorized later pass must first run a read-only inventory against both `marketplace_listings` and legacy `addons`, record the exact row IDs, current publication/revocation state, linked versions, purchases/licenses/install intents, and referential dependencies, then prepare an exact dry-run hide/archive/delete plan. Bradley/admin approval is required before mutation. Unrelated Marketplace records must not be changed.

Pass 8C adds `scripts/marketplaceV1LegacyInventory.mjs`, its read-only SQL contract, and `scripts/marketplaceV1CleanupPlan.mjs`. The inventory requires a dedicated read-only PostgreSQL role, stores output outside Git at mode `0600`, and never prints the connection URL. The planner consumes that private inventory, refuses ambiguous or unrelated rows, writes a mode-`0600` non-mutating plan, and deliberately has no apply mode. Exact hosted row IDs remain unknown until an authorized operator supplies the read-only connection.

The complete operator procedure is `docs/marketplace/pass-8c-live-proof-operator-checklist.md`. Pass 10A still requires a dedicated read-only database credential to capture exact row IDs and an approved administrative credential to apply and verify the migration plus exact reversible retirement. Website filtering is defense in depth, not proof of hosted cleanup.

An honest empty catalog is acceptable. A dependency or planned integration must not be restored as an installable add-on unless it becomes a real packaged, permission-declared, reviewed add-on with working install semantics.
