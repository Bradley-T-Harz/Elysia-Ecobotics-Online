# Research Notes Policy

Research Notes is the Commune room for public research-oriented discussion: evidence summaries, source discussion, ecological observations, citation notes, uncertainty, methods/context, and Living Library-linked work.

Research Notes asks: what evidence do we have, what does it suggest, what are the limits, and where does interpretation begin?

## Room Identity

- User-facing name: Research Notes.
- Stable route slug: `research-notes`.
- Internal post type remains `research_note` for compatibility.
- Structured metadata lives in `commune_research_notes` and remains linked to a normal `commune_posts` row.

Research Notes is not an Official Update, Living Library source record, Media Garden post, Troubleshooting Grove issue, Repository Showcase, Elysia Iteration Showcase, Coding Cornucopia code collaboration space, certification, or private research storage.

## Structured Fields

Research Notes separates:

- research question/topic
- domain
- evidence strength/confidence
- Living Library source link
- citation notes
- evidence summary
- observation
- interpretation
- uncertainty
- context/discussion
- source links
- geographic scope
- ecological subsystem
- method type
- data type
- ethics/sensitivity note

The public detail page should render these fields as structured research context, not as an undifferentiated blog body.

## Evidence Strength

Allowed evidence-strength values are:

- preliminary
- anecdotal
- moderate
- strong
- mixed
- needs verification
- unknown

Evidence strength is a descriptive signal only. It is not authority, rank, certification, official endorsement, or a trust badge.

## Review States

Research-specific review states are:

- submitted
- published
- needs citation
- needs clarification
- source issue
- overclaiming evidence
- corrected
- archived

Reviewer notes remain in private review/admin systems. Public correction notes may be shown when they help readers understand a correction, source issue, or evidence-boundary change.

## Safety Rules

Research Notes must not expose:

- private research participant data
- sensitive ecological location data
- private site or landowner data
- copyrighted full-text papers unless the author has rights to share them
- credentials, API keys, `.env` files, machine paths, logs, vaults, or private local Elysia data
- private prompts, hidden review notes, private account data, or service-role keys

Attachments remain governed by Commune upload, moderation, and media display policies.

## Living Library Boundary

A Living Library source link is metadata. It does not prove source quality, create a canonical Living Library source record, or imply source approval. Future Living Library integration may add source lookup and source cards, but Research Notes must still preserve evidence, interpretation, and uncertainty boundaries.

