import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";
import { canReviewDomain, loadCurrentRoleState, type AppRole, type ReviewDomain } from "../review/reviewClient";
import { economicOperatorCapabilityKeys } from "../billing/billingClient";
import type { DeveloperProfile } from "../../pages/The-Developer-Forge/developerForgeApi";

type Doorways = { profile: DeveloperProfile | null; publisherManager: boolean; roles: AppRole[]; isAdmin: boolean; capabilities: string[] };
const empty: Doorways = { profile: null, publisherManager: false, roles: [], isAdmin: false, capabilities: [] };

/** Presentation only. Destination APIs and RLS remain the authority. No local profile fallback. */
export function useAccountDoorways() {
  const { userId, accessToken, loading: authLoading } = useAuth();
  const [result, setResult] = useState<{ token: string; data: Doorways; warning: string } | null>(null);
  useEffect(() => {
    let current = true;
    if (!userId || !accessToken || !supabase) return;
    const client = supabase;
    void (async () => {
      const { data: auth, error } = await client.auth.getUser();
      if (error || auth.user?.id !== userId) throw new Error("Account verification unavailable");
      const [profile, roles, economic, publishers] = await Promise.all([
        client.from("developer_profiles").select("id,user_id,developer_slug,display_name,status").eq("user_id", userId).maybeSingle(),
        loadCurrentRoleState(),
        client.rpc("current_user_economic_operator_overview"),
        client.rpc("current_user_publisher_workspace")
      ]);
      const record = profile.data as DeveloperProfile | null;
      const capabilities = !economic.error && economic.data?.authorized === true && Array.isArray(economic.data.capabilities)
        ? economicOperatorCapabilityKeys.filter(key => economic.data.capabilities.includes(key)) : [];
      if (current) setResult({ token: accessToken, data: {
        profile: !profile.error && record?.user_id === userId && record.id ? record : null,
        publisherManager: !publishers.error && Array.isArray(publishers.data?.publishers) && publishers.data.publishers.length > 0,
        roles: roles.signedIn ? roles.roles : [], isAdmin: roles.signedIn && roles.isAdmin, capabilities
      }, warning: profile.error || economic.error || roles.warnings.length ? "Some account destinations could not be checked. Reload to try again." : "" });
    })().catch(() => { if (current) setResult({ token: accessToken, data: empty, warning: "Account destinations could not be verified. Reload to try again." }); });
    return () => { current = false; };
  }, [userId, accessToken]);
  // Never render the previous actor's capabilities while a new session is loading.
  const resolved = Boolean(accessToken && result?.token === accessToken);
  const data = resolved ? result!.data : empty;
  return { ...data, creator: Boolean(data.profile) || data.publisherManager, economic: data.capabilities.length > 0, signedIn: Boolean(userId && accessToken), loading: authLoading || Boolean(accessToken && !resolved), warning: resolved ? result!.warning : "" };
}

const reviewRoutes: Record<string, ReviewDomain> = {
  "/admin/addon-submissions": "marketplace", "/admin/developers": "marketplace",
  "/admin/library-sources": "living_library_source", "/admin/work-submissions": "work_with",
  "/admin/review/work-with": "work_with", "/admin/review/stewardship": "stewardship",
  "/admin/review/commune": "commune", "/admin/review/living-library": "living_library_source",
  "/admin/review/marketplace": "marketplace", "/admin/review/broken-links": "living_library_broken_link"
};
export function canVisitStaffRoute(route: string, access: Pick<Doorways, "roles" | "isAdmin" | "capabilities">) {
  const pathname = route.split(/[?#]/)[0];
  if (pathname.startsWith("/admin/economic-operations")) {
    if (!access.capabilities.length) return false;
    const section = pathname.split("/")[3];
    const sectionCapabilities: Record<string, string[]> = {
      sellers: ["marketplace_payout_manage"], onboarding: ["marketplace_payout_manage"],
      offers: ["marketplace_payout_manage"], settlement: ["marketplace_payout_manage"],
      support: ["economic_refunds_manage", "recurring_support_manage"], refunds: ["economic_refunds_manage", "recurring_support_manage"],
      organizations: ["organization_billing_manage"], sponsorship: ["sponsorship_manage"],
      "job-fees": ["job_fee_assess", "economic_assistance_manage"], "hosted-allowance": ["sandbox_credits_adjust"],
      waivers: ["economic_assistance_manage"], audit: ["economic_audit_view"],
      receipts: ["economic_orders_view", "economic_payments_view", "economic_refunds_manage", "economic_audit_view", "accounting_export"]
    };
    return !sectionCapabilities[section] || sectionCapabilities[section].some(key => access.capabilities.includes(key));
  }
  if (["/admin/roles", "/admin/badges", "/commons-circle/admin/messaging-access"].includes(pathname)) return access.isAdmin;
  if (reviewRoutes[pathname]) return access.isAdmin || canReviewDomain(access.roles, reviewRoutes[pathname]);
  if (pathname === "/commons-circle/admin-communications") return access.isAdmin || access.roles.some(role => ["moderator", "commune_moderator"].includes(role));
  if (pathname.startsWith("/admin") || pathname === "/commons-circle/admin-console") return access.isAdmin || access.roles.length > 0;
  return true;
}
