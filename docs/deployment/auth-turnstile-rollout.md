# Supabase Auth Turnstile rollout

Updated: 2026-07-30.

This runbook governs the additive Cloudflare Turnstile layer for public
Supabase Auth. It does not replace the repaired Website Account form, Supabase
rate limits, email confirmation, Brevo, RLS, participation gates, MFA, or the
Identity Worker. CAPTCHA enforcement remains disabled until every launch gate
below passes.

## Architecture and scope

One dedicated Managed widget named `Elysia Shared Auth Production` is shared
by:

- Online account creation, password sign-in, and password-reset email request;
- Artisan password sign-in and existing-account OTP/magic-link request.

The existing `Elysia Artisan Collective` widget, its public key, its Worker
secret, and its governance/lifecycle actions remain unchanged. Confirmation
callbacks, recovery password completion, `updateUser`, session
hydration/refresh, sign-out, profile setup, MFA, account lifecycle Workers,
guardian/age assurance, participation, Marketplace, Commune, Forge, sandbox,
billing, and RLS are outside this Auth CAPTCHA scope.

Supabase performs native server-side provider validation after enforcement is
enabled. A client-rendered challenge alone is readiness evidence, not
protection, and must never be described as complete CAPTCHA enforcement.
Turnstile actions are generic analytics labels only; no email, password,
profile data, user identifier, or Elysia data enters `action` or `cData`.

## Public configuration

```text
VITE_AUTH_CAPTCHA_MODE=off | preflight | required
VITE_AUTH_TURNSTILE_SITE_KEY=<dedicated Auth widget public site key>
```

Missing or invalid modes resolve to `off`. The public site key is intentionally
browser-visible. The widget secret must exist only in protected operator
custody and, after the launch gates pass, Supabase Authentication → Bot and
Abuse Protection. It must never enter Git, Vite, Pages public variables,
Workers, bundles, source maps, tests, screenshots, URLs, analytics,
diagnostics, or logs.

Online is a Direct Upload project, so these Vite values must be present in the
actual local/CI build environment before `wrangler pages deploy`; changing a
Pages variable cannot rewrite an already-built bundle. Local and automated
tests use Cloudflare's official test site key
`1x00000000000000000000AA` and a test-only browser adapter. They never use the
production widget or a runtime bypass.

## Modes

| Mode | Contract |
| --- | --- |
| `off` | No Auth widget and no client token requirement. Auth request shapes remain backward-compatible. |
| `preflight` | Render and exercise the widget while tokenless Auth remains possible and Supabase enforcement remains off. This proves client rendering, hostname acceptance, callbacks, CSP, accessibility, and browser behavior only. |
| `required` | The browser refuses protected Auth submission without a current token, preserves credentials, and retains the one-request lock. Supabase still remains disabled until every hard gate passes. |

Tokens remain only in an in-memory ref, never in credential React state,
`FormData`, the DOM response field, storage, a URL, analytics, or diagnostics.
One token is atomically consumed by one Auth request and the widget is reset
after success, provider rejection, rate limiting, email failure, or ambiguous
network failure. Expiration, timeout, retry, mode change, route change, and
unmount clear the token without clearing email or password.

## Production and preview host policy

The production widget authorizes exactly:

```text
elysiaecobotics.com
elysiaartisancollective.pages.dev
```

The first entry also authorizes its subdomains, including `www` and the future
Artisan custom hostname. Do not add localhost, loopback, the Online Pages
domain, previews, or unique deployment hosts. Online Auth viewed from an
unauthorized deployment host presents a canonical
`https://elysiaecobotics.com` account link and never sends a tokenless
production request. Artisan previews receive neither the production
Auth-specific key nor `required` mode.

## Rollout gates

1. Commit and test source with the default mode `off`.
2. Deploy both production applications in `off`; record deployment IDs,
   commits, bundle names, and hashes.
3. Confirm no Auth widget appears and the established Auth UI remains intact.
4. Create the dedicated Managed widget with world region, no clearance, no
   Bot Fight integration, no ephemeral IDs, and no off-label setting.
5. Protect the returned secret; give only the public site key to both
   production frontends.
6. Deploy `preflight`; verify one widget per form, canonical hosts, CSP,
   callbacks, accessibility, autofill/password retention, narrow/mobile
   layout, and no token leakage. Do not claim server protection.
7. Deploy `required`; record new rollback deployments and verify no protected
   request occurs without a current token.
8. Require operator acceptance in real Brave, Firefox, LibreWolf, and a real
   mobile browser on both production applications. LibreWolf is a hard gate.
9. Only after all prior evidence exists, enter the matching dedicated widget
   secret in Supabase, select Cloudflare Turnstile, and enable CAPTCHA.
10. Perform the controlled password, signup/confirmation, recovery, callback,
    session, and Artisan acceptance sequence while respecting the project email
    rate limit.

Do not alter SMTP, redirects, confirmation, sessions, hooks, providers, rate
limits, database rows, users, RLS, or participation settings during this
rollout.

## Failure and browser behavior

Loading, ready, expired, unavailable, content-blocked, unsupported-browser,
`captcha_failed`, rate-limit, network, and email-delivery states must remain
truthful and retryable. Never label a visitor a bot, silently do nothing,
permanently disable submit, clear a password because verification failed, or
convert a CAPTCHA/Auth failure into success.

Cloudflare supports current Chromium-family and Firefox browsers. Brave Shields
and hardened Firefox/LibreWolf settings may block the challenge script or
iframe. The UI preserves credentials and offers a keyboard-accessible retry;
operators must verify their real browser configurations because headless
automation with official test keys is not a substitute for human production
acceptance. No CSP broadening is permitted: keep the exact
`https://challenges.cloudflare.com` script/frame origin and do not add
`unsafe-eval`, new inline allowances, wildcard origins, or unrelated analytics
permissions.

Turnstile is an external anti-abuse service. On protected forms, the browser
connects to Cloudflare and browser/network signals may be processed there.
Supabase submits the short-lived token for verification. No Elysia local
memory is involved, and the application deliberately supplies no credential
or profile data to Turnstile metadata. Any public privacy-notice wording
remains subject to the existing legal review process.

## Monitoring

During the first hour inspect Supabase Auth logs for `captcha_failed` and 429s,
Turnstile challenge/Siteverify analytics, Brevo delivery results, and browser
CSP/console errors. Review legitimate completion and hardened-browser failures
through 24 hours, then challenge-to-validation ratio, invalid tokens, email
reputation, rate-limit pressure, and accessibility friction through seven
days. Never log or retain tokens, request bodies, emails, or passwords.

## Emergency rollback

If enforcement blocks legitimate Auth:

1. Disable Supabase CAPTCHA first and confirm tokenless native Auth acceptance
   is restored.
2. Set both frontend builds to `off` and redeploy, or roll back to the recorded
   off-mode deployments.
3. The original Online hard fallback remains deployment
   `8d205536-bdf5-44a6-8953-9cc12ac76a9e`, commit
   `7065bc8997b8532dffd0aadddd9c3bb8d70637a9`.

Do not delete the widget, rotate a secret without evidence of compromise,
touch the governance widget, change SMTP/redirects/confirmation, clear users or
sessions, alter database rows/RLS, or revert unrelated account repairs.

## Release evidence

Record non-secret evidence only: widget name, public site key, mode, exact
hostnames, creation date, final commits/deployments/bundle hashes, browser
results, enforcement date, sanitized Supabase state, tests, monitoring results,
and rollback owner. Never record the widget secret.
