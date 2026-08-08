# Opportunity Commons Security Boundary

Opportunity Commons is a public, moderated listing room. It is not an applicant-tracking system, staffing agency, identity-verification service, payroll system, contract-signing system, or private hiring database.

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

`commune_job_posts` is publicly readable only with its linked published/public `commune_posts` row, or to its owner/reviewers under existing policy. V2 check constraints require complete structured truth and compatible conditional combinations. Restrictive insert/update policies reserve `private_work_with` for a current administrator, an exact first-party organization, and `/work-with-elysia-ecobotics`.

Ordinary-user publication remains backend governed through RLS, review RPCs, publication functions, service restrictions, and fail-closed triggers. V2 does not weaken those controls. The separately deferred transactional Job creation RPC is not part of this implementation.

## Private reviewer notes

`commune_job_posts.private_application_note` is a legacy column on a publicly row-readable table and therefore is not a private storage location. V2 clients do not select or write it. Protected notes are inserted into `review_comments` as `internal`, whose RLS allows only authorized reviewers to read them. Decision reasons remain separately visible to submitters.

## Advisory review signals

Client-side signals help reviewers prioritize suspicious payment, gift-card/crypto/fake-check/equipment-purchase language, sensitive-information requests, pressure/guarantee language, domain mismatch, missing organization context, and unpaid-for-profit combinations. They do not certify safety and do not automatically accuse, reject, publish, or alter payment state.

## Non-endorsement and no execution

Moderation, publication, labels, and payment state are not identity or opportunity verification. Opportunity labels do not determine legal worker status. Job Post content never executes code, clones repositories, installs packages, runs commands, or invokes a sandbox by default.
