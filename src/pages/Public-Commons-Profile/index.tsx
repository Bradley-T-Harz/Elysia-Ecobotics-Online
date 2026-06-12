import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import { loadPublicCommonsProfile } from "../The-Commons-Circle/commonsCircleApi";
import type { PublicCommonsProfile, UserBadge } from "../The-Commons-Circle/commonsCircleApi";

function PublicBadgeIcon({ badge }: { badge: UserBadge }) {
  const [failed, setFailed] = useState(false);
  return <div className="medallion-icon-frame">{badge.icon_path && !failed ? <img className="medallion-icon" src={badge.icon_path} alt={`${badge.name} badge icon`} onError={() => setFailed(true)} /> : <span className="medallion-glyph">✦</span>}</div>;
}

type PublicCustomizationView = {
  theme_mode?: string | null;
  background_style?: string | null;
  profile_layout?: string | null;
  decal_set?: string | null;
  selected_decals?: string[] | null;
};

function classToken(value: string | null | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-z0-9_-]/gi, "_");
}

function customizationClass(settings: PublicCustomizationView) {
  return `commons-theme-${classToken(settings.theme_mode, "starlit_archive")} commons-background-${classToken(settings.background_style, "soft_cyber_garden")} commons-layout-${classToken(settings.profile_layout, "classic_homebase")}`;
}

function formatDecalLabel(value: string) {
  return value.replace(/_/g, " ");
}

function visibleDecals(settings: PublicCustomizationView) {
  const decals = settings.selected_decals?.length ? settings.selected_decals : settings.decal_set && settings.decal_set !== "none" ? [settings.decal_set] : [];
  return decals.filter(Boolean);
}

function DecalStrip({ settings }: { settings: PublicCustomizationView }) {
  const decals = visibleDecals(settings);
  if (!decals.length) return null;
  return <div className="commons-decal-strip" aria-label="Selected profile decals">{decals.map((decal) => <span className="commons-decal-chip" key={decal}>{formatDecalLabel(decal)}</span>)}</div>;
}


export default function PublicCommonsProfilePage() {
  const { username = "" } = useParams();
  const [profileData, setProfileData] = useState<PublicCommonsProfile | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPublicCommonsProfile(username).then((result) => {
      if (!active) return;
      setProfileData(result.data);
      setWarnings(result.warnings);
      setLoading(false);
    });
    return () => { active = false; };
  }, [username]);

  if (loading) {
    return <div className="page-stack"><PageHero eyebrow="Commons Profile" title="Loading public profile"><p>Checking the public Commons profile visibility settings.</p></PageHero></div>;
  }

  if (!profileData) {
    if (import.meta.env.DEV && warnings.length) console.warn("[Public Commons Profile]", warnings);
    return <div className="page-stack"><PageHero eyebrow="Commons Profile" title="Profile not found"><p>This public Commons profile does not exist yet, is unavailable, or Supabase is not configured.</p></PageHero></div>;
  }

  const { profile, visibility, customization, badges, publicCollections, publicSavedSources, isOwner } = profileData;
  const style = { "--commons-accent": customization.accent_color || "#8ee8dc" } as CSSProperties;
  const profileClasses = `page-stack commons-public-profile commons-homebase ${customizationClass(customization)}`;
  if (import.meta.env.DEV && warnings.length) console.warn("[Public Commons Profile]", warnings);

  return (
    <div className={profileClasses} style={style}>
      <PageHero eyebrow="Public Commons Profile" title={visibility.show_display_name ? profile.display_name || profile.username : `@${profile.username}`}>
        <p>This public profile is controlled by the member's Commons Circle visibility settings. It never shows private email, resumes, receipts, Work With requests, admin review data, notifications, local Elysia connection data, or private saved items.</p>
      </PageHero>
      <section className="section-card commons-homebase-hero">
        <div className="commons-profile-mantle" style={customization.banner_url ? { backgroundImage: `linear-gradient(135deg, rgba(10, 20, 22, .35), rgba(18, 44, 48, .4)), url(${customization.banner_url})` } : undefined}>
          <div className="commons-avatar">{customization.avatar_url ? <img src={customization.avatar_url} alt="Public Commons avatar" /> : <span>{(profile.display_name || profile.username).slice(0, 1).toUpperCase()}</span>}</div>
          <div><p className="eyebrow">@{profile.username}</p><h2>{visibility.show_display_name ? profile.display_name || profile.username : `@${profile.username}`}</h2>{visibility.show_member_tier && <p>Free Member</p>}</div>
        </div>
        <DecalStrip settings={customization} />
        {isOwner && <div className="button-row"><a className="button-link button-link--primary" href="/commons-circle">Edit in Commons Circle</a></div>}
      </section>

      <section className="commons-homebase-grid">
        <article className="section-card">
          <p className="eyebrow">Profile</p>
          <h2>Public fields</h2>
          {visibility.show_bio && profile.bio && <p>{profile.bio}</p>}
          {visibility.show_interests && profile.interests && <p><strong>Interests:</strong> {profile.interests}</p>}
          {visibility.show_website && profile.website_url && <p><a href={profile.website_url} target="_blank" rel="noreferrer">Website</a></p>}
          {visibility.show_github && profile.github_url && <p><a href={profile.github_url} target="_blank" rel="noreferrer">GitHub / code profile</a></p>}
          {visibility.show_developer_status && <p><strong>Developer status:</strong> {profile.is_developer ? "visible/requested" : "not listed"}</p>}
          <p className="boundary-note">Authority roles are not granted by profile display, badges, medallions, donations, or self-selection.</p>
        </article>
        <article className="section-card">
          <p className="eyebrow">Stewardship</p>
          <h2>{visibility.show_stewardship_recognition ? "Public recognition" : "Hidden by member"}</h2>
          <p>{visibility.show_stewardship_recognition ? "Reviewed stewardship recognition can appear here later when the member chooses to show it." : "This member has hidden stewardship recognition from their public profile."}</p>
        </article>
      </section>

      {visibility.show_badges && <section className="section-card commons-medallion-wall"><p className="eyebrow">Medallions</p><h2>Public badges</h2>{badges.length ? <div className="commons-medallion-grid">{badges.map((badge) => <article className={`earned${badge.authority || badge.authority_linked ? " authority-linked" : ""}`} key={badge.badge_key}><PublicBadgeIcon badge={badge} /><h3>{badge.name}</h3><p>{badge.description}</p>{badge.rule_summary && <p className="commons-medallion-note">{badge.rule_summary}</p>}{badge.note && <p className="commons-medallion-note">{badge.note}</p>}<div className="commons-badge-row"><span>{badge.rarity}</span><span>{badge.category || badge.badge_type}</span>{(badge.authority || badge.authority_linked) && <span>authority-linked recognition</span>}</div></article>)}</div> : <p>No public badges are visible yet.</p>}<p className="boundary-note">Badges are recognition, not administrator, moderator, reviewer, guardian, developer trust, or paid-role authority.</p></section>}

      {visibility.show_source_collections && <section className="section-card commons-shelves"><p className="eyebrow">Public source collections</p><h2>Collections this member chose to show</h2>{publicCollections.length ? <div className="commons-shelf-grid">{publicCollections.map((collection) => <article className="commons-preview-card" key={collection.id || collection.title}><h3>{collection.title}</h3><p>{collection.description || "Public source collection"}</p><span>{collection.source_count} sources · {collection.visibility}</span></article>)}</div> : <p>No public collections are visible.</p>}</section>}

      {visibility.show_saved_sources && <section className="section-card commons-shelves"><p className="eyebrow">Public saved sources</p><h2>Sources this member chose to show</h2>{publicSavedSources.length ? <div className="commons-shelf-grid">{publicSavedSources.map((source) => <article className="commons-preview-card" key={source.source_id}><h3>{source.source_name}</h3><p>{source.category || "Living Library source"}</p>{source.source_url && <a className="button-link" href={source.source_url} target="_blank" rel="noreferrer">Official source</a>}</article>)}</div> : <p>No public saved sources are visible.</p>}</section>}
    </div>
  );
}
