# Job Post Policy

Job Post is the Commune room for public opportunity listings: community job posts, EcoSyneva/Elysia opportunities, volunteer calls, paid roles, stipends, research roles, contributor calls, internships when clearly labeled, contract opportunities, moderator/reviewer needs, Developer Forge contributor calls, Marketplace reviewer calls, Living Library curator calls, field/research support, and public project recruitment.

Job Post asks: what public opportunity is available, what is the role, what is the pay/volunteer status, where is it located or remote, how can people safely ask questions, and what must be clear before publication?

## Room Identity

- User-facing room name: Job Post.
- Stable route slug: `job-post`.
- Internal post type: `job_post`.
- Structured metadata lives in `commune_job_posts` and remains linked to a normal `commune_posts` row and thread.

Job Post is not Work With Elysia Ecobotics, a private application system, a resume/CV board, a LinkedIn clone, payroll, contract signing, identity-document intake, or a private applicant database.

## Publication Rule

Normal community users may submit Job Posts, but they must not publish Job Posts directly. Every normal-user Job Post requires admin approval before becoming public.

Administrators may publish directly. Admin direct-publish still preserves the structured metadata, public thread, anti-scam state, and review/history context where the current Commune review system supports it.

## Structured Fields

Job Post separates:

- role title
- organization/project
- role type
- paid/volunteer status
- compensation clarity
- location/remote/hybrid mode
- location details
- time commitment
- deadline
- contact/application path
- requirements/skills
- role summary
- application status
- anti-scam review status
- public safety notes
- Work With private intake bridge note
- public correction/clarification note

The public detail page should render these fields as a structured opportunity listing, not as an undifferentiated generic body.

## Anti-Scam Review States

Reviewer/admin anti-scam states are:

- not reviewed
- reviewed clear
- needs pay clarification
- needs contact clarification
- needs location clarification
- suspicious
- removed

These states are moderation/review signals, not public trust badges. Public users cannot self-assign `reviewed_clear`.

## Listing Status

Public listing statuses are:

- open
- reviewing
- filled
- closed
- archived
- needs clarification

Listing status does not turn the room into private applicant tracking. It only describes the public listing lifecycle.

## Work With Boundary

Job Post is the public board. Work With Elysia Ecobotics is the private application/intake path.

Use Job Post for public listing details and public questions. Use Work With for resumes/CVs, private contact details, private application materials, private attachments, and administrator-review requests.

The Work With/private application notice is system-owned and permanent. Normal Job Post authors cannot erase, weaken, or override the warning that resumes/CVs, identity documents, private contact details, SSNs, bank details, and private application materials belong in Work With Elysia Ecobotics or another safe application path, not public Job Post comments.

## Safety Rules

Job Posts and public comments must not ask for or expose:

- resumes or CVs
- SSNs, tax IDs, bank details, payroll details, or identity documents
- private addresses or private phone numbers
- private application packets or contracts
- private applicant data
- Work With uploads
- credentials, API keys, `.env` files, service-role keys, or private local Elysia data
- hidden review notes or private admin email

Attachments remain governed by Commune media upload, moderation, and public display policies.
