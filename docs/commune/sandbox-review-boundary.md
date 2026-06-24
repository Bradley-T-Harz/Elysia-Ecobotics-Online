# Sandbox review boundary

Sandbox review requests are metadata and risk-review requests. They are not approval or trust.

The public website must not:

- run submitted code in the browser/frontend/Supabase/Postgres/Local Elysia
- provide a terminal
- install dependencies
- run package scripts
- clone repositories
- access local Elysia files, memory, vaults, logs, credentials, or machine data

Collaborative code review documents may link to a sandbox review request. Execution belongs in the separate isolated Coding Cornucopia sandbox runner with explicit snapshot input, resource limits, logging, kill controls, no secrets, no private network, and no host mounts.

Local Elysia remains the final runtime/sandbox authority.

## Local Handoff

Approved website requests may export a `.elysia-sandbox-request.json` handoff bundle. That bundle is metadata only. It must exclude private reviewer notes and secrets, and it must say that Local Elysia has to revalidate and ask explicit local approval before any future execution.

Reviewer approval for handoff is not execution approval. The public website does not call Local Elysia automatically and does not provide a terminal, package install, dependency install, repository clone, or unsafe run path. Snapshot runs require the configured isolated sandbox endpoint.
