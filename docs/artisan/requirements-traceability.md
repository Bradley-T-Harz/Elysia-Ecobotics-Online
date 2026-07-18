# Elysia Artisan Collective requirements traceability

Updated: 2026-07-18

This is the cross-repository implementation ledger for the Elysia Artisan
Collective program. Elysia Ecobotics Online owns this document because it also
owns the canonical shared Supabase migration chain. The Artisan repository may
link to this ledger but must not create a competing database history.

Status vocabulary:

- `pending`: implementation or verification remains.
- `implemented`: repository evidence exists and its focused checks pass.
- `flagged`: the complete technical path exists but activation is fail-closed.
- `external`: a credentialed, legal, vendor, staffing, or dashboard action is
  intentionally outside repository completion.
- `verified`: final cross-project verification has passed.

## Constitutional boundaries

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| GOV-001 | Canonical name is Elysia Artisan Collective. | implemented | Online portal and Artisan metadata/navigation. |
| GOV-002 | Online remains the professional public institution. | implemented | Additive portal only; final full Online regression remains. |
| GOV-003 | Artisan is a separate sibling repository at the exact requested path. | implemented | Separate `.git` on `main`; Release 1 root commit `e9b32c9`. |
| GOV-004 | Online is the only owner of the canonical Supabase migration chain. | pending | Online migrations plus Artisan `supabase/README.md`. |
| GOV-005 | One `auth.users` identity, one Commons Profile, one canonical public profile URL. | pending | Shared contracts, RLS, callback tests. |
| GOV-006 | Artisan has no signup or second profile editor/database. | pending | Join/auth UI and Auth integration tests. |
| GOV-007 | Private local Elysia memory, conversations, files, logs, vaults, credentials, prompts, runtime, machine data, processes, and sockets never cross the boundary. | implemented | `docs/security/artisan-trust-boundary.md`; final scans remain. |
| GOV-008 | Artists retain ownership; ordinary posting grants a narrow operational license only. | pending | Versioned legal manifest, artwork license model, legal pages. |
| GOV-009 | No automatic AI-training, merchandise, resale, exclusivity, unrelated advertising, or unrestricted sublicensing rights. | pending | Legal manifest/content-integrity tests. |
| GOV-010 | Human, AI-assisted, AI-directed, hybrid, procedural, and generative work is allowed with honest disclosure. | pending | Artwork constraints, UI, challenge rules, tests. |
| GOV-011 | No raw user HTML, CSS, JavaScript, arbitrary iframes, tracking pixels, arbitrary embeds, or executable uploads. | pending | Validators, CSP, API/RLS checks, security tests. |
| GOV-012 | No direct messages, explicit-media room system, engagement ranking, ads, or behavioral tracking. | pending | Schema/route/static scans and product tests. |
| GOV-013 | No public originals; only processed, approved derivatives may be delivered. | pending | Storage policy, media state machine, Worker tests. |
| GOV-014 | Service-role secrets never enter browser code; frontend state is never the authorization boundary. | pending | Worker isolation, bundle and secret scans. |
| GOV-015 | Privileged actions are scoped, atomic, idempotent where applicable, audited, and tested. | pending | RPCs, capability checks, immutable audit tests. |
| GOV-016 | Every public artwork preserves credit, profile linkage, license, method disclosure, and accessibility description. | pending | Database constraints, projections, gallery tests. |
| GOV-017 | Initial URL is `https://elysiaartisancollective.pages.dev`; future URL is `https://artisans.elysiaecobotics.com`; URLs are centralized. | implemented | `src/config/siteUrls.ts`, portal and Artisan static tests. |
| GOV-018 | Commons account destination is exactly `https://elysiaecobotics.com/commons-circle`. | implemented | Central URL modules and Join/portal tests. |

## Project 1 — Elysia Ecobotics Online portal

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| P1-001 | Add `/artisan-collective` using the native Online shell and visual system. | implemented | Portal page, native shell/styles, route and build. |
| P1-002 | Place Artisan Collective between Commons Circle and Story on desktop, mobile, footer, route indexes, and tests. | implemented | `SiteNav.tsx`, `SiteFooter.tsx`, sitemap and smoke tests. |
| P1-003 | Portal contains purpose, one-account/profile explanation, artist-rights statement, and explicit private-Elysia boundary. | implemented | `artisanPortalSmokeTest.mjs`. |
| P1-004 | Primary action resolves through centralized configuration to the initial/future Artisan URL. | implemented | `src/config/siteUrls.ts`; exact allowlist test. |
| P1-005 | Add title, description, canonical, and social metadata. | implemented | route helper plus direct clean-URL HTML entry. |
| P1-006 | Add/update sitemap, robots, redirects, and security headers without breaking Functions. | implemented | Pages assets; portal/security checks. |
| P1-007 | Preserve every existing Online route, feature, account flow, billing surface, Marketplace, Commune, Forge, sandbox, admin, and responsive behavior. | pending | Full `test:all`, typecheck, build, route inventory. |

## Project 2 — shared public identity and governance

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| P2-001 | Minimal database-enforced public profile-card contract; Artisan never reads `profiles` directly. | pending | Projection/RPC, grant and anonymous-query tests. |
| P2-002 | Full profile rows remain owner/staff-only and broad public reads are retired through a compatibility-safe sequence. | pending | Migration, Online read adaptations, RLS tests. |
| P2-003 | Public profile publication is explicit; minors have conservative defaults. | pending | Profile/publication fields and predicates. |
| P2-004 | Handle history provides canonical redirects and prevents impersonating reuse. | pending | History/tombstone schema, RPC tests. |
| P2-005 | Shared participation state distinguishes self-attested, estimated, verified, guardian-verified, unverified, and expired assurance. | pending | Protected tables and current-user summary. |
| P2-006 | Age evidence is minimized; provider evidence remains external where possible. | pending | Provider adapter and schema constraints. |
| P2-007 | Exact, content-hashed, versioned shared terms and scope acceptances are append-only. | pending | Legal manifest, acceptance RPC, integrity tests. |
| P2-008 | Shared restrictions are scoped; severe safety actions may cross sites while ordinary Artisan sanctions remain local. | pending | Restriction scopes, predicates, actor matrix. |
| P2-009 | Staff capabilities are narrow and independent for forum, media, challenges, reports, cases, appeals, credits, copyright, child safety, audit, and system view. | pending | Capability assignments and AAL2 checks. |
| P2-010 | General export/deletion/anonymization coordinates Auth, profile, content attribution, licenses, moderation evidence, legal holds, and handle tombstones. | pending | Lifecycle requests, RPC/Worker and retention tests. |
| P2-011 | Shared guardian relationships and consent are verified, scoped, versioned, revocable, audited, and never confused with `guardian_reviewer`. | pending | Protected schema, provider interface, revocation tests. |
| P2-012 | Browser eligibility is a safe projection only; raw age/guardian evidence stays protected. | pending | RPC contracts and grants. |
| P2-013 | Existing-account email/password and OTP/magic-link sign-in works on Artisan; OTP uses `shouldCreateUser:false`. | pending | Auth client and integration tests. |
| P2-014 | PKCE callback establishes only an origin-local session; no cookies/localStorage/tokens cross origins or appear in URLs. | pending | Callback code and leakage tests. |
| P2-015 | Auth redirect destinations and return paths are exact allowlists. | pending | Config examples, hosted runbook, redirect tests. |
| P2-016 | Identity and Artisan privileged APIs use isolated Workers/service bindings with exact-origin mutations, bounded input, fail-closed config, Turnstile, and structured safe logs. | pending | Worker sources/config/tests. |
| P2-017 | Turnstile validates server-side, including hostname/action, single-use/expiry handling, and no browser secret. | pending | Adapter unit tests; production widget is external. |
| P2-018 | Generated database types/contracts are consumed by both applications without a second migration chain. | pending | Generated/checked-in contract types. |

## Project 3 / Release 1 — two-site public foundation

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| R1-001 | Separate React/TypeScript/Vite/Cloudflare application and Git repository. | implemented | Exact sibling path, root commit `e9b32c9`, passing build. |
| R1-002 | Seven complete primary routes and distinct visual worlds: Cosmic Foyer, Infinite Corkboard, Cabinet, Museum, Gate, Cave Wall, Small Print. | implemented | Seven page-specific TSX/CSS worlds and Release 1 contract test. |
| R1-003 | Pages do not collapse into seven variants of one card layout. | implemented | Distinct cosmic/corkboard/cabinet/museum/gate/cave/zine compositions. |
| R1-004 | Shared invisible navigation, footer, account state, errors, report path, and accessibility shell. | implemented | Shared shell, error boundary, routes; authenticated state added in later release. |
| R1-005 | Static forum rooms/post details, challenges/details, winners, artwork details, and full archive are complete. | implemented | Six rooms, three challenges, four winners, twelve archive works. |
| R1-006 | Metadata, canonical/social tags, sitemap, robots, headers, redirects, real 404, and Pages route config exist. | implemented | Public config and `release1SmokeTest.mjs`. |
| R1-007 | Keyboard, mobile, semantic landmarks, focus management, screen-reader labels, reduced motion, and Calm the Weirdness work. | implemented | Shared a11y shell/CSS; final browser/axe verification remains under V-002. |
| R1-008 | Decorative motion is pausable, non-flashing, no autoplay media, and remains expressive when calm. | implemented | motion/calm CSS and static policy tests. |
| R1-009 | Pages build/deploy configuration is valid for `dist`; production/preview boundaries are documented. | implemented | `npm run verify`, Pages config and README/runbook; deployment remains external. |
| R1-010 | Deployment occurs only with authenticated access and verified project ownership. | external | Cloudflare project/domain credentials. |

## Release 2 — account-linked adult closed beta

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| R2-001 | Existing-account-only sign-in, membership bootstrap, invite control, and 18+ participation control. | pending | Auth/membership UI, flags, tests. |
| R2-002 | Public profile cards and avatars link to canonical Commons Profiles and are never copied into a second editor. | pending | Profile feature and tests. |
| R2-003 | Image-only artwork/posts with constrained artist-created room themes; no arbitrary code. | pending | Artwork/forum models, UI, validation. |
| R2-004 | Comments, limited replies, mentions, locks, slow mode, blocks, reports, and edit history work. | pending | Schema/RPC/UI/actor tests. |
| R2-005 | Appreciation exists without engagement ranking or leaderboards. | pending | Schema/UI/static tests. |
| R2-006 | Image-only challenges, versioned rules, atomic eligibility/submission, judging, winner agreement, awards, winners, and all-entry gallery work. | pending | Schema/RPC/UI/integration tests. |
| R2-007 | Uploads enter private quarantine via bounded permit; extension is never trusted. | pending | Worker/storage policy/security tests. |
| R2-008 | JPEG/PNG/WebP are decoded, dimension/pixel/size checked, metadata stripped, canonically re-encoded, thumbnailed, and premoderated. | pending | Images binding adapter/queue tests. |
| R2-009 | Only approved derivatives publish; rejected/abandoned originals follow retention. | pending | Media state/RLS/retention tests. |
| R2-010 | Admin dashboard supports challenge, submission, media, forum, report, case, appeal, user restriction, credit, copyright, child-safety, terms, audit, and system work. | pending | Admin routes/capability tests. |
| R2-011 | Reports, cases, independent appeals, credit corrections, takedowns, legal holds, and immutable audit are complete. | pending | Schema/RPC/UI/tests. |
| R2-012 | Terms, privacy, guidelines, artist rights, challenge rules, AI/authorship, moderation/appeals, copyright/DMCA, accessibility, and retention surfaces exist and are marked draft where counsel approval is absent. | pending | Legal routes/content tests. |
| R2-013 | No money, prizes, commissions, direct contact, or automatic public self-publication is enabled. | pending | Flags/static/schema tests. |

## Release 3 — teen participation, activation fail-closed

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| R3-001 | Server-enforced adult/teen/unverified/restricted/expired/deletion states for every action. | pending | Permission matrix, Worker/RLS tests. |
| R3-002 | Teen public profiles are pseudonymous/minimal by default with no exact age, school, precise location, direct contact, or unreviewed external links. | pending | Profile projection constraints/tests. |
| R3-003 | Guardian relationships, scoped consent, approval, revocation, notices, and dispute history work where policy requires. | pending | Guardian APIs/UI/tests. |
| R3-004 | Terms-version changes force correct reacceptance without broad account lockout. | pending | Acceptance state/RPC tests. |
| R3-005 | Notification controls, reporting priority, cross-site restriction propagation, export, and deletion work for teens. | pending | UI/RPC/Worker tests. |
| R3-006 | Every user/guardian/staff state has direct RLS and Worker actor-matrix coverage. | pending | SQL and TypeScript matrices. |
| R3-007 | Teen activation defaults off until legal review, provider readiness, trained staffing, incident processes, and launch approval exist. | flagged | `ARTISAN_TEEN_ENABLED=false`; external gate. |

## Release 4 — multimedia and younger-participant architecture

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| R4-001 | Typed registry covers static image, audio, short video, document, animation, 3D, and constrained interactive media. | pending | Adapter registry and tests. |
| R4-002 | Every adapter declares allowlist, limits, validator, sanitizer, previewer, accessibility requirements, moderation, retention, and enabled state. | pending | Registry contract tests. |
| R4-003 | Audio handles duration, size, metadata, waveform/preview, transcript/description, loudness, and no autoplay. | pending | Adapter/UI/tests; activation flagged. |
| R4-004 | Video handles codecs, duration/resolution, transcoding, poster/frame, captions/transcript, flash review, and no autoplay. | pending | Media binding adapter/tests; activation flagged. |
| R4-005 | Documents reject script/active content, sanitize metadata, impose page/size limits, and produce safe previews. | pending | Adapter/tests; activation flagged. |
| R4-006 | Animation has frame/duration/flash limits and a still preview. | pending | Adapter/tests; activation flagged. |
| R4-007 | 3D enforces supported formats, polygon/texture/resource limits, safe viewer, no scripts/network, thumbnail, and text alternative. | pending | Adapter/sandbox/UI/tests; activation flagged. |
| R4-008 | Interactive works use a declarative or isolated reviewed package with no arbitrary iframe/network/storage/credential access. | pending | Manifest validator/sandbox policy/tests; activation flagged. |
| R4-009 | Storage provider abstraction supports Supabase private Storage and future private R2 without changing product modules. | pending | Providers and contract tests. |
| R4-010 | Processing is idempotent and queue-oriented with retries, DLQ/runbook, state history, and retention. | pending | Worker queue handler/config/tests. |
| R4-011 | Under-13 architecture has guardian-sponsored accounts/consent provider interface, direct notice, scoped approvals, revocation, dashboard, access/delete controls, minimal collection, and audit trail. | pending | Protected schema, providers, UI, tests. |
| R4-012 | Under-13 activation defaults off until verified consent provider, legal review, geography, staffing, and incident-response gates pass. | flagged | `ARTISAN_UNDER_13_ENABLED=false`; external gate. |

## Final verification and external activation

| ID | Requirement | Status | Evidence / gate |
| --- | --- | --- | --- |
| V-001 | Focused tests run after each meaningful slice, followed by broader regressions. | pending | Command log in final report. |
| V-002 | Online and Artisan typecheck, unit/integration/security/accessibility/browser suites, and production builds pass. | pending | CI/local command evidence. |
| V-003 | Migration filenames/order, transaction boundaries, grants, function ACLs, storage policies, and actor matrices pass. | pending | Migration/SQL tests. |
| V-004 | Auth callbacks, redirect allowlists, profile privacy, token leakage, CSP/CORS/headers, and secret boundaries pass. | pending | Security tests/runbook. |
| V-005 | Quarantine, processing, publication, forum, comments, challenges, judging, galleries, reports, moderation, appeals, admin, export, and deletion pass end to end. | pending | Integration/E2E evidence. |
| V-006 | Every attachment is re-read for the final gap audit and every discrepancy is fixed or identified as a genuine external gate. | pending | Final audit record. |
| V-007 | Hosted Supabase state is inventoried before any remote migration; no hosted state is guessed. | external | Catalog-only credentials and approval. |
| V-008 | Cloudflare Pages/Workers/Queues/Images/R2/Turnstile/domain settings are deployed and verified only in the authenticated intended account. | external | Cloudflare access and production approval. |
| V-009 | Counsel approves final terms, age/geography, guardian consent, artist rights, challenge rules, DMCA, privacy, and retention. | external | Legal sign-off. |
| V-010 | Named trained moderation, appeals, copyright, child-safety, security, outage, and restore owners exist before relevant activation. | external | Staffing/operations sign-off. |
| V-011 | DMCA agent registration, child-safety reporting process, SMTP, providers, backups, WAF/rate limits, monitoring, and alerts are completed manually. | external | Provider/dashboard/government actions. |
| V-012 | Every repository is clean and commits are logical; no private local Elysia path or data enters either public repository. | pending | Final Git status and scans. |
