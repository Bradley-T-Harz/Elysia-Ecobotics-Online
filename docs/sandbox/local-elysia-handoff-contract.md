# Local Elysia Handoff Contract

This document describes the expected import contract for a later Local Elysia implementation. It is not a runner.

## Bundle

The website exports JSON with schema version `elysia.sandbox_request.v1` and handoff kind `local_elysia_sandbox_request`. The bundle contains source metadata, execution intent metadata, optional user-provided code text, public reviewer feedback, a safety contract, and a SHA-256 checksum.

The bundle must not include service-role keys, private reviewer notes, credentials, private local Elysia logs, vault data, private files, receipts, resumes, or secrets.

## Local Elysia Requirements

Local Elysia must:

- Revalidate the entire bundle.
- Verify the checksum.
- Ask explicit local user approval before any execution.
- Use sandbox isolation.
- Default network to disabled.
- Default filesystem access to an isolated temporary workspace.
- Refuse secrets, private paths, broad filesystem access, private network targets, install hooks, repository clone instructions, and dangerous shell chains.
- Write local audit logs for import, refusal, approval, and any future execution.

Reviewer approval from the website is not local execution approval. Local Elysia remains the final runtime/sandbox authority.

## Refusal Examples

Local Elysia should refuse bundles that include private keys, `.env` references, service-role text, `/home/` paths, `C:\` paths, `npm install`, `curl | bash`, `git clone`, broad filesystem access, localhost/private-network targets, or missing acknowledgements.
