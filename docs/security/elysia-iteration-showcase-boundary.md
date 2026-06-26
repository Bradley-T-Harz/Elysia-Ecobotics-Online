# Elysia Iteration Showcase Security Boundary

Elysia Iteration Showcase is public progress communication, not a trusted execution lane.

## Hard Prohibitions

The room must not:

- clone repositories
- install dependencies
- build repositories
- run repository scripts
- run shell commands
- execute code in the browser, Supabase, Postgres, Local Elysia, or the website build process
- expose service-role keys, environment files, private user data, private prompts, local Elysia memory, files, logs, vaults, credentials, machine data, or hidden moderator notes
- claim Official Update authority, Developer Forge approval, Marketplace readiness, compatibility certification, production readiness, installability, safety, or trust

## Selected-Artifact Sandbox Review

Sandbox review is allowed only through the existing governed sandbox path and only for explicitly pasted selected artifacts. The review service must preserve the Coding Cornucopia sandbox boundary:

- non-root execution
- isolated runner service
- no website secrets
- no service-role keys
- no private database access
- no local Elysia access
- no host filesystem access
- ephemeral workspace
- network disabled by default
- CPU, memory, process, time, and output limits
- structured diagnostics
- audit/run records where account-backed tables are active

Successful sandbox diagnostics are evidence only. They do not mean an iteration is safe, official, approved, installable, compatible, or Marketplace-ready.

## Public Media

Screenshots and demo media use the normal Commune attachment path. Media is moderated before public display for normal users and remains read-only inside the post flow after publication.
