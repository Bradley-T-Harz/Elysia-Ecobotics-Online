# Manifest Reference

An Elysia add-on manifest is a declaration of purpose, compatibility, runtime needs, and permissions. It is not a permission grant.

Required fields include `schema_version`, `addon_id`, `name`, `version`, `description`, `author`, `license`, `permissions`, `compatibility`, `runtime`, and `security`.

Manifests must not include credentials, private keys, private local Elysia memory, absolute local paths, localhost-only public listing URLs, or authority claims.
