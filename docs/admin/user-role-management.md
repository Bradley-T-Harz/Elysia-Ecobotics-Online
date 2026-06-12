# User Role Management

Authority roles are assigned through `user_roles`, not badges, public profile settings, donation recognition, membership tier, or Developer Forge profile status.

Roles may include:

- `administrator`
- `reviewer`
- `moderator`
- `marketplace_reviewer`
- `source_reviewer`
- `commune_moderator`
- `guardian_reviewer`

Role management must be admin-gated. The UI refuses role self-assignment, and RLS should prevent non-admin users from inserting or updating role rows.

Public profiles must not expose private auth emails or role-management records. Authority-linked badges may recognize trusted work, but the badge itself must not grant access.
