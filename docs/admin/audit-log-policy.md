# Audit Log Policy

Admin and reviewer actions should leave audit records.

Audit records should include:

- actor user id
- action
- target type
- target id
- timestamp
- minimal metadata

Audit logs are private governance records. They may reference private reports, private packages, reviewer notes, receipts, resumes, or security events, so they must not be public.

Actions that should be logged include report review, content hide/remove/restore/archive, add-on approval/rejection/security hold/publication/revocation, developer status changes, Living Library source decisions, Work With or role-submission decisions, and user role changes.

Audit logs are not badge records and do not grant authority.
