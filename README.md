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
```

Never put a Supabase service-role key in frontend code.

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
