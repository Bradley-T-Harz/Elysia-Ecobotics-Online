# Marketplace Privacy Boundary

Elysia Marketplace is public/cloud-facing. Local Elysia is private/local-first.

Marketplace data may include account email handled by Supabase Auth, public profile fields, saved add-ons, submissions, review state, and public add-on metadata.

The marketplace must not collect local Elysia passwords, local files, local memory, request traces, operator-room state, dependency inventory, vault content, `.env` data, SSH keys, or private machine metadata by default.

Developer submission is the narrow exception for files the developer explicitly selects. Folder/package import and static inspection run in browser memory first. A separate confirmation must disclose that the selected files leave the developer's computer and transfer to Elysia Ecobotics / EcoSyneva Commons review infrastructure. The website must never describe that transfer as local-only, silently include unselected files, clone a Git URL, or publish a submission automatically.

Future linking should use a short-lived pairing code. Passwords must never be shared between marketplace and local Elysia.


## Manual profile sync from local Elysia

Local Elysia may offer a manual, explicit sync preview for public text fields only: username, display name, bio, and interests. The user must select fields and confirm before those values are written to Supabase.

Profile photo sync remains planned unless a safe Marketplace avatar storage path is added. Local Elysia must not upload original local profile photo paths.

Local Elysia passwords, private local profile fields, files, memory, request traces, dependency inventory, vault material, `.env` data, SSH keys, local filesystem paths, and Supabase service-role keys must never be sent to Marketplace.
