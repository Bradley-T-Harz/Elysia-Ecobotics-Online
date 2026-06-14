# Marketplace Revocation Policy

Revocation is an evidence-preserving safety action. It does not hard-delete package metadata or review records.

Reviewer actions can revoke:

- an entire Marketplace listing
- one reviewed add-on version

Public revocation data may include only listing/add-on identity, version when relevant, severity, reason category, public notice, revocation time, and active/resolved status. Private reviewer notes, package storage paths, private review evidence, and audit logs must not be public.

Revoked listings or versions must not create new website install intents. Local Elysia may still perform its own local checks for already downloaded packages, but the website must not present revoked items as installable.
