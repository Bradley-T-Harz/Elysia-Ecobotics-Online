# Marketplace v1 Catalog Cleanup Record

## Website-source action completed

The former static seed catalog represented Core/profile dependencies and planned integrations as if they were Marketplace add-ons. The website source now removes that pseudo-catalog and retains only Codev as a clearly labeled official v1-finalization candidate. Codev is `pending_review` and not installable.

The website catalog loader also suppresses these exact legacy identifiers/names if returned by either supported remote catalog projection:

| Slug | Name | Website behavior |
| --- | --- | --- |
| `advanced-pdf-parser` | Advanced PDF Parser | Hidden |
| `ollama-local-models` | Ollama Local Models | Hidden |
| `searxng-research` | SearXNG Research | Hidden |

This is presentation cleanup, not a database mutation. No Supabase rows were queried, changed, hidden, or deleted in this pass.

## Separate database cleanup gate

If any of the three records exist in Supabase, an authorized later pass must first run a read-only inventory against both `marketplace_listings` and legacy `addons`, record the exact row IDs, current publication/revocation state, linked versions, purchases/licenses/install intents, and referential dependencies, then prepare an exact dry-run hide/archive/delete plan. Bradley/admin approval is required before mutation. Unrelated Marketplace records must not be changed.

An honest empty catalog is acceptable. A dependency or planned integration must not be restored as an installable add-on unless it becomes a real packaged, permission-declared, reviewed add-on with working install semantics.
