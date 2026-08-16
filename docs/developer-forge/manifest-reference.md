# Manifest Reference

An Elysia add-on manifest is a declaration of purpose, compatibility, runtime needs, and permissions. It is not a permission grant.

The canonical v1 package filename is `manifest.json`. Local Elysia's canonical package schema is `1.1`; the current Website Forge editing/submission contract remains legacy `1.0` until its stored permission catalog and review records are migrated together. Browser intake recognizes both states honestly. See `local-elysia-manifest-compatibility.md`.

Required fields include `schema_version`, `addon_id`, `name`, `version`, `description`, `author`, `license`, `permissions`, `compatibility`, `runtime`, and `security`.

Manifests must not include credentials, private keys, private local Elysia memory, absolute local paths, localhost-only public listing URLs, or authority claims.

Marketplace validation is not final install authority. Local Elysia reopens and revalidates every package before install-disabled staging or enablement, and may refuse a Marketplace-reviewed package.
