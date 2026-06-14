# Admin Package Inspection UI

The admin add-on submissions queue is a static inspection surface. Reviewers can inspect Developer Forge submissions without executing package contents.

The UI may show:

- submission status and developer profile summary
- manifest JSON
- declared permissions, reasons, scopes, and risk acknowledgement
- package file name, size, storage metadata, SHA-256, scan status, and signature status
- validation and compatibility results
- Marketplace preview
- private publication/revocation event history
- archive inspection status, risk level, manifest summary, and file inventory when available

The UI must not expose private package storage paths publicly. Private reviewer notes stay internal. Developer-facing feedback is separate and may be shown to the submitter.

Static scan success is not a proof of safety. Local Elysia remains final runtime and installer authority.

Deep archive inspection is still inert. Reviewers can see file lists, hashes, warnings, and blocking issues, but the website does not execute package contents.
