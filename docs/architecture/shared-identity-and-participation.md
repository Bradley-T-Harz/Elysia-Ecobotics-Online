# Shared identity and participation architecture

Updated: 2026-07-18

## Governing boundary

Elysia Ecobotics Online and Elysia Artisan Collective use one Supabase project,
one `auth.users` row, one canonical Commons Profile, and one public Commons
Profile URL. The Artisan application does not offer signup and does not own a
second profile editor, profile table, user directory, or migration history.

Private local Elysia is outside this architecture. Neither public repository,
Cloudflare configuration, browser bundle, Worker, Supabase schema, upload
pipeline, log, or deployment runbook may read or name private memory,
conversations, local files, vaults, prompts, runtime state, machine data,
processes, or sockets.

## Two-origin session model

```text
Online browser                         Artisan browser
origin-local Supabase session          origin-local Supabase session
         |                                      |
         +-- same Supabase Auth tenant ----------+
         |     one auth.users identity
         |     exact redirect allowlist
         |     no shared cookies or tokens
         v
safe public RPCs / owner-scoped RPCs
         |
         v
Online Pages or Artisan Pages
         |
         +-- private service binding --> shared identity Worker
                                            |
                                            +-- verified JWT / owner client
                                            +-- service role only for narrow,
                                                actor-explicit audited RPCs
```

Artisan password login uses the existing account only. OTP/magic-link requests
must pass `shouldCreateUser: false`. PKCE email callbacks terminate at the exact
Artisan `/auth/callback` URL and exchange the short-lived code in the same
browser that owns the verifier. Sessions remain origin-local; cookies,
`localStorage`, bearer tokens, recovery tokens, and PKCE codes are never copied
between the two sites or embedded in cross-origin links.

After Auth succeeds, UI code loads `current_user_artisan_bootstrap()`. An Auth
session alone never means the user may participate. Database predicates and
Worker RPCs remain authoritative for current legal versions, assurance state,
participation band, guardian scopes, restrictions, membership, and feature
activation.

Exact hosted callbacks:

- `https://elysiaartisancollective.pages.dev/auth/callback`
- `https://artisans.elysiaecobotics.com/auth/callback`

Those are browser PKCE callbacks. Separately, reviewed age/guardian providers
send signed server callbacks to the canonical Online proxy paths
`/api/identity/v1/providers/age-assurance/callback` and
`/api/identity/v1/providers/guardian/callback`. The proxy has no provider
secret; it forwards a narrow header allowlist to the private Identity Worker.
The Worker verifies and normalizes the callback before an idempotent database
transition. Artisan `/guardian/consent/:token` is only a return/status surface
and never records consent from a URL visit.

The local and hosted redirect inventory is maintained in
`supabase/config.toml`. Hosted Supabase dashboard values must be compared to it
before activation; repository configuration does not prove hosted state.

## Public profile contract

Anonymous and cross-site consumers read only `profile_public_cards` through
the allowlisted public profile RPCs. Full `profiles` rows remain owner/staff
data. Publication is explicit, handle history creates canonical redirects and
reserved tombstones, and youth publication defaults conservative. Public cards
must not expose email, legal name, exact age or birthday, assurance evidence,
guardian relationships, school, precise location, private moderation state, or
provider identifiers.

The canonical public profile remains an Online URL. Artisan artwork, comments,
awards, and credits reference the canonical user/profile identifier rather than
copying profile fields into a mutable artist profile.

## Worker boundary

`services/identity-worker/worker.ts` is a private Worker with `workers_dev:
false` and no route. Pages reaches it through the `IDENTITY_SERVICE` service
binding. The Pages project holds no service-role or provider secrets.

Stable API routes:

| Method | Route | Authority |
| --- | --- | --- |
| GET | `/api/identity/v1/health` | safe feature capability projection |
| GET | `/api/identity/v1/public-profile?handle=…` | anonymous safe-card RPC |
| GET | `/api/identity/v1/bootstrap` | verified existing account |
| POST | `/api/identity/v1/profile/publication` | verified owner + exact origin + RPC |
| POST | `/api/identity/v1/legal/accept` | verified owner + exact origin + content hashes |
| POST | `/api/identity/v1/lifecycle/request` | owner + origin + rate limit + Turnstile |
| GET | `/api/identity/v1/lifecycle/requests` | verified owner; safe request ledger |
| GET | `/api/identity/v1/lifecycle/requests/:id` | verified owner; one owned request |
| POST | `/api/identity/v1/lifecycle/requests/:id/cancel` | verified owner + exact origin + atomic cancellation |
| GET | `/api/identity/v1/account/exports/:id` | verified owner; private R2 stream + SHA-256 |
| GET/POST | `/api/identity/v1/notifications` | verified owner; service-only preference RPC on mutation |
| POST | `/api/identity/v1/age-assurance/start` | owner + origin + rate limit + Turnstile + provider gate |
| POST | `/api/identity/v1/guardian-relationship/start` | owner + origin + rate limit + Turnstile + provider gate |
| POST | `/api/identity/v1/guardian-consent/start` | guardian + origin + rate limit + Turnstile + provider gate |
| POST | `/api/identity/v1/guardian-sponsored-account/start` | AAL2 guardian + origin + Turnstile + separately flagged provider gate |
| POST | `/api/identity/v1/guardian-sponsored-account/claim` | canonical existing under-13 account + origin + Turnstile + one-time claim secret |
| GET | `/api/identity/v1/guardian/content-approvals` | AAL2 guardian; relationship-scoped queue |
| POST | `/api/identity/v1/guardian/content-approvals/request` | dependent actor + origin; exact target approval request |
| POST | `/api/identity/v1/guardian/content-approvals/decide` | AAL2 guardian + origin; relationship-scoped decision |
| GET | `/api/identity/v1/guardian/dependents/status` | AAL2 guardian; handle-scoped coarse authorization status |
| POST | `/api/identity/v1/guardian/dependents/profile` | AAL2 guardian + origin; scoped public-profile control |
| GET/POST | `/api/identity/v1/guardian/dependents/lifecycle[/status]` | AAL2 guardian + origin on mutation; handle-scoped lifecycle control |
| POST | `/api/identity/v1/guardian/relationships/revoke` | verified relationship party + exact origin + audit |
| POST | `/api/identity/v1/guardian/consents/revoke` | verified relationship party + exact origin + audit |
| POST | `/api/identity/v1/providers/age-assurance/callback` | signed age-provider callback; replay-safe adapter normalization only |
| POST | `/api/identity/v1/providers/guardian/callback` | signed guardian-provider callback; replay-safe adapter normalization only |
| POST | `/api/identity/v1/providers/guardian-sponsored-account/callback` | signed sponsorship callback; replay-safe adapter normalization only |
| POST | `/api/identity/v1/staff/lifecycle/*` | fresh TOTP AAL2 scoped operator; 15-minute read/work window, 5-minute transitions/cleanup/Auth deletion |
| POST | `/api/identity/v1/staff/legal/documents/register` | fresh TOTP AAL2 scoped legal operator + exact content hash; activation uses 5-minute window |
| POST | `/api/identity/v1/staff/restrictions/impose` | verified staff + TOTP within 5 minutes + capability RPC |
| POST | `/api/identity/v1/staff/restrictions/lift` | verified staff + TOTP within 5 minutes + capability RPC |

All request bodies have bounded size and exact keys. Mutation origins are an
exact allowlist. Logs reconstruct only event name, outcome, normalized route,
and UUID correlation ID; they exclude tokens, bodies, emails, profile data,
provider payloads, and caught errors. Errors are stable codes with no upstream
details. Privileged database calls carry the verified actor UUID and AAL into a
narrow atomic RPC that checks capability and records immutable audit.

The Identity Worker validates the bearer with Supabase before reading its signed
AMR claim. Privileged freshness accepts only a detailed `totp` entry with an
integer, non-future timestamp. Staff work expires after 15 minutes and destructive
state transitions after five; rotating or refreshing an access token does not
reset either window. Guardian-sponsored account creation/claim, approval of child
content, enabling a dependent public profile, and requesting dependent deletion
also use the five-minute step-up. Privacy-preserving refusal/profile disable,
relationship or consent revocation, and ordinary user deletion requests remain
available without a new MFA step-up: those paths either reduce exposure or begin
a cancellable, cooled, operator-governed lifecycle rather than deleting immediately.
The final staff cleanup and Auth deletion still require the five-minute window.

Turnstile validation is server-side and checks success, exact action, exact
hostname, timestamp freshness, token bounds, and an idempotency UUID. Cloudflare
enforces single use and the five-minute lifetime. A successful widget render is
never treated as authorization.

Provider redirects are also server-enforced. Every concrete age or guardian
adapter must publish a non-empty, code-reviewed list of exact HTTPS origins.
The Worker rejects HTTP, credentials in URLs, ports, unlisted hosts, lookalike
subdomains, and parent-domain suffix tricks before it records a provider
transaction or returns a redirect to the browser. Redirect origins are not an
operator-supplied environment string: adding or changing one requires the same
reviewed code change as the concrete adapter. Disabled adapters expose no
redirect origins and remain unable to start a transaction.

Under-13 sponsorship has an additional data boundary. The raw normalized
dependent contact is given only to the reviewed provider adapter and is never
stored, logged, returned, or placed in audit metadata. The canonical database
receives an HMAC-SHA-256 contact digest generated with an Identity-only secret.
The returned claim value is one-time, bounded, and stored only as a SHA-256
digest; claiming attaches a provider-approved sponsorship to an already-created
canonical Supabase account and never creates a second account system. The
sponsorship, content-approval, and dependent-control route groups each have an
independent default-off flag in addition to the global under-13 gate.

## Lifecycle provider boundary

Account lifecycle orchestration remains in the private Identity Worker, but
each irreversible side effect has its own explicit provider contract and
default-off activation flag:

- account exports use the Identity-only `COMMUNITY_EXPORTS` binding backed by
  the private `elysia-community-account-exports` R2 bucket, exact owner-authenticated
  streaming, SHA-256 integrity, create-only object keys, and database-owned
  expiry state. R2 encrypts objects and metadata at rest with managed
  AES-256-GCM; the bucket has no public URL;
- export expiry uses dedicated shared lifecycle work. Identity never claims the
  Artisan media-retention queue and receives neither Artisan media nor the
  separately protected evidence bucket;
- account-owned object cleanup is delegated through a bounded hold-aware
  adapter. The Identity orchestration surface receives only an object count and
  evidence hash, never arbitrary private object keys from a browser;
- Auth deletion calls the Supabase admin API with soft deletion mandatory,
  verifies that the provider response identifies the database-selected target,
  and records hash-only request, confirmation, and provider-receipt evidence;
- the built-in notification adapter completes only the already-created
  owner-scoped in-app record. A second, explicitly selected
  `cloudflare-email-service-v1` adapter resolves the confirmed recipient only
  inside the Identity Worker, uses the restricted `IDENTITY_EMAIL` binding,
  emits escaped transactional text and HTML, and records only hash evidence.
  It remains off unless the sender domain, binding, notification preferences,
  and exact provider configuration are all active; the account email never
  enters the browser, outbox payload, log, or audit metadata.

Manual evidence remains a reviewed recovery path, not a substitute for these
adapters. Hosted execution stays disabled until the dedicated bindings,
scheduled trigger, lifecycle database contract, legal-hold behavior, provider
credentials, retention policy, and destructive-operation runbook are verified.

## Participation and guardian rules

Auth identity, profile publication, membership, legal acceptance, assurance,
guardian consent, restrictions, and content moderation are separate states.
Every database mutation re-evaluates effective state. UI guards explain denial
but do not authorize it.

| Actor/state | Browse | Public card | Comment/upload/challenge | Guardian controls | Staff action |
| --- | --- | --- | --- | --- | --- |
| Anonymous | approved public only | published safe cards | no | no | no |
| Unverified account | public + own account | conservative/off | no | request only | no |
| Eligible adult beta member | approved + owner drafts | explicit publication | enabled scope, premoderated | own relationships only | no |
| Teen, feature off | public only | conservative/off | no | status/request only | no |
| Teen, feature on + required consent | approved + owner drafts | pseudonymous/minimal | only consented scopes, premoderated | linked consent status | no |
| Under 13, feature off | non-personalized public only | no | no | architecture only | no |
| Guardian | normal own access | own card rules | own participation only | scopes/status/revoke; never dependent drafts/reports | no |
| Restricted/suspended/deletion pending | restriction-specific | may be suppressed | denied by applicable scope | safety/lifecycle paths only | no |
| Scoped staff with AAL2 | public + assigned queues | safe card | assigned capability only | minimum necessary | narrow audited capability only |
| Service Worker | no general browsing identity | RPC contract | actor-explicit RPC only | provider result only | no implicit super-admin path |

`guardian_reviewer` is an administrative review role and is never treated as a
parent or legal guardian. Guardian consent is relationship-verified,
scope-specific, versioned, expiring/revocable, and audited. A guardian does not
automatically receive access to a dependent's drafts, reports, credentials,
uploads, or moderation evidence.

## Activation states

Repository defaults are fail-closed:

- adult closed beta: off until invite, moderation, hosted schema, and incident
  readiness are verified;
- teen participation: off until counsel, geography, age/guardian provider,
  trained staffing, notices, incident handling, and launch approval are real;
- under-13 participation: off until the separately reviewed child-product and
  verifiable parental-consent requirements are complete;
- provider adapters: disabled until a named vendor contract, credentials,
  webhook contract, exact redirect origins, data-retention review, and
  production test plan exist.

Feature flags cannot override missing legal versions, ineffective consent,
expired assurance, restrictions, disabled capabilities, or database RLS.
