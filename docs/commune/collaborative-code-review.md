# Collaborative code review

Commune collaborative code review is a text-and-discussion layer. It lets signed-in users create code review documents, save manual snapshots, annotate line ranges, copy/export text, and prepare future Commune post or sandbox-review metadata.

It is not runtime execution.

Boundaries:

- No code execution.
- No terminal or run button.
- No dependency install, package scripts, or repository clone.
- No local file access.
- No private local Elysia memory, vault, log, credential, or machine-data access.
- No dangerous HTML rendering.
- Code is rendered inertly in `<pre><code>` as text.

Documents are cloud-hosted community data when saved to Supabase. Do not paste credentials, `.env` files, private local logs, private files, tokens, private keys, vault data, or sensitive personal material.

Version history is manual snapshots only. The edit lock is a simple coordination foundation, not full CRDT/Yjs multiplayer editing.
