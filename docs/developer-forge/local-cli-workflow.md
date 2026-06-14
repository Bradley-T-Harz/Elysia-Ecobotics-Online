# Local CLI Workflow

1. Initialize a starter:

```bash
npm run addon:init -- my-addon --template documentation-helper
```

2. Edit `manifest.json`, `README.md`, `PERMISSIONS.md`, and any inert source/asset files.

3. Validate and scan:

```bash
npm run addon:validate -- ./my-addon
npm run addon:scan -- ./my-addon
```

4. Package only after blocking issues are gone:

```bash
npm run addon:package -- ./my-addon --out ./dist/my-addon.elysia-addon
```

5. Inspect the archive:

```bash
npm run addon:inspect -- ./dist/my-addon.elysia-addon
```

Packaging is inert. It does not run builds, dependency installs, package scripts, repository commands, or local Elysia actions. Submission/publishing remains separate from local packaging.
