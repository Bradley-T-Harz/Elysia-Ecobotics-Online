# Community Voting Room Policy

The Community Voting Room is an advisory governance feature in The Elysia Commune. Community votes guide stewardship decisions about website priorities, fixes, additions, removals, and direction-of-work questions.

Community votes do not automatically govern the site, change policy, create safety or legal obligations, alter Marketplace behavior, alter Developer Forge behavior, change Elysia behavior, or publish Official Updates. Admins control lifecycle and outcomes.

## Who Can View

Anonymous visitors and signed-in members can view public Community Voting Room posts when the linked Commune post is public and published. Result visibility depends on the vote's configured result setting.

## Who Can Vote

Signed-in members can cast one ballot per vote while the vote is effectively open. Members can change their ballot while the vote remains open.

Anonymous visitors cannot vote.

## Who Can Create And Control Votes

Only administrators can create Community Voting Room votes, define options, open or close voting, reopen a vote, accept or decline an outcome, archive a vote, mark a vote as posted to Official Update, toggle comments, or write the admin outcome summary.

## Lifecycle Statuses

Supported statuses are:

- `draft`
- `scheduled`
- `open`
- `closed`
- `accepted`
- `declined`
- `posted_to_official_update`
- `archived`

`accepted` means administrators have accepted the advisory guidance as a stewardship signal. `declined` means administrators have chosen not to act on the guidance. `posted_to_official_update` means an administrator manually recorded a relationship to an Official Update; it does not create or publish one automatically.

## Result Visibility

Supported result visibility settings are:

- `always`
- `after_vote`
- `after_close`
- `staff_only`

Public result paths expose aggregate counts only. They do not expose voter identities.

## Comments

Each vote can allow or disable comments. When comments are disabled, the post remains readable but new public comments are blocked by UI and database policy.

## Official Update Separation

Official Update remains separate. A Community Voting Room outcome can include an optional manual link to an Official Update post, but the voting feature never auto-creates Official Updates and never gives community users official publishing authority.
