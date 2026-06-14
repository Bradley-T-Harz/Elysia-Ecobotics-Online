# Package Format

A future `.elysia-addon` package should contain `manifest.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, optional assets, and optional source files.

Developer Forge package intake is inert. It can calculate metadata and private storage paths when policies are active, but it does not build packages or execute code. Published packages require Marketplace review.

Current Forge exports are inert browser-built starter archives. They may include `manifest.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, `PERMISSIONS.md`, starter placeholder files, and `checksums.json`. Exporting a `.elysia-addon` file from the website does not mean the package is reviewed, published, installed, enabled, or safe. Local Elysia must validate the archive, hashes, permissions, compatibility, revocation status, and user consent before any local installation.

Package inspection limits: the public website performs metadata/static checks only. It does not deeply execute archives, install dependencies, run package hooks, fetch remote dependencies, clone repositories, or prove code safety.
