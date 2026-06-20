import { useCallback, useEffect, useState } from "react";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import PageHero from "../../shared/components/PageHero";
import { loadCurrentRoleState } from "../../shared/review/reviewClient";
import type { AppRole } from "../../shared/review/reviewClient";
import { loadCommonsHomebase } from "./commonsCircleApi";
import type { CommonsHomebaseData } from "./commonsCircleApi";

const adminConsoleLinks = [
  ["/admin", "Admin dashboard", "Governance overview and safe queue counts."],
  ["/admin/moderation", "Moderation dashboard", "Reported and flagged public content."],
  ["/admin/reports", "Reported content queue", "Private reports and review outcomes."],
  ["/admin/addon-submissions", "Add-on review queue", "Developer Forge submissions and package metadata."],
  ["/admin/developers", "Developer verification", "Developer profile requests and trust status."],
  ["/admin/library-sources", "Living Library source review", "Source submissions, provenance, and privacy notes."],
  ["/admin/work-submissions", "Work With / role review", "Private work, volunteer, and role-interest submissions."],
  ["/admin/roles", "User role management", "Manual authority assignment and revocation."],
  ["/admin/audit", "Audit logs", "Internal review and moderation events."]
] as const;

const adminAuthorityRoles: AppRole[] = ["administrator", "moderator", "reviewer", "marketplace_reviewer", "source_reviewer", "commune_moderator", "guardian_reviewer"];

type RoleGateState = { roles: AppRole[]; isAdmin: boolean; signedIn: boolean };

function MiniFact({ label, value }: { label: string; value: string | number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export function userCanOpenCommonsAdminConsole(homebase: Pick<CommonsHomebaseData, "signedIn" | "profile"> | null | undefined, roleState: RoleGateState) {
  return Boolean(homebase?.signedIn && (homebase.profile?.is_admin || roleState.isAdmin || roleState.roles.some((role) => adminAuthorityRoles.includes(role))));
}

export function CommonsCircleAdminEntryCard() {
  return <section className="section-card commons-admin-console">
    <p className="eyebrow">Private Admin Console</p>
    <h2>Admin Console</h2>
    <p>Moderation, review, role, and governance tools are available on a separate private console page.</p>
    <div className="button-row"><a className="button-link button-link--primary" href="/commons-circle/admin-console">Open Admin Console</a></div>
    <p className="boundary-note">Badges, membership tiers, donations, developer visibility, contribution interest, and public profile customization do not grant administrator, moderator, reviewer, guardian, or paid-role authority.</p>
  </section>;
}

export function CommonsCircleAdminConsolePanel({ homebase, roleState }: { homebase: CommonsHomebaseData; roleState: RoleGateState }) {
  const profile = homebase.profile;
  return <section className="section-card commons-admin-console" id="admin-console">
    <p className="eyebrow">Private Admin Console</p>
    <h2>Moderation and governance tools</h2>
    <p>This card is shown only for signed-in accounts with administrator, reviewer, moderator, or domain-review authority. Queue details remain protected by Supabase RLS and each admin route checks access directly.</p>
    <dl className="mini-facts">
      <MiniFact label="Admin profile flag" value={profile?.is_admin ? "Yes" : "No"} />
      <MiniFact label="Role gate" value={roleState.isAdmin ? "Administrator" : roleState.roles.length ? roleState.roles.map((role) => role.replace(/_/g, " ")).join(", ") : "Profile admin flag"} />
      <MiniFact label="Private queues" value="RLS-gated" />
      <MiniFact label="Authority source" value="Admin-assigned roles only" />
    </dl>
    <div className="commons-admin-grid">
      {adminConsoleLinks.map(([href, label, description]) => <a className="commons-admin-link" href={href} key={href}><strong>{label}</strong><span>{description}</span></a>)}
    </div>
    <p className="boundary-note">Badges, membership tiers, donations, developer visibility, contribution interest, and public profile customization do not grant administrator, moderator, reviewer, guardian, or paid-role authority.</p>
  </section>;
}

export default function CommonsCircleAdminConsolePage() {
  const [homebase, setHomebase] = useState<CommonsHomebaseData | null>(null);
  const [roleState, setRoleState] = useState<RoleGateState>({ roles: [], isAdmin: false, signedIn: false });
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const pushMessage = useCallback((message: string) => {
    if (message.trim()) setMessages((current) => [message, ...current].slice(0, 4));
  }, []);

  const refresh = useCallback(async () => {
    const [homebaseResult, roles] = await Promise.all([loadCommonsHomebase(), loadCurrentRoleState()]);
    setHomebase(homebaseResult);
    setRoleState({ roles: roles.roles, isAdmin: roles.isAdmin, signedIn: roles.signedIn });
    setLoaded(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const allowed = userCanOpenCommonsAdminConsole(homebase, roleState);

  return <div className="page-stack commons-circle-page commons-homebase">
    <PageHero eyebrow="Private account extension" title="Commons Circle Admin Console">
      <p>Moderation, review, role, and governance tools extend from the private Commons Circle homebase for authorized administrators, reviewers, and moderators.</p>
      <p>Authority comes from assigned roles and protected backend policies, not badges, membership, donations, or public profile visibility.</p>
    </PageHero>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}

    {!loaded && <section className="section-card"><p className="eyebrow">Role gate</p><h2>Checking admin console access...</h2><p>Private queue links stay hidden until role state is loaded.</p></section>}

    {loaded && !homebase?.signedIn && <section className="section-card">
      <p className="eyebrow">Sign in required</p>
      <h2>Admin Console requires a Website Account.</h2>
      <p>Sign in through Commons Circle before opening private moderation, review, role, or governance tools.</p>
      <AuthPanel
        onMessage={pushMessage}
        onAuthChanged={refresh}
        copy={{
          eyebrow: "Website Account",
          title: "Create or Sign In to Website Account",
          description: "This is your public Elysia Ecobotics Online account. It is separate from the private local Elysia core.",
          signedOutText: "No active website session.",
          confirmationPath: "/commons-circle/admin-console",
          confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to this private console page."
        }}
      />
    </section>}

    {loaded && homebase?.signedIn && !allowed && <section className="section-card">
      <p className="eyebrow">Role required</p>
      <h2>Admin Console is private.</h2>
      <p>This page is only for accounts with administrator, reviewer, moderator, or domain-review authority assigned by authorized administrators.</p>
      <p className="boundary-note">Badges, membership tiers, donations, developer visibility, contribution interest, and public profile customization do not grant administrator, moderator, reviewer, guardian, or paid-role authority.</p>
      <div className="button-row"><a className="button-link" href="/commons-circle">Back to Commons Circle</a></div>
    </section>}

    {loaded && homebase && allowed && <>
      <CommonsCircleAdminConsolePanel homebase={homebase} roleState={roleState} />
      <div className="button-row"><a className="button-link" href="/commons-circle">Back to Commons Circle</a></div>
    </>}
  </div>;
}
