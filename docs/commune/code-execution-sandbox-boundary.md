# Code execution sandbox boundary

The public website can request a governed run, but it never executes submitted code itself. Requests go only to the same-origin `/api/sandbox/*` Cloudflare Pages Functions and require the current signed-in Supabase session.

Submitted code crosses Cloudflare and Hetzner for isolated execution. Supabase may store bounded run metadata, a code hash, safe output previews, diagnostics, lifecycle timestamps, quota state, and idempotency data. The service does not intentionally persist successful raw code or full raw output.

The production runner permits one locked-down rootless Podman container with no network, package install, shell, package hooks, dependency execution, repository clone, host mounts, Local Elysia access, private vault access, credentials, or engine socket. It has fixed resource and output limits and deletes successful raw run data immediately.

Static diagnostics and execution results are evidence only. They are not a security review, trust signal, approval, authorship proof, compatibility guarantee, or permission to install or run the code elsewhere. Local Elysia remains the final authority for local tools and installs.
