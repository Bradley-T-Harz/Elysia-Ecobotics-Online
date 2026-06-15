# Admin code review moderation

The Admin Reports page can surface code review reports for authorized reviewers/moderators/admins. It should allow private inspection of reported document text or annotation comments, hide/remove actions, report dismissal, and private reviewer notes.

Private boundaries:

- Reports are not public.
- Reviewer notes are not public.
- Hidden/removed documents and annotations are not public.
- Moderation events are internal governance records.
- Badges, membership, donations, developer profile visibility, or contribution interest do not grant moderation authority.

Safety boundaries:

- Code review is text review only.
- No run button, terminal, package install, repository clone, dependency execution, or local Elysia access exists in this pass.
