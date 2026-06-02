# Elysia Add-on Manifest Contract

An Elysia add-on manifest is a declaration of an add-on's purpose, dependencies, actions, and security posture. It is not a permission grant.

Required fields include `schema_version`, `id`, `name`, `publisher`, `version`, `category`, `summary`, `description`, `trust_tier`, `local_only`, `network_access`, `dependencies`, `actions`, `security`, and `tags`.

Allowed action kinds include Python package plans, Docker Compose setup/start/stop plans, config toggles, external manager opening, manual instructions, and setup script declarations. Local Elysia must validate and approve every action before execution.

Forbidden manifest patterns include embedded secrets, local passwords, arbitrary shell command fields, private keys, hidden upload endpoints, and claims that the website installed anything locally.
