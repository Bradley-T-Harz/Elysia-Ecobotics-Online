# Marketplace Install Intents

Install intents are short-lived website records for signed-in users. They contain an add-on version reference, a nonce hash, expiry, and status.

The browser may open `elysia://marketplace/install?intent_id=...&nonce=...`, but local Elysia treats that URL as an invitation only. A fake or expired deep link must not install anything.

Local install completion is not synced back to the website unless a future explicit opt-in device link is built.
