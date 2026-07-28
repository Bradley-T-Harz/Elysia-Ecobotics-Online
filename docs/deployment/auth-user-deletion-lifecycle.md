# Auth-user deletion lifecycle

## Scope

This repair addresses the production `SQLSTATE 23503` failure caused by
`private.account_participation_user_id_fkey`. The active migration chain has
299 non-system foreign keys that point directly to `auth.users(id)`:

- 46 `CASCADE`
- 73 `SET NULL`
- 158 `RESTRICT`
- 22 `NO ACTION`

The complete row-by-row inventory, including nullability, constraint
definition, signup creation, content/evidence classification, and lifecycle
decision, is produced by:

```sh
psql --set ON_ERROR_STOP=1 --file scripts/sql/auth_users_dependency_inventory.sql
```

Run that query against both a clean disposable database and hosted production
before approving a deletion migration. It is read-only.

## Reviewed change

Exactly two rows are created automatically for every new Auth user and have no
independent meaning after that Auth user is removed:

| Relation | Constraint | Before | After | Lifecycle |
| --- | --- | --- | --- | --- |
| `private.account_participation` | `account_participation_user_id_fkey` | `ON DELETE RESTRICT` | `ON DELETE CASCADE` | Disposable server-owned participation state |
| `private.community_notification_preferences` | `community_notification_preferences_user_id_fkey` | `ON DELETE RESTRICT` | `ON DELETE CASCADE` | Disposable delivery preferences |

Migration `20260728010000_auth_user_deletion_lifecycle.sql` changes only these
two constraints. It verifies the exact old catalog shape before changing it,
uses a bounded lock and statement timeout, retains `uuid`, `NOT NULL`,
`ON UPDATE NO ACTION`, non-deferrability, validation, primary-key indexes, RLS,
ownership, and grants, and documents both lifecycle decisions.

## Lifecycle classes

### A — Cascade with Auth user

Disposable preferences, onboarding state, private settings, saved items,
reactions, profile customization, and equivalent identity-bound state may
follow the Auth user. The migration adds only the two reviewed bootstrap rows;
it does not rewrite existing cascade policies.

### B — Set null or anonymize and retain

Existing nullable actor/owner references using `SET NULL` retain the record
without the direct Auth identifier. Handle tombstones are included so a
retired handle cannot silently become an impersonation vector.

### C — Retain as audit or legal evidence

Moderation, safety, guardian, age, consent, legal-hold, agreement, economic,
security, and audit records retain their existing restrictive or minimized
identity policy. Their purpose and retention period must be resolved by the
governed lifecycle workflow; this migration never cascades them.

### D — Governed cleanup before hard deletion

Authored/public content and any non-null restrictive ownership relationship
require an explicit delete, anonymize, transfer, or retention decision before
hard deletion. Existing authored-content cascades are reported as a policy risk
by the inventory rather than silently being treated as disposable. Dashboard
hard deletion is appropriate only when preflight proves that no unresolved
Class C/D row exists.

### E — Storage API cleanup or ownership transfer

`storage.objects` ownership is inventoried separately. Owned objects must be
deleted through the Supabase Storage API or reassigned under an approved
retention policy before Auth deletion. Direct SQL deletion from
`storage.objects` is prohibited.

## Existing governed application workflow

The Online account-deletion route already creates a reviewed lifecycle request
instead of deleting from the browser. The Identity Worker already:

- authoritatively validates the Supabase user for each request;
- requires a fresh AAL2 event for destructive staff transitions;
- rate-limits operator mutations;
- checks cooling-period state and active legal holds in database RPCs;
- inventories and queues account-owned Artisan media for Storage API cleanup;
- requires hashed evidence for storage and Auth-deletion handoffs;
- uses the server-only Supabase Admin API;
- requests irreversible Supabase Auth soft deletion so retained direct
  references remain valid;
- records privacy-minimized, idempotent handoff receipts.

Soft deletion remains the safe default for accounts with retained Class C/D
records. Hard deletion is separately acceptable for a positively identified
disposable account only after the complete preflight reports no unresolved
retention, ownership, content, or Storage dependency.

## Authorization after deletion

Online and the shared Identity Worker do not authorize sensitive operations
from JWT claims alone. They call Supabase Auth `getUser` with the presented
access token before serving protected identity operations. After deletion:

- refresh must fail;
- the shared Identity bootstrap must reject the account;
- Online, Artisan, Marketplace, Developer Forge, billing, sandbox, and admin
  server paths must continue to perform authoritative user validation;
- browser state must not manufacture participation from a stale token.

Global JWT expiry is not changed by this repair.

## Production deletion boundary

Production deletion is never a broad or pattern-based operation. The operator
must:

1. resolve the exact approved email to one Auth user;
2. verify exact equality and a single result without reporting the email or ID;
3. verify no active legal hold, governed content, economic obligation, or owned
   Storage object remains;
4. delete only that user through the reviewed Admin/Dashboard path;
5. verify both cascade rows disappeared, no FK orphan exists, no `23503` was
   logged, and protected Online and Artisan identity endpoints reject the
   deleted account.
