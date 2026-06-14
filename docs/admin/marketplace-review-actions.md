# Marketplace Review Actions

Authorized Marketplace reviewers may:

- request changes
- reject
- place a submission on security hold
- approve
- publish an approved version
- revoke a listing or version

Developers cannot approve, publish, or revoke their own submissions. Public users cannot access review queues, private notes, package metadata, or audit logs.

Every action should write review events, marketplace publication events, and admin audit records where the corresponding tables are active.

Badges, membership, developer visibility, stewardship recognition, or contribution interest do not grant review authority.
