# Commune Sandbox Request Handoff

The Commune sandbox request flow is a metadata and review workflow only. It lets a signed-in user describe a future sandbox need, submit that description for review, and export an approved JSON handoff bundle for a later Local Elysia import.

The public website does not execute code, open a terminal, install dependencies, clone repositories, call Local Elysia, or access local files, memory, vaults, logs, models, credentials, or machine data.

## Flow

1. User creates a sandbox request draft with title, source type, language, expected command as metadata, dependencies as names only, network policy, filesystem policy, requested limits, and risk notes.
2. User acknowledges that the website will not execute it, secrets are not included, and Local Elysia remains final authority.
3. Reviewer/admin may request changes, reject, place on security hold, or approve for local handoff.
4. Only approved requests can export `.elysia-sandbox-request.json` metadata.
5. Local Elysia must revalidate the bundle and ask explicit local approval before any future execution.

Reviewer approval is not execution approval. It only means the request is ready to hand off as reviewed metadata.

## Export Boundary

The handoff bundle excludes private reviewer notes and must not include secrets. It includes a safety contract stating that the website did not execute code and that Local Elysia must revalidate.
