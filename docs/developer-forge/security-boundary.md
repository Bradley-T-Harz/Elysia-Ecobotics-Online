# Security Boundary

Developer Forge prepares add-ons for Marketplace review. It does not install, enable, disable, run, or control add-ons.

The public website must not execute uploaded add-on code, package scripts, build hooks, dependency hooks, or shell commands. It must not access local Elysia memory, vaults, logs, credentials, local repositories, or private files.

Static scan catches obvious risks only. Local Elysia remains the final installer and permission authority.

The Forge workbench may provide Monaco syntax highlighting, JSON/Markdown formatting, sanitized Markdown previews, command-palette actions, archive inspection, checksums, and Marketplace previews. These are editing and review aids only. They are not proof of safety, not a signature, not publication, and not permission to run.

Command-palette actions must stay scoped to safe Forge operations such as opening files, validating, formatting, scanning, exporting inert archives, previewing Marketplace metadata, submitting snapshots, and creating revision drafts. The public website must not expose a raw shell, dependency installer, package script runner, or local Elysia controller.
