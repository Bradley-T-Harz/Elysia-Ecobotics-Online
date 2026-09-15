# Secret bindings

**Never put values here, in Git, commands, chat, screenshots, logs, fixtures, or VITE variables. Save every permanent credential in Bitwarden before continuing.** Bradley enters permanent values through secure runtime secret entry. Codex can validate names and presence only.

| Runtime | Secret name | Source |
|---|---|---|
| Separate test billing Worker | STRIPE_SECRET_KEY_TEST | Dedicated Stripe sandbox restricted/server key |
| Separate test billing Worker | STRIPE_WEBHOOK_SECRET_TEST | That sandbox's exact registered endpoint |
| Separate test billing Worker | SUPABASE_SERVICE_ROLE_KEY | Separate sandbox economic database |
| elysia-first-party-billing | STRIPE_SECRET_KEY_LIVE | Approved first-party live Stripe account |
| elysia-first-party-billing | STRIPE_WEBHOOK_SECRET_LIVE | Exact live endpoint |
| elysia-first-party-billing | SUPABASE_SERVICE_ROLE_KEY | Production economic database |

No Stripe publishable key is needed: Checkout is hosted. Account ID, Product/Price/Portal IDs, API version, public origin and publishable Supabase key are non-secret configuration. The live Worker must not contain test secrets; the test Worker must not contain live secrets. No Connect, seller, runner, or sandbox-compute credentials belong here.

From the repository, hidden interactive entry for a production binding is `npx wrangler secret put STRIPE_SECRET_KEY_LIVE --config wrangler.billing.production.jsonc`; use the other two names for their respective bindings. Prefer Cloudflare Dashboard's encrypted secret field if the terminal interaction would expose input. Never pass a value as a CLI argument. Keep all flags OFF while entering secrets. Verify via secret names only, never fetch values.

Provisioning script credentials must be injected by a secure secret manager into the process environment; never use shell history or a committed `.env`. A key stored only in a Worker is not readable back for local provisioning. A future session may use an approved secret-manager execution context; Bradley is not asked to hand-create Products/Prices.
