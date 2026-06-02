# Elysia Marketplace

Elysia Marketplace is a standalone public/cloud-facing add-on catalog, profile, developer submission, and trust review website for Elysia-compatible extensions.

This website does **not** install software on local machines. Local Elysia remains the final authority for installation, uninstallation, enablement, disablement, execution, local password checks, and local machine inventory.

## Current MVP

- Vite + React + TypeScript routed marketplace app.
- Supabase-ready authentication, profile, saved add-ons, submissions, and admin review boundaries.
- Demo-mode fallback when Supabase env vars are missing.
- Static seed catalog and public manifest schema.
- Add-on search/filter/details/action-preview flows.
- Developer submission form with frontend manifest validation.
- Trust/security policy surfaces.

## Safety Boundary

The marketplace may store marketplace accounts, public profiles, saved add-ons, submissions, review state, and public manifests in Supabase when configured.

The marketplace must not receive local Elysia passwords, local files, local memory, dependency inventory, vault data, request traces, operator-room state, or private machine metadata by default.

Buttons use honest wording such as `Save to My Add-ons`, `Prepare Install`, and `View Manifest`. They do not claim local installation.

## Routes

- `/` marketplace overview
- `/browse` catalog search and filters
- `/addons/:id` shareable add-on details
- `/action-preview?addon=<id>` manifest action preview
- `/account` marketplace auth/profile
- `/submit` developer submission portal
- `/trust` trust and security policy
- `/manifest-api` manifest schema and public catalog docs
- `/admin` admin review placeholder

## Local Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

The dev server binds to `127.0.0.1` by default.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Run `supabase/policies.sql`.
4. Optionally run `supabase/seed.sql`.
5. Copy `.env.example` to `.env.local` and fill:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Never place a Supabase service role key in frontend env files.

## Cloudflare Pages

Suggested build settings:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Future Local Elysia Integration

Local Elysia may later fetch the public catalog, validate manifests, and perform approved local actions through a password-gated Add-ons room. The website itself will remain a catalog/profile/submission surface, not a remote-control surface for someone’s computer.

## Catalog Preview Maintenance

`public/catalog-preview.json` is generated from `src/data/seedAddons.ts` with:

```bash
node scripts/generateCatalogPreview.mjs
```

Run this after changing seed add-ons.
