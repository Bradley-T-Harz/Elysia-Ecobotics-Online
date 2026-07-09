# Repository Showcase Security Boundary

Repository Showcase is metadata-first. The public website may display reviewed metadata connected to a normal Commune post/thread, but it must not treat a repository URL as executable or trustworthy.

Admin-authored Repository Showcase guidance/template posts are allowed without a repository URL only when explicitly labeled as guidance. They are not repository listings and do not create repository trust, compatibility review, Marketplace approval, Developer Forge approval, signing, versioning, install safety, selected-artifact sandbox approval, or sandbox execution.

Required boundaries:

- no whole-repository clone
- no dependency installation
- no build/test/run/deploy actions
- no shell execution from Repository Showcase
- no browser execution
- no Supabase/Postgres execution
- no Local Elysia execution
- no service-role key exposure
- no private repository OAuth claim unless a future explicit OAuth flow exists
- no secret, credential, local path, vault, log, or private account-data exposure

Public metadata import is allowed only from public URLs and is author-reviewed before submission. It may be stale, incomplete, misleading, or unsafe. It is never a trust signal.

Selected-artifact sandbox review is allowed only for a pasted file/snippet submitted through the Repository Showcase sandbox request route. The selected artifact uses the existing sandbox runner policy: no root execution, network disabled by default, no package install, resource limits, output capture, and structured diagnostics where available.

Sandbox success does not mean safe. It does not mean compatible. It does not mean licensed. It does not make the repository Marketplace-ready. Reviewer and Marketplace decisions remain separate.
