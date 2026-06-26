# Job Post Security Boundary

Job Post is a public, moderated opportunity listing room. It is not private hiring infrastructure and must not store or expose applicant secrets, resumes/CVs, identity documents, financial data, or Work With private uploads.

## What Job Post May Store

- Public opportunity title and summary.
- Public organization/project context.
- Public role type, pay/volunteer clarity, location/remote mode, time commitment, deadline, and requirements.
- Public-safe contact or application path.
- Public status such as open, reviewing, filled, closed, archived, or needs clarification.
- Reviewer/admin anti-scam state.
- Public correction or clarification note when needed.
- Public attachments allowed by Commune media policy.

## What Job Post Must Not Store

- Resumes, CVs, private application packets, private contracts, or private applicant profiles.
- SSNs, tax IDs, bank details, payroll details, identity documents, private addresses, or private phone numbers.
- Work With Elysia Ecobotics private uploads or private intake details.
- Private account email, hidden reviewer notes, private admin email, or private identity fields.
- Service-role keys, `.env` files, credentials, tokens, logs, vault data, local paths, private local Elysia memory/files, or machine data.

## Public Read Boundary

`commune_job_posts` public reads are allowed only when the linked `commune_posts` row is a published public `job_post`. Authors can read their own rows, and assigned reviewers/admins can read rows for moderation.

## Admin Approval Boundary

Normal-user Job Posts must remain `pending_review` until admin approval. Admin direct-publish is allowed, but it still records structured metadata and does not weaken media, report, comment, or anti-scam safety rules.

## Anti-Scam Boundary

Anti-scam review states are assigned by moderators/reviewers/admins. They are not user-controlled trust badges and do not prove employment legitimacy, legal compliance, payment safety, or suitability.

## Work With Boundary

Work With Elysia Ecobotics remains the private intake path. Job Post may link to Work With, but it must not expose Work With uploads, private applications, resumes, CVs, or applicant data.

## No Execution Boundary

Job Post does not execute code, clone repositories, install packages, run shell commands, or invoke sandbox execution by default. It is an opportunity board, not a code runtime or application processor.
