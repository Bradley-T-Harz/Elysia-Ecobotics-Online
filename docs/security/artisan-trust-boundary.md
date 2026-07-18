# Artisan Collective trust boundary

Updated: 2026-07-18

## Permitted data flow

The Artisan system may receive only the minimum shared public/account data
needed for the product: a verified Supabase user identifier, safe public Commons
Profile card, owner-scoped bootstrap state, exact legal acceptances, effective
participation/restriction results, constrained artwork metadata, processed media
derivatives, and narrowly scoped audited staff decisions.

It must never receive private local Elysia memory, conversations, files, logs,
vault data, credentials, model prompts, runtime state, machine data, private
processes, or sockets. No public repository contains an import, path, binding,
hostname, API, schema, storage bucket, environment variable, or deployment step
for that local system.

## Secret placement

| Location | Allowed | Prohibited |
| --- | --- | --- |
| Browser bundle | Supabase URL/publishable key, Turnstile site key, public origins | service role, provider secret, signing key, private bucket credential |
| Pages | public configuration and private Worker service binding | Supabase service role, media/provider secrets |
| Identity Worker | encrypted shared-governance secrets only | billing, sandbox, private-Elysia credentials |
| Artisan Worker | encrypted Artisan/media secrets only | billing, sandbox, private-Elysia credentials |
| Database | minimized hashes/references and audit | raw identity documents, raw provider payloads, private-Elysia data |

Workers have no public `workers.dev` route by default. Mutations require an exact
Origin, authenticated identity when applicable, bounded schemas, server-side
permissions, and rate controls. Browser eligibility is explanatory only.

## Media threat boundary

Original uploads are private quarantine objects and bearer upload permits are
short-lived and scoped to one owner, media record, MIME family, size, and object
key. File extensions and browser MIME claims are not trusted. Decoders validate
real type, dimensions, pixel count, duration/resource limits, strip metadata,
and create canonical derivatives. Moderation occurs before publication. Public
delivery never points at an original/quarantine key.

The product accepts no raw HTML, CSS, JavaScript, arbitrary iframe, executable
document, tracking pixel, remote embed, or unrestricted networked 3D/interactive
package. Text rendering is escaped/sanitized. CSP is a second boundary, not the
primary content validator.

## Abuse and safety cases

- Token leakage: no tokens in URLs after callback processing, logs, referrers,
  cross-origin storage, error bodies, analytics, or support screenshots.
- RLS bypass: deny-first grants, protected schemas, security-definer functions
  with fixed search paths, actor-explicit service RPCs, and direct actor matrices.
- Doxxing/minors: pseudonymous safe cards, no exact age/school/location/contact,
  conservative publication and notification defaults, rapid reporting.
- XSS/unsafe files: no raw code surfaces; canonical decode/re-encode and safe
  previews; CSP, nosniff, sandboxed viewers, and no arbitrary origins.
- Stolen art/credit: required credit/profile/license/provenance fields, edit
  history, report/correction/takedown/appeal flows, immutable audit, legal holds.
- CSAM/credible child-safety harm: quarantine, premoderation, immediate access
  restriction and evidence preservation under a trained, legally reviewed
  process; never download or circulate suspected material as an ordinary review
  workflow.
- Moderation abuse: scoped capabilities, AAL2, reason requirements, separation
  of moderation and appeal where possible, immutable audit, no silent edits.
- Private-Elysia exposure: explicit deny boundary plus repository, bundle,
  environment-name, path, and secret scans before release.
