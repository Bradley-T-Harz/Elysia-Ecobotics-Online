# Elysia Ecobotics Online

Elysia Ecobotics Online is the public website and account ecosystem for Elysia Ecobotics. It contains the Elysia Marketplace as one section, plus pages for downloads, products, the Lab, Developer Forge, Living Library, Commune, Commons Circle, story, about, and mission.

The site is public/cloud-facing. The private local Elysia core remains local, private, governed, and user-controlled. The website must not silently access local Elysia memory, private files, private logs, local credentials, request traces, identity vaults, `.env` files, or private machine data.

## Stack

- Vite
- React
- TypeScript
- React Router
- Supabase Auth/Postgres through the browser-safe anon key
- Cloudflare Pages SPA routing through `public/_redirects`

## Environment

Create `.env.local` for local Supabase testing:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AUTH_CAPTCHA_MODE=off
VITE_AUTH_TURNSTILE_SITE_KEY=
```

Never put a Supabase service-role key in frontend code.

`VITE_AUTH_CAPTCHA_MODE` accepts only `off`, `preflight`, or `required`;
missing and invalid values resolve to `off`. The Auth Turnstile site key is
public, but production uses the dedicated Auth widget rather than
`VITE_TURNSTILE_SITE_KEY`, which remains assigned to existing
participation/lifecycle flows. Local and automated verification uses
Cloudflare's official test key, never the production key or secret. See
`docs/deployment/auth-turnstile-rollout.md` for the deployment, preview,
browser, privacy, and rollback contract.

## Development

```bash
npm ci
npm run typecheck
npm run build
npm run test:routes
npm run dev
```

## Cloudflare Pages

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

Preserve `public/_redirects` so direct route refreshes work.

## Marketplace Boundary

The Elysia Marketplace prepares public add-on plans, manifests, permission reviews, saved add-ons, submissions, and trust labels. It does not install software locally. Future local installation must be performed by local Elysia after explicit user approval, outside Elysia core in an `Elysia_Add-ons` folder.
