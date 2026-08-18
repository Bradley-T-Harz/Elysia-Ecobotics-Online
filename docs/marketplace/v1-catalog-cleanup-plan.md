# Marketplace v1 Catalog Cleanup Record

## Website-source action completed

The former static seed catalog represented Core/profile dependencies and planned integrations as if they were Marketplace add-ons. The website source now removes that pseudo-catalog and retains only Codev as a clearly labeled official v1-finalization candidate. Codev is `pending_review` and not installable.

The website catalog loader also suppresses these exact legacy identifiers/names if returned by either supported remote catalog projection:

| Slug | Name | Website behavior |
| --- | --- | --- |
| `advanced-pdf-parser` | Advanced PDF Parser | Hidden |
| `ollama-local-models` | Ollama Local Models | Hidden |
| `searxng-research` | SearXNG Research | Hidden |

The source suppression remains defense in depth. On 2026-08-18, the authorized Pass 10A hosted closure applied migration `20260818010000_legacy_marketplace_publication_boundary.sql`, captured a mode-`0600` private pre-mutation inventory, and reversibly retired the exact three matching legacy rows plus their exact three version rows. The rows were not hard-deleted: each add-on now has `status = deprecated` and `trust_tier = deprecated`, while each linked version has `review_status = deprecated`.

Post-mutation proof confirmed that the target count was exactly three, no modern Marketplace listing matched them, the anonymous legacy query returned zero target rows, and the public browse page omitted all three names. The pre-inventory SHA-256 is `a0dcaa89b2b958544a3a765c1f329bdbf095b33efacc0134a7ca71a014f7932`; its private local path and raw row IDs are intentionally excluded from public documentation.

## Completed database cleanup gate

The authorized cleanup followed this sequence: read-only inventory against `marketplace_listings` and legacy `addons`; exact row, version, saved-item, and install-intent dependency checks; private backup; exact dry-run plan; guarded reversible update; exact post-query; anonymous query; and live browse verification. The guarded operation affected exactly three add-ons and three versions, zero saved records, zero install intents, and no unrelated Marketplace rows.

Pass 8C added `scripts/marketplaceV1LegacyInventory.mjs`, its read-only SQL contract, and `scripts/marketplaceV1CleanupPlan.mjs`. The inventory requires a dedicated read-only PostgreSQL role, stores output outside Git at mode `0600`, and never prints the connection URL. The planner consumes that private inventory, refuses ambiguous or unrelated rows, writes a mode-`0600` non-mutating plan, and deliberately has no apply mode. Pass 10A used a separate local-only guarded operator action after the exact inventory and Bradley/admin authorization were present.

The complete repeatable operator procedure remains `docs/marketplace/pass-8c-live-proof-operator-checklist.md`. Future cleanup still requires a new exact inventory, backup, dry-run, and explicit authorization; this Pass 10A evidence does not authorize broad or repeated database mutation.

An honest empty catalog is acceptable. A dependency or planned integration must not be restored as an installable add-on unless it becomes a real packaged, permission-declared, reviewed add-on with working install semantics.
