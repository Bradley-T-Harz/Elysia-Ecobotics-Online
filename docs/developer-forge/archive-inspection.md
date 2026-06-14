# Inert Archive Inspection

Archive inspection supports `.elysia-addon` and `.zip` files using JSZip. Inspection is static and inert: package contents are listed and scanned as data, never executed.

Checks include:

- file inventory
- manifest presence and summary
- README/LICENSE/CHANGELOG/PERMISSIONS presence
- checksums presence and mismatch checks
- path traversal
- absolute paths
- suspicious file count and size limits
- suspicious compression ratio
- `.env`, credential, vault, and private-key filenames
- service-role strings and secret-looking tokens
- package install hooks such as `preinstall` and `postinstall`
- executable/script-like files
- minified or large source-like files
- undeclared network domains where detectable
- manifest entrypoints that reference missing files

Limits are intentionally conservative. Browser inspection can be useful for preview, but it is not a final trust boundary. Reviewers should use the local CLI and future controlled backend inspection for stronger review.

The correct message is: “No blocking issues found by static/archive inspection.” Never say an archive is safe merely because inspection passed.
