import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { loadCurrentUserCircle, removeFromCircle, respondToCircleInvitation, type CircleOverview, type CircleRelationshipItem } from "./circleApi";

const emptyCircle: CircleOverview = { accepted: [], incoming: [], sent: [], counts: { accepted: 0, incoming: 0, sent: 0 } };

function CircleCard({ item, actions }: { item: CircleRelationshipItem; actions?: ReactNode }) {
  return <article className="section-card commons-circle-member-card">
    <div className="commons-circle-member-card__identity">
      {item.profile.avatarUrl ? <img src={item.profile.avatarUrl} alt="" loading="lazy" /> : <span className="commons-circle-member-card__fallback" aria-hidden="true">{(item.profile.displayName || item.profile.handle).slice(0, 1).toUpperCase()}</span>}
      <div><h3>{item.profile.displayName || `@${item.profile.handle}`}</h3><p><Link to={item.profile.profileUrl}>@{item.profile.handle}</Link></p>{item.profile.shortPublicBio && <p>{item.profile.shortPublicBio}</p>}</div>
    </div>
    {actions && <div className="button-row">{actions}</div>}
  </article>;
}

export default function CirclePage() {
  const [circle, setCircle] = useState(emptyCircle);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await loadCurrentUserCircle();
    setCircle(result.data);
    setWarnings(result.warnings);
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function respond(id: string, accept: boolean) {
    const result = await respondToCircleInvitation(id, accept);
    setMessage(result.message);
    if (result.ok) await refresh();
  }
  async function remove(id: string) {
    const result = await removeFromCircle(id);
    setMessage(result.message);
    if (result.ok) await refresh();
  }

  return <div className="page-stack commons-circle-page commons-your-circle-page">
    <PageHero eyebrow="Commons Circle" title="Your Circle">
      <p>Your Circle is a private list of mutual Commons connections. Invitations require consent from both people.</p>
      <p>Circle membership is not a follower count, endorsement, employment relationship, reviewer status, moderator status, or administrator authority.</p>
    </PageHero>
    <section className="section-card">
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Mutual connections</p><h2>{circle.counts.accepted} mutual Circle {circle.counts.accepted === 1 ? "member" : "members"}</h2></div><Link className="button-link" to="/commons-circle/signals">Back to Signals</Link></div>
      <dl className="mini-facts"><div><dt>Mutuals</dt><dd>{circle.counts.accepted}</dd></div><div><dt>Invitations received</dt><dd>{circle.counts.incoming}</dd></div><div><dt>Invitations sent</dt><dd>{circle.counts.sent}</dd></div></dl>
      {message && <p className="message" role="status">{message}</p>}
      {warnings.map((warning) => <p className="message" key={warning}>{warning}</p>)}
    </section>
    <section className="section-card">
      <div className="section-heading"><p className="eyebrow">Invitations received</p><h2>Choose each connection deliberately</h2></div>
      <div className="commons-circle-member-grid">{circle.incoming.map((item) => <CircleCard key={item.relationshipId} item={item} actions={<><button className="button-primary" type="button" onClick={() => void respond(item.relationshipId, true)}>Accept invitation</button><button type="button" onClick={() => void respond(item.relationshipId, false)}>Decline</button></>} />)}</div>
      {!loading && !circle.incoming.length && <p className="commune-empty-state">No incoming Circle invitations.</p>}
    </section>
    <section className="section-card">
      <div className="section-heading"><p className="eyebrow">Your mutuals</p><h2>In Your Circle</h2></div>
      <div className="commons-circle-member-grid">{circle.accepted.map((item) => <CircleCard key={item.relationshipId} item={item} actions={<button type="button" onClick={() => void remove(item.relationshipId)}>Remove from Circle</button>} />)}</div>
      {!loading && !circle.accepted.length && <p className="commune-empty-state">No mutual Circle members yet. Open a public Commons Profile to send an invitation.</p>}
    </section>
    <section className="section-card">
      <div className="section-heading"><p className="eyebrow">Invitations sent</p><h2>Waiting for consent</h2></div>
      <div className="commons-circle-member-grid">{circle.sent.map((item) => <CircleCard key={item.relationshipId} item={item} actions={<span className="review-status">Circle invitation sent</span>} />)}</div>
      {!loading && !circle.sent.length && <p className="commune-empty-state">No outgoing invitations are waiting.</p>}
    </section>
    <WarningCallout title="Private connection boundary"><p>Only you and the other participant can see this relationship. Administrators do not receive blanket access. Removing a mutual does not silently revoke access to private posts that already named them explicitly; post owners manage those participant lists separately.</p></WarningCallout>
  </div>;
}
