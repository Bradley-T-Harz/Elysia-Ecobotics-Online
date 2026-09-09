import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";
import type { AddonManifest } from "../../pages/The-Elysia-Marketplace/types";

const schema = z.object({ publisherId: z.string().uuid(), creatorAttribution: z.string().min(1).max(200), publisherDisplayName: z.string().min(1).max(200),
  version: z.string(), packageSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(), recordedAt: z.string(), kind: z.enum(["external_release_reference", "published_version_snapshot"]) }).strict();

export default function AddonPublisherProvenance({ addon }: { addon: AddonManifest }) {
  const [record, setRecord] = useState<{ key: string; data: z.infer<typeof schema> | null } | null>(null);
  const addonKey = addon.canonical_addon_id ?? addon.id;
  const key = `${addonKey}:${addon.version}:${addon.package_sha256 ?? ""}`;
  useEffect(() => {
    let current = true;
    if (!supabase) return;
    void supabase.rpc("get_addon_publisher_provenance", { p_addon_key: addonKey, p_version: addon.version, p_package_sha256: addon.package_sha256 ?? null })
      .abortSignal(AbortSignal.timeout(12_000)).then(({ data, error }) => {
        const parsed = schema.safeParse(data);
        if (current) setRecord({ key, data: !error && parsed.success && parsed.data.version === addon.version && parsed.data.packageSha256 === (addon.package_sha256 ?? null) ? parsed.data : null });
      });
    return () => { current = false; };
  }, [key, addonKey, addon.version, addon.package_sha256]);
  const data = record?.key === key ? record.data : null;
  return <section className="publisher-provenance" aria-label="Ownership and release attribution"><h3>Ownership &amp; attribution</h3>
    {data ? <><p>Creator / Organization: <strong>{data.creatorAttribution}</strong></p><p>Publisher account: <strong>{data.publisherDisplayName}</strong></p><p>{data.kind === "external_release_reference" ? "External release provenance; this does not claim Marketplace review approval." : "Attribution preserved in this published version's submission record."}</p><p>Relationship recorded {new Date(data.recordedAt).toLocaleDateString()}. Current profile names do not rewrite this record.</p></> : <p>The release declares its publisher in the manifest. An authoritative publisher relationship for this exact release is not confirmed here; the public label alone grants no management authority.</p>}
  </section>;
}
