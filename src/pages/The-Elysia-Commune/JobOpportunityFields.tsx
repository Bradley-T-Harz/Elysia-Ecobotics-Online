import {
  availableCompensationModelsForStatus,
  compensationModelsForStatus,
  jobApplicationRouteOptions,
  jobCompensationPeriodOptions,
  jobCompensationStatusOptions,
  jobDurationTypeOptions,
  jobExperienceLevelOptions,
  jobOpportunityTypeOptions,
  jobPosterTypeOptions,
  jobTimeBasisOptions,
  jobWorkArrangementOptions,
  validateJobOpportunity,
  type JobApplicationRouteType,
  type JobCompensationModel,
  type JobCompensationPeriod,
  type JobCompensationStatus,
  type JobDurationType,
  type JobExperienceLevel,
  type JobOpportunityDraft,
  type JobOpportunityType,
  type JobPosterType,
  type JobTimeBasis,
  type JobWorkArrangement
} from "./jobOpportunityModel";

type Props = {
  value: JobOpportunityDraft;
  organizationProject: string;
  isAdmin: boolean;
  showErrors?: boolean;
  onChange: (value: JobOpportunityDraft) => void;
};

export default function JobOpportunityFields({ value, organizationProject, isAdmin, showErrors = false, onChange }: Props) {
  const validation = validateJobOpportunity(value, { isAdmin, organizationProject });
  const set = <K extends keyof JobOpportunityDraft>(key: K, next: JobOpportunityDraft[K]) => onChange({ ...value, [key]: next });
  const status = value.compensationStatus;
  const quantifiable = value.compensationModels.some((model) => ["salary", "hourly", "fixed_project_fee", "milestone_project_payment", "stipend", "fellowship_funding", "honorarium"].includes(model));
  const needsCompensationDetails = status === "mixed_multiple" || status === "other" || value.compensationModels.some((model) => ["honorarium", "commission", "reimbursement_expenses", "academic_credit", "other"].includes(model));
  const destinationLabel = value.applicationRouteType === "organization_contact"
    ? "Official webpage or organization email"
    : value.applicationRouteType === "repository_contribution_instructions"
      ? "Repository / contribution URL"
      : value.applicationRouteType === "private_work_with"
        ? "Private Work With route"
        : "Application destination";
  const error = (field: string) => showErrors && validation.fields[field] ? <span className="field-error" role="alert">{validation.fields[field]}</span> : null;

  function changeStatus(next: JobCompensationStatus | "") {
    const fixedModels = compensationModelsForStatus(next);
    const allowedModels = new Set(availableCompensationModelsForStatus(next).map((option) => option.value));
    const retainedModels = value.compensationModels.filter((model) => allowedModels.has(model));
    onChange({
      ...value,
      compensationStatus: next,
      compensationModels: fixedModels.length || ["unpaid_volunteer", "reimbursement_only", "academic_credit_only", "future_compensation_not_established"].includes(next) ? fixedModels : retainedModels
    });
  }

  function toggleModel(model: JobCompensationModel) {
    const compensationModels = value.compensationModels.includes(model)
      ? value.compensationModels.filter((item) => item !== model)
      : [...value.compensationModels, model];
    set("compensationModels", compensationModels);
  }

  return <div className="wide-field job-opportunity-fields">
    <fieldset className="commune-progressive-fieldset job-opportunity-basics">
      <legend>Opportunity basics</legend>
      <p className="boundary-note">Describe the relationship separately from compensation, schedule, and application route.</p>
      <div className="commune-form-grid job-opportunity-basics-grid">
        <label><span>Opportunity type <span aria-hidden="true">*</span></span><select required aria-describedby="job-opportunity-type-help" value={value.opportunityType} onChange={(event) => set("opportunityType", event.target.value as JobOpportunityType | "")}><option value="">Choose type</option>{jobOpportunityTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span id="job-opportunity-type-help" className="field-help">What kind of opportunity is actually available?</span>{error("opportunityType")}</label>
        <label><span>Poster / organization type <span aria-hidden="true">*</span></span><select required value={value.posterType} onChange={(event) => set("posterType", event.target.value as JobPosterType | "")}><option value="">Choose poster type</option>{jobPosterTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error("posterType")}</label>
        {value.opportunityType && <label className="wide-field"><span>Organization website optional</span><input type="url" inputMode="url" value={value.organizationWebsite} onChange={(event) => set("organizationWebsite", event.target.value)} placeholder="https://organization.example" />{error("organizationWebsite")}</label>}
        {value.opportunityType === "other" && <label className="wide-field"><span>Explain the opportunity type <span aria-hidden="true">*</span></span><textarea rows={3} required value={value.opportunityDetails} onChange={(event) => set("opportunityDetails", event.target.value)} placeholder="State clearly what relationship or opportunity is being offered." />{error("opportunityDetails")}</label>}
      </div>
    </fieldset>

    <fieldset className="commune-progressive-fieldset">
      <legend>Compensation — required</legend>
      <p className="boundary-note">Every opportunity must affirmatively disclose its compensation status. A blank or vague promise is not accepted.</p>
      <div className="commune-form-grid">
        <label className="wide-field"><span>Compensation status <span aria-hidden="true">*</span></span><select required value={status} onChange={(event) => changeStatus(event.target.value as JobCompensationStatus | "")}><option value="">Declare compensation</option>{jobCompensationStatusOptions.filter((option) => option.value !== "future_compensation_not_established" || value.opportunityType === "future_role_interest_talent_pool").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error("compensationStatus")}</label>
        {status && status !== "future_compensation_not_established" && <div className="wide-field job-compensation-models" role="group" aria-labelledby="job-compensation-models-label">
          <p id="job-compensation-models-label">Compensation model{["paid", "stipend_funded", "mixed_multiple"].includes(status) ? " *" : ""}</p>
          <div className="commune-checklist">{availableCompensationModelsForStatus(status).map((option) => {
            const fixed = (status === "unpaid_volunteer" && option.value === "unpaid_volunteer") || (status === "reimbursement_only" && option.value === "reimbursement_expenses") || (status === "academic_credit_only" && option.value === "academic_credit");
            const hide = ["unpaid_volunteer", "reimbursement_only", "academic_credit_only"].includes(status) && !fixed;
            return hide ? null : <label className="checkbox-line" key={option.value}><input type="checkbox" checked={value.compensationModels.includes(option.value)} disabled={fixed} onChange={() => toggleModel(option.value)} /><span>{option.label}</span></label>;
          })}</div>{error("compensationModels")}
        </div>}
        {quantifiable && <>
          <label><span>Currency <span aria-hidden="true">*</span></span><input required inputMode="text" maxLength={3} value={value.compensationCurrency} onChange={(event) => set("compensationCurrency", event.target.value.toUpperCase())} placeholder="USD" />{error("compensationCurrency")}</label>
          <label><span>Amount / minimum <span aria-hidden="true">*</span></span><input required type="number" min="0" step="0.01" inputMode="decimal" value={value.compensationMinAmount} onChange={(event) => set("compensationMinAmount", event.target.value)} />{error("compensationMinAmount")}</label>
          <label><span>Maximum optional</span><input type="number" min="0" step="0.01" inputMode="decimal" value={value.compensationMaxAmount} onChange={(event) => set("compensationMaxAmount", event.target.value)} />{error("compensationMaxAmount")}</label>
          <label><span>Amount basis <span aria-hidden="true">*</span></span><select required value={value.compensationPeriod} onChange={(event) => set("compensationPeriod", event.target.value as JobCompensationPeriod | "")}><option value="">Choose basis</option>{jobCompensationPeriodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error("compensationPeriod")}</label>
        </>}
        {needsCompensationDetails && <label className="wide-field"><span>Compensation details <span aria-hidden="true">*</span></span><textarea required rows={3} value={value.compensationDetails} onChange={(event) => set("compensationDetails", event.target.value)} placeholder="Explain commission, reimbursement, credit, mixed terms, or other compensation plainly." />{error("compensationDetails")}</label>}
        {status && <label className="wide-field"><span>Benefits / additional support optional</span><textarea rows={2} value={value.benefitsSummary} onChange={(event) => set("benefitsSummary", event.target.value)} placeholder="Benefits, equipment, travel support, mentoring, or other relevant support." /></label>}
      </div>
    </fieldset>

    <fieldset className="commune-progressive-fieldset">
      <legend>Work and time structure</legend>
      <div className="commune-form-grid">
        <label><span>Work arrangement <span aria-hidden="true">*</span></span><select required value={value.workArrangement} onChange={(event) => set("workArrangement", event.target.value as JobWorkArrangement | "")}><option value="">Choose arrangement</option>{jobWorkArrangementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error("workArrangement")}</label>
        <label><span>Time basis <span aria-hidden="true">*</span></span><select required value={value.timeBasis} onChange={(event) => set("timeBasis", event.target.value as JobTimeBasis | "")}><option value="">Choose time basis</option>{jobTimeBasisOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error("timeBasis")}</label>
        <label><span>Duration <span aria-hidden="true">*</span></span><select required value={value.durationType} onChange={(event) => set("durationType", event.target.value as JobDurationType | "")}><option value="">Choose duration</option>{jobDurationTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error("durationType")}</label>
        {value.opportunityType && <label><span>Experience / eligibility optional</span><select value={value.experienceLevel} onChange={(event) => set("experienceLevel", event.target.value as JobExperienceLevel | "")}><option value="">Not specified</option>{jobExperienceLevelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
      </div>
    </fieldset>

    <fieldset className="commune-progressive-fieldset">
      <legend>Application route</legend>
      <p className="boundary-note">Keep public interaction thin. Route serious applications through a legitimate external destination, contribution route, organization contact, or authorized private Work With flow.</p>
      <div className="commune-form-grid">
        <label className="job-application-route-type-field"><span>Application route type <span aria-hidden="true">*</span></span><select required value={value.applicationRouteType} onChange={(event) => {
          const applicationRouteType = event.target.value as JobApplicationRouteType | "";
          onChange({ ...value, applicationRouteType, applicationDestination: applicationRouteType === "private_work_with" ? "/work-with-elysia-ecobotics" : value.applicationDestination });
        }}><option value="">Choose route</option>{jobApplicationRouteOptions.filter((option) => option.value !== "private_work_with" || isAdmin).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error("applicationRouteType")}</label>
        {value.applicationRouteType && value.applicationRouteType !== "other_legitimate" && <label className="wide-field"><span>{destinationLabel} <span aria-hidden="true">*</span></span><input required readOnly={value.applicationRouteType === "private_work_with"} inputMode={value.applicationRouteType === "organization_contact" ? "email" : "url"} value={value.applicationDestination} onChange={(event) => set("applicationDestination", event.target.value)} placeholder={value.applicationRouteType === "organization_contact" ? "https://organization.example/apply or jobs@organization.example" : "https://organization.example/apply"} />{error("applicationDestination")}</label>}
        {(value.applicationRouteType === "other_legitimate" || value.applicationRouteType === "repository_contribution_instructions") && <label className="wide-field"><span>Application / contribution instructions{value.applicationRouteType === "other_legitimate" ? " *" : ""}</span><textarea rows={3} required={value.applicationRouteType === "other_legitimate"} value={value.applicationInstructions} onChange={(event) => set("applicationInstructions", event.target.value)} placeholder="Explain what a person should do without asking them to publish sensitive information." />{error("applicationInstructions")}</label>}
      </div>
    </fieldset>

    {value.opportunityType === "testing_feedback_call" && <fieldset className="commune-progressive-fieldset">
      <legend>Testing / feedback privacy</legend>
      <label><span>Participation and privacy note <span aria-hidden="true">*</span></span><textarea required rows={3} value={value.testingPrivacyNote} onChange={(event) => set("testingPrivacyNote", event.target.value)} placeholder="Explain what participants will test or share, what information is collected, and where it goes." />{error("testingPrivacyNote")}</label>
    </fieldset>}

    {value.opportunityType === "future_role_interest_talent_pool" && <label className="checkbox-line opportunity-required-ack"><input type="checkbox" checked={value.futureInterestAcknowledged} onChange={(event) => set("futureInterestAcknowledged", event.target.checked)} /><span>I confirm this is an interest or talent-pool notice, not a current opening, offer, promise of work, or promise of compensation.</span>{error("futureInterestAcknowledged")}</label>}
  </div>;
}
