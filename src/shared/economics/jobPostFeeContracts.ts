import { z } from "zod";

export const jobPostFeesPath = "/commons-circle/signals/requests-reviews?domain=job_posts#posting-fees";
export const jobFeeCategories = [
  ["small_organization", "Small organization"], ["community_benefit", "Public or community benefit"],
  ["financial_hardship", "Financial hardship"], ["education_research", "Educational or research use"], ["other", "Other"],
] as const;
const category = z.enum(["small_organization", "community_benefit", "financial_hardship", "education_research", "other"]).nullable();
const request = z.object({
  category, explanation: z.string().min(1).max(500),
  status: z.enum(["submitted", "reviewing", "needs_information", "answered", "withdrawn"]),
  response: z.string().max(500), revision: z.number().int().positive(), updatedAt: z.string().datetime({ offset: true }),
}).strict();
export const jobFeeItemSchema = z.object({
  jobPostId: z.string().uuid(), postId: z.string().uuid(), authorUserId: z.string().uuid().nullable(), title: z.string().max(240), contentStatus: z.string().min(1).max(80),
  classification: z.enum(["not_assessed", "community_free", "commercial", "waived", "subsidized"]),
  conditionStatus: z.enum(["not_assessed", "not_required", "payment_required", "payment_pending", "satisfied", "waived", "subsidized", "refunded", "disputed", "reconciliation_required"]),
  request: request.nullable(),
}).strict();
export type JobFeeItem = z.infer<typeof jobFeeItemSchema>;
export const jobFeeWorkspaceSchema = z.object({
  items: z.array(jobFeeItemSchema).max(20), hasMore: z.boolean(), cursor: z.string().uuid().nullable(), canReview: z.boolean(), canAssess: z.boolean(), paymentsCollected: z.literal(false),
}).strict().refine(value => value.hasMore === (value.cursor !== null), "Invalid pagination");
export type JobFeeWorkspace = z.infer<typeof jobFeeWorkspaceSchema>;
const base = { jobPostId: z.string().uuid(), commandId: z.string().uuid(), expectedRevision: z.number().int().min(0).max(999_999_999) };
export const jobFeeCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("submit"), category, explanation: z.string().trim().min(1).max(500) }).strict(),
  z.object({ ...base, action: z.literal("withdraw") }).strict(),
  z.object({ ...base, action: z.literal("review"), status: z.enum(["reviewing", "needs_information", "answered"]), response: z.string().trim().min(1).max(500) }).strict(),
]);
export type JobFeeCommand = z.infer<typeof jobFeeCommandSchema>;
export const jobFeeCommandResultSchema = z.object({ jobPostId: z.string().uuid(), commandId: z.string().uuid(), revision: z.number().int().positive() }).strict();

/** The opportunity's compensation, poster type and prose are never inputs. */
export function jobFeeStatus(item?: Pick<JobFeeItem, "classification" | "conditionStatus">) {
  if (item?.classification === "community_free" && item.conditionStatus === "not_required") return { label: "No fee required", detail: "This opportunity has an authoritative free-path assessment." };
  if (item?.classification === "waived" && item.conditionStatus === "waived") return { label: "No fee required", detail: "An existing governed grant waives EcoSyneva’s posting fee for this opportunity." };
  if (item?.classification === "subsidized" && item.conditionStatus === "subsidized") return { label: "No fee required", detail: "Existing governed assistance covers the posting fee for this opportunity. This is assistance, not a waiver." };
  if (item?.classification === "commercial" && ["payment_required", "payment_pending", "satisfied"].includes(item.conditionStatus)) return { label: "Commercial fee may apply", detail: item.conditionStatus === "satisfied" ? "The internal economic condition is recorded as satisfied. This is not a receipt or proof of a live payment." : "This opportunity has a commercial assessment. No payment is currently being collected here." };
  return { label: "Economic review required", detail: "A current free path, waiver or commercial payment condition has not been established here. An opportunity’s description or compensation does not determine its fee status." };
}
