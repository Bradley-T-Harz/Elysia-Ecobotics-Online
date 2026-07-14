# Coding Cornucopia Code Snippet Display Policy

Commune code snippets are inert text.

They may be displayed in the Coding Cornucopia editor/viewer, copied by users, checked with static diagnostics, and discussed in comments. They must not be executed by the browser page, Supabase, Postgres, Marketplace, Developer Forge, or private local Elysia.

When the governed service is enabled, execution may happen only from explicit snapshots through authenticated same-origin Pages Functions, Supabase authorization/reservation, Cloudflare Access/Tunnel, and the isolated runner boundary. Submitted code crosses Cloudflare and Hetzner, and bounded metadata/previews may be stored in Supabase. A successful run does not mark the code safe, approved, installable, or Marketplace-ready.

Code snippets should be scanned for obvious secrets and private paths before submission. Snippets that appear to contain service-role keys, private keys, GitHub tokens, `.env` contents, passwords, API keys, or credentials must be blocked until edited.
