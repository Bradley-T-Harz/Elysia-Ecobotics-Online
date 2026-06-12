# Content Visibility States

Use these states where practical:

- `draft`: owner-only.
- `submitted`: owner plus authorized reviewers.
- `published`: public, if the content is intended for public display.
- `flagged`: needs review; public visibility may be limited by feature policy.
- `hidden`: not public.
- `removed`: not public, retained for audit/legal/safety records.
- `archived`: inactive; not public unless explicitly designed as an archive.
- `revoked`: no longer public/installable; a public revocation notice may remain when safety requires it.

Do not expose hidden, removed, draft, private, security-held, rejected, or revoked private records to public users.

Marketplace add-on revocation is different from deleting local installed add-ons. The website can publish a revocation notice or prepare local warning metadata, but local Elysia remains final authority over local state.
