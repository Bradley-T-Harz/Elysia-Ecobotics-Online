# Community Voting Room Security Boundary

The Community Voting Room uses dedicated sidecar tables under Commune post ownership. The linked `commune_posts` row controls public visibility; vote sidecars carry advisory governance metadata, options, ballots, and lifecycle events.

## RLS Model

RLS is enabled on:

- `commune_vote_posts`
- `commune_vote_options`
- `commune_vote_ballots`
- `commune_vote_events`

Public and authenticated readers can read public vote metadata, options, and public events only when the linked Commune post is public and published.

## Anonymous Boundary

Anonymous visitors can view public votes where RLS allows. They cannot insert or update ballots, cannot manage lifecycle state, and cannot see voter identities.

## Authenticated Member Boundary

Authenticated members can read their own ballot. They cannot read other members' ballots.

Authenticated members can insert or update exactly their own ballot only while:

- `vote_status = 'open'`
- `opens_at` is null or already reached
- `closes_at` is null or not yet passed
- the linked Commune post is public and published
- the selected option belongs to the same vote

Closed, scheduled, archived, accepted, declined, posted-to-Official-Update, and out-of-window votes reject ballot writes at the database policy layer.

## Result Privacy

Public result paths return aggregate counts only:

- `vote_post_id`
- `option_id`
- `ballot_count`
- `total_ballots`
- `percentage`

The public aggregate result function does not return `voter_user_id` and does not expose individual ballot rows.

## Admin And Reviewer Boundary

Admins can create and manage vote metadata, options, events, lifecycle state, comment locks, and outcome summaries. Reviewers/admins can read staff-level events and audit-level rows where existing Commune review-role helpers allow it.

The feature reuses the existing admin/reviewer role helpers. It does not create a new role system.

## Official Update Boundary

Community votes do not automatically create Official Updates. A vote can store an optional `official_update_post_id`, but that field is a manual reference only. Official Update publishing, correction, retraction, and admin authority remain separate.

This feature does not automatically create Official Updates.
