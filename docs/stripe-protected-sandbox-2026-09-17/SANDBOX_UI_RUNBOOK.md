# Protected sandbox UI: deployment and owner handoff

## Exact state

Stable sandbox origin: **https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev**.

The separate frontend is deployed and locked. All anonymous UI, asset and API requests return 403; no app HTML or JavaScript is exposed. The Access team domain and application audience are deliberately blank until the owner creates the applications below. This is verified fail-closed protection, **not a claim that an actual authorized Cloudflare Access login has passed**.

The preferred `sandbox.elysiaecobotics.com` hostname already resolves and is reserved by the existing compute-sandbox configuration. The current login cannot read its DNS records. It was not repointed or reused. The stable Workers URL requires no new domain or paid feature. No billing plan, subscription, production deployment, production data or historical release was changed.

| Component | Configuration | Scope |
|---|---|---|
| Frontend | `wrangler.ui.sandbox.jsonc` | Static assets run through the Worker before serving; previews OFF; only sandbox service bindings |
| Billing | `wrangler.billing.sandbox.jsonc` | Existing isolated backend; new origin; `BILLING_MODE=disabled`; all 25 enablement/confirmation flags false |
| Identity | `wrangler.identity.sandbox.jsonc` | Private Worker, no workers.dev or preview URL; sandbox Supabase only; lifecycle/provider/email operations OFF |
| Database | `kdtqyxlrkpmlpupzgmwv` | Existing fully replayed isolated project; no new SQL or production-data copy |

The frontend has no secrets. The identity Worker is necessary because the existing account/profile UI calls `/api/identity/*`; routing that path to production would violate isolation. Identity itself is enabled for sandbox account work, independently of money gates, but its backend credential is not yet bound. Unsupported API routes return 503 and never fall back to production. Free Creator Studio and Developer Forge entry points are included in the sandbox build; actual signed-in workflows await Access and isolated account configuration.

## Smallest owner actions now

1. In the existing Cloudflare account `52813999b345cafda80d67f1d6345d5c`, open **Zero Trust**. If onboarding is required, choose **Free** and a team name. No paid upgrade is authorized or necessary for this small owner-only sandbox. Under **Access → Applications → Add an application → Self-hosted**, create:
   - Name: `Elysia Online isolated sandbox`.
   - Public hostname: `elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev`, whole host (no path).
   - Session duration: `12h`.
   - Allow policy: **Emails → `bradleytharz3407@proton.me`** only. Leave everyone else denied. Use the existing identity provider, or enable One-time PIN for this email if no provider exists. Do not create an Everyone-Allow policy.
2. Add the narrower self-hosted application:
   - Name: `Elysia sandbox signed Stripe webhook`.
   - Hostname: the same exact frontend hostname; path **`/api/billing/webhook`**, no wildcard.
   - Policy: **Bypass → Everyone**, for this one endpoint only. The Worker separately exempts only exact **POST**, without query parameters. Other methods, child paths and trailing slashes still require Access. This bypass permits transport to the verified webhook handler; it grants no payment authority.
   - Do not add a root bypass or register a second Stripe endpoint for this alias. The canonical future Stripe endpoint remains on the billing Worker, below.
3. Share only the **non-secret Access team domain** (`https://<team>.cloudflareaccess.com`) and the **root application's AUD tag** with Codex. Codex will bind them in both sandbox Workers, commit, deploy and verify. Do not send login codes, cookies or JWTs.
4. In **Workers & Pages → `elysia-shared-identity-sandbox` → Settings → Variables and Secrets**, add encrypted Secret **`SUPABASE_SERVICE_ROLE_KEY`** using the existing credential for sandbox project `kdtqyxlrkpmlpupzgmwv`, directly from Bitwarden. Ensure the permanent credential is saved in Bitwarden before continuing. Do not reveal it in chat, scripts, source, logs or screenshots. The sandbox billing Worker already has this secret; do not re-enter it there. No Stripe secret is needed for this stage.

Cloudflare denied the attempted sandbox Access-app creation with HTTP 403/code 1010 under the existing login; it also denied Access organization inspection. This provider permission boundary is why the owner must create the apps. Cloudflare does not expose the already-bound billing backend secret for transfer, so binding it to the new private identity Worker is also owner-only. These are external access limitations, not an additional approval requirement imposed by a local skill.

The exact non-secret app/policy payloads are preserved in [cloudflare-access-plan.json](cloudflare-access-plan.json). Once the owner finishes these steps, Codex completes all configuration and checks below. An owner sign-in is needed to prove the actual email/identity-provider flow; do not share its verification code with Codex.

## Codex continuation: no provider acceptance yet

Run from a clean checkout of `Elysia-Ecobotics-Online`, substituting only the public Access references:

```sh
node scripts/configureSandboxAccess.mjs --team-domain=https://TEAM.cloudflareaccess.com --audience=ROOT_APPLICATION_AUD
node scripts/protectedSandboxUiTest.mjs
npm run typecheck:functions
npm run sandbox:ui:build
node scripts/protectedSandboxBrowserTest.mjs
```

The binding helper checks the exact sandbox project and every money flag before writing. Keep `BILLING_STAGING_ACCESS_CONFIRMED=false` until real deployed authorized/unauthorized checks pass; do not set it merely because an app exists. Commit/push the non-secret configuration, then deploy the exact clean candidate with the same qualified assets:

```sh
WRANGLER_WRITE_LOGS=false node_modules/.bin/wrangler deploy --config wrangler.identity.sandbox.jsonc --env-file /dev/null
WRANGLER_WRITE_LOGS=false node_modules/.bin/wrangler deploy --config wrangler.billing.sandbox.jsonc --env-file /dev/null
WRANGLER_WRITE_LOGS=false node_modules/.bin/wrangler deploy --config wrangler.ui.sandbox.jsonc --env-file /dev/null
```

All three configs name sandbox Workers explicitly. Never deploy the generic or production config for this task. Secret bindings are preserved by deployment; inspect names only. Do not populate local `.env` files. `sandbox:ui:build` uses an allowlisted environment, disables Vite env-file loading, checks sandbox references and disabled publication, and writes asset hashes to `dist-sandbox-build.json`. Preserve this manifest in evidence with the source commit. Do not reuse production `dist`.

Verify afterward:

- Anonymous and forged JWT requests expose no UI/assets/APIs. After Access is active, anonymous UI requests normally go to the Access login; the Worker still denies any request that bypasses the edge login without a valid assertion.
- Owner Access login loads `/`, `/marketplace/creator-studio`, `/developer-forge`, `/account`, `/support`, `/commons-circle/support-billing`; real sandbox app login remains a separate identity step.
- Root AUD, team issuer, RSA signature, expiration and not-before checks pass only for the intended Access app. Do not retain JWTs or cookies in evidence.
- Direct billing URL denies unauthenticated reads/mutations even without a separate interactive Access application on that host. The frontend service binding forwards the verified assertion, which the backend verifies again.
- Only exact POST `/api/billing/webhook` bypasses Access. With current money gates OFF it returns 503 from the billing-disabled guard, not a login page. HMAC must remain enforced when separately authorized test fulfillment is enabled. Invalid, missing or duplicate signatures are not accepted as payment truth.
- Identity has no public route; its service binding points only to `elysia-shared-identity-sandbox`. Verify backend secret **presence**, never its value. Use only synthetic sandbox accounts in later tests.
- Every billing gate remains OFF, `BILLING_MODE=disabled`, the UI says payments disabled, and no Stripe session/provider acceptance is started.

### Auth and payment return URLs

Already applied to sandbox Supabase only, preserving signup/email-confirmation/captcha settings:

```text
site_url:
https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev

additional allowed auth URLs:
https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev/account
https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev/commons-circle
https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev/account/recovery
```

`scripts/configureSandboxAuth.py` dry-runs by default; `--apply` uses the existing secure Supabase CLI management login in memory (Linux Secret Service through `secretstorage`, or an approved process-injected access token). It updates only these sandbox auth settings; it cannot migrate a linked production database. No backend key is retrieved. This step is already complete; Bradley need not repeat it.

`BILLING_PUBLIC_ORIGIN` now equals the exact sandbox origin above. Checkout uses existing server-derived lane return paths beneath it; Portal returns to `/commons-circle/support-billing`. Redirects cannot confirm settlement.

Canonical future Stripe sandbox webhook:
**https://elysia-first-party-billing-sandbox.bradleytharz3407.workers.dev/api/billing/webhook**.

The frontend mirrors that exact path for safe transport, but registering both URLs would create duplicate deliveries. Keep the one canonical URL in `stripeContract.ts`. See [full Stripe bindings, permissions, event list and provisioning runbook](STRIPE_DASHBOARD_HUMAN_RUNBOOK.md) for the later stage.

## Protection implementation and limits

Both Workers validate Cloudflare Access JWTs using the existing repository RS256/JWKS validator. Blank or malformed configuration denies access; no unsigned/header-presence trust is used. Static assets run through the Worker first. Responses are private/no-store and noindex; the Content Security Policy permits data connections only to the exact sandbox Supabase project and required same-origin/Turnstile endpoints. Version preview URLs are OFF.

Cloudflare's automatic `ctx.access` feature does not pass through Static Assets routing or service-binding calls, so the Worker performs explicit verification. See [Cloudflare Access on Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) and [Worker-first asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

No actual authorized remote Access login, sandbox account creation, real Stripe interaction, invoice, email delivery, upload, provider identity verification or compute execution is claimed in this stage. The sandbox identity configuration intentionally omits production storage/email/provider bindings. Those capabilities are not prerequisites for the scoped first-party Checkout acceptance paths and cannot fall back to production.

## Rollback

Keep money gates OFF and preserve the database replay/ledger. For UI regression, redeploy the qualified source/asset manifest recorded in README with the Access guard intact. For access uncertainty, blanking the two Access bindings on both sandbox Workers safely returns them to the current locked state; it does not require opening any public route.

Do **not** blindly restore the pre-stage billing version `31f96a20-91c6-458b-b707-34e9f1f618a0`: it predates the direct API Access guard. If a provider adapter rollback becomes necessary, preserve the new guard and disabled flags in a forward fix. The private identity Worker must remain without a public route. No down migration, production rollback, database reset or data deletion is needed or authorized by this stage.
