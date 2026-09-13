# Codev multi-surface implementation evidence

This implementation follows the four owner-supplied Codev directives. Elysia and
Codev remain v1.0.0. The current Codev Add-on repository is read-only. Installation,
explicit Sync Codev, native confirmation, refresh, and separate workspace grants
remain mandatory before any connected website interface is exposed.

## Baseline

Online started clean at `9fecc07`. Current production deployment was
`ff1939d0-ed57-4516-9784-dce3a5cf878d` from that source. Fetched `online/main` was
`c04260585e237e213d10e0220d964a09e4f0bbcf`. All existing source history is preserved.
The production schema inventory used an explicitly approved READ ONLY transaction;
it found 66 applied migrations through `20260910050000`. No migration or deployment
has been applied by this implementation yet.

## Shared contract checkpoint

The authoritative Python contracts in Elysia generate matching JSON Schema and
TypeScript here. Pairing grants zero workspaces. Browser clients cannot grant
native mutation/commands. Actor/account/surface/revision/expiry/epoch bindings
are enforced by the shared domain, with v1 compatibility retained beneath it.

## Browser workspace core checkpoint (Phase 5 in progress)

`src/shared/codev/workspace.ts` owns actual included bytes separately from editor
text and metadata-only files. It tracks original/current revisions, dirty state,
manifest revision, saved/validated/packaged revisions, package hash and provenance.
Patches use exact file/workspace hashes and reject stale, replayed or wrong-owner
plans. The browser hash matches the canonical Python hash vector.

Packaging reconstructs every included source file from the current workspace.
Binary bytes, CRLF, no-final-newline text, and full LICENSE text are preserved.
`checksums.json` is derived; schema 1.1 checksum metadata is updated in the actual
manifest buffer before capturing the packaged revision. No unrelated manifest
fields or product versions are silently changed. Signed manifests require an
explicit unsigned revision before rebuilding. Unavailable bytes prevent packaging.

IndexedDB recovery is scoped by account, browser, surface and draft. A transaction
compares recovery generations before save/delete, so a stale tab cannot replace a
newer save. Recovery rechecks content hashes and does not restore approvals,
validation success or package readiness. Secret-looking text/private paths prevent
recovery persistence. This is browser-local storage, not remote source storage.

Validation so far: byte-level package/patch/recovery contracts passed; real
Chromium IndexedDB tests passed account isolation, reload recovery, cross-tab
conflicts, dirty-buffer preservation and stale-delete refusal with external
network blocked. Frontend typecheck, existing intake contracts and Local Elysia
manifest convergence passed. The core is not yet connected to either page; page
save/export/transfer and account lifecycle integration is the next Phase 5 gate.
