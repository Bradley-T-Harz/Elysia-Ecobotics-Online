# Community Vote API Contract

Community Voting Room data is stored as a Commune post plus vote sidecars.

## Post Type And Room

- Room display name: `Community Voting Room`
- Room slug: `community-vote`
- Post type: `community_vote`
- Supported routes: `/commune/community-vote` and `/commune/rooms/community-vote`

## Tables

- `commune_vote_posts`
- `commune_vote_options`
- `commune_vote_ballots`
- `commune_vote_events`

## Status Enums

Vote statuses:

- `draft`
- `scheduled`
- `open`
- `closed`
- `accepted`
- `declined`
- `posted_to_official_update`
- `archived`

Decision type V1:

- `single_choice_guidance`

Result visibility:

- `always`
- `after_vote`
- `after_close`
- `staff_only`

Event types:

- `created`
- `scheduled`
- `opened`
- `closed`
- `reopened`
- `accepted`
- `declined`
- `posted_to_official_update`
- `archived`
- `outcome_updated`
- `comments_enabled`
- `comments_disabled`

## Loader Shape

`loadVotePostsForPosts(postIds, account)` returns `CommunityVoteView[]`.

Each view contains:

- `vote`
- `options`
- `viewerBallot`
- `results`
- `events`

`results` are safe aggregate rows only. Public UI must not expose `voter_user_id`.

## Submit Helper

`submitCommunityVotePost(input)` is admin-only. It creates:

- a normal public Commune post with `post_type = community_vote`
- a discussion thread
- a `commune_vote_posts` sidecar row
- two or more option rows
- lifecycle event rows

The helper does not create an Official Update.

## Ballot Helper

`castCommunityVoteBallot(input)` is authenticated-member only. It upserts one ballot per `vote_post_id` and `voter_user_id`. The UI blocks anonymous, closed, non-open, and out-of-window votes before calling the database, but RLS remains the authority.

## Lifecycle Helper

`updateCommunityVoteLifecycle(input)` is admin-only. Supported actions are:

- `open`
- `close`
- `reopen`
- `accept`
- `decline`
- `archive`
- `mark_posted_to_official_update`
- `update_outcome`
- `enable_comments`
- `disable_comments`

Each lifecycle change records a vote event.

## Result Aggregation Contract

`commune_vote_result_summary(target_vote_post_ids uuid[])` returns aggregate counts only. It never returns voter identities.

## Signal Console Contract

Signal Console loads Community Voting Room previews for admins/reviewers and owners:

- new/open vote
- closing soon
- closed awaiting outcome
- accepted
- declined
- posted to Official Update
- archived

Voting Room signals remain separate from Official Update signals.
