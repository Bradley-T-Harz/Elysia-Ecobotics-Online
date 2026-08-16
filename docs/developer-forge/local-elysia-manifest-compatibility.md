# Website and Local Elysia Manifest Compatibility

`manifest.json` is the only canonical v1 add-on manifest filename. A manifest is a declaration for review; it is never a permission grant or install instruction.

## Two validation gates

1. Developer Forge and Marketplace perform browser-side static intake and website review checks. They do not execute code or grant local authority.
2. Local Elysia independently reopens the `.elysia-addon`, verifies the package and its checksums, resolves effective permissions, and performs final validation before any install-disabled staging or enablement decision.

Marketplace approval cannot bypass the second gate. Local Elysia may reject a Marketplace-reviewed package.

## Schema truth

- Local Elysia's canonical package contract is schema `1.1`.
- Website Forge's existing editable/submission contract is legacy schema `1.0` while its database permission catalog and review forms are converged safely.
- The website intake surface now recognizes the canonical schema `1.1` shape and reports whether it is a canonical candidate, malformed, unsupported, or a legacy package requiring Local Elysia revalidation.
- Recognition is advisory. It does not claim byte-for-byte package compatibility or final install safety.

Canonical schema `1.1` includes publisher identity, compatibility, required profiles, named entrypoints, governed bridge metadata, reasoned permission objects, deny-by-default network/filesystem/memory/model/tool policies, execution and local-sandbox declarations, external services, SPDX license, provenance, signing truth, dependencies, checksums, and binary declarations.

## Required convergence follow-up

Promoting Website Forge's editable and remotely submitted manifests from `1.0` to `1.1` requires a coordinated website/Supabase contract change: migrate the permission catalog to Local Elysia's dotted permission keys, update stored manifest validation and review tooling, preserve legacy drafts, and prove a real signed-in submission. That migration must not be improvised in a website-only release closure pass.

Until then, the UI must say that Local Elysia performs final validation before install or enablement. Website review remains useful but non-authoritative.
