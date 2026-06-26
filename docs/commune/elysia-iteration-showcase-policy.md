# Elysia Iteration Showcase Policy

Elysia Iteration Showcase is the Commune room for public progress context: demos, screenshots, UI updates, version/build notes, add-on previews, design progress, and visible iteration reports.

It is a sibling of Repository Showcase and Coding Cornucopia, not a clone of either room. Iteration posts may reference repositories, commits, pull requests, releases, selected snippets, screenshots, or demo notes, but the room remains public metadata and discussion by default.

## Public Boundary

- Iteration Showcase posts are public only after normal Commune moderation or admin publish.
- Posts are progress/demo context, not Official Updates.
- Posts do not claim release authority, security advisory status, compatibility certification, production readiness, Developer Forge approval, Marketplace readiness, installability, or trust.
- Users must not include private prompts, local paths, credentials, logs, vault contents, sealed memory, private screenshots, private repo data, hidden moderator notes, or local Elysia data.

## Structured Metadata

Structured rows live in `commune_iteration_showcases` and link to normal `commune_posts` by `post_id`. Public post details should render the structured metadata when available and fall back to the post body for older posts.

Expected metadata includes:

- iteration type
- version/build label
- what changed
- why it matters
- known limitations
- next step
- optional public source/repo URL
- provider, branch, commit, release tag, and pull request reference
- testing status and compatibility note
- risk/context flags
- import source and public import metadata
- selected-artifact sandbox review status

## GitHub / Source Import

The public GitHub import path may fetch public metadata for preview and user review. It must not use OAuth, private repository access, cloning, install scripts, builds, dependency installation, shell commands, or execution.

## Sandbox Review

Iteration Showcase sandbox review is selected-artifact only. A user may paste a public-safe snippet, config, manifest, or small artifact into the review route. The system must not run a whole repository, install dependencies, clone source code, invoke shell, call Local Elysia, or treat sandbox success as approval.

Developer Forge and Marketplace review remain separate.
