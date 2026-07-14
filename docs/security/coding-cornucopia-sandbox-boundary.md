# Coding Cornucopia governed sandbox boundary

Coding Cornucopia code is untrusted input. It is never executed in the browser, Pages Function, Supabase/Postgres, Cloudflare build environment, application host, or Local Elysia.

The only production path is:

```text
browser
  -> same-origin /api/sandbox/* Pages Functions
  -> verified Supabase identity + RLS source authorization + atomic reservation
  -> Cloudflare Access Service Auth
  -> Cloudflare Tunnel
  -> 127.0.0.1:8788 on Hetzner
  -> one locked-down rootless Podman container
```

Trust is reduced at every hop. The browser supplies only a short-lived user token and source selection. Cloudflare validates identity and authorization, applies request and response bounds, and attaches private service credentials. Supabase provides the authoritative user, RLS source view, quotas, idempotency, leases, and bounded run record. Hetzner receives no identity token or private account/source context.

The runner enforces a second independent request schema and fixed policy. It has no network, shell, package install, writable container root, capabilities, privilege escalation, root user, host/repository/home/vault/socket mounts, or host-execution fallback. CPU, memory, PID, wall-clock, request, and output limits are fixed in code. Production images are immutable digests and are never pulled on demand. Only one execution may exist; there is no internal queue or automatic engine fallback.

Successful raw code and output are removed immediately. Supabase retains bounded metadata, code hash, safe output previews, diagnostics, status, quota/idempotency fields, and lifecycle timestamps under RLS. Bounded server audit records contain operational metadata, not raw code, output, tokens, or user identity.

Both Cloudflare and the runner have explicit execution kill switches. Incident response must fail closed first, preserve only bounded non-secret evidence, kill and remove any active container, rotate affected credentials directly in their control planes, and verify before re-enabling.

Execution is evidence only. Success does not mean the code is safe, approved, trustworthy, correctly attributed, installable, compatible, or authorized for Marketplace, Developer Forge, or Local Elysia use.
