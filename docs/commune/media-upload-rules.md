# Media Upload Rules

Commune media is private moderation material until linked to approved public content.

Allowed first-pass public/community media:

- images: png, jpg, jpeg, webp, gif, max 5 MB
- text/code metadata: txt, md, json, csv, max 100 KB
- PDFs may be accepted for moderation review, max 5 MB, but are not public by default

Blocked:

- `.env`
- private keys
- credential/token/password files
- executable scripts and binaries
- archives unless a future review process explicitly allows them
- local Elysia logs, vault files, resumes, receipts, private screenshots, and identity documents

The website must not create public URLs for pending/private media.

If storage upload succeeds but metadata insert fails, the frontend should attempt to remove the private storage object and report a clean failure. Canonical media metadata is stored in `commune_media`; legacy upload records are compatibility-only and should not be the public visibility source.
