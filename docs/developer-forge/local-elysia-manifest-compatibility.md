# Website and Local Elysia Manifest Compatibility

`manifest.json` is the only canonical v1 add-on manifest filename. A manifest is a declaration for review; it is never a permission grant or install instruction.

## Two validation gates

1. Developer Forge and Marketplace perform browser-side static intake and website review checks. They do not execute code or grant local authority.
2. Local Elysia independently reopens the `.elysia-addon`, verifies the package and its checksums, resolves effective permissions, and performs final validation before any install-disabled staging or enablement decision.

Marketplace approval cannot bypass the second gate. Local Elysia may reject a Marketplace-reviewed package.

## Schema truth

- Local Elysia's canonical package contract is schema `1.1`.
- Website Forge's existing editable/submission contract remains readable as legacy schema `1.0` while its database permission catalog and review records are preserved.
- Every newly generated CLI or browser `.elysia-addon` export is normalized to canonical schema `1.1`, with reasoned Local Elysia permission keys, deny-by-default policies, a named entrypoint, and manifest-owned SHA-256 payload checksums.
- The website intake surface now recognizes the canonical schema `1.1` shape and reports whether it is a canonical candidate, malformed, unsupported, or a legacy package requiring Local Elysia revalidation.
- Recognition is advisory. It does not claim byte-for-byte package compatibility or final install safety.

Canonical schema `1.1` includes publisher identity, compatibility, required profiles, named entrypoints, governed bridge metadata, reasoned permission objects, deny-by-default network/filesystem/memory/model/tool policies, execution and local-sandbox declarations, external services, SPDX license, provenance, signing truth, dependencies, checksums, and binary declarations.

## Legacy draft boundary

Existing editable drafts and historical review records may retain schema `1.0`; they are not silently rewritten in account storage. Export performs a conservative one-way normalization into an inert `1.1` package. Public/bundled-content legacy permissions map to no local runtime grant, while scoped network, filesystem, model, and sandbox requests map to the controlled Local Elysia vocabulary with explicit reasons. Blocked or unknown authority is never widened.

Local Elysia still reopens the exact exported bytes, performs final validation before install or enablement, and remains the staging, permission, revocation, and removal authority. Website review remains useful but non-authoritative.
