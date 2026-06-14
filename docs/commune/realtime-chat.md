# Commune realtime chat

Commune realtime chat is a signed-in, cloud-hosted public/community discussion feature. It is not a private local Elysia room, private DM system, support ticket vault, or code execution surface.

Current boundaries:

- Signed-in users only may post messages.
- Public readers only see messages that remain `published` in published rooms.
- Messages are plain text and rendered as text by React.
- There are no private DMs in this pass.
- There are no file uploads in chat.
- Code snippets in chat are text only and are not executed.
- Users are warned not to post credentials, `.env` files, tokens, private local Elysia logs, private files, vault data, or sensitive personal material.

Supabase Realtime can subscribe to inserts on `commune_realtime_messages`. If realtime is unavailable, the UI falls back to manual refresh rather than crashing.

Slow mode is a safety tool, not a complete anti-abuse system. Moderation, reporting, RLS, and future rate-limit hardening remain part of the operating model.
