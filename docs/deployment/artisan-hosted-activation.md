# Artisan hosted activation runbook

Updated: 2026-07-18

This runbook lists credentialed and human-governance steps that repository code
cannot truthfully complete. It is intentionally fail-closed. Repository examples
do not prove that Supabase or Cloudflare hosted settings exist.

## Release authority

Before any hosted mutation, record the intended Supabase project reference,
Cloudflare account ID, Online Pages project, Artisan Pages project, Worker
names, environment, release commit SHAs, operator, approver, and rollback owner.
Do not infer project ownership from a local URL or stale Git remote.

Production activation requires separate approval for:

- database migration;
- private Worker and Pages deployment;
- adult-beta membership opening;
- teen participation;
- under-13 participation;
- each new media adapter;
- custom domain/DNS changes.

## 1. Supabase preflight

1. Use catalog-only/read-only credentials to inventory migration ledger, tables,
   views, functions, function ACLs, triggers, RLS policies, Auth redirect
   allowlist, Storage buckets/policies, extensions, cron/jobs, and hosted
   generated types. Never print credentials or user/profile rows.
2. Compare the hosted ledger to the full tracked Online chain. Stop on any
   unknown, missing, reordered, modified, or partially applied migration.
3. Run the repository migration/static actor suites, then apply the chain to a
   disposable/staging project restored from a production-like backup.
4. Exercise every anonymous, owner, invited adult, unverified, restricted,
   teen, guardian, scoped staff, AAL1, AAL2, service Worker, and deletion state.
5. Verify a recent backup and a documented restore drill. Schema rollback is a
   forward migration, not a destructive history rewrite.
6. Apply through the repository's reviewed migration workflow only after the
   migration diff and backup are approved. Capture ledger output without data.
7. Regenerate database types from the resulting hosted schema, compare to the
   checked-in contract, and update consumers through a normal reviewed commit.

The canonical chain belongs only to `Elysia-Ecobotics-Online/supabase/migrations`.
Never run an Artisan-local migration command.

## 2. Supabase Auth

Configure exact redirects; do not use production wildcards:

- `https://elysiaartisancollective.pages.dev/auth/callback`
- `https://artisans.elysiaecobotics.com/auth/callback`
- the documented localhost `5174` callback URLs for development only;
- existing exact Online setup/recovery destinations from `supabase/config.toml`.

Verify PKCE callback exchange, recovery isolation, existing-account password
login, and OTP/magic link with `shouldCreateUser:false`. Confirm that an unknown
email cannot create an account from Artisan. Verify no access/refresh/recovery
token survives in address bars, history, referrers, logs, analytics, or
cross-origin storage.

Review email templates, SMTP sender/domain authentication, bounce/complaint
handling, abuse limits, session duration, refresh-token rotation, password
policy, MFA/AAL2 staff requirement, banned-user behavior, and Auth audit logs.
Local `supabase/config.toml` enables TOTP enrollment and verification so the
fresh-MFA flow can be exercised in local/staging verification; it deliberately
keeps phone MFA disabled. Neither local setting proves the hosted project.
Enable hosted TOTP explicitly, keep unsupported MFA methods off, enroll named
staff individually, and verify stale/future/malformed AMR rejection before admin
activation.

## 3. Cloudflare private services

1. Authenticate Wrangler to the intended account and verify identity with a
   read-only command. Stop if the account or project is ambiguous.
2. Create/deploy `elysia-shared-identity` from the reviewed identity config.
   It must have `workers_dev:false`, no route, no custom domain, and encrypted
   Worker-only secrets. Set all feature flags false initially.
3. Create/deploy `elysia-artisan-api` with the same private defaults. Bind only
   the reviewed private buckets, queues, image/media services, and rate limits.
4. Bind both Online and Artisan Pages Functions to the appropriate private
   Workers. Pages must not receive a service-role or provider secret.
5. Deploy preview first. Confirm that direct Worker URLs are unavailable and
   only the same-origin Pages proxies work.
6. Verify structured logs contain no bearer tokens, emails, request bodies,
   object keys, provider payloads, moderation evidence, or caught-error text.

`wrangler.identity.example.jsonc` remains the all-off first-deployment template.
After the exact bindings, encrypted secrets, allowed origins, rate limiter and
Turnstile hostname are verified, deploy `wrangler.identity.production.jsonc`
to open only the confirmed-account, owner-scoped profile and governance read
contract. That production profile deliberately leaves adult membership, every
youth gate, lifecycle execution, notification delivery and external provider
off. Enabling the shared identity contract is not an Artisan invitation and
does not change a database participation state or feature flag.

Use encrypted secrets for the Supabase service role, Turnstile secret, provider
keys, webhook secrets, and storage credentials. Public Supabase publishable and
Turnstile site keys remain browser-visible by design.

## 4. Turnstile

Use Cloudflare's reviewed widget/API setup for separate preview and production
hostnames. Confirm the sitekey and allowed hosts before creation. Never commit
the secret. Test server-side Siteverify success, failure, reuse, expiry,
hostname mismatch, action mismatch, timeout, malformed body, and provider
outage. The server must continue checking exact action and hostname.

Turnstile is required on abuse-prone lifecycle, assurance, guardian, report,
upload authorization, recovery, and invitation flows. It is an abuse signal,
not identity, age, consent, participation, or authorization proof.

## 4A. Age and guardian provider callbacks

The Identity Worker remains private. Configure reviewed providers to deliver
their signed server callbacks through Online's public same-origin proxy only:

- `https://elysiaecobotics.com/api/identity/v1/providers/age-assurance/callback`
- `https://elysiaecobotics.com/api/identity/v1/providers/guardian/callback`

Do not configure a `workers.dev` URL or an Artisan browser return page as the
provider webhook. The Pages proxy forwards only the allowlisted signature,
timestamp, event, content and tracing headers and strips cookies. The Worker
then verifies the provider signature/freshness, exact transaction and purpose,
normalizes a coarse result, consumes it idempotently through the canonical RPC,
and writes audit. A browser visit or provider redirect alone changes nothing.

Before enabling either adapter, prove valid, invalid, stale, replayed,
wrong-purpose, wrong-provider, oversized, malformed and out-of-order callbacks;
provider outage; database rollback; and secret rotation. Logs must contain no
callback body, evidence, email, birth date, identity document, signature or
provider credential. Record the exact provider callback URL, signing algorithm,
key version, IP/WAF policy and rollback owner in the release ledger.

## 5. Media infrastructure

Create private quarantine, approved-derivative, thumbnail, and restricted
evidence storage only after region, residency, retention, cost, backup, and
incident decisions are signed off. Verify:

- no public `r2.dev` or public Supabase bucket for originals;
- narrow CORS for the exact Artisan origins and required methods/headers;
- randomized Worker-owned keys and short-lived scoped permits;
- lifecycle deletion for abandoned/rejected quarantine objects;
- queue retry and dead-letter behavior, idempotent processors, alarms;
- Cloudflare Images canonical re-encode/metadata removal and thumbnail output;
- no derivative publication before review approval;
- signed/controlled delivery cannot be changed into an original-object URL;
- evidence/legal-hold objects are excluded from automatic deletion only through
  a documented audited hold.

R2 event notifications and queue consumers are dashboard/credentialed actions;
repository bindings alone do not create them.

For optional transactional notification email, onboard
`elysiaecobotics.com` in Cloudflare Email Sending, verify the generated SPF,
DKIM, bounce-domain and DMARC records, and confirm the intended account quota
and suppression monitoring. The Identity Worker binding is restricted to
`notifications@elysiaecobotics.com`. Only after controlled-recipient delivery,
bounce/complaint handling, preferences, and evidence hashes are verified may
`IDENTITY_NOTIFICATION_DELIVERY_PROVIDER=cloudflare-email-service-v1` and
`IDENTITY_NOTIFICATION_DELIVERY_ENABLED=true` be set. No Email Service API key
belongs in the Worker or repository; the native binding supplies authority.

## 6. Pages and domain

Create the Artisan Pages project from the exact intended Git repository. Build
with the locked Node version and `npm run build`; publish `dist`. Verify preview
and production variable separation, Pages Function bindings, redirects, 404,
CSP, HSTS, CORS absence on static content, sitemap/robots/canonical metadata,
and source-map policy.

The initial production origin is
`https://elysiaartisancollective.pages.dev`. Add
`https://artisans.elysiaecobotics.com` only after ownership and DNS are approved.
Then update Auth redirects, Turnstile hostnames, CSP/connect/media origins,
Worker origin allowlists, canonical selection, sitemap, monitoring, and tests as
one coordinated change. Keep the Pages domain working during transition unless
a separately approved redirect plan says otherwise.

## 7. Legal, staffing, and operations gates

Counsel must approve the exact content hashes and versions for terms, privacy,
community guidelines, artist rights/license, AI/authorship disclosure,
challenge rules/winner agreement, copyright/DMCA, appeals, retention/deletion,
age bands, geography, and guardian notices/consent. Register a DMCA agent and
publish real contact information through an approved business process.

Name and train primary/backup owners for moderation, independent appeals,
copyright/credit, child safety and mandatory reporting, privacy/deletion,
security incidents, outage response, queue/DLQ, database restore, and provider
escalation. Establish coverage and maximum response targets before opening
participation.

Adult beta may open only after invite issuance, premoderation coverage, reporting
and appeals, upload quarantine, incident drills, and observability pass. Teen
and under-13 flags remain false until their separate launch checklists and live
provider verification are explicitly approved. Multimedia adapters remain false
until each format's processing and moderation operations are proven.

## 8. Production verification and rollback

Run browser/E2E actor matrices on both origins, then verify every public route,
callback, profile privacy query, permission denial, upload state transition,
forum/comment flow, challenge/judging/gallery flow, report/case/appeal, audit,
export/deletion request, keyboard/mobile/screen-reader/reduced-motion/calm mode,
headers/CSP/CORS, and secret scan.

Rollback acquisition and participation with feature flags first. Stop queue
consumption safely, preserve untrusted objects and audit evidence according to
policy, and avoid destructive database rollback. Record incident/release
timestamps, affected versions, flag changes, and verification evidence without
copying private user content into ordinary logs.
