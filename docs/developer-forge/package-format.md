# Package Format

A future `.elysia-addon` package should contain `manifest.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, optional assets, and optional source files.

Developer Forge package intake is inert. It can import explicitly selected folders/repositories, ZIP source bundles, `.elysia-addon` files, or a manifest into browser memory and prepare a ZIP-compatible package without executing code. Choosing files does not upload them. A separate acknowledged private-transfer action may store the package for account-backed review when policies are active. Published packages require Marketplace review.

Current Forge exports are inert browser-built starter archives. They may include `manifest.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, `PERMISSIONS.md`, starter placeholder files, and `checksums.json`. Exporting a `.elysia-addon` file from the website does not mean the package is reviewed, published, installed, enabled, or safe. Local Elysia must validate the archive, hashes, permissions, compatibility, revocation status, and user consent before any local installation.

Package inspection limits: the public website performs metadata/static checks only. It does not deeply execute archives, install dependencies, run package hooks, fetch remote dependencies, clone repositories, or prove code safety.

Expected package structure:

```text
manifest.json
README.md
LICENSE
CHANGELOG.md
PERMISSIONS.md
assets/
src/
checksums.json
```

`checksums.json` records SHA-256 hashes for package entries. A checksum match means the bytes match the package manifest, not that the add-on is safe.

The local packager excludes common working folders such as `node_modules`, `.git`, and `dist` by default. It refuses path traversal, absolute paths, `.env` files, credential filenames, and blocking static scan results.

No package hook, build hook, dependency install, repository clone, or add-on runtime code is executed during package creation or inspection. Git URLs are review metadata only.
