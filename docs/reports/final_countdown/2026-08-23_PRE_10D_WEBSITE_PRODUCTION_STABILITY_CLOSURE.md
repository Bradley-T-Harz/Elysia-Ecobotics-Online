# Pre-10D Website Production Stability Closure

Date: 2026-08-23

Repository: `Elysia-Ecobotics-Online` (private source authority)

Scope: Website stability only; Pass 10D did not begin
Current status: canonical browser/route/cache repair green; live authenticated sandbox acceptance and governed synthetic-account cleanup remain mandatory before the completion verdict

## 1. Starting state

- Branch: `main`
- Reviewed starting HEAD: `63c5017a63f9d6afa2493ad69fc77d2d69973833`
- Starting remote alignment: `main == online/main`
- Starting tree: clean
- Established source remote visibility: private
- Starting canonical Pages deployment: `ef059faa-546d-46a6-ae66-bfc915bcd9ac`
- Starting canonical deployment source: `63c5017a63f9d6afa2493ad69fc77d2d69973833`
- Canonical domain: `https://elysiaecobotics.com`
- Elysia, Codev, Artisan, and other adjacent repositories were not modified.

The baseline `npm run test:all` passed every established source and built-artifact test after the browser tests were given their required loopback listener permission. That green result existed at the same time that canonical production was visibly blank. This is retained as direct evidence that source-test success alone was insufficient.

## 2. Production failure reproduced

Canonical `index.html` matched the fresh verified local build byte-for-byte, but every requested canonical `/assets/*.js` and `/assets/*.css` response returned:

- HTTP `200`;
- `Content-Type: text/plain; charset=utf-8`;
- the 24-byte `asset-not-found.txt` body.

The React root consequently remained empty. Archive, Legal, and every other React route were affected by the same deployment-boundary failure even though their source components and lazy chunks were present and locally renderable.

The starting rule was:

```text
/assets/* /asset-not-found.txt 200
/* /index.html 200
```

Cloudflare Pages follows `_redirects` rules whether or not the source asset exists. The `/assets/*` rule therefore intercepted valid hashed assets, not just missing ones. The previous corrective commit had changed an unsupported 404 rewrite into a supported 200 rewrite, but that made the fallback syntactically accepted while still semantically destructive.

The first repaired deployment exposed a second layer of the same production incident. Shared chunks whose content hashes had not changed retained their old URLs, and the earlier bad 24-byte fallback responses had been cached under those URLs with the site's one-year immutable asset policy. Canonical HTML and the newly changed main bundle were current, but seven unchanged preload chunks still returned the cached `text/plain` fallback. Local Pages could not reproduce an already-poisoned edge/browser cache generation. The repaired build therefore places every JavaScript entry and shared chunk in the explicit `safe-assets-v1` namespace. This is a permanent boundary from the historically poisoned URL generation; content hashes continue to govern changes inside the safe namespace.

Primary platform references used during diagnosis:

- <https://developers.cloudflare.com/pages/configuration/redirects/>
- <https://developers.cloudflare.com/pages/configuration/serving-pages/>
- <https://developers.cloudflare.com/pages/functions/routing/>

## 3. Repair

The repair preserves the existing Pages Functions security boundary and does not widen invocation to ordinary documents:

1. The global `/assets/*` rewrite was removed.
2. The global SPA catch-all was removed so missing static files can no longer receive executable-looking SPA HTML.
3. The current router was compressed into 44 accepted route-specific Pages rules (including the two established canonical 301 redirects).
4. Established SPA routes rewrite internally to `/` with status 200.
5. `artisan-collective.html` remains a direct static clean-URL document and is not intercepted.
6. A standalone, styled, script-free top-level `404.html` now gives unknown pages and missing assets a truthful HTTP 404 boundary.
7. Pages Function invocation remains restricted to the established sandbox, identity, and safe public profile-media proxy namespaces. Billing continues to belong to its separate Worker boundary.
8. Route, Artisan, and Commune regression tests now reject a global SPA catch-all or any `/assets/` redirect and verify explicit current-route coverage.
9. Reusable Playwright and native WebDriver BiDi visual-audit harnesses now inspect hydration, visible geometry, overflow, console errors, failed requests, failed static resources, history navigation, and screenshots.
10. Vite entry and shared-chunk filenames use the `safe-assets-v1` namespace, and the production Auth/profile artifact gates require that namespace.

The real local Wrangler Pages runtime accepted all 44 redirect rules without warnings. Its serving-boundary proof was:

| Request | Result |
|---|---|
| current hashed JavaScript | `200 application/javascript` |
| current hashed CSS | `200 text/css` |
| synthetic stale JavaScript chunk | `404 text/html`, standalone 404 document, `no-store` |
| `/archive` | `200 text/html`, application shell |
| `/legal` | `200 text/html`, application shell |
| `/commune/coding-cornucopia/sandbox-request` | `200 text/html`, application shell |
| unknown unregistered path | `404 text/html`, standalone 404 document, `no-store` |

The established CSP, HSTS, `nosniff`, frame denial, referrer policy, permissions policy, and immutable caching on valid hashed assets remained intact.

## 4. Complete route inventory

Executable router truth remains `src/App.tsx`. The preservation contract contains 133 router declarations and produces 154 unique smoke paths. The full local Pages and four-browser canonical visual audits visited all 154 and classified all 154 as `PASS` after distinguishing expected anonymous/auth-required states from static-resource failures. Thus every path in the grouped inventory below has the same final visual classification in Chromium, Brave, Firefox, and LibreWolf: `PASS`; restricted entry points rendered their truthful `AUTH-EXPECTED` state inside that visual pass rather than leaking or redirecting away the protected surface.

Complete inventory, grouped without omitting aliases or restricted entry surfaces:

- Root and public product surfaces: `/`, `/archive`, `/products`, `/lab`, `/story`, `/about`, `/mission`, `/work-with-elysia-ecobotics`, `/support`, `/support/thank-you`.
- Marketplace canonical surfaces: `/marketplace`, `/marketplace/browse`, `/marketplace/addons/:id`, `/marketplace/action-preview`, `/marketplace/account`, `/marketplace/submit`, `/marketplace/trust`, `/marketplace/manifest-api`, `/marketplace/admin`.
- Marketplace compatibility surfaces: `/browse`, `/addons/:id`, `/action-preview`, `/account`, `/submit`, `/trust`, `/manifest-api`.
- Developer Forge: `/developer-forge`, `/developer-forge/profile`, `/developer-forge/dashboard`, `/developer-forge/drafts`, `/developer-forge/drafts/new`, `/developer-forge/drafts/:id`, and the `manifest`, `permissions`, `package`, `validate`, `preview`, and `submit` draft tabs; `/developer-forge/submissions`, `/developer-forge/submissions/:id`; `/developer-forge/docs` and its `workbench`, `manifest`, `permissions`, `security`, `templates`, and `compatibility` pages.
- Living Library: `/living-library`, `/living-library/browse/:categorySlug`, `/living-library/source/:sourceId`.
- Commune core: `/commune`, `/commune/rooms`, `/commune/rooms/:roomSlug`, `/commune/rooms/:roomSlug/new`, `/commune/rooms/:roomSlug/posts`, `/commune/posts/:postId`, `/commune/new`, `/commune/realtime`, `/commune/moderation`.
- Commune specialized and compatibility surfaces: `/commune/repository-showcase`, `/commune/repository-showcase/new`, `/commune/repository-showcase/sandbox-request`, `/commune/elysia-iteration-showcase/sandbox-request`, `/commune/troubleshooting`, `/commune/troubleshooting-grove/review`, `/commune/troubleshooting-grove/sandbox-request`, `/commune/sandbox-review`, `/commune/coding-cornucopia/review`, `/commune/coding-cornucopia/sandbox-request`, `/commune/code-sharing/review`, `/commune/code-sharing/sandbox-request`, `/commune/:roomSlug`, `/commune/:roomSlug/new`.
- Account lifecycle: `/account/forgot-password`, `/account/recovery`, `/account/export`, `/account/delete`.
- Commons Circle core: `/commons-circle`, `/commons-circle/onboarding`, `/commons-circle/setup/profile`, `/commons-circle/setup/stewardship`, `/commons-circle/setup/work-with`, `/commons-circle/setup/confirm`, `/commons-circle/:publicHandle`, `/commons/:publicHandle`.
- Commons Circle private/account surfaces: `/commons-circle/admin-console`, `/commons-circle/admin-communications`, `/commons-circle/admin/messaging-access`, `/commons-circle/saved-shelves`, `/commons-circle/inbox`, `/commons-circle/notifications`, `/commons-circle/requests-reviews`, `/commons-circle/support-billing`.
- Signals: `/commons-circle/signals`, `/commons-circle/signals/inbox`, `/commons-circle/signals/inbox/new`, `/commons-circle/signals/inbox/settings`, `/commons-circle/signals/inbox/conversations/:conversationId`, `/commons-circle/signals/notifications`, `/commons-circle/signals/requests-reviews`, `/commons-circle/signals/coding-proposals`, `/commons-circle/signals/troubleshooting`, `/commons-circle/signals/research-notes`, `/commons-circle/signals/repository-showcases`, `/commons-circle/signals/iteration-showcases`, `/commons-circle/signals/job-posts`, `/commons-circle/signals/voting-room`, `/commons-circle/signals/official-updates`, `/commons-circle/signals/sandbox-reviews`, `/commons-circle/signals/work-with`, `/commons-circle/signals/marketplace-forge`, `/commons-circle/signals/circle`.
- Artisan bridge: `/artisan-collective` (direct static document and approved external bridge behavior preserved).
- Legal index and policies: `/legal`, plus Privacy, Terms of Use, Community Guidelines, Marketplace Developer Agreement, Add-on Submission, Security Review, Vulnerability Disclosure, DMCA/Copyright, Acceptable Use, Code of Conduct, Volunteer/Contributor Disclaimer, Donation Recognition, Trademark, Support and Billing, Refund and Cancellation, Sandbox Credit, Job Post Fee, Marketplace Commerce, Organization Services, Sponsorship Independence, Account Closure Financial Retention, and Living Library Third-Party Resources under `/legal/*`.
- Administration: `/admin`, `/admin/moderation`, `/admin/reports`, `/admin/addon-submissions`, `/admin/developers`, `/admin/library-sources`, `/admin/work-submissions`, `/admin/review`, each review domain (`work-with`, `stewardship`, `commune`, `living-library`, `marketplace`, `broken-links`), `/admin/roles`, `/admin/badges`, `/admin/audit`, `/admin/economic-operations`.
- Legacy canonical redirects: `/community-guidelines` to `/legal/community-guidelines`; `/work-with` to `/work-with-elysia-ecobotics`.
- Unknown/unregistered direct entries: truthful standalone 404; in-application wildcard navigation behavior remains owned by React Router.

Dynamic placeholders were materialized only with synthetic route-safe fixture values. Restricted and record-dependent routes were accepted when they rendered their truthful anonymous/auth-required/not-found state; no administrator or private content was assumed.

## 5. Canonical browser and visual proof

All browser sessions used fresh disposable profiles/contexts and synthetic or anonymous state.

| Browser | Version | Canonical production proof | Result |
|---|---:|---|---|
| Chromium | 149.0.7827.55 | 154-route desktop inventory; 9 critical routes × 1440×900, 1280×800, 768×1024, 390×844; headed Xvfb critical set | PASS |
| Brave (installed binary) | 151.0.7922.137 | 154-route desktop inventory; 9 critical routes × all four viewports; headed Xvfb critical set | PASS |
| Playwright Firefox | 151.0 | 154-route desktop inventory; 9 critical routes × all four viewports; headed Xvfb critical set | PASS |
| LibreWolf (installed binary, native WebDriver BiDi) | 154.0-2 | 154-route desktop inventory; 9 critical routes at desktop/mobile; headed Xvfb critical set; normal reload, native Ctrl+Shift+R, back/forward | PASS |

The nine cross-browser critical routes were Home, Archive, Legal, Commune, Coding Workbench entry, Developer Forge, Marketplace, Living Library, and Admin. Each audit required hydrated non-loading content, a nonempty visible React root, no horizontal overflow, no page exception, no fatal application console error, no failed JavaScript/CSS asset, and working Archive ↔ Legal back/forward navigation. The complete production result was 154/154 routes in each of all four browser families, with zero failed JavaScript/CSS assets and zero remaining fatal application errors.

The host's `/usr/bin/firefox` is a launcher for a Firefox Snap that is not installed. No package was installed merely to manufacture a test result. The current Playwright Firefox engine therefore supplies the Firefox 151 matrix; installed LibreWolf 154.0-2 supplies the native installed Gecko-family proof through its real binary and a fresh disposable profile. This distinction is retained so the report does not falsely claim a host Firefox installation that does not exist.

Selected fresh headed canonical-production screenshot hashes:

- Chromium Home desktop: `5492864f8d58bb33504172977aa003bffc2f8f9b0e41c9ee6caea607dc8bb4a4`
- Brave Legal desktop: `b370005a8e6b16e16acc60f66f49b9ecbb3b9ae958f817b109b48a00588d3ca3`
- Firefox Archive desktop: `e3bb9791c8e1310979aaaf8b7f69d1402aa1f6b9ccbc2a3c468f5254fbc36b0f`
- LibreWolf Coding Workbench desktop: `631aeaf65bfc8a00828642f39f75899bb115d42e04feae734a687a8c518cc0f3`

The initial native LibreWolf CLI screenshot was deliberately rejected because it captured the loading shell before React hydration. Native WebDriver BiDi was then used to wait for the complete load, inspect DOM/console/network state, and capture the hydrated page. The final native audit also crosses through an inert document between routes so canceled resources from an outgoing page cannot be misattributed to the next route. This prevents screenshot and navigation races from becoming false evidence.

## 6. Console and network findings

- No canonical audit encountered a failed JavaScript or CSS asset after the repair. Every entry asset had correct MIME, `nosniff`, immutable caching, and byte identity with the verified production artifact.
- Cloudflare automatically injects its optional Web Analytics beacon at the edge. Canonical `index.html` remains byte-identical to local `dist/index.html` and contains no beacon in source. LibreWolf privacy protection blocks that injected third-party beacon, producing four recorded analytics-only CSP/CORS/SRI messages per route. The application root still hydrates, all application assets pass, and Cloudflare's edge analytics are independent of the beacon. These warnings are retained as non-blocking third-party evidence, not hidden as application success.
- Cloudflare Turnstile's challenge frame emits a formatting probe in Chromium/Brave and the equivalent `0` plus invalid-URI DejaVu-font sanitizer messages in Firefox/LibreWolf. Classification is permitted only when the real Turnstile script is present; Elysia-bundle errors are never accepted through that exception. Turnstile challenge HTTP behavior remains recorded separately.
- LibreWolf records Supabase Auth's immediate `Navigator LockManager` acquisition miss while anonymous pages remain hydrated and Auth settles. The authenticated production sandbox/UI gate remains required before final closure, so this message is not being used to waive authenticated proof.
- `/commune/realtime` records Firefox/LibreWolf rejecting Cloudflare's third-party `__cf_bm` bot-management cookie on the Supabase origin. The rendered Commune page, application assets, and session-less client initialization remain intact.
- Anonymous account/conversation routes truthfully produce expected Supabase 401 responses. Marketplace Account can also record the absent same-origin billing-capability route while rendering a truthful non-commerce account surface; the separately governed billing Worker is not being folded into the Pages project during this pass.

The final full-inventory warning totals were 57 Chromium, 53 Brave, 121 Firefox, and 729 LibreWolf events. All were retained in the JSON evidence and fell into the exact third-party/anonymous categories above; there were zero accepted fatal application errors and zero failed JavaScript/CSS assets.

## 7. Commune and sandbox inventory

The current Commune contains ten rooms:

1. Media Garden
2. Troubleshooting Grove
3. Coding Cornucopia (`code-sharing` compatibility retained)
4. Repository Showcase
5. Community Network
6. Job Post
7. Research Notes
8. Elysia Iteration Showcase
9. Community Voting Room
10. Official Updates

Execution-capable or sandbox-review Workbench surfaces exist for Coding Cornucopia, Troubleshooting Grove, Repository Showcase, and Elysia Iteration Showcase. Official Updates explicitly does not expose execution; ordinary media display remains inert. Static/browser contracts passed across all ten rooms at desktop, tablet/half-screen, and mobile widths.

The proxy still distinguishes accepted completion, `policy_blocked` 422, malformed requests, authentication, profile/eligibility denial, rate limits, disabled service, runner unavailability, timeouts, cancellation, and internal failures. The runner retains network denial, read-only root, no capabilities, `no-new-privileges`, non-root execution, PID/CPU/memory/output/time limits, no host/repository/socket mounts, immutable images, and cleanup verification.

Live authenticated production execution remains a hard pre-verdict gate. It will use distinct short-lived synthetic ordinary accounts through normal Auth/profile controls; no operator account, private content, magic role, or bypass is permitted.

The production control-plane inventory is otherwise correct: the canonical Pages deployment is an exact clean `main` deployment, production sandbox execution is enabled, the runner origin is Access-protected, required production values/secrets/service binding exist with the expected types, and preview does not receive the production sandbox secrets. Anonymous canonical health returns the sanitized `authentication_required` response; direct unauthenticated access to the runner origin is denied by Cloudflare Access.

No prior owner-only profile-less or eligible acceptance-token files exist in the disposable test area. Creating new production accounts without an immediate governed deletion authority would violate this pass's cleanup requirement. The final acceptance therefore awaits two distinct short-lived synthetic access tokens supplied only through owner-only files, plus a governed way to remove the synthetic accounts after proof. Credential contents must never enter shell arguments, chat, logs, or this report.

## 8. Automated verification so far

- Starting `npm run test:all`: PASS while canonical production was blank (important negative evidence).
- Route contract: 155 routes/aliases PASS.
- Route preservation: 133 declarations, 154 unique smoke paths PASS.
- Protected surfaces: PASS.
- Security: PASS.
- Commune and sandbox proxy contracts: PASS.
- TypeScript application and Functions typechecks: PASS.
- Vite production build: PASS.
- Public bundle security baseline: PASS (92 artifacts).
- Local real Wrangler Pages serving boundary: PASS after repair.
- Complete 154-path visual inventory: PASS after repair.
- `git diff --check`: PASS.
- Final post-repair `npm run test:all`: PASS after the audit-harness refinements and complete matrix reran from the beginning. This includes all source/security/identity/Marketplace/Developer Forge/Commune/sandbox contracts, TypeScript application and Functions checks, Vite production build, the complete established browser suite, and a 93-file public-bundle scan with no source maps, runtime environment files, secrets, or private-machine paths.
- The race was in the route-entry test, not the application: under load, a generic `main h1` wait could still match the retained Archive heading before the lazy Support destination rendered. The assertion now waits for the actual Support heading and still requires exact top entry, page-context focus, POP restoration, target framing, and absence of a delayed second jump.
- Vite stale-chunk recovery browser regression: PASS; one same-route automatic reload is followed by a visible, user-controlled recovery boundary rather than a reload loop or blank screen.
- Production-profile build with required Turnstile mode: PASS.
- Production Auth compiled-artifact gate: PASS.
- First production-profile artifact: 93 files; SHA-256 `dbe87721f0641d48cd8d07b8b4c0db4e96762b62a72c339d851706eb9a0bb5bf`.
- Safe-namespace production candidate: 93 files; SHA-256 `88223a8bc303738a0b9be000b5c617ccd8633d094386a4abff4315c051a8e333`.
- Safe-namespace Commons/Auth bundle: `assets/safe-assets-v1-commons-circle-C8GjeVfD.js`; SHA-256 `31d9237f845bcd09ca899d309b95d1802cd525313520461d6afe6b52b909ccea`.
- Explicit live rootless Podman local-isolation suite: PASS against disposable hardened Python/Node candidates built from already-present digest-pinned bases. Candidate image IDs were `b885877a60f7acb49ca1590f8c41697c434df8546a316051f81d0d6a4f14e339` and `185525d8b664cbbcc6dec453cd42f7fa4154be99bbc5cc0cf08ab48b2cb2fb26`; neither was published and both were removed after proof. The suite proved Python/JavaScript/TypeScript execution, zero effective capabilities, exact ulimits/cgroup limits, private PID namespace, no bind mounts, bounded tmpfs, timeout, immediate concurrent refusal, cancellation, hard output limit, memory/PID/network denial, shell removal, read-only root, removed package tooling, no private host path, secret-policy refusal, file-size enforcement, Node child-process denial, and no orphan containers.
- The first live local probe inherited the development defaults, which point at mutable upstream bases, and failed the shell-removal test. It was not accepted. The repository's reviewed hardened Containerfiles removed shells/BusyBox/package tooling; exported filesystem inspection passed, the full suite then passed, and both disposable image candidates plus failed synthetic runtime state were removed without publication.

The authenticated production sandbox gate is still recorded only after it actually runs through normal Auth/profile/eligibility and cleanup controls.

## 9. Deployment, cache upgrade, live sandbox, cleanup, and final verdict

Repair commit `82b733a657589f7385cf5564b6a6a32bfac7e530` was pushed to the established private remote and deployed as Pages production deployment `adc786df-c6ec-4aa3-b511-aad67452e3c7`. That deployment was intentionally rejected by the post-deployment canonical gate: seven reused shared-chunk URLs still served the historically cached 24-byte fallback. This finding is why a successful upload and a correct new main bundle were not accepted as closure.

Corrective commit `118a0549178b4dae9dde4481a7d161082cb57c40` (`Isolate Website assets from poisoned cache generation`) was then pushed only to the established private remote and deployed as canonical production deployment `4c2ed447-4420-4c5d-a3b3-f1f07eab4067`. The verified production artifact contained 93 files and had aggregate SHA-256 `88223a8bc303738a0b9be000b5c617ccd8633d094386a4abff4315c051a8e333`.

Canonical artifact parity passed for `index.html` plus all eight directly referenced JavaScript/CSS assets. Canonical index SHA-256 was `ebf6724c4803da04f3d21674fa482f60bcafbaacd02014d02750bfb4a6531667`; every asset was byte-identical to the qualified artifact. A deliberately missing JavaScript path returned `404 text/html`, `no-store`, a script-free document, and never the SPA shell.

The cache-upgrade harness served the exact shell from the rejected first deployment into a canonical browsing context. Chromium, Brave, and Firefox each proved that the old pre-safe-generation assets were actually attempted, a normal reload obtained only `safe-assets-v1` modules, a second reload remained hydrated, and Archive → Legal → back → forward worked without an automatic reload loop. Installed LibreWolf separately passed native normal reload, Ctrl+Shift+R hard reload, and the same back/forward sequence.

No synthetic production identities, Commune posts, Marketplace records, Forge records, or sandbox jobs were created during the anonymous/browser phase, so there is currently no temporary public data to remove. Disposable LibreWolf profiles were removed; no LibreWolf/Xvfb process or WebDriver listener on the two test ports remained. The rootless integration left no labeled sandbox container, and its disposable runtime/image candidates were removed.

The final completion verdict remains pending only on gates that have not yet been proven: authenticated production execution through every Workbench-exposing room workflow, cross-account job/cancellation isolation, governed removal of the synthetic acceptance accounts/data, the final post-proof regression/build, final evidence commit/deployment alignment, and a clean repository. No completion commit is created while any mandatory gate remains blocked.

Pass 10D has not begun.
