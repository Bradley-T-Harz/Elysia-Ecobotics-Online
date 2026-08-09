# Job Post Policy

Job Post keeps its stable `job-post` route and `job_post` internal type while the v2 model broadens the public form beyond ordinary employment. It supports paid employment, contracts/freelance work, internships, apprenticeships/traineeships, fellowships/funded placements, research, volunteer/community service, community/open-source contribution, testing/feedback calls, future-role interest/talent pools, and clearly explained other opportunities.

The governing principle is: broad enough for legitimate collaboration, structured enough that relationship and compensation cannot be hidden, private enough that applications do not become public dossiers, and moderated enough that publication does not become a scammer's free billboard.

## Separate public concepts

V2 stores these separately:

- opportunity type;
- affirmative compensation status and one or more compatible compensation models;
- amount/range, currency, and period when compensation is quantifiable;
- work arrangement;
- time basis and duration;
- poster/organization type;
- optional experience/eligibility;
- legitimate application-route type and destination/instructions.

Relationship labels do not decide worker classification. Posters remain responsible for complying with applicable wage, employment, contractor, internship, volunteer, pay-transparency, nondiscrimination, privacy, and other laws.

## Compensation truth

Every v2 opportunity must declare one of: paid; stipend/funded; unpaid/volunteer; reimbursement only; academic credit only; mixed/multiple; future compensation not established; or other. “Future compensation not established” is available only for an explicit future-role interest/talent-pool notice. It is never a generic escape hatch.

Salary, hourly, fixed-fee, milestone, stipend, fellowship, and honorarium models require a positive amount/minimum, three-letter currency, and amount basis. Commission, reimbursement, academic credit, mixed, and other terms require an explanation. Blank or `must_clarify` is not a valid v2 compensation declaration.

## Progressive disclosure

The composer is a single accessible page using native fieldsets, selects, inputs, checkboxes, and textareas. It reveals only the details relevant to the selected relationship, compensation, and application route. Testing/feedback calls require a participation/privacy note. Future-role notices require an acknowledgement that no opening, offer, or promise exists. “Other” requires an explanation.

## Publication and verification

Ordinary-user submissions require governed review before publication. Administrator submissions still pass through the governed Job Post review RPC and the independent economic publication condition. Payment cannot buy approval, publication, trust, or ranking.

Publication is not endorsement or verification. Elysia Ecobotics does not guarantee a poster's identity, legitimacy, compensation, safety, accuracy, or legal compliance. Readers must verify the organization and application destination independently.

## Application privacy

Public posts and comments must not contain resumes/CVs, Social Security numbers, tax or bank information, identity documents, private addresses, private phone numbers, account credentials, contracts, or sensitive application packets. Serious applications must use an independently verified official application page, organization contact, repository/contribution route, or authorized first-party Work With flow.

The Work With route is not generic. Only an authorized administrator may select the canonical private Work With route. Selecting it is an explicit declaration that the listing is genuinely Elysia Ecobotics / EcoSyneva-originated; ordinary users remain denied and third-party opportunities must use their own legitimate destination. Frontend validation and restrictive RLS both enforce administrator authority and the exact route without relying on free-text organization-name matching.

## Review and anti-scam signals

Reviewers see the generic post and structured sidecar as one presentation case while both underlying review records and audit history remain intact. Advisory signals can prioritize applicant-payment language, sensitive-information requests, domain mismatch, pressure/guarantee language, missing organization context, and unpaid opportunities from for-profit posters. Signals are not legal conclusions, automated scam findings, or automatic rejection.

Decision reasons are submitter-visible. Private reviewer notes use RLS-protected `review_comments` with `visibility = 'internal'`; new code must never store a private note in the public-row `commune_job_posts.private_application_note` legacy column.

## Compatibility

Existing rows remain `model_version = 1`. No ambiguous legacy value is guessed. Deterministic mappings may describe contract, internship, volunteer, paid/stipend/unpaid/mixed, and remote/hybrid/onsite/field-based values, while unclear legacy rows stay visibly legacy. New rows use `model_version = 2` and dual-write legacy fields for old consumers.

Generic Commune links, media, tags, comments, reports, saves, notifications, moderation, and billing remain shared and unchanged in authority.
