# Coding Cornucopia collaborative code review

Coding Cornucopia collaborative code review is a text-and-discussion layer with explicit manual snapshots, static diagnostics, annotations, and governed sandbox requests when the production proxy is enabled.

The browser page is not runtime execution. It sends explicit snapshots only to the authenticated same-origin Cloudflare proxy, which authorizes and reserves the request before contacting the isolated Hetzner runner.

Boundaries:

- No browser, Supabase, Postgres, or Local Elysia execution.
- No terminal.
- No dependency install, package scripts, or repository clone.
- No local file access.
- No private local Elysia memory, vault, log, credential, or machine-data access.
- No dangerous HTML rendering.
- Code is rendered inertly in the Coding Cornucopia editor/viewer.
- Sandbox success is evidence only, not trust or Marketplace approval.

Documents are cloud-hosted community data when saved to Supabase. Do not paste credentials, `.env` files, private local logs, private files, tokens, private keys, vault data, or sensitive personal material.

Submitted code crosses Cloudflare and Hetzner. Supabase may retain a code hash, bounded result previews, diagnostics, lifecycle/idempotency/quota metadata, and timestamps. Successful raw code/output is not intentionally retained by the runner.

Version history is manual snapshots. The edit lock is a simple coordination foundation, not full CRDT/Yjs multiplayer editing yet.
