export const JOB_OPPORTUNITY_MODEL_VERSION = 2 as const;

export type JobOpportunityType =
  | "paid_employment"
  | "contract_freelance"
  | "internship"
  | "apprenticeship_traineeship"
  | "fellowship_funded_placement"
  | "research_opportunity"
  | "volunteer_community_service"
  | "community_open_source_contribution"
  | "testing_feedback_call"
  | "future_role_interest_talent_pool"
  | "other";

export type JobCompensationStatus =
  | "paid"
  | "stipend_funded"
  | "unpaid_volunteer"
  | "reimbursement_only"
  | "academic_credit_only"
  | "mixed_multiple"
  | "future_compensation_not_established"
  | "other";

export type JobCompensationModel =
  | "salary"
  | "hourly"
  | "fixed_project_fee"
  | "milestone_project_payment"
  | "stipend"
  | "fellowship_funding"
  | "honorarium"
  | "commission"
  | "reimbursement_expenses"
  | "academic_credit"
  | "unpaid_volunteer"
  | "other";

export type JobWorkArrangement = "onsite" | "remote" | "hybrid" | "field_based" | "multiple_locations" | "flexible_varies" | "other";
export type JobTimeBasis = "full_time" | "part_time" | "flexible_as_needed" | "one_time_event" | "other";
export type JobDurationType = "temporary" | "seasonal" | "project_based" | "fixed_term" | "recurring" | "ongoing" | "other";
export type JobPosterType =
  | "business_company"
  | "nonprofit_charity"
  | "government_public_agency"
  | "education_research_institution"
  | "cooperative"
  | "community_organization"
  | "open_source_project"
  | "independent_individual"
  | "informal_community_initiative"
  | "other";
export type JobExperienceLevel = "no_experience_required" | "student" | "entry_early_career" | "experienced" | "senior_lead" | "open_all_levels" | "other_requirements";
export type JobApplicationRouteType = "official_application_webpage" | "organization_contact" | "repository_contribution_instructions" | "private_work_with" | "other_legitimate";
export type JobCompensationPeriod = "hour" | "day" | "week" | "month" | "year" | "project" | "milestone" | "event" | "other";

export type JobLegacyRoleType = "paid_role" | "volunteer_call" | "stipend_role" | "contract" | "internship" | "research_role" | "collaboration_role" | "contributor_call" | "reviewer_moderator_need" | "other";
export type JobLegacyPaidStatus = "paid" | "volunteer" | "stipend" | "unpaid" | "mixed" | "must_clarify";
export type JobLegacyLocationMode = "remote" | "hybrid" | "local" | "field_based" | "unspecified";

export type SelectOption<T extends string> = { value: T; label: string; description?: string };

export const jobOpportunityTypeOptions: SelectOption<JobOpportunityType>[] = [
  { value: "paid_employment", label: "Paid employment" },
  { value: "contract_freelance", label: "Contract / freelance" },
  { value: "internship", label: "Internship" },
  { value: "apprenticeship_traineeship", label: "Apprenticeship / traineeship" },
  { value: "fellowship_funded_placement", label: "Fellowship / funded placement" },
  { value: "research_opportunity", label: "Research opportunity" },
  { value: "volunteer_community_service", label: "Volunteer / community service" },
  { value: "community_open_source_contribution", label: "Community / open-source contribution" },
  { value: "testing_feedback_call", label: "Testing / feedback call" },
  { value: "future_role_interest_talent_pool", label: "Future-role interest / talent pool" },
  { value: "other", label: "Other" }
];

export const jobCompensationStatusOptions: SelectOption<JobCompensationStatus>[] = [
  { value: "paid", label: "Paid" },
  { value: "stipend_funded", label: "Stipend / funded" },
  { value: "unpaid_volunteer", label: "Unpaid / volunteer" },
  { value: "reimbursement_only", label: "Reimbursement / expenses only" },
  { value: "academic_credit_only", label: "Academic credit only" },
  { value: "mixed_multiple", label: "Mixed / multiple" },
  { value: "future_compensation_not_established", label: "Future compensation not established" },
  { value: "other", label: "Other" }
];

export const jobCompensationModelOptions: SelectOption<JobCompensationModel>[] = [
  { value: "salary", label: "Salary" },
  { value: "hourly", label: "Hourly" },
  { value: "fixed_project_fee", label: "Fixed project fee" },
  { value: "milestone_project_payment", label: "Milestone / project-based payment" },
  { value: "stipend", label: "Stipend" },
  { value: "fellowship_funding", label: "Fellowship funding" },
  { value: "honorarium", label: "Honorarium" },
  { value: "commission", label: "Commission-based" },
  { value: "reimbursement_expenses", label: "Reimbursement / expenses" },
  { value: "academic_credit", label: "Academic credit" },
  { value: "unpaid_volunteer", label: "Unpaid / volunteer" },
  { value: "other", label: "Other" }
];

export const jobWorkArrangementOptions: SelectOption<JobWorkArrangement>[] = [
  { value: "onsite", label: "Onsite" }, { value: "remote", label: "Remote" }, { value: "hybrid", label: "Hybrid" },
  { value: "field_based", label: "Field-based" }, { value: "multiple_locations", label: "Multiple locations" },
  { value: "flexible_varies", label: "Flexible / varies" }, { value: "other", label: "Other" }
];
export const jobTimeBasisOptions: SelectOption<JobTimeBasis>[] = [
  { value: "full_time", label: "Full-time" }, { value: "part_time", label: "Part-time" },
  { value: "flexible_as_needed", label: "Flexible / as-needed" }, { value: "one_time_event", label: "One-time / event-based" },
  { value: "other", label: "Other" }
];
export const jobDurationTypeOptions: SelectOption<JobDurationType>[] = [
  { value: "temporary", label: "Temporary" }, { value: "seasonal", label: "Seasonal" }, { value: "project_based", label: "Project-based" },
  { value: "fixed_term", label: "Fixed-term" }, { value: "recurring", label: "Recurring" }, { value: "ongoing", label: "Ongoing" },
  { value: "other", label: "Other" }
];
export const jobPosterTypeOptions: SelectOption<JobPosterType>[] = [
  { value: "business_company", label: "Company / business" }, { value: "nonprofit_charity", label: "Nonprofit / charity" },
  { value: "government_public_agency", label: "Government / public agency" }, { value: "education_research_institution", label: "Education / research institution" },
  { value: "cooperative", label: "Cooperative" }, { value: "community_organization", label: "Community organization" },
  { value: "open_source_project", label: "Open-source project" }, { value: "independent_individual", label: "Independent individual" },
  { value: "informal_community_initiative", label: "Informal / community initiative" }, { value: "other", label: "Other" }
];
export const jobExperienceLevelOptions: SelectOption<JobExperienceLevel>[] = [
  { value: "no_experience_required", label: "No experience required" }, { value: "student", label: "Student" },
  { value: "entry_early_career", label: "Entry-level / early career" }, { value: "experienced", label: "Experienced" },
  { value: "senior_lead", label: "Senior / lead" }, { value: "open_all_levels", label: "Open to all levels" },
  { value: "other_requirements", label: "Other / see requirements" }
];
export const jobApplicationRouteOptions: SelectOption<JobApplicationRouteType>[] = [
  { value: "official_application_webpage", label: "Official application webpage" },
  { value: "organization_contact", label: "Organization contact" },
  { value: "repository_contribution_instructions", label: "Repository / contribution instructions" },
  { value: "private_work_with", label: "Private Work With flow" },
  { value: "other_legitimate", label: "Other legitimate route" }
];
export const jobCompensationPeriodOptions: SelectOption<JobCompensationPeriod>[] = [
  { value: "hour", label: "Per hour" }, { value: "day", label: "Per day" }, { value: "week", label: "Per week" },
  { value: "month", label: "Per month" }, { value: "year", label: "Per year" }, { value: "project", label: "Per project" },
  { value: "milestone", label: "Per milestone" }, { value: "event", label: "Per event" }, { value: "other", label: "Other" }
];

const values = <T extends string>(options: SelectOption<T>[]) => options.map((option) => option.value);
export const jobOpportunityTypes = values(jobOpportunityTypeOptions);
export const jobCompensationStatuses = values(jobCompensationStatusOptions);
export const jobCompensationModels = values(jobCompensationModelOptions);
export const jobWorkArrangements = values(jobWorkArrangementOptions);
export const jobTimeBases = values(jobTimeBasisOptions);
export const jobDurationTypes = values(jobDurationTypeOptions);
export const jobPosterTypes = values(jobPosterTypeOptions);
export const jobExperienceLevels = values(jobExperienceLevelOptions);
export const jobApplicationRouteTypes = values(jobApplicationRouteOptions);
export const jobCompensationPeriods = values(jobCompensationPeriodOptions);

export type JobOpportunityDraft = {
  opportunityType: JobOpportunityType | "";
  opportunityDetails: string;
  posterType: JobPosterType | "";
  organizationWebsite: string;
  compensationStatus: JobCompensationStatus | "";
  compensationModels: JobCompensationModel[];
  compensationCurrency: string;
  compensationMinAmount: string;
  compensationMaxAmount: string;
  compensationPeriod: JobCompensationPeriod | "";
  compensationDetails: string;
  benefitsSummary: string;
  workArrangement: JobWorkArrangement | "";
  timeBasis: JobTimeBasis | "";
  durationType: JobDurationType | "";
  experienceLevel: JobExperienceLevel | "";
  applicationRouteType: JobApplicationRouteType | "";
  applicationDestination: string;
  applicationInstructions: string;
  testingPrivacyNote: string;
  futureInterestAcknowledged: boolean;
};

export const emptyJobOpportunityDraft: JobOpportunityDraft = {
  opportunityType: "", opportunityDetails: "", posterType: "", organizationWebsite: "", compensationStatus: "", compensationModels: [],
  compensationCurrency: "", compensationMinAmount: "", compensationMaxAmount: "", compensationPeriod: "", compensationDetails: "", benefitsSummary: "",
  workArrangement: "", timeBasis: "", durationType: "", experienceLevel: "", applicationRouteType: "", applicationDestination: "", applicationInstructions: "",
  testingPrivacyNote: "", futureInterestAcknowledged: false
};

export type JobOpportunityV2 = {
  model_version: 2;
  opportunity_type: JobOpportunityType;
  opportunity_details: string | null;
  poster_type: JobPosterType;
  organization_website: string | null;
  compensation_status: JobCompensationStatus;
  compensation_models: JobCompensationModel[];
  compensation_currency: string | null;
  compensation_min_amount: number | null;
  compensation_max_amount: number | null;
  compensation_period: JobCompensationPeriod | null;
  compensation_details: string | null;
  benefits_summary: string | null;
  work_arrangement: JobWorkArrangement;
  time_basis: JobTimeBasis;
  duration_type: JobDurationType;
  experience_level: JobExperienceLevel | null;
  application_route_type: JobApplicationRouteType;
  application_destination: string | null;
  application_instructions: string | null;
  testing_privacy_note: string | null;
  future_interest_acknowledged: boolean;
};

export type JobOpportunityMetadataFields = Partial<JobOpportunityV2> & { model_version?: number | null };

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
  return allowed.includes(normalized as T) ? normalized as T : null;
}
function textOrNull(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
function amountOrNull(value: unknown) { const text = String(value ?? "").trim(); if (!text) return null; const number = Number(text); return Number.isFinite(number) ? number : null; }

export function normalizeJobOpportunityDraft(input: Partial<JobOpportunityDraft>): JobOpportunityDraft {
  return {
    opportunityType: pick(input.opportunityType, jobOpportunityTypes) ?? "",
    opportunityDetails: String(input.opportunityDetails ?? ""),
    posterType: pick(input.posterType, jobPosterTypes) ?? "",
    organizationWebsite: String(input.organizationWebsite ?? ""),
    compensationStatus: pick(input.compensationStatus, jobCompensationStatuses) ?? "",
    compensationModels: Array.from(new Set((input.compensationModels ?? []).map((item) => pick(item, jobCompensationModels)).filter((item): item is JobCompensationModel => Boolean(item)))),
    compensationCurrency: String(input.compensationCurrency ?? "").trim().toUpperCase(),
    compensationMinAmount: String(input.compensationMinAmount ?? ""),
    compensationMaxAmount: String(input.compensationMaxAmount ?? ""),
    compensationPeriod: pick(input.compensationPeriod, jobCompensationPeriods) ?? "",
    compensationDetails: String(input.compensationDetails ?? ""),
    benefitsSummary: String(input.benefitsSummary ?? ""),
    workArrangement: pick(input.workArrangement, jobWorkArrangements) ?? "",
    timeBasis: pick(input.timeBasis, jobTimeBases) ?? "",
    durationType: pick(input.durationType, jobDurationTypes) ?? "",
    experienceLevel: pick(input.experienceLevel, jobExperienceLevels) ?? "",
    applicationRouteType: pick(input.applicationRouteType, jobApplicationRouteTypes) ?? "",
    applicationDestination: String(input.applicationDestination ?? ""),
    applicationInstructions: String(input.applicationInstructions ?? ""),
    testingPrivacyNote: String(input.testingPrivacyNote ?? ""),
    futureInterestAcknowledged: input.futureInterestAcknowledged === true
  };
}

export function jobOpportunityPayload(input: JobOpportunityDraft): JobOpportunityV2 {
  const draft = normalizeJobOpportunityDraft(input);
  if (!draft.opportunityType || !draft.posterType || !draft.compensationStatus || !draft.workArrangement || !draft.timeBasis || !draft.durationType || !draft.applicationRouteType) {
    throw new Error("A validated opportunity draft is required before building its payload.");
  }
  const quantifiable = draft.compensationModels.some((model) => ["salary", "hourly", "fixed_project_fee", "milestone_project_payment", "stipend", "fellowship_funding", "honorarium"].includes(model));
  const needsCompensationDetails = draft.compensationStatus === "mixed_multiple" || draft.compensationStatus === "other" || draft.compensationModels.some((model) => ["honorarium", "commission", "reimbursement_expenses", "academic_credit", "other"].includes(model));
  return {
    model_version: JOB_OPPORTUNITY_MODEL_VERSION,
    opportunity_type: draft.opportunityType,
    opportunity_details: draft.opportunityType === "other" ? textOrNull(draft.opportunityDetails) : null,
    poster_type: draft.posterType,
    organization_website: textOrNull(draft.organizationWebsite),
    compensation_status: draft.compensationStatus,
    compensation_models: draft.compensationModels,
    compensation_currency: quantifiable ? textOrNull(draft.compensationCurrency) : null,
    compensation_min_amount: quantifiable ? amountOrNull(draft.compensationMinAmount) : null,
    compensation_max_amount: quantifiable ? amountOrNull(draft.compensationMaxAmount) : null,
    compensation_period: quantifiable ? draft.compensationPeriod || null : null,
    compensation_details: needsCompensationDetails ? textOrNull(draft.compensationDetails) : null,
    benefits_summary: textOrNull(draft.benefitsSummary),
    work_arrangement: draft.workArrangement,
    time_basis: draft.timeBasis,
    duration_type: draft.durationType,
    experience_level: draft.experienceLevel || null,
    application_route_type: draft.applicationRouteType,
    application_destination: draft.applicationRouteType === "other_legitimate" ? null : textOrNull(draft.applicationDestination),
    application_instructions: ["other_legitimate", "repository_contribution_instructions"].includes(draft.applicationRouteType) ? textOrNull(draft.applicationInstructions) : null,
    testing_privacy_note: draft.opportunityType === "testing_feedback_call" ? textOrNull(draft.testingPrivacyNote) : null,
    future_interest_acknowledged: draft.opportunityType === "future_role_interest_talent_pool" && draft.futureInterestAcknowledged
  };
}

export function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const privateHost = host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home")
      || !host.includes(".") || /^(127\.|10\.|0\.0\.0\.0$|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
      || host === "::1" || /^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host);
    return ["http:", "https:"].includes(url.protocol) && !privateHost;
  } catch { return false; }
}
export function isEmailAddress(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }

export type JobOpportunityValidationContext = { isAdmin?: boolean };
export type JobOpportunityValidation = { ok: boolean; errors: string[]; fields: Record<string, string> };

export function validateJobOpportunity(input: JobOpportunityDraft, context: JobOpportunityValidationContext = {}): JobOpportunityValidation {
  const draft = normalizeJobOpportunityDraft(input);
  const fields: Record<string, string> = {};
  const add = (field: string, message: string) => { if (!fields[field]) fields[field] = message; };
  if (!draft.opportunityType) add("opportunityType", "Choose an opportunity type.");
  if (!draft.posterType) add("posterType", "Choose who is posting this opportunity.");
  if (!draft.compensationStatus) add("compensationStatus", "Declare the compensation status.");
  if (!draft.workArrangement) add("workArrangement", "Choose a work arrangement.");
  if (!draft.timeBasis) add("timeBasis", "Choose a time basis.");
  if (!draft.durationType) add("durationType", "Choose a duration.");
  if (!draft.applicationRouteType) add("applicationRouteType", "Choose a legitimate application route.");
  if (draft.organizationWebsite && !isPublicHttpUrl(draft.organizationWebsite)) add("organizationWebsite", "Use a public HTTP(S) organization website.");
  if (draft.opportunityType === "other" && draft.opportunityDetails.trim().length < 12) add("opportunityDetails", "Explain the other opportunity type clearly.");
  if (draft.opportunityType === "testing_feedback_call" && draft.testingPrivacyNote.trim().length < 12) add("testingPrivacyNote", "Explain what participants will share and how their information will be handled.");
  if (draft.opportunityType === "future_role_interest_talent_pool" && !draft.futureInterestAcknowledged) add("futureInterestAcknowledged", "Confirm that this is not a current opening or promise of work.");
  if (draft.compensationStatus === "future_compensation_not_established" && draft.opportunityType !== "future_role_interest_talent_pool") add("compensationStatus", "Only future-role interest posts may use this compensation status.");

  const models = new Set(draft.compensationModels);
  const paidModels: JobCompensationModel[] = ["salary", "hourly", "fixed_project_fee", "milestone_project_payment", "honorarium", "commission", "other"];
  if (["paid", "stipend_funded", "mixed_multiple"].includes(draft.compensationStatus) && models.size === 0) add("compensationModels", "Select at least one compensation model.");
  if (draft.compensationStatus === "paid" && !paidModels.some((item) => models.has(item))) add("compensationModels", "Paid opportunities need a paid compensation model.");
  if (draft.compensationStatus === "paid" && [...models].some((item) => !paidModels.includes(item))) add("compensationModels", "Paid opportunities cannot mix in stipend, credit, reimbursement, or unpaid models; choose Mixed instead.");
  if (draft.compensationStatus === "stipend_funded" && !models.has("stipend") && !models.has("fellowship_funding")) add("compensationModels", "Stipend / funded opportunities need a stipend or fellowship funding model.");
  if (draft.compensationStatus === "stipend_funded" && [...models].some((item) => !["stipend", "fellowship_funding"].includes(item))) add("compensationModels", "Stipend / funded opportunities may use only stipend or fellowship funding models; choose Mixed for additional forms.");
  if (draft.compensationStatus === "unpaid_volunteer" && (models.size !== 1 || !models.has("unpaid_volunteer"))) add("compensationModels", "Unpaid / volunteer opportunities must use the unpaid / volunteer model.");
  if (draft.compensationStatus === "reimbursement_only" && (models.size !== 1 || !models.has("reimbursement_expenses"))) add("compensationModels", "Reimbursement-only opportunities must use the reimbursement model.");
  if (draft.compensationStatus === "academic_credit_only" && (models.size !== 1 || !models.has("academic_credit"))) add("compensationModels", "Academic-credit-only opportunities must use the academic credit model.");
  if (draft.compensationStatus === "mixed_multiple" && models.size < 2) add("compensationModels", "Mixed compensation needs at least two models.");
  if (draft.compensationStatus === "future_compensation_not_established" && models.size > 0) add("compensationModels", "Do not imply a compensation model for a future role whose compensation is not established.");
  const detailModels: JobCompensationModel[] = ["honorarium", "commission", "reimbursement_expenses", "academic_credit", "other"];
  const needsDetails = draft.compensationStatus === "other" || detailModels.some((item) => models.has(item));
  if ((needsDetails || draft.compensationStatus === "mixed_multiple") && draft.compensationDetails.trim().length < 8) add("compensationDetails", "Explain the compensation terms clearly.");

  const amountModels: JobCompensationModel[] = ["salary", "hourly", "fixed_project_fee", "milestone_project_payment", "stipend", "fellowship_funding", "honorarium"];
  const needsAmount = amountModels.some((item) => models.has(item));
  const min = amountOrNull(draft.compensationMinAmount);
  const max = amountOrNull(draft.compensationMaxAmount);
  if (needsAmount && (min === null || min <= 0)) add("compensationMinAmount", "Enter a positive amount or minimum.");
  if (min !== null && min < 0) add("compensationMinAmount", "Compensation cannot be negative.");
  if (max !== null && (max < 0 || (min !== null && max < min))) add("compensationMaxAmount", "The maximum must be at least the minimum.");
  if (needsAmount && !/^[A-Z]{3}$/.test(draft.compensationCurrency)) add("compensationCurrency", "Use a three-letter currency code such as USD.");
  if (needsAmount && !draft.compensationPeriod) add("compensationPeriod", "Choose what period or unit the amount covers.");

  const destination = draft.applicationDestination.trim();
  if (["official_application_webpage", "repository_contribution_instructions"].includes(draft.applicationRouteType) && !isPublicHttpUrl(destination)) add("applicationDestination", "Use a public HTTP(S) destination.");
  if (draft.applicationRouteType === "organization_contact" && !isPublicHttpUrl(destination) && !isEmailAddress(destination)) add("applicationDestination", "Use an official public webpage or organization email address.");
  if (draft.applicationRouteType === "private_work_with") {
    if (!context.isAdmin) add("applicationRouteType", "Private Work With is reserved for authorized Elysia Ecobotics / EcoSyneva opportunities.");
    if (destination !== "/work-with-elysia-ecobotics") add("applicationDestination", "Use the canonical private Work With route.");
  }
  if (draft.applicationRouteType === "other_legitimate" && draft.applicationInstructions.trim().length < 12) add("applicationInstructions", "Explain the legitimate application route clearly.");
  return { ok: Object.keys(fields).length === 0, errors: Object.values(fields), fields };
}

export function compensationModelsForStatus(status: JobCompensationStatus | ""): JobCompensationModel[] {
  if (status === "unpaid_volunteer") return ["unpaid_volunteer"];
  if (status === "reimbursement_only") return ["reimbursement_expenses"];
  if (status === "academic_credit_only") return ["academic_credit"];
  if (status === "future_compensation_not_established") return [];
  return [];
}

export function availableCompensationModelsForStatus(status: JobCompensationStatus | "") {
  if (status === "paid") return jobCompensationModelOptions.filter((option) => ["salary", "hourly", "fixed_project_fee", "milestone_project_payment", "honorarium", "commission", "other"].includes(option.value));
  if (status === "stipend_funded") return jobCompensationModelOptions.filter((option) => ["stipend", "fellowship_funding"].includes(option.value));
  if (status === "mixed_multiple") return jobCompensationModelOptions;
  if (status === "unpaid_volunteer") return jobCompensationModelOptions.filter((option) => option.value === "unpaid_volunteer");
  if (status === "reimbursement_only") return jobCompensationModelOptions.filter((option) => option.value === "reimbursement_expenses");
  if (status === "academic_credit_only") return jobCompensationModelOptions.filter((option) => option.value === "academic_credit");
  return [];
}

function label<T extends string>(options: SelectOption<T>[], value?: string | null, fallback = "Not specified") {
  return options.find((item) => item.value === value)?.label ?? fallback;
}
export const jobOpportunityTypeLabel = (value?: string | null) => label(jobOpportunityTypeOptions, value, "Legacy opportunity");
export const jobCompensationStatusLabel = (value?: string | null) => label(jobCompensationStatusOptions, value, "Compensation needs clarification");
export const jobCompensationModelLabel = (value?: string | null) => label(jobCompensationModelOptions, value);
export const jobWorkArrangementLabel = (value?: string | null) => label(jobWorkArrangementOptions, value, "Arrangement needs clarification");
export const jobTimeBasisLabel = (value?: string | null) => label(jobTimeBasisOptions, value);
export const jobDurationTypeLabel = (value?: string | null) => label(jobDurationTypeOptions, value);
export const jobPosterTypeLabel = (value?: string | null) => label(jobPosterTypeOptions, value);
export const jobExperienceLevelLabel = (value?: string | null) => label(jobExperienceLevelOptions, value);
export const jobApplicationRouteLabel = (value?: string | null) => label(jobApplicationRouteOptions, value);

export function formatJobCompensation(job: JobOpportunityMetadataFields & { compensation_clarity?: string | null }) {
  if (job.model_version !== JOB_OPPORTUNITY_MODEL_VERSION || !job.compensation_status) return job.compensation_clarity?.trim() || "Legacy compensation — clarification may be needed";
  const status = jobCompensationStatusLabel(job.compensation_status);
  const models = (job.compensation_models ?? []).map(jobCompensationModelLabel).join(", ");
  const min = job.compensation_min_amount;
  const max = job.compensation_max_amount;
  const amount = min == null ? "" : `${job.compensation_currency ?? ""} ${Number(min).toLocaleString()}${max != null && max !== min ? `–${Number(max).toLocaleString()}` : ""}${job.compensation_period ? ` / ${job.compensation_period}` : ""}`.trim();
  return [status, models, amount, job.compensation_details].filter(Boolean).join(" · ");
}

export function legacyFieldsForOpportunity(job: JobOpportunityV2): { role_type: JobLegacyRoleType; paid_volunteer_status: JobLegacyPaidStatus; location_mode: JobLegacyLocationMode; compensation_clarity: string; contact_path: string | null } {
  const roleMap: Record<JobOpportunityType, JobLegacyRoleType> = {
    paid_employment: "paid_role", contract_freelance: "contract", internship: "internship", apprenticeship_traineeship: "other",
    fellowship_funded_placement: "stipend_role", research_opportunity: "research_role", volunteer_community_service: "volunteer_call",
    community_open_source_contribution: "contributor_call", testing_feedback_call: "collaboration_role", future_role_interest_talent_pool: "other", other: "other"
  };
  const statusMap: Record<JobCompensationStatus, JobLegacyPaidStatus> = {
    paid: "paid", stipend_funded: "stipend", unpaid_volunteer: "unpaid", reimbursement_only: "must_clarify", academic_credit_only: "must_clarify",
    mixed_multiple: "mixed", future_compensation_not_established: "must_clarify", other: "must_clarify"
  };
  const locationMap: Record<JobWorkArrangement, JobLegacyLocationMode> = {
    onsite: "local", remote: "remote", hybrid: "hybrid", field_based: "field_based", multiple_locations: "unspecified", flexible_varies: "unspecified", other: "unspecified"
  };
  return {
    role_type: roleMap[job.opportunity_type], paid_volunteer_status: statusMap[job.compensation_status], location_mode: locationMap[job.work_arrangement],
    compensation_clarity: formatJobCompensation(job), contact_path: job.application_destination || job.application_instructions
  };
}

export function deterministicV2FromLegacy(input: { role_type?: string | null; paid_volunteer_status?: string | null; location_mode?: string | null }): Partial<JobOpportunityV2> {
  const opportunity: Record<string, JobOpportunityType> = { contract: "contract_freelance", internship: "internship", volunteer_call: "volunteer_community_service" };
  const compensation: Record<string, JobCompensationStatus> = { paid: "paid", stipend: "stipend_funded", volunteer: "unpaid_volunteer", unpaid: "unpaid_volunteer", mixed: "mixed_multiple" };
  const arrangement: Record<string, JobWorkArrangement> = { remote: "remote", hybrid: "hybrid", field_based: "field_based", local: "onsite" };
  return {
    opportunity_type: opportunity[String(input.role_type ?? "")] ?? undefined,
    compensation_status: compensation[String(input.paid_volunteer_status ?? "")] ?? undefined,
    work_arrangement: arrangement[String(input.location_mode ?? "")] ?? undefined
  };
}

export type JobReviewerFlagSeverity = "high" | "medium_high" | "medium" | "low";
export type JobReviewerFlag = { code: string; severity: JobReviewerFlagSeverity; message: string };
export function jobOpportunityReviewerFlags(job: JobOpportunityMetadataFields & { organization_project?: string | null; organization_website?: string | null; application_destination?: string | null; compensation_details?: string | null; role_summary?: string | null; requirements_skills?: string | null; safety_notes?: string | null }) {
  const flags: JobReviewerFlag[] = [];
  const add = (code: string, severity: JobReviewerFlagSeverity, message: string) => { if (!flags.some((item) => item.code === code)) flags.push({ code, severity, message }); };
  const text = [job.compensation_details, job.role_summary, job.requirements_skills, job.safety_notes, job.application_destination].filter(Boolean).join(" ").toLowerCase();
  if (job.compensation_status === "unpaid_volunteer" && job.poster_type === "business_company") add("unpaid_for_profit", "medium_high", "Unpaid opportunity from a for-profit poster: review the relationship, benefit, and applicable obligations closely.");
  if (job.compensation_status === "unpaid_volunteer" && job.poster_type === "business_company" && job.opportunity_type === "internship") add("unpaid_business_internship", "medium_high", "Unpaid business internship: confirm the terms are explicit and escalate classification questions to the poster.");
  if (/pay (?:to|before)|application fee|training fee|send (?:money|funds)|gift ?card|crypto(?:currency)?|cashapp|wire transfer|deposit (?:a )?check|equipment (?:purchase|check)/i.test(text)) add("applicant_payment_request", "high", "Possible applicant payment, transfer, gift-card, crypto, check, or equipment-purchase request.");
  if (/social security|\bssn\b|tax document|bank account|routing number|passport|driver'?s license|identity document|login credential|password/i.test(text)) add("sensitive_information_request", "high", "Possible request for sensitive identity, financial, tax, or login information.");
  if (/guaranteed (?:job|employment|income)|no interview|immediate hire|act now|telegram|whatsapp only/i.test(text)) add("pressure_or_guarantee_language", "medium", "Pressure, off-platform-only contact, or guaranteed-work language needs reviewer attention.");
  if (!job.organization_website) add("organization_website_absent", "low", "No organization website was provided; independently inspect the named poster and application route.");
  if (job.organization_website && job.application_destination && isPublicHttpUrl(job.organization_website) && isPublicHttpUrl(job.application_destination)) {
    const organizationHost = new URL(job.organization_website).hostname.replace(/^www\./, "");
    const destinationHost = new URL(job.application_destination).hostname.replace(/^www\./, "");
    if (organizationHost !== destinationHost && !destinationHost.endsWith(`.${organizationHost}`)) add("application_domain_mismatch", "medium", "Application destination uses a different domain from the organization website.");
  }
  return flags;
}
