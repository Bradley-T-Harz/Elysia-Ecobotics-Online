# Coding Cornucopia Sandbox Boundary

Coding Cornucopia is the Commune coding room. Public code is community knowledge, not automatic trust.

## Execution Boundary

The website, browser frontend, Supabase, Postgres, Cloudflare Pages build, and Local Elysia app must not execute public code snippets directly.

Executable runs must go through the isolated Coding Cornucopia sandbox runner or an equivalent reviewed sandbox service with:

- non-root execution
- container or stronger isolation
- no host home mount
- no repo root mount
- no Docker socket mount
- no service-role keys
- no website secrets
- no private Supabase data
- no Local Elysia memory/files/logs/vaults/credentials
- ephemeral workspace
- network disabled by default
- CPU, memory, process, timeout, and output limits
- language allowlist
- dependency installs disabled by default
- audit log
- operator kill/revoke ability

## Snapshot Rule

Sandbox runs target explicit snapshots. Hidden live editor state is not executable.

Published posts remain stable public artifacts. Live/collaborative editing, later CRDT sessions, and workbench drafts must create snapshots before a sandbox run can be requested.

## Trust Rule

A successful sandbox run is evidence only. It does not mean:

- the code is safe
- the code is approved
- the author is trusted
- the snippet can be installed
- the snippet is a Marketplace add-on
- Developer Forge review is complete
- Local Elysia should run it without revalidation

Developer Forge and Marketplace approval remain separate manifest, permission, security, compatibility, licensing, signing, and review processes.
