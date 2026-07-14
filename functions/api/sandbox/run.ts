import { authenticateRequest } from "./_shared/auth.ts";
import { finalizeRun, reserveRun, startRun } from "./_shared/database.ts";
import {
  PublicHttpError,
  assertProductionEnabled,
  jsonResponse,
  requireJsonPost,
  requireSameOriginMutation,
  safeErrorResponse
} from "./_shared/http.ts";
import { assertRunnerConfiguration, executeRunner, sanitizeRunnerResult, unavailableRunnerResult } from "./_shared/runner.ts";
import { parseSandboxRequestBody } from "./_shared/schema.ts";
import { resolveAuthorizedSource } from "./_shared/source.ts";
import type {
  AuthenticatedRequest,
  AuthorizedSource,
  Env,
  PublicSandboxResult,
  Reservation,
  RunnerResult,
  SandboxRunRequest,
  StartedReservation
} from "./_shared/types.ts";

export type RunDependencies = {
  authenticate(request: Request, env: Env): Promise<AuthenticatedRequest>;
  resolveSource(auth: AuthenticatedRequest, request: SandboxRunRequest): Promise<AuthorizedSource>;
  reserve(auth: AuthenticatedRequest, request: SandboxRunRequest, source: AuthorizedSource): Promise<Reservation>;
  start(auth: AuthenticatedRequest, runId: string, clientRequestId: string, env: Env): Promise<StartedReservation>;
  execute(env: Env, reservation: StartedReservation, source: AuthorizedSource): Promise<RunnerResult>;
  finalize(auth: AuthenticatedRequest, runId: string, clientRequestId: string, env: Env, result: RunnerResult): Promise<boolean>;
};

const defaultDependencies: RunDependencies = {
  authenticate: authenticateRequest,
  resolveSource: (auth, request) => resolveAuthorizedSource(auth.supabase, request),
  reserve: (auth, request, source) => reserveRun(auth.supabase, request, source),
  start: (auth, runId, clientRequestId, env) => startRun(auth.supabase, runId, clientRequestId, requiredFinalizerToken(env)),
  execute: executeRunner,
  finalize: (auth, runId, clientRequestId, env, result) => finalizeRun(auth.supabase, runId, clientRequestId, requiredFinalizerToken(env), result)
};

function requiredFinalizerToken(env: Env): string {
  const token = env.SANDBOX_DB_FINALIZER_TOKEN;
  if (!token || token.length < 32 || token.length > 512 || /(replace|placeholder|changeme|enter[_ -]?directly)/i.test(token)) {
    throw new PublicHttpError(503, "sandbox_misconfigured");
  }
  return token;
}

function assertExecutionConfiguration(env: Env): void {
  requiredFinalizerToken(env);
  assertRunnerConfiguration(env);
}

function replayResult(reservation: Reservation, source: AuthorizedSource, env: Env): PublicSandboxResult {
  const result = reservation.result;
  if (!reservation.runId || !result) throw new PublicHttpError(409, "idempotent_request_pending", 4);
  const sanitized = sanitizeRunnerResult(result, source, env);
  return {
    ...sanitized,
    runId: reservation.runId,
    recordingStatus: "recorded",
    idempotentReplay: true
  };
}

export async function handleSandboxRun(
  request: Request,
  env: Env,
  dependencies: RunDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertProductionEnabled(request, env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    assertExecutionConfiguration(env);
    const auth = await dependencies.authenticate(request, env);
    const parsedRequest = await parseSandboxRequestBody(request);
    const source = await dependencies.resolveSource(auth, parsedRequest);
    if (!source.code || new TextEncoder().encode(source.code).byteLength > 65_536) {
      throw new PublicHttpError(403, "source_code_invalid");
    }

    const reservation = await dependencies.reserve(auth, parsedRequest, source);
    if (!reservation.accepted) {
      const error = reservation.reason === "quota_exceeded" ? "sandbox_quota_exceeded" : "sandbox_busy";
      throw new PublicHttpError(429, error, reservation.retryAfter ?? 4);
    }
    if (reservation.idempotentReplay) return jsonResponse(replayResult(reservation, source, env));
    if (!reservation.runId) throw new PublicHttpError(503, "reservation_unavailable");

    const startedReservation = await dependencies.start(auth, reservation.runId, parsedRequest.clientRequestId, env);

    let runnerResult: RunnerResult;
    try {
      runnerResult = await dependencies.execute(env, startedReservation, source);
    } catch (error) {
      runnerResult = unavailableRunnerResult(source);
      const recorded = await dependencies.finalize(auth, reservation.runId, parsedRequest.clientRequestId, env, runnerResult);
      if (error instanceof PublicHttpError && error.status === 429) {
        throw new PublicHttpError(429, "sandbox_busy", error.retryAfter ?? 4);
      }
      return jsonResponse({
        ...runnerResult,
        runId: reservation.runId,
        recordingStatus: recorded ? "recorded" : "failed",
        idempotentReplay: false
      } satisfies PublicSandboxResult);
    }

    const recorded = await dependencies.finalize(auth, reservation.runId, parsedRequest.clientRequestId, env, runnerResult);
    return jsonResponse({
      ...runnerResult,
      runId: reservation.runId,
      recordingStatus: recorded ? "recorded" : "failed",
      idempotentReplay: false
    } satisfies PublicSandboxResult);
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export const onRequest: PagesFunction<Env> = (context) => handleSandboxRun(context.request, context.env);
