# Marketplace Local Install Contract

The public website is a catalog, account, review, saved-library, install-intent, revocation, and trust surface. Local Elysia is the final installer authority.

The website may create a short-lived install intent and open an `elysia://` invitation. It may not silently install, enable, disable, remove, execute, or control local Elysia.

Third-party add-ons install into the sibling `Add-ons/` folder, not inside the Elysia core. Local Elysia validates package structure, checksums, permissions, and revocation state before any local state change.
