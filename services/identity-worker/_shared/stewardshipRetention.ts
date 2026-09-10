import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SupabaseOwnedStorageCleanupAdapter } from "./storageCleanup.ts";

const jobsSchema = z.array(z.object({
  requestId: z.string().uuid(), leaseToken: z.string().uuid(),
  objects: z.array(z.object({ objectId: z.string().uuid(), bucket: z.literal("stewardship-receipts"), name: z.string().min(1).max(500) }).strict()).max(100)
}).strict()).max(10);

/** No public endpoint, payment provider, or byte download. DB claims are the authority. */
export async function processStewardshipRetention(client: SupabaseClient) {
  const claim = await client.rpc("claim_stewardship_proof_deletions", { p_limit: 10 });
  if (claim.error) throw new Error("stewardship_retention_claim_failed");
  const jobs = jobsSchema.parse(claim.data);
  const cleanup = new SupabaseOwnedStorageCleanupAdapter(client);
  let completed = 0, failed = 0;
  for (const job of jobs) {
    try {
      if (job.objects.some(object => object.name.split("/").length !== 3 || object.name.split("/")[1] !== job.requestId)) throw new Error("stewardship_retention_scope_invalid");
      await cleanup.remove(job.objects, job.requestId);
      const result = await client.rpc("complete_stewardship_proof_deletion", { p_request_id: job.requestId, p_lease_token: job.leaseToken });
      if (result.error || result.data !== true) throw new Error("stewardship_retention_confirmation_failed");
      completed++;
    } catch { failed++; } // Lease expiry retries ambiguous failures; never log paths or identities.
  }
  return { claimed: jobs.length, completed, failed };
}
