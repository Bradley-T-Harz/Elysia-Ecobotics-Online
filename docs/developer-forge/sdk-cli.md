# Elysia Add-on SDK and CLI

The repo-local SDK lives in `packages/addon-sdk`. The local CLI wrapper is `scripts/elysiaAddonCli.mjs` and is exposed through npm scripts.

Intended future package names:

- `@elysia-ecobotics/addon-sdk`
- `@elysia-ecobotics/elysia-addon-cli`

Local commands:

```bash
npm run addon:init -- my-addon --template theme-pack
npm run addon:validate -- ./my-addon
npm run addon:scan -- ./my-addon
npm run addon:package -- ./my-addon --out ./dist/my-addon.elysia-addon
npm run addon:inspect -- ./dist/my-addon.elysia-addon
npm run addon:doctor
```

The CLI reads only the path you provide. It does not scan your home directory, private local Elysia files, vaults, credentials, logs, or machine data unless you explicitly point it at those paths. Do not do that.

The CLI never installs dependencies, runs package scripts, builds submitted code, clones repositories, executes shell commands from package metadata, uploads files, or submits to a live API in this pass.
