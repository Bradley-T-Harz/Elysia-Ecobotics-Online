# Marketplace Privacy Boundary

Elysia Marketplace is public/cloud-facing. Local Elysia is private/local-first.

Marketplace data may include account email handled by Supabase Auth, public profile fields, saved add-ons, submissions, review state, and public add-on metadata.

The marketplace must not collect local Elysia passwords, local files, local memory, request traces, operator-room state, dependency inventory, vault content, `.env` data, SSH keys, or private machine metadata by default.

Future linking should use a short-lived pairing code. Passwords must never be shared between marketplace and local Elysia.
