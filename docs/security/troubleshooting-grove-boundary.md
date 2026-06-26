# Troubleshooting Grove Security Boundary

Troubleshooting Grove is public diagnostic support. It can contain useful error context, but that makes redaction and execution boundaries especially important.

Required redaction boundaries:

- no secrets, tokens, API keys, passwords, credentials, or .env contents
- no private account email, user private data, customer data, or identity documents
- no private local Elysia memory, local Elysia logs, vaults, sealed memory, credentials, or files
- no private local paths if avoidable, and no private machine inventory
- no unredacted screenshots or logs that expose sensitive data

Required execution boundaries:

- code/reproduction snippets are inert text until an explicit sandbox run
- no browser/frontend execution
- no Supabase/Postgres execution
- no Local Elysia execution
- no root shell or unrestricted server execution
- no arbitrary shell, package installation, repository clone/run, or network access
- no C/C++ or shell active support unless a future hardened policy explicitly enables it

Sandbox diagnostics use the existing Coding Cornucopia sandbox runner/client where eligible. The sandbox service must remain isolated, non-root, resource-limited, network-disabled by default, and free of website secrets, service-role keys, private database access, and local Elysia access.

Sandbox success is evidence only. It does not prove that a bug is fixed, that code is safe, that a workaround is approved, or that anything is Marketplace-ready. The original author still decides whether a proposed fix becomes the accepted public snapshot, and moderators still handle safety enforcement separately.
