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

## Phase 7 — Marketplace connected client (local qualification)

The submission page adds one compact Sync Codev slot. There is no loopback request
or private-key storage before explicit Sync. Authenticated intent creation exposes
only a short-lived manual code; native installation and confirmation are required
before the browser verifies a signed broker response. The current canonical draft
is persisted and checked before the required reload. A fresh document restores
only its scoped, nonextractable IndexedDB key; copied sessionStorage in a new tab
is discarded, including before a later reload. Refresh explicitly revokes previous
source shares while preserving their grant-epoch tombstones. Disconnect closes
browser authority synchronously before attempting native/cloud cleanup.

The shared drawer defaults to no selected source and no workspace grant. Explicit
sharing discloses source kind, inventory/content counts, bytes, direction, scope
and retention. Conversations use the canonical governed native cognition path.
Read-only sharing cannot authorize proposals. Reviewed patches require the exact
server plan, one-use approval, current browser revision/hashes, current editability
and durable owner-scoped original-text recovery before mutation. Authority is
rechecked after asynchronous hashing. Recovery restore also requires the exact
post-patch revision/hash. Validation derives from the changed canonical buffers;
review, package transfer, publisher authority and submission remain separate.

CSP now permits only the dedicated literal `http://127.0.0.1:47321` broker in
`connect-src`; the existing upgrade/script/frame protections remain. The permission
policy permits same-origin loopback permission and denies general local-network
access. The allowance covers the SPA document because entry from another route
must retain its original document policy. It grants no broker authority. Pages
publishes only `/api/codev/*` in addition to its existing allowed routes; financial
API publication is unchanged. No native API bearer, source or private key enters
the pairing endpoint.

Qualification at this checkpoint:

- Actual built Marketplace page + real Python broker/signatures + Chromium
  151.0.7922.34, with normal browser security. Identities, installation and provider
  responses are explicitly synthetic; this is not live production qualification.
- Logged-out/unsynced zero-probe behavior, missing installation refusal, separate
  native approval, required refresh, zero initial source, read/proposal scopes,
  full LICENSE/binary recovery, exact manifest/source patch, stale proposal refusal,
  cloned-tab isolation (including reload), restoration and existing explicit private
  transfer passed. No Codev action wrote to publisher/draft/storage fixtures.
- Unsynced submission DOM and rendered screenshot were byte-identical to the saved
  phase-6 baseline after removing only the Sync slot. Desktop and 390px mobile
  Sync/drawer/diff/recovery screenshots were inspected; no horizontal overflow.
- 21 native/broker/full-browser checks passed. Real IndexedDB tests also passed
  owner/draft isolation, compare-and-swap, stale restore/delete refusal, original
  text restoration and authority revocation during asynchronous hashing.
- Existing Forge/Marketplace integration regression, workspace contract checks,
  pairing endpoint security, frontend/Functions types and isolated build passed.

Evidence is under `/tmp/codev-implementation-20260913/marketplace-codev-browser-phase7/`
and the sibling phase-7 logs. No remote migration, push or deployment has occurred.
Forge mounting, complete cross-surface qualification and production verification
remain subsequent gates. Codev Add-on and product versions remain unchanged.

## Phase 8 — Forge client and cross-surface lifecycle (local qualification)

Forge mounts the same compact Sync slot only on its drafts routes. A context
registration binds the existing workbench controller to the shared drawer; no
second agent, credential store, broker or pairing protocol was introduced. The
original draft lock and pending operation counter gate Codev editing and the
required refresh. The current draft, exact source revision, full LICENSE/binary
bytes, active file, new-draft name and ownership selection survive sync. View
recovery is short-lived, account/browser scoped metadata; it creates no source,
publisher, workspace or execution authority.

Forge can narrow a multi-file proposal by reviewing only one file or rejecting a
file. Every narrowed selection receives a new canonical plan and needs fresh exact
approval. A request for revision returns to the same conversation. The panel
shows the active file and current deterministic validation findings. Locked drafts
cannot request or accept edits; the existing Duplicate draft for revision flow
preserves source without inheriting the old draft's Codev grant.

Safe operation receipts now have bounded account/workspace-local IndexedDB
persistence, independently of private keys and patch recovery. They remain
informational; they cannot authorize replay. Account changes synchronously close
browser authority and use the old key only for one fixed signed native revocation.
A monotonically changing authentication epoch invalidates delayed operations even
across A → B → A. Saved or pending restoration records are also retired without
reading another account's source. Ordinary access-token refresh preserves the
same account/login-bound workspace and connection.

Qualification passed against the real built Marketplace and Forge pages, normal
Chromium 151.0.7922.34 security, and the real signed Python broker. Identity,
installation and provider adapters remained synthetic. Evidence includes:

- Both unsynced page DOMs and screenshot bytes matched their saved pre-Sync
  checkpoints after removing only their one Sync slot.
- New-draft form state, dirty README/full package contents, selected draft and
  active file survived the required refresh. Pairing shared no workspace.
- File-specific rejection produced a new exact plan; only the accepted source
  changed, and inert export included those accepted current bytes. Full README,
  LICENSE and binary bytes survived Save draft and revision duplication.
- Existing submitted locks refused proposals/edits. Revision copies required a
  new explicit grant. Account switching removed active native source grants;
  returning to A did not reconnect. A delayed intent across A → B → A was withheld.
- Real IndexedDB receipt/recovery account isolation and the existing Forge/
  Marketplace save, transfer, conflict and account regression passed. Frontend
  types, isolated build and full signed browser suites passed.
- Desktop Forge proposal/lock/scope and mobile connected views were visually
  inspected, with no horizontal overflow.

Evidence: `/tmp/codev-implementation-20260913/website-codev-browser-phase8/` and
sibling phase-8 logs. These results do not attest a real production installation,
provider or signed-in production account. Final native/platform/security/build,
publication, migration, deployment and production verification remain phase 9.
No remote mutation, version bump or Codev Add-on change occurred in this phase.

## Phase 9 qualification and applied migration

The existing website full-suite gates passed across the initial run and its
focused continuation. Reviewed assertions now recognize the exact fifth Pages
route and literal loopback CSP source, while retaining the existing secret,
publication, sandbox and origin checks. The route-entry fixture now supplies a
browser-scoped v2 local draft instead of relying on automatic import of unscoped
v1 data. Route-entry, badge administration, abuse administration and the public
bundle audit passed in the continuation; the latter checked 228 artifacts.
Frontend/Functions types and the isolated build passed. No synthetic build is
authorized for production deployment.

Codev's signed transport and both full website flows passed in Chromium
151.0.7922.34 and Firefox 153.0. Both engines used normal security settings, real
loopback transport and explicitly synthetic account/installation/provider
adapters. Both proved unchanged unsynced DOM and screenshot bytes after removal
of the sole Sync slot. The same runs covered explicit native confirmation,
refresh/dirty-draft preservation, no initial workspace grant, exact reviewed
edits, per-file rejection, stale revision refusal, account/session revocation,
cloned-tab isolation, full LICENSE/binary preservation, locked drafts and local
recovery. Firefox desktop/mobile connected views were manually inspected. The
Monaco input driver uses real keyboard events and checks export bytes before Sync.

The exact production migration transaction was rehearsed in a network-disabled
Supabase Postgres container, including duplicate application refusal and all 67
migrations' behavior checks. `plpgsql_check` found no error-level findings across
576 governed function names. Migration `20260913010000` was then applied remotely
with SHA-256 `d931217ae703ab97ae464a56db9aaedfe7ae9465e7d46c57b42a96b281508193`.
The independent READ ONLY inventory confirms two new private forced-RLS tables,
nine functions, one trigger and one history row; no existing policies or objects
were removed or altered. Pairing stores no source, file/workspace permissions,
publisher roles or native API credentials.

The live Pages project remains a direct-upload project. Its existing production
bindings were inventoried without secret values, including the enabled governed
sandbox and identity service. The current public lifecycle Turnstile widget was
read from the live bundle for exact build configuration. Production password
authentication correctly refused automated login without CAPTCHA. Two temporary
tagged QA accounts use admin-issued one-time links for later live pairing tests;
no email, role elevation or CAPTCHA policy change was performed. These tests do
not qualify interactive CAPTCHA. Exact-account cleanup is required after live
verification. Push, production build/deployment and live Codev verification follow
this checkpoint.


### Production runtime correction

Initial deployment `cc04d973-a43f-464f-bdf1-3b312f73ac7e` (source `f5b06ef`)
served ordinary pages and passed the production auth/CAPTCHA-rendering audit, but
real Sync returned 503. The same ordinary QA session succeeded against the narrow
RPC and the Node handler with the exact deployed public bindings. Local workerd
reproduced the failure: it rejects `fetch` with `redirect: "error"`.
The handler now uses `manual` and rejects every non-success response before any
second request. A persisted real-workerd regression uses the deployed compatibility
date and routes all outbound requests to a synthetic worker; success, cross-origin
302 refusal, same-origin 307 refusal and strict response validation pass. The Node
suite also covers all five redirect statuses. These checks run in the normal Codev
pairing gate and full readiness suite. No binding, permission or database change
was needed. Corrected deployment and live qualification follow this checkpoint.
