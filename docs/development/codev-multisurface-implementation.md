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

## Browser workspace checkpoint (Phase 5)

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

Both pages now use this store. Full repository/archive imports replace the selected
source tree; manifest-only imports update that file without borrowing a different
package identity. Edits invalidate current validation/package readiness. Exact
LICENSE contents are independent of SPDX metadata. Workspace export preserves the
reviewed manifest contract, including legacy declarations; the existing explicit
template-export flow remains a separate canonical-template conversion. This avoids
silently changing permissions, execution declarations, or source behind the editor.

Browser recovery includes bounded form metadata but refuses credential, approval,
grant, consent, and acknowledgement state. Account/browser/surface/draft keys keep
recovery separate; legacy unowned v1 local records are not automatically attached
to an authenticated account. Debounced local recovery preserves dirty files across
reload, and the existing Save draft action distinguishes browser files from remote
metadata. Access-token refresh and route navigation preserve the workspace. Remote
metadata writes compare a saved content fingerprint and the current database
`updated_at` value. A late successful save updates only the baseline and preserves
newer unsaved edits.

Private transfer rebuilds current bytes, verifies every archive entry against its
workspace receipt, and records the exact package ID/revision/hash. Review uses that
specific package rather than whichever row is newest. Upload, scan, metadata, or
account failures stop dependent submission steps. The Supabase client is pinned to
the initiating account and login session for every request. An account change while
a transfer is awaiting an API response prevents any further source transmission.
No pairing, native probe, or connected Codev UI is exposed by this phase.

Validation: frontend and Functions typechecks; production-shaped synthetic build;
byte-level workspace/metadata/patch/recovery contracts; existing intake, manifest
convergence, submission-boundary, publisher-authority and public-bundle security
checks. Real Chromium tests covered IndexedDB reload, cross-tab generation conflicts,
stale-delete refusal, full LICENSE/source/binary preservation through save and ZIP
export, same-session token refresh, navigation, remote metadata conflicts, newer
edits during an awaited save, failed upload stopping submission, exact uploaded bytes
and package snapshots, and account changes during pending transfer. Existing Forge
CSP regression passed desktop/mobile; publisher regression passed 24 desktop/mobile
and role views without browser exceptions or provider requests. Focused screenshots
were inspected; local Chromium evidence is under the task's private `/tmp` directory.
These are synthetic browser/API checks, not a claim of production pairing or live
review submission. Database/pairing/deployment qualification remains ahead.

## Phase 6 pairing foundation (not deployed)

The additive `20260913010000_codev_pairing_sessions.sql` migration stores private
pairing identity and lifecycle metadata only. RLS, explicit function ownership,
empty search paths and narrow RPC grants keep the tables inaccessible to API
roles. Browser RPCs require an authenticated JWT and an existing matching
`auth.sessions` row, plus the existing ordinary-account lifecycle gate. Native
RPCs require unpredictable, separate, single-purpose secrets. Neither publisher,
reviewer, financial, draft nor storage authority is granted. Login deletion
cascades to revoke pairing. Expired metadata is pruned on subsequent pairing
creation, with per-account attempt limits; no source or workspace contents enter
these tables.

Pages uses only its existing public Supabase bindings. The new narrow route
handler validates exact origin/method/keys/body/destination, hashes manual/native
secrets, rejects redirects, validates public keys on P-256, and filters the complete
output shape. Browser private keys and native API credentials never enter Pages.
Binding types were generated with Wrangler from the clearly marked types-only
config; that config is not a production deployment configuration.

The shared browser transport signs exact UTF-8 payloads, pins the native key from
the HTTPS intent, and verifies request-bound responses. It has no startup probe
or port scan. It is not yet mounted on either page. Normal-security Chromium with
synthetic HTTPS identity and the actual Python broker passed signed status,
selected-file sharing and an exact browser patch; the original CSP and denied
loopback permission each caused zero broker requests. Source LICENSE/binary hashes
were preserved; replay, impostor key, private-key export and account change were
rejected. Browser identity/provider adapters were synthetic.

All 67 migrations replayed in disposable network-disabled PostgreSQL; pairing
identity, role isolation, expiry, replay and logout checks passed. The database
linter found no error-level findings across 576 governed function names. Endpoint
security tests and frontend/Functions typechecks passed. Actual production schema
was inventoried using the owner's explicitly approved admin connection solely
inside enforced READ ONLY transactions; credentials were not exposed. No migration
has been applied remotely and no push or deployment has occurred in this phase.
