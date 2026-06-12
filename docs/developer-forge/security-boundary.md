# Security Boundary

Developer Forge prepares add-ons for Marketplace review. It does not install, enable, disable, run, or control add-ons.

The public website must not execute uploaded add-on code, package scripts, build hooks, dependency hooks, or shell commands. It must not access local Elysia memory, vaults, logs, credentials, local repositories, or private files.

Static scan catches obvious risks only. Local Elysia remains the final installer and permission authority.
