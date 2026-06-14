# Commune realtime moderation

Realtime chat moderation uses private report and event tables:

- `commune_realtime_reports`
- `commune_room_moderation_events`
- `commune_realtime_messages`
- `commune_realtime_rooms`

Reports are private to authorized moderators, reviewers, and administrators through RLS. Public users cannot read reports, private reviewer notes, or moderation events.

Moderators can hide or remove messages. Hidden and removed messages are not publicly readable. Evidence is retained as metadata rather than hard-deleted by normal UI actions.

Room controls include posting mode and slow mode. Posting modes are `open_signed_in`, `members_only`, `read_only`, `moderated`, and `disabled`.

Moderation actions should write `commune_room_moderation_events` where policies allow it. Shared review/audit integration can be expanded later, but realtime chat moderation must remain role-gated by RLS, not frontend navigation alone.
