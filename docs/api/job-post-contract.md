# Opportunity Commons / Job Post API Contract

Stable identifiers remain `job-post`, `job_post`, and `public.commune_job_posts`. V2 is an additive sidecar extension, not a new room or replacement table.

## Creation flow

`submitJobPost` still creates the generic `commune_posts` record, thread, structured sidecar, optional shared media, and review items. Creation is not yet transactional; the separately proposed transactional RPC is explicitly deferred. All ordinary-user posts start non-public. Administrators use the same governed Job Post review boundary after the subject and sidecar exist.

## Versions and compatibility

- Existing records default to `model_version = 1` and retain every legacy column and constraint.
- V2 records set `model_version = 2` and populate the new structured columns.
- New submissions dual-write deterministic legacy `role_type`, `paid_volunteer_status`, `location_mode`, `compensation_clarity`, and `contact_path` values.
- Readers request v2 columns first and fall back to the legacy projection if code is temporarily running before the additive migration.
- Legacy rows are not rewritten or guessed. Deterministic presentation mappings are explicitly limited.

## V2 columns

`opportunity_type`, `opportunity_details`, `poster_type`, `organization_website`, `compensation_status`, `compensation_models`, `compensation_currency`, `compensation_min_amount`, `compensation_max_amount`, `compensation_period`, `compensation_details`, `benefits_summary`, `work_arrangement`, `time_basis`, `duration_type`, `experience_level`, `application_route_type`, `application_destination`, `application_instructions`, `testing_privacy_note`, and `future_interest_acknowledged`.

Legacy title, organization, location text, time commitment, deadline, requirements, safety, summary, application lifecycle, moderation, correction, and timestamp fields remain in place.

## Validation layers

The centralized `jobOpportunityModel.ts` owns TypeScript types, option lists, normalization, labels, display formatting, conditional validation, dual-write mapping, deterministic legacy projection, public URL/email rules, and advisory reviewer signals. The composer and API both validate. PostgreSQL CHECK constraints independently enforce allowed values, v2 completeness, compensation compatibility, amounts, conditional text, and route shape.

The `private_work_with` route additionally requires a restrictive database policy: administrator authority, exact first-party organization name, and canonical destination.

## Review projection

The admin client joins `commune_posts` and `commune_job_posts` review records into one presentation case keyed by post id. It keeps all underlying ids and history. The case shows opportunity, poster, compensation, work/time, location, application route/domain, organization website, requirements, safety context, submitted generic links, and advisory flags.

Submitter-visible decision reasons continue through governed review. Protected reviewer notes use `review_comments.visibility = 'internal'`. V2 never writes `private_application_note`.

## Public projection and discovery

Cards remain compact: opportunity, compensation status/summary, work arrangement, and listing status. Detail pages show the structured model, safe application destination, privacy warning, and publication-not-verification statement. Legacy listings are identified and never presented as v2-complete.

Only three public Job Post filters are added: opportunity type, compensation status, and work arrangement. Search also includes the structured values. No ATS-style filter explosion or public applicant state is introduced.

## Billing and moderation independence

Opportunity type does not classify a post as commercial/free/waived/subsidized. Existing private economic classification and its two-fact publication gate remain independent. Fee enforcement stays disabled/test-gated unless separately configured and approved. `reconciliation_required` is a valid fail-closed economic result.

Payment never grants content approval. Content approval never fabricates payment. Neither proves identity, legitimacy, compensation, safety, or legal compliance.
