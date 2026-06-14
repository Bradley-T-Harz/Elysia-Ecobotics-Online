# Admin realtime chat moderation

The Admin Reports page includes a realtime chat moderation panel for authorized roles. It is intentionally narrow: view open realtime reports, inspect the reported plain-text message, hide/remove messages, dismiss or mark reports actioned, and update room posting mode or slow mode.

Private boundaries:

- Report details and reviewer notes are not public.
- Hidden/removed messages are not public.
- Moderation events are internal governance records.
- Room controls require moderator/reviewer/admin authority and RLS enforcement.
- Badges, membership tiers, donations, developer profile status, and contribution interest do not grant moderation authority.

Safety boundaries:

- Chat has no private DMs.
- Chat has no file uploads.
- Chat has no code execution, run button, package install, repository clone, or local Elysia access.
- Slow mode is helpful but imperfect; use reports, hides/removals, room mode changes, and future rate-limit hardening together.
