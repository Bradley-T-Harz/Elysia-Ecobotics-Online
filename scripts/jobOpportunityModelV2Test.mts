import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  JOB_OPPORTUNITY_MODEL_VERSION,
  availableCompensationModelsForStatus,
  deterministicV2FromLegacy,
  emptyJobOpportunityDraft,
  formatJobCompensation,
  jobApplicationRouteTypes,
  jobCompensationModels,
  jobCompensationStatuses,
  jobDurationTypes,
  jobOpportunityPayload,
  jobOpportunityReviewerFlags,
  jobOpportunityTypes,
  jobPosterTypes,
  jobTimeBases,
  jobWorkArrangements,
  legacyFieldsForOpportunity,
  normalizeJobOpportunityDraft,
  validateJobOpportunity,
  type JobOpportunityDraft,
} from "../src/pages/The-Elysia-Commune/jobOpportunityModel.ts";

const expected = {
  opportunity: ["paid_employment", "contract_freelance", "internship", "apprenticeship_traineeship", "fellowship_funded_placement", "research_opportunity", "volunteer_community_service", "community_open_source_contribution", "testing_feedback_call", "future_role_interest_talent_pool", "other"],
  status: ["paid", "stipend_funded", "unpaid_volunteer", "reimbursement_only", "academic_credit_only", "mixed_multiple", "future_compensation_not_established", "other"],
  models: ["salary", "hourly", "fixed_project_fee", "milestone_project_payment", "stipend", "fellowship_funding", "honorarium", "commission", "reimbursement_expenses", "academic_credit", "unpaid_volunteer", "other"],
  arrangement: ["onsite", "remote", "hybrid", "field_based", "multiple_locations", "flexible_varies", "other"],
  time: ["full_time", "part_time", "flexible_as_needed", "one_time_event", "other"],
  duration: ["temporary", "seasonal", "project_based", "fixed_term", "recurring", "ongoing", "other"],
  poster: ["business_company", "nonprofit_charity", "government_public_agency", "education_research_institution", "cooperative", "community_organization", "open_source_project", "independent_individual", "informal_community_initiative", "other"],
  route: ["official_application_webpage", "organization_contact", "repository_contribution_instructions", "private_work_with", "other_legitimate"],
};
assert.deepEqual(jobOpportunityTypes, expected.opportunity, "opportunity taxonomy drifted");
assert.deepEqual(jobCompensationStatuses, expected.status, "compensation-status taxonomy drifted");
assert.deepEqual(jobCompensationModels, expected.models, "compensation-model taxonomy drifted");
assert.deepEqual(jobWorkArrangements, expected.arrangement, "work-arrangement taxonomy drifted");
assert.deepEqual(jobTimeBases, expected.time, "time-basis taxonomy drifted");
assert.deepEqual(jobDurationTypes, expected.duration, "duration taxonomy drifted");
assert.deepEqual(jobPosterTypes, expected.poster, "poster taxonomy drifted");
assert.deepEqual(jobApplicationRouteTypes, expected.route, "application-route taxonomy drifted");

function validDraft(overrides: Partial<JobOpportunityDraft> = {}): JobOpportunityDraft {
  return normalizeJobOpportunityDraft({
    ...emptyJobOpportunityDraft,
    opportunityType: "paid_employment",
    posterType: "business_company",
    organizationWebsite: "https://organization.example/about",
    compensationStatus: "paid",
    compensationModels: ["salary"],
    compensationCurrency: "USD",
    compensationMinAmount: "64000",
    compensationMaxAmount: "82000",
    compensationPeriod: "year",
    workArrangement: "remote",
    timeBasis: "full_time",
    durationType: "ongoing",
    experienceLevel: "entry_early_career",
    applicationRouteType: "official_application_webpage",
    applicationDestination: "https://organization.example/careers/apply",
    ...overrides,
  });
}

assert.equal(validateJobOpportunity(emptyJobOpportunityDraft).ok, false, "blank v2 draft must fail closed");
const paid = validDraft();
assert.equal(validateJobOpportunity(paid).ok, true, "complete paid opportunity should validate");
const payload = jobOpportunityPayload(paid);
assert.equal(payload.model_version, JOB_OPPORTUNITY_MODEL_VERSION);
assert.deepEqual(payload.compensation_models, ["salary"]);
assert.equal(payload.compensation_min_amount, 64000);
assert.equal(payload.application_destination, "https://organization.example/careers/apply");
assert.match(formatJobCompensation(payload), /Paid.*Salary.*USD.*64,000.*82,000.*year/i);

assert.deepEqual(availableCompensationModelsForStatus("paid").map((item) => item.value), ["salary", "hourly", "fixed_project_fee", "milestone_project_payment", "honorarium", "commission", "other"]);
assert.deepEqual(availableCompensationModelsForStatus("stipend_funded").map((item) => item.value), ["stipend", "fellowship_funding"]);
assert.equal(validateJobOpportunity(validDraft({ compensationModels: ["salary", "unpaid_volunteer"] })).ok, false, "paid cannot hide an unpaid component; Mixed is required");
assert.equal(validateJobOpportunity(validDraft({ compensationStatus: "stipend_funded", compensationModels: ["stipend", "commission"] })).ok, false, "funded status cannot carry a contradictory commission model");
assert.equal(validateJobOpportunity(validDraft({ compensationModels: ["honorarium"], compensationDetails: "" })).ok, false, "honorarium terms must be explained");
assert.equal(validateJobOpportunity(validDraft({ compensationModels: ["commission"], compensationCurrency: "", compensationMinAmount: "", compensationMaxAmount: "", compensationPeriod: "", compensationDetails: "20 percent of collected revenue after refunds." })).ok, true, "commission may be disclosed through explicit terms when no deterministic amount exists");

for (const [status, model] of [["unpaid_volunteer", "unpaid_volunteer"], ["reimbursement_only", "reimbursement_expenses"], ["academic_credit_only", "academic_credit"]] as const) {
  const draft = validDraft({ compensationStatus: status, compensationModels: [model], compensationCurrency: "", compensationMinAmount: "", compensationMaxAmount: "", compensationPeriod: "", compensationDetails: status === "unpaid_volunteer" ? "" : "Terms are explained clearly here." });
  assert.equal(validateJobOpportunity(draft).ok, true, `${status} should use its explicit fixed model`);
  assert.equal(validateJobOpportunity({ ...draft, compensationModels: [] }).ok, false, `${status} cannot become an empty/ambiguous declaration`);
}

const mixed = validDraft({ compensationStatus: "mixed_multiple", compensationModels: ["hourly", "reimbursement_expenses"], compensationDetails: "Hourly pay plus documented travel reimbursement." });
assert.equal(validateJobOpportunity(mixed).ok, true, "Mixed should retain ordered underlying models");
assert.deepEqual(jobOpportunityPayload(mixed).compensation_models, ["hourly", "reimbursement_expenses"]);
assert.equal(validateJobOpportunity({ ...mixed, compensationModels: ["hourly"] }).ok, false, "Mixed needs at least two real models");

const future = validDraft({ opportunityType: "future_role_interest_talent_pool", compensationStatus: "future_compensation_not_established", compensationModels: [], compensationCurrency: "", compensationMinAmount: "", compensationMaxAmount: "", compensationPeriod: "", futureInterestAcknowledged: true });
assert.equal(validateJobOpportunity(future).ok, true, "future-interest exception must be explicit and acknowledged");
assert.equal(validateJobOpportunity({ ...future, opportunityType: "research_opportunity" }).ok, false, "future-TBD cannot be used outside future-interest posts");
assert.equal(validateJobOpportunity({ ...future, futureInterestAcknowledged: false }).ok, false, "future-interest notice must carry its no-promise acknowledgement");

assert.equal(validateJobOpportunity(validDraft({ opportunityType: "testing_feedback_call", testingPrivacyNote: "" })).ok, false, "testing calls need a privacy/data-use note");
assert.equal(validateJobOpportunity(validDraft({ opportunityType: "testing_feedback_call", testingPrivacyNote: "Participants share browser feedback only; no credentials are collected." })).ok, true);
assert.equal(validateJobOpportunity(validDraft({ opportunityType: "other", opportunityDetails: "too short" })).ok, false, "Other cannot be an ambiguity escape hatch");
assert.equal(validateJobOpportunity(validDraft({ opportunityType: "other", opportunityDetails: "A clearly described community relationship." })).ok, true);

for (const badDestination of ["", "javascript:alert(1)", "http://localhost/apply", "http://127.0.0.1/apply", "http://192.168.1.8/apply", "https://internal/apply"]) {
  assert.equal(validateJobOpportunity(validDraft({ applicationDestination: badDestination })).ok, false, `public application destination must reject ${badDestination || "blank"}`);
}
assert.equal(validateJobOpportunity(validDraft({ applicationRouteType: "organization_contact", applicationDestination: "jobs@organization.example" })).ok, true, "official organization email remains supported");
assert.equal(validateJobOpportunity(validDraft({ applicationRouteType: "private_work_with", applicationDestination: "/work-with-elysia-ecobotics" }), { isAdmin: false }).ok, false, "ordinary users cannot select private Work With");
assert.equal(validateJobOpportunity(validDraft({ applicationRouteType: "private_work_with", applicationDestination: "" }), { isAdmin: true }).ok, false, "private Work With must use the exact first-party route");
assert.equal(validateJobOpportunity(validDraft({ applicationRouteType: "private_work_with", applicationDestination: "/work-with-elysia-ecobotics" }), { isAdmin: true }).ok, true, "canonical administrator authority plus the explicit first-party route should validate");

const legacy = legacyFieldsForOpportunity(payload);
assert.equal(legacy.role_type, "paid_role");
assert.equal(legacy.paid_volunteer_status, "paid");
assert.equal(legacy.location_mode, "remote");
assert.equal(legacy.contact_path, payload.application_destination);
assert.equal(deterministicV2FromLegacy({ role_type: "contract", paid_volunteer_status: "paid", location_mode: "remote" }).opportunity_type, "contract_freelance");
assert.equal(deterministicV2FromLegacy({ role_type: "other", paid_volunteer_status: "must_clarify", location_mode: "unspecified" }).opportunity_type, undefined, "ambiguous legacy values must not be guessed");

const flags = jobOpportunityReviewerFlags({
  ...payload,
  poster_type: "business_company",
  opportunity_type: "internship",
  compensation_status: "unpaid_volunteer",
  compensation_models: ["unpaid_volunteer"],
  organization_project: "Example Co",
  organization_website: "https://example.org",
  application_destination: "https://different.example/apply",
  role_summary: "Act now. Buy equipment with our check and send gift cards. Guaranteed job, WhatsApp only.",
  requirements_skills: "Send your SSN and bank account.",
});
for (const code of ["unpaid_for_profit", "unpaid_business_internship", "applicant_payment_request", "sensitive_information_request", "pressure_or_guarantee_language", "application_domain_mismatch"]) {
  assert(flags.some((item) => item.code === code), `review advisory flag missing: ${code}`);
}

const [composer, fields, service, reviewClient, admin, legal, migration, workWithAuthorityMigration] = await Promise.all([
  fs.readFile("src/pages/The-Elysia-Commune/index.tsx", "utf8"),
  fs.readFile("src/pages/The-Elysia-Commune/JobOpportunityFields.tsx", "utf8"),
  fs.readFile("src/pages/The-Elysia-Commune/communeAccountApi.ts", "utf8"),
  fs.readFile("src/shared/review/reviewClient.ts", "utf8"),
  fs.readFile("src/pages/Admin/index.tsx", "utf8"),
  fs.readFile("src/pages/Legal/legalPolicyPages.ts", "utf8"),
  fs.readFile("supabase/migrations/20260808010000_job_post_opportunity_model_v2.sql", "utf8"),
  fs.readFile("supabase/migrations/20260809010000_job_post_private_work_with_admin_authority.sql", "utf8"),
]);
assert(composer.includes("<JobOpportunityFields") && composer.includes("jobOpportunityAcknowledgement"), "composer must use the centralized progressive v2 control and independent truth acknowledgement");
assert(!composer.includes("Creator anti-scam") && !service.includes("private_application_note:"), "creator trust controls and writes to the public-row pseudo-private note must stay removed");
assert(service.includes("jobOpportunityPayload") && service.includes("legacyFieldsForOpportunity"), "service must dual-write the validated v2 and legacy contracts");
assert(service.includes("legacyJobPostSelect"), "reader must retain pre-migration fallback");
assert(reviewClient.includes("review_comments") && reviewClient.includes("jobOpportunityReviewerFlags"), "reviewer detail must use protected notes and advisory flags");
assert(admin.includes("JobOpportunityReviewPanel") && admin.includes("addInternalReviewComment"), "admin must present a joined Job case with protected internal notes");
assert(legal.includes("Publication is not endorsement or verification") && legal.includes("Opportunity labels do not determine legal employment or worker status"), "coordinated non-endorsement and classification language missing");
for (const [name, source] of [["Commune", composer], ["Admin Review", admin], ["Legal", legal]]) assert(!/Opportunity Commons/i.test(source), `${name} must retain the public Job Post name`);
assert(fields.includes('option.value !== "private_work_with" || isAdmin') && service.includes("isAdmin: account.isAdmin"), "Private Work With must use the canonical administrator state in the UI and submit service");
assert(
  reviewClient.includes("supabase.auth.getUser()")
    && reviewClient.includes('from("user_roles").select("role")')
    && reviewClient.includes('.is("revoked_at", null)')
    && reviewClient.includes('from("profiles").select("is_admin")')
    && reviewClient.includes('roles.includes("administrator") || Boolean'),
  "administrator authority must come from the authenticated user plus the canonical active-role/profile sources",
);
assert(migration.includes("model_version smallint not null default 1") && !/\bupdate\s+public\.commune_job_posts\b/i.test(migration), "migration must be additive and must not rewrite legacy rows");
assert(migration.includes('as restrictive') && migration.includes("private work with"), "first-party Work With must be RLS-enforced");
assert(workWithAuthorityMigration.includes("public.current_user_is_admin()") && workWithAuthorityMigration.includes("/work-with-elysia-ecobotics") && !workWithAuthorityMigration.includes("organization_project"), "forward policy repair must use canonical admin authority, not free-text organization matching");

console.log("Opportunity Commons v2 model, compatibility, validation, safety, review, and legal contracts passed.");
