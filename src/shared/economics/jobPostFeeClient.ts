import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";
import { jobFeeCommandResultSchema, jobFeeCommandSchema, jobFeeWorkspaceSchema, type JobFeeCommand } from "./jobPostFeeContracts";

export class JobFeeError extends Error {
  constructor(readonly code: "forbidden" | "conflict" | "limited" | "invalid" | "unavailable") {
    super({ forbidden: "This account cannot access this private Job Post request.", conflict: "This request changed. Refresh its status before sending another update.", limited: "The request limit has been reached. Please try again later.", invalid: "Check the short explanation and optional category.", unavailable: "Private fee requests are unavailable right now. No submission or fee decision should be assumed. You can still use the Job Post content workflow." }[code]);
  }
}
// The supplied session must still be current before dispatch. RPCs independently
// derive auth.uid(); neither participant nor operator can supply another actor.
async function rpc(token: string, name: string, args: Record<string, unknown>) {
  if (!supabase || !token) throw new JobFeeError("forbidden");
  const session = await supabase.auth.getSession();
  if (session.error || session.data.session?.access_token !== token) throw new JobFeeError("forbidden");
  const { data, error } = await supabase.rpc(name, args).setHeader("Authorization", `Bearer ${token}`).abortSignal(AbortSignal.timeout(12_000));
  if (error) throw new JobFeeError(error.code === "42501" ? "forbidden" : error.code === "40001" || error.code === "23505" ? "conflict" : error.code === "54000" ? "limited" : error.code === "22023" || error.code === "22P02" ? "invalid" : "unavailable");
  return data as unknown;
}
export async function loadJobFeeWorkspace(token: string, operator: boolean, jobPostId: string | null, before: string | null = null) {
  const parsed = jobFeeWorkspaceSchema.safeParse(await rpc(token, "current_user_job_post_fee_workspace", { p_operator: operator, p_job_post_id: jobPostId, p_before: before }));
  if (!parsed.success) throw new JobFeeError("unavailable");
  return parsed.data;
}
export async function commandJobFeeRequest(token: string, command: JobFeeCommand) {
  const input = jobFeeCommandSchema.safeParse(command);
  if (!input.success) throw new JobFeeError("invalid");
  const result = jobFeeCommandResultSchema.safeParse(await rpc(token, "submit_job_post_fee_request_command", { p_command: input.data }));
  if (!result.success || result.data.commandId !== command.commandId || result.data.jobPostId !== command.jobPostId || result.data.revision !== command.expectedRevision + 1) throw new JobFeeError("unavailable");
  return result.data;
}
