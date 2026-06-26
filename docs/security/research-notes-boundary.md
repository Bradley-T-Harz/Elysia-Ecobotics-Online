# Research Notes Security Boundary

Research Notes is public, moderated research discussion. It is not a place for private research storage, hidden reviewer notes, sealed Elysia memory, credentials, sensitive ecological location data, or private site data.

## What Research Notes May Store

- Public research question/topic.
- Public domain or ecological subsystem.
- Public evidence summary, observation, interpretation, uncertainty, and citation notes.
- Public Living Library source links or source references.
- Public attachments allowed by Commune media policy.
- Public correction notes when moderation or author correction changes interpretation.

## What Research Notes Must Not Store

- Service-role keys, API keys, passwords, secrets, `.env` files, or credentials.
- Private local Elysia memory, files, logs, vaults, request traces, or machine data.
- Hidden reviewer notes or internal moderation deliberation.
- private research participant data.
- Sensitive ecological location data, species/site locations, or private landowner data.
- Copyrighted full-text papers unless sharing is permitted.
- Private account email or identity fields.

## Public Read Boundary

`commune_research_notes` public reads are allowed only when the linked `commune_posts` row is a published public `research_note` post. Authors can read their own rows, and assigned reviewers/admins can read rows for moderation.

## Review Boundary

Research-specific review states such as `needs_citation`, `needs_clarification`, `source_issue`, and `overclaiming_evidence` are moderation aids. They do not become public authority claims and do not reveal hidden reviewer notes.

## Living Library Boundary

Research Notes may link to public Living Library sources, but a link is not a verified source card, source approval, or canonical Living Library record. Broken-source reporting and source lookup can be added later without weakening this boundary.

## No Execution Boundary

Research Notes does not execute code, run repositories, install packages, clone sources, or invoke sandbox execution by default. If a future selected-artifact review path is added, it must follow the same no-root, no-network-by-default, no-secret, no-local-Elysia sandbox boundaries as Coding Cornucopia.
