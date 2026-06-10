# Marketplace Revocation Feed

The website may publish reviewed revocation records for add-on versions or package hashes. Local Elysia checks the feed before install/update and may warn or safe-disable according to local policy.

The website cannot remotely disable local add-ons directly. Revocation handling is local, visible, and audited.

Static feed placeholder: `/marketplace-revocations.json`. Supabase-backed revocations are stored in `marketplace_revocations` when the migration is applied.
