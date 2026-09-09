# Job Post Security Boundary

Job Post is a public, moderated listing room. It is not an applicant-tracking system, staffing agency, identity-verification service, payroll system, contract-signing system, or private hiring database.

## Public data allowed

- Opportunity, poster, compensation, work, time, eligibility, location, deadline, and requirements.
- Public-safe organization website and legitimate application destination/instructions.
- Public correction and listing-lifecycle state.
- Shared Commune links and policy-allowed public attachments.

## Public data prohibited

- Resumes/CVs, applicant profiles, application packets, contracts, or Work With uploads.
- SSNs, tax IDs/forms, bank or payroll details, identity documents, private addresses, or private phone numbers.
- Credentials, tokens, `.env` content, service-role keys, private logs, vault data, local paths, or local Elysia private data.
- Hidden reviewer notes or investigation details.

## Database and RLS

`commune_job_posts` is publicly readable only with its linked published/public `commune_posts` row, or to its owner/reviewers under existing policy. V2 check constraints require complete structured truth and compatible conditional combinations. Restrictive insert/update policies reserve `private_work_with` for a current administrator and `/work-with-elysia-ecobotics`. Selecting that admin-only route declares first-party Elysia Ecobotics / EcoSyneva origin; free-text organization names are display content, not authority.

Ordinary-user publication remains backend governed through RLS, review RPCs, publication functions, service restrictions, and fail-closed triggers. V2 does not weaken those controls. The separately deferred transactional Job creation RPC is not part of this implementation.

## Private reviewer notes

`commune_job_posts.private_application_note` is a legacy column on a publicly row-readable table and therefore is not a private storage location. V2 clients do not select or write it. Protected notes are inserted into `review_comments` as `internal`, whose RLS allows only authorized reviewers to read them. Decision reasons remain separately visible to submitters.

## Participant economic requests

Migration `20260909010000_job_post_participant_economic_requests.sql` prepares a separate `private.job_post_economic_requests` intake table. Forced RLS is enabled, and direct table privileges are revoked from `anon`, `authenticated` and `service_role`. Only the narrowly scoped authenticated RPCs in the [Job Post contract](../api/job-post-contract.md#private-participant-fee-requests-forward-migration-20260909010000) expose these records. Both use a fixed empty search path and derive the actor from the verified session. No production migration is implied by the presence of this file.

An authorized economic operator can read the shared title and request; being an administrator, a content reviewer or another poster grants no such access. Only `economic_assistance_manage` permits a private reply. `job_fee_assess` permits the queue and assessment doorway but does not permit replies. Direct financial mutations continue to require their existing service-role, capability, grant and feature checks. A client cannot turn request handling into a waiver, grant, price change, refund, charge, content approval or publication event.

Explanations/replies are plain text, bounded to 500 characters, and never copied into public post bodies, review-item bodies, notifications, local storage or draft exports. The participant form requests no files or exact income and warns against sensitive documents and payment credentials. There is no automatic deletion or adopted request-retention duration. These records belong in the existing assisted private economic export/retention inventory; deployment review must account for that additional scope without promising automated artifact delivery or erasure. Withdrawal is a reversible handling state, not data erasure or revocation of an existing grant.

Local verification covers direct table/RPC grants, owner and operator isolation, expired/revoked authority, account bans, strict payloads, repeat/stale commands, rate bounds, pagination, existing grant projection and unchanged publication/payment state. All synthetic fixtures run only in the disposable local database and browser interception harness. They are not migration seeds and must never run against production.

## Advisory review signals

Client-side signals help reviewers prioritize suspicious payment, gift-card/crypto/fake-check/equipment-purchase language, sensitive-information requests, pressure/guarantee language, domain mismatch, missing organization context, and unpaid-for-profit combinations. They do not certify safety and do not automatically accuse, reject, publish, or alter payment state.

## Non-endorsement and no execution

Moderation, publication, labels, and payment state are not identity or opportunity verification. Opportunity labels do not determine legal worker status. Job Post content never executes code, clones repositories, installs packages, runs commands, or invokes a sandbox by default.
