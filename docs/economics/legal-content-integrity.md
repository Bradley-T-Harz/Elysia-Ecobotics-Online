# Economic legal-content integrity

Economic checkout and account-management consent must bind to the exact reviewed text shown on the website, not merely to a reusable version label or route. This repository therefore content-addresses each canonical economic legal page with SHA-256.

## Canonical semantic payload

The canonical source remains `src/pages/Legal/legalPolicyPages.ts`. For integrity purposes, one page is serialized by `serializeEconomicLegalSemanticContent` as a JSON object with this exact property order:

1. `route`
2. `title`
3. `status`
4. `lastUpdated`
5. `body`

The UTF-8 bytes of that JSON string are hashed with SHA-256. Presentation wrappers, React markup, and navigation outside those semantic fields are not part of the digest. The reviewed versions, metadata, and lowercase 64-character digests are frozen in `src/pages/Legal/economicLegalContentManifest.ts`.

## Change procedure

Changing a canonical page's route, title, status, last-updated date, or body invalidates its digest. Do not update the digest alone to silence the integrity test. A substantive change requires legal and operational review, a new immutable document or consent-bundle version, a forward database migration, updated active pointers only when activation is approved, updated capability expectations, and updated tests. Existing consent records retain their original version and content hash.

The read-only `scripts/economicLegalContentIntegritySmokeTest.mjs` recomputes every digest and verifies the database seed, consent manifests, server parser, and browser parser use the same contract. Run it through the wired package command:

```bash
npm run test:economic-legal-integrity
```

This command is part of `npm run test:billing` and therefore part of the Docker-free phase of `npm run test:release`. Digest agreement is necessary but not sufficient: legal approval, immutable version activation, disposable-database behavior, and external configuration remain independent gates.

## Database and API boundary

Every `private.economic_legal_document_versions` row has a required lowercase SHA-256. Every document inside an immutable consent-bundle manifest has exactly `version`, `path`, and `contentSha256`. Public economic capabilities return those same three fields. Server and browser parsers require exact object keys and reject missing, extra, malformed, stale, or mismatched hashes.

A content hash proves byte-level agreement with this repository manifest; it is not legal approval, legal advice, a signature, proof of enforceability, or permission to activate payments. All economic feature flags remain off until their separate legal, business, banking, processor, security, and operational gates are satisfied.
