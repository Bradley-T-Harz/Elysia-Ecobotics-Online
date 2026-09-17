import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";
const lane = z.object({ key: z.string(), enabled: z.boolean(), sandboxQualified: z.boolean(), taxDecisionRecorded: z.boolean(), taxBehavior: z.string(), legalQualified: z.boolean(), rolloutAuthorized: z.boolean() });
const schema = z.object({ provider: z.literal("stripe"), scope: z.literal("first_party_account"), reviewStatus: z.string(), reviewedAt: z.string().nullable(), mode: z.enum(["test", "live"]), webhookVerified: z.boolean(), eventCoverageVerified: z.boolean(), lastPreflightAt: z.string().nullable(), thirdPartyStatus: z.literal("hard_off"), lanes: z.array(lane) });
const runtimeSchema = z.object({ mode: z.enum(["disabled", "test", "live"]), testCredentialPresent: z.boolean(), testWebhookSecretPresent: z.boolean(), liveCredentialPresent: z.boolean(), liveWebhookSecretPresent: z.boolean(), economicServerConfigured: z.boolean(), providerConfigured: z.boolean() });
export default function FirstPartyProviderReadiness() {
  const [state, setState] = useState<z.infer<typeof schema> | null>(null);
  const [runtime, setRuntime] = useState<z.infer<typeof runtimeSchema> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) throw new Error("unavailable");
      const result = await supabase.rpc("current_first_party_provider_readiness").abortSignal(AbortSignal.timeout(12_000));
      if (result.error) throw new Error("unavailable");
      const next = schema.parse(result.data);
      if (active) setState(next);
    }
    // This operator surface can inspect runtime status while public payments are off.
    void fetch("/api/billing/provider-readiness", { signal: AbortSignal.timeout(12_000), cache: "no-store" })
      .then(async response => { if (!response.ok) return; const result = await response.json(); const parsed = runtimeSchema.safeParse(result.runtime); if (active && parsed.success) setRuntime(parsed.data); })
      .catch(() => { /* Show unknown, never infer missing secrets or activation. */ });
    void load().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return <section className="section-card"><h2>Stripe first-party provider readiness</h2>
    <p>Account review passed September 15, 2026. Each lane requires its own verified configuration and qualification. Third-party Marketplace money, Connect and payouts remain hard OFF.</p>
    {runtime ? <dl className="mini-facts">
      <div><dt>Runtime mode</dt><dd>{runtime.mode}</dd></div>
      <div><dt>Sandbox key / webhook secret</dt><dd>{runtime.testCredentialPresent ? "Present" : "Missing"} / {runtime.testWebhookSecretPresent ? "Present" : "Missing"}</dd></div>
      <div><dt>Live key / webhook secret</dt><dd>{runtime.liveCredentialPresent ? "Present" : "Missing"} / {runtime.liveWebhookSecretPresent ? "Present" : "Missing"}</dd></div>
      <div><dt>Economic server binding</dt><dd>{runtime.economicServerConfigured ? "Configured" : "Missing or invalid"}</dd></div>
      <div><dt>Runtime configuration checks</dt><dd>{runtime.providerConfigured ? "Passed; lane gates still apply" : "Not ready"}</dd></div>
    </dl> : <p role="status">Runtime configuration is unknown until the billing endpoint responds.</p>}
    <p>Secret presence does not prove key permissions, account identity or successful payment processing.</p>
    {error ? <p role="status">Current readiness records are unavailable. No activation should be inferred.</p> : !state ? <p role="status">Checking authoritative readiness…</p> : <>
      <dl className="mini-facts"><div><dt>Account review</dt><dd>{state.reviewStatus} · {state.reviewedAt}</dd></div><div><dt>Last recorded preflight</dt><dd>{state.lastPreflightAt ?? "Not recorded"}</dd></div><div><dt>Economic environment</dt><dd>{state.mode}</dd></div><div><dt>Verified webhook delivery</dt><dd>{state.webhookVerified ? "Verified" : "Pending"}</dd></div><div><dt>Event coverage</dt><dd>{state.eventCoverageVerified ? "Verified" : "Pending"}</dd></div></dl>
      <div className="economic-capability-grid">{state.lanes.map(item => <article className="economic-summary-card" key={item.key}><h3>{item.key.replace(/_/g, " ")}</h3><p><strong>{item.enabled ? "Database switch enabled; runtime gates also apply" : "OFF"}</strong></p><ul><li>Sandbox acceptance: {item.sandboxQualified ? "recorded" : "pending"}</li><li>Tax decision: {item.taxDecisionRecorded ? "recorded" : "pending"}</li><li>Legal qualification: {item.legalQualified ? "recorded" : "pending"}</li><li>Rollout authorization: {item.rolloutAuthorized ? "recorded" : "pending"}</li></ul></article>)}</div>
    </>}
  </section>;
}
