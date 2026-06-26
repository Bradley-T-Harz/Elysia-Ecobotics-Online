# Official Update Security Boundary

Official Update is admin-only public communication. Its boundary is designed to prevent authority self-assignment, impersonation, hidden private data leakage, and accidental code execution.

The room must not expose:

- Admin private email
- Service-role keys or Supabase secrets
- `.env` content
- Hidden moderator notes
- Private account data
- Private local Elysia memory, files, logs, vaults, credentials, or machine data
- Private prompts, sealed memory, local paths, or internal screenshots

The room must not perform:

- Community submission or moderation-as-official-authoring
- Public code workbench editing
- Proposed revisions or community code acceptance flows
- Sandbox execution from public Official Update code
- Browser, Supabase, Postgres, or Local Elysia execution
- Repository clone, dependency install, build, deploy, or shell execution
- Developer Forge or Marketplace approval

Database enforcement should keep Official Update metadata and official code writes restricted to `public.current_user_is_admin()`. Public reads are allowed only when the linked `commune_posts` row is published and public, or when the signed-in user is the admin author/reviewer by policy.

Comment locking is enforced in frontend and in the comment insert RLS repair included in `2026_06_26_official_update_structured_workflow.sql`. Reviewers/admins may still moderate and audit; public community comments are blocked while locked.

Successful publication is not proof of code safety, compatibility, installability, or Marketplace readiness. Official code examples remain read-only public records.
