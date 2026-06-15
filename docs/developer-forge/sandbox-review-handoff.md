# Developer Forge Sandbox Review Handoff

Developer Forge may prepare add-on or package metadata for a future sandbox review request, but it does not execute packages, install dependencies, run package scripts, clone repositories, or call Local Elysia.

If a Forge draft needs future sandbox review, the website should create a metadata-only sandbox request. Reviewers can approve that request for Local Elysia handoff export. The exported JSON is not a runtime package and is not proof that the add-on is safe.

Local Elysia must revalidate the request, ask explicit local approval, and enforce sandbox/network/filesystem limits before any future execution layer exists.
