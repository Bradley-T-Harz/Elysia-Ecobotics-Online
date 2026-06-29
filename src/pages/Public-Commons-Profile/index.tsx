import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { getCommonsBackgroundStyleOption, normalizeCommonsBackgroundStyle } from "../../shared/commonsBackgroundStyles";
import { getCommonsProfileLayoutOption, normalizeCommonsProfileLayout } from "../../shared/commonsProfileLayouts";
import CommonsBackgroundAtmosphere from "../../shared/components/CommonsBackgroundAtmosphere";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import CommonsProfileLayoutFrame from "../../shared/components/CommonsProfileLayoutFrame";
import PageHero from "../../shared/components/PageHero";
import { loadPublicCommonsProfile } from "../The-Commons-Circle/commonsCircleApi";
import type { PublicCommonsProfile, UserBadge } from "../The-Commons-Circle/commonsCircleApi";

function PublicBadgeIcon({ badge }: { badge: UserBadge }) {
  const [failed, setFailed] = useState(false);
  return <div className="medallion-icon-frame">{badge.icon_path && !failed ? <img className="medallion-icon" src={badge.icon_path} alt={`${badge.name} badge icon`} onError={() => setFailed(true)} /> : <span className="medallion-glyph">✦</span>}</div>;
}

type PublicCustomizationView = {
  theme_mode?: string | null;
  accent_color?: string | null;
  background_style?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  profile_layout?: string | null;
  decal_set?: string | null;
  selected_decals?: string[] | null;
};

function safeAccentColor(value: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value as string : "#8ee8dc";
}

function classToken(value: string | null | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-z0-9_-]/gi, "_");
}

function customizationClass(settings: PublicCustomizationView) {
  return `commons-theme-${classToken(settings.theme_mode, "starlit_archive")} commons-background-${classToken(normalizeCommonsBackgroundStyle(settings.background_style), "soft_cyber_garden")} commons-layout-${classToken(normalizeCommonsProfileLayout(settings.profile_layout), "classic_homebase")}`;
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
  return <div className="commons-decal-strip commons-public-decal-strip" aria-label="Selected public profile decorative markers">{decals.map((decal) => <span className="commons-decal-chip" key={decal}>{formatDecalLabel(decal)}</span>)}</div>;
}

function previewText(value: string, max = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1).trim()}…` : compact;
}

function publicUsernameFromHandle(publicHandle: string) {
  let decoded = publicHandle.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (!decoded.startsWith("@")) return null;
  const username = decoded.slice(1).trim();
  return /^[a-z0-9][a-z0-9_-]{1,48}$/i.test(username) ? username : null;
}

export default function PublicCommonsProfilePage() {
  const { publicHandle = "" } = useParams();
  const username = publicUsernameFromHandle(publicHandle);
  const [profileData, setProfileData] = useState<PublicCommonsProfile | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!username) {
      setProfileData(null);
      setWarnings([]);
      setLoading(false);
      return () => { active = false; };
    }
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
    return <div className="page-stack"><PageHero eyebrow="Commons Profile" title="Profile not found or not public"><p>This public Commons Circle profile is unavailable. The handle may be missing, private, not published, or not created yet.</p></PageHero></div>;
  }

  const { profile, visibility, customization, badges, publicCollections, publicLinks, publicCommunePosts, publicCommuneComments, isOwner } = profileData;
  const accentColor = safeAccentColor(customization.accent_color);
  const backgroundStyle = normalizeCommonsBackgroundStyle(customization.background_style);
  const profileLayout = normalizeCommonsProfileLayout(customization.profile_layout);
  const profileLayoutOption = getCommonsProfileLayoutOption(profileLayout);
  const style = { "--commons-accent": accentColor } as CSSProperties;
  const profileClasses = `page-stack commons-public-profile commons-homebase ${customizationClass(customization)}`;
  const visibleName = visibility.show_display_name ? profile.display_name || profile.username : `@${profile.username}`;
  const hasPublicIdentityDetails = Boolean((visibility.show_bio && profile.bio) || profile.organization || (visibility.show_interests && profile.interests) || (visibility.show_website && profile.website_url) || (visibility.show_github && profile.github_url) || publicLinks.length);
  const hasPublicCollections = publicCollections.length > 0;
  const hasPublicContributions = publicCommunePosts.length > 0 || publicCommuneComments.length > 0;
  if (import.meta.env.DEV && warnings.length) console.warn("[Public Commons Profile]", warnings);

  return (
    <div className={profileClasses} style={style} data-commons-theme={customization.theme_mode || "starlit_archive"} data-commons-background={backgroundStyle} data-commons-layout={profileLayout}>
      <PageHero eyebrow="Public Commons Profile" title={visibleName}>
        <p>This is a public Commons Circle profile. It does not expose private account email, private requests, saved shelves, local Elysia data, files, logs, vaults, credentials, or machine data.</p>
      </PageHero>
      <CommonsBackgroundAtmosphere backgroundStyle={backgroundStyle} accentColor={accentColor} variant="public" className="commons-public-profile-atmosphere commons-public-atmosphere-stage">
        <CommonsProfileLayoutFrame profileLayout={profileLayout} variant="public" className="commons-public-profile-layout-frame">
          <section className="commons-profile-slot commons-profile-slot--summary">
            <article className="section-card commons-homebase-hero commons-public-room-hero commons-public-section commons-public-card-glass commons-profile-summary-shell">
              <div className={`commons-profile-summary-card commons-profile-mantle commons-public-profile-mantle${customization.banner_url ? " has-public-banner" : ""}`}>
                {customization.banner_url && <img className="commons-public-banner commons-profile-banner-layer" src={customization.banner_url} alt="" aria-hidden="true" loading="lazy" />}
                <div className="commons-profile-summary-card__avatar">
                  <CommonsAvatarViewer src={customization.avatar_url} alt="Public Commons avatar" fallback={(profile.display_name || profile.username).slice(0, 1).toUpperCase()} viewLabel="View full public Commons profile picture" />
                </div>
                <div className="commons-profile-summary-card__body commons-public-profile-title">
                  <p className="eyebrow commons-profile-summary-card__handle">@{profile.username}</p>
                  <h2 className="commons-profile-summary-card__name">{visibleName}</h2>
                  {profile.headline && <p>{profile.headline}</p>}
                  <div className="commons-customization-badges commons-profile-summary-card__chips" aria-label="Public profile presentation settings"><span>{formatDecalLabel(customization.theme_mode || "starlit_archive")}</span><span>{getCommonsBackgroundStyleOption(backgroundStyle).label}</span><span>{profileLayoutOption.label}</span></div>
                </div>
              </div>
              <DecalStrip settings={customization} />
              {isOwner && <div className="button-row commons-profile-summary-card__edit"><a className="button-link button-link--primary" href="/commons-circle">Edit in Commons Circle</a></div>}
            </article>
          </section>

          <section className="commons-profile-slot commons-profile-slot--identity">
            <article className={`section-card commons-public-section commons-public-card-glass commons-public-section-card commons-public-identity-card${hasPublicIdentityDetails ? "" : " commons-public-section--empty commons-public-section-card--empty"}`}>
              <p className="eyebrow commons-public-section-card__eyebrow">Profile</p>
              <h2>Public identity</h2>
              {visibility.show_bio && profile.bio && <p>{profile.bio}</p>}
              {profile.organization && <p><strong>Organization:</strong> {profile.organization}</p>}
              {visibility.show_interests && profile.interests && <p><strong>Interests:</strong> {profile.interests}</p>}
              <div className="commons-public-link-list">
                {visibility.show_website && profile.website_url && <p><a href={profile.website_url} target="_blank" rel="noreferrer">Website</a></p>}
                {visibility.show_github && profile.github_url && <p><a href={profile.github_url} target="_blank" rel="noreferrer">GitHub / code profile</a></p>}
                {publicLinks.map((link) => <p key={`${link.label}-${link.url}`}><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>{link.kind ? ` · ${link.kind}` : ""}</p>)}
              </div>
              {!hasPublicIdentityDetails && <p>No public profile fields are visible yet.</p>}
              <p className="boundary-note commons-public-authority-note">Profile display, badges, medallions, donations, and self-selection do not grant administrator, moderator, reviewer, guardian, developer trust, or paid-role authority.</p>
            </article>
          </section>

          <section className="commons-profile-slot commons-profile-slot--recognition">
            <article className="section-card commons-public-section commons-public-card-glass commons-public-section--compact commons-public-section-card commons-public-recognition-card">
              <p className="eyebrow commons-public-section-card__eyebrow">Stewardship</p>
              <h2>{visibility.show_stewardship_recognition ? "Public recognition" : "Hidden by member"}</h2>
              <p>{visibility.show_stewardship_recognition ? "Reviewed stewardship recognition can appear here later when the member chooses to show it." : "This member has hidden stewardship recognition from their public profile."}</p>
            </article>
          </section>

          {visibility.show_badges && (
            <section className="commons-profile-slot commons-profile-slot--badges">
              <article className={`section-card commons-medallion-wall commons-public-section commons-public-card-glass commons-public-section-card commons-public-badges-card${badges.length ? "" : " commons-public-section--empty commons-public-section-card--empty"}`}>
                <p className="eyebrow commons-public-section-card__eyebrow">Medallions</p>
                <h2>Public badges</h2>
                {badges.length ? (
                  <div className="commons-medallion-grid commons-public-badge-list">
                    {badges.map((badge) => (
                      <article className={`earned commons-public-card-glass commons-public-badge-card${badge.authority || badge.authority_linked ? " authority-linked" : ""}`} key={badge.badge_key}>
                        <PublicBadgeIcon badge={badge} />
                        <h3>{badge.name}</h3>
                        <p>{badge.description}</p>
                        {badge.rule_summary && <p className="commons-medallion-note">{badge.rule_summary}</p>}
                        {badge.note && <p className="commons-medallion-note">{badge.note}</p>}
                        <div className="commons-badge-row commons-public-badge-tags"><span>{badge.rarity}</span><span>{badge.category || badge.badge_type}</span>{(badge.authority || badge.authority_linked) && <span>authority-linked recognition</span>}</div>
                      </article>
                    ))}
                  </div>
                ) : <p>No public badges are visible yet.</p>}
                <p className="boundary-note commons-public-authority-note">Badges are recognition, not administrator, moderator, reviewer, guardian, developer trust, or paid-role authority.</p>
              </article>
            </section>
          )}

          {visibility.show_source_collections && (
            <section className="commons-profile-slot commons-profile-slot--collections">
              <article className={`section-card commons-shelves commons-public-section commons-public-card-glass commons-public-section-card commons-public-collections-card${hasPublicCollections ? "" : " commons-public-section--empty commons-public-section-card--empty"}`}>
                <p className="eyebrow commons-public-section-card__eyebrow">Public source collections</p>
                <h2>Collections this member chose to show</h2>
                {publicCollections.length ? (
                  <div className="commons-shelf-grid commons-public-card-grid commons-public-collection-list">
                    {publicCollections.map((collection) => <article className="commons-preview-card commons-public-card-glass" key={collection.id || collection.title}><h3>{collection.title}</h3><p>{collection.description || "Public source collection"}</p><span>{collection.source_count} sources · {collection.visibility}</span></article>)}
                  </div>
                ) : <p>No public collections are visible.</p>}
              </article>
            </section>
          )}

          {visibility.show_commune_posts && (
            <section className="commons-profile-slot commons-profile-slot--contributions">
              <article className={`section-card commons-shelves commons-public-section commons-public-card-glass commons-public-section-card commons-public-contributions-card${hasPublicContributions ? "" : " commons-public-section--empty commons-public-section-card--empty"}`}>
                <p className="eyebrow commons-public-section-card__eyebrow">Public Commune contributions</p>
                <h2>Published posts and comments</h2>
                {publicCommunePosts.length || publicCommuneComments.length ? (
                  <div className="commons-shelf-grid commons-public-card-grid commons-public-contribution-grid">
                    {publicCommunePosts.map((post) => <article className="commons-preview-card commons-public-card-glass commons-public-contribution-card" key={post.id}><p className="commons-public-contribution-card__type">Published post</p><h3>{post.title}</h3><p>{post.excerpt || post.post_type || "Published Commune post"}</p><a className="button-link" href={`/commune/posts/${post.id}`}>Read post</a></article>)}
                    {publicCommuneComments.map((comment) => <article className="commons-preview-card commons-public-card-glass commons-public-contribution-card" key={comment.id}><p className="commons-public-contribution-card__type">{comment.parent_comment_id ? "Published reply" : "Published comment"}</p><h3>{comment.parent_comment_id ? "Published reply" : "Published comment"}</h3><p>{previewText(comment.body)}</p><a className="button-link" href={`/commune/posts/${comment.post_id}`}>Open thread</a></article>)}
                  </div>
                ) : <p>No public Commune contributions are visible yet.</p>}
              </article>
            </section>
          )}
        </CommonsProfileLayoutFrame>
        <div className="commons-public-atmosphere-reveal commons-public-atmosphere-reveal--slim" aria-hidden="true" />
      </CommonsBackgroundAtmosphere>
    </div>
  );
}
