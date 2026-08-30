import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import { COMMONS_BACKGROUND_STYLES, getCommonsBackgroundStyleOption, normalizeCommonsBackgroundStyle } from "../../shared/commonsBackgroundStyles";
import { COMMONS_DECORATIVE_MARKER_SET_OPTIONS, normalizeCommonsDecorativeMarkerSet, resolveCommonsDecorativeMarkers } from "../../shared/commonsDecorativeMarkers";
import { COMMONS_PROFILE_LAYOUTS, getCommonsProfileLayoutOption, normalizeCommonsProfileLayout } from "../../shared/commonsProfileLayouts";
import { COMMONS_THEME_MODES, getCommonsThemeModeOption, normalizeCommonsThemeMode } from "../../shared/commonsThemeModes";
import { commonsCustomizationStyle, customizationClass } from "../../shared/commonsCustomizationStyles";
import RequireMember from "../../shared/auth/RequireMember";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import CommonsBackgroundAtmosphere from "../../shared/components/CommonsBackgroundAtmosphere";
import CommonsProfileLayoutFrame from "../../shared/components/CommonsProfileLayoutFrame";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import {
  COMMONS_BANNER_POSITION_MAX,
  COMMONS_BANNER_POSITION_MIN,
  COMMONS_BANNER_ZOOM_MAX,
  COMMONS_BANNER_ZOOM_MIN,
  DEFAULT_COMMONS_BANNER_POSITION_X,
  DEFAULT_COMMONS_BANNER_POSITION_Y,
  DEFAULT_COMMONS_BANNER_ZOOM,
  defaultCustomization,
  loadCommonsHomebase,
  normalizeCommonsBannerPosition,
  normalizeCommonsBannerZoom,
  readLocalStorage,
  removeProfileMedia,
  saveCustomization,
  uploadProfileMedia,
  writeLocalStorage,
  type ProfileCustomization,
  type ProfileWithSetup,
} from "./commonsCircleApi";

function signature(settings: ProfileCustomization) {
  return JSON.stringify({
    ...settings,
    theme_mode: normalizeCommonsThemeMode(settings.theme_mode),
    background_style: normalizeCommonsBackgroundStyle(settings.background_style),
    decal_set: normalizeCommonsDecorativeMarkerSet(settings.decal_set),
    selected_decals: [],
    profile_layout: normalizeCommonsProfileLayout(settings.profile_layout),
    banner_zoom: normalizeCommonsBannerZoom(settings.banner_zoom),
    banner_position_x: normalizeCommonsBannerPosition(settings.banner_position_x),
    banner_position_y: normalizeCommonsBannerPosition(settings.banner_position_y),
  });
}

function formatZoom(value: number) { return `${Math.round(normalizeCommonsBannerZoom(value) * 100)}%`; }
function formatPosition(value: number) { return `${Math.round(normalizeCommonsBannerPosition(value))}%`; }

export default function ProfileAppearanceSettingsPage() {
  const [profile, setProfile] = useState<ProfileWithSetup | null>(null);
  const [draft, setDraft] = useState<ProfileCustomization>(defaultCustomization);
  const [saved, setSaved] = useState<ProfileCustomization>(defaultCustomization);
  const [signedIn, setSignedIn] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [mediaStatus, setMediaStatus] = useState("");
  const localPreviews = useRef<Record<"avatar" | "banner", string | null>>({ avatar: null, banner: null });
  const pushMessage = useCallback((message: string) => {
    if (message.trim()) setMessages((current) => [message, ...current].slice(0, 6));
  }, []);

  const refresh = useCallback(async (preserve?: ProfileCustomization) => {
    const result = await loadCommonsHomebase();
    const local = readLocalStorage<ProfileCustomization | null>("commonsCircle.customizationDemo.v1", null);
    const unavailable = result.warnings.some((warning) => /Profile customization|profile_customization/i.test(warning));
    setProfile(result.profile);
    setSignedIn(result.signedIn);
    setSaved(result.customization);
    setDraft(preserve ?? (unavailable && local ? { ...result.customization, ...local } : result.customization));
    result.warnings.filter((warning) => /custom|media|profile/i.test(warning)).forEach(pushMessage);
  }, [pushMessage]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => {
    Object.values(localPreviews.current).forEach((url) => { if (url) URL.revokeObjectURL(url); });
  }, []);

  function patchDraft(patch: Partial<ProfileCustomization>) {
    setDraft((current) => ({
      ...current,
      ...patch,
      ...(patch.theme_mode === undefined ? {} : { theme_mode: normalizeCommonsThemeMode(patch.theme_mode) }),
      ...(patch.background_style === undefined ? {} : { background_style: normalizeCommonsBackgroundStyle(patch.background_style) }),
      ...(patch.decal_set === undefined ? {} : { decal_set: normalizeCommonsDecorativeMarkerSet(patch.decal_set), selected_decals: [] }),
      ...(patch.profile_layout === undefined ? {} : { profile_layout: normalizeCommonsProfileLayout(patch.profile_layout) }),
      ...(patch.banner_zoom === undefined ? {} : { banner_zoom: normalizeCommonsBannerZoom(patch.banner_zoom) }),
      ...(patch.banner_position_x === undefined ? {} : { banner_position_x: normalizeCommonsBannerPosition(patch.banner_position_x) }),
      ...(patch.banner_position_y === undefined ? {} : { banner_position_y: normalizeCommonsBannerPosition(patch.banner_position_y) }),
    }));
  }

  function revokePreview(kind: "avatar" | "banner") {
    const url = localPreviews.current[kind];
    if (url) URL.revokeObjectURL(url);
    localPreviews.current[kind] = null;
  }

  async function handleMedia(file: File | null, kind: "avatar" | "banner") {
    if (!file) return;
    const label = kind === "avatar" ? "Avatar" : "Banner";
    const urlKey = kind === "avatar" ? "avatar_url" : "banner_url";
    const idKey = kind === "avatar" ? "avatar_media_id" : "banner_media_id";
    revokePreview(kind);
    const localUrl = URL.createObjectURL(file);
    localPreviews.current[kind] = localUrl;
    patchDraft({ [urlKey]: localUrl, [idKey]: null });
    setMediaStatus(`${label} selected. Uploading ${kind}…`);
    const result = await uploadProfileMedia(file, kind);
    result.warnings.forEach(pushMessage);
    if (result.publicUrl && result.mediaId) {
      revokePreview(kind);
      const next = { ...draft, [urlKey]: result.publicUrl, [idKey]: result.mediaId };
      setDraft(next);
      setSaved((current) => ({ ...current, [urlKey]: result.publicUrl, [idKey]: result.mediaId }));
      setMediaStatus(`${label} updated in private profile storage. Public views receive only the governed transformed image.`);
      await refresh(next);
    } else {
      setMediaStatus(`${label} did not finish uploading. The selected image remains a browser-only preview.`);
    }
  }

  async function removeMedia(kind: "avatar" | "banner") {
    const label = kind === "avatar" ? "Avatar" : "Banner";
    const urlKey = kind === "avatar" ? "avatar_url" : "banner_url";
    const idKey = kind === "avatar" ? "avatar_media_id" : "banner_media_id";
    setMediaStatus(`Removing ${kind}…`);
    const warnings = await removeProfileMedia(kind);
    warnings.forEach(pushMessage);
    if (!warnings.length) {
      revokePreview(kind);
      const next = { ...draft, [urlKey]: null, [idKey]: null };
      setDraft(next);
      setSaved((current) => ({ ...current, [urlKey]: null, [idKey]: null }));
      setMediaStatus(`${label} removed. The safe fallback remains available.`);
      await refresh(next);
    } else setMediaStatus(`${label} could not be removed. No account-backed media record was changed.`);
  }

  async function save() {
    const normalized: ProfileCustomization = {
      ...draft,
      theme_mode: normalizeCommonsThemeMode(draft.theme_mode),
      background_style: normalizeCommonsBackgroundStyle(draft.background_style),
      decal_set: normalizeCommonsDecorativeMarkerSet(draft.decal_set),
      selected_decals: [],
      profile_layout: normalizeCommonsProfileLayout(draft.profile_layout),
      banner_zoom: normalizeCommonsBannerZoom(draft.banner_zoom),
      banner_position_x: normalizeCommonsBannerPosition(draft.banner_position_x),
      banner_position_y: normalizeCommonsBannerPosition(draft.banner_position_y),
    };
    if (!signedIn) {
      writeLocalStorage("commonsCircle.customizationDemo.v1", normalized);
      setSaved(normalized);
      pushMessage("Customization saved locally. Sign in to publish these choices.");
      return;
    }
    const warnings = await saveCustomization(normalized);
    warnings.forEach(pushMessage);
    if (warnings.length) {
      writeLocalStorage("commonsCircle.customizationDemo.v1", normalized);
      setDraft(normalized);
      return;
    }
    setSaved(normalized);
    setDraft(normalized);
    pushMessage("Customization saved. Your public profile uses these style choices.");
    await refresh(normalized);
  }

  const changed = signature(draft) !== signature(saved);
  const previewStyle = commonsCustomizationStyle(draft);
  const layout = normalizeCommonsProfileLayout(draft.profile_layout);
  const classic = layout === "classic_homebase";
  const decals = resolveCommonsDecorativeMarkers(draft);

  return <div className="page-stack commons-circle-page">
    <PageMetadata title="Profile & Appearance | Elysia Ecobotics Online" description="Customize the current Commons Profile appearance." canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/commons-circle/settings/appearance`} />
    <PageHero eyebrow="Account & Profile Settings" title="Profile & Appearance" brandMark="standard"><p>The existing Customization Studio now lives here. Every theme, accent, background, decorative marker, layout, avatar, banner, framing, preview, save, and removal control is preserved.</p></PageHero>
    <RequireMember label="Profile & Appearance settings belong to the signed-in Website Account.">
      <div className="page-stack">
        {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <p className="message" key={`${message}-${index}`}>{message}</p>)}</section>}
        <section className="section-card commons-studio">
          <p className="eyebrow">Customization Studio</p><h2>Shape your public profile room</h2>
          <p>Avatar and banner media update when selected. Other choices preview here and publish only when you press Save customization. Do not upload receipts, resumes, credentials, private screenshots, or local Elysia material.</p>
          <p className={changed ? "boundary-note commons-unsaved-preview" : "commons-empty-state"}>{changed ? "Unsaved preview. Save to publish these style choices." : "Saved customization is live. New changes preview here first."}</p>
          <div className="commons-studio-grid">
            <div className="commons-studio-controls">
              <label><span>Theme mode</span><select value={normalizeCommonsThemeMode(draft.theme_mode)} onChange={(event) => patchDraft({ theme_mode: normalizeCommonsThemeMode(event.target.value) })}>{COMMONS_THEME_MODES.map((theme) => <option key={theme.key} value={theme.key}>{theme.label}</option>)}</select></label>
              <label><span>Accent color</span><input type="color" value={draft.accent_color} onChange={(event) => patchDraft({ accent_color: event.target.value })} /></label>
              <label><span>Background style</span><select value={normalizeCommonsBackgroundStyle(draft.background_style)} onChange={(event) => patchDraft({ background_style: event.target.value })}>{COMMONS_BACKGROUND_STYLES.map((style) => <option key={style.key} value={style.key}>{style.label}</option>)}</select></label>
              <label><span>Decorative marker set</span><select value={normalizeCommonsDecorativeMarkerSet(draft.decal_set)} onChange={(event) => patchDraft({ decal_set: normalizeCommonsDecorativeMarkerSet(event.target.value) })}>{COMMONS_DECORATIVE_MARKER_SET_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
              <label><span>Profile layout</span><select value={layout} onChange={(event) => patchDraft({ profile_layout: normalizeCommonsProfileLayout(event.target.value) })}>{COMMONS_PROFILE_LAYOUTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
            </div>
            <div className="commons-media-upload-row">
              <label><span>Avatar upload</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleMedia(event.target.files?.[0] ?? null, "avatar"); event.currentTarget.value = ""; }} /></label>
              <label><span>Banner upload</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleMedia(event.target.files?.[0] ?? null, "banner"); event.currentTarget.value = ""; }} /></label>
              <button type="button" onClick={() => void removeMedia("avatar")} disabled={!saved.avatar_url && !draft.avatar_url}>Remove profile picture</button>
              <button type="button" onClick={() => void removeMedia("banner")} disabled={!saved.banner_url && !draft.banner_url}>Remove banner</button>
            </div>
            {mediaStatus && <p className="commons-media-status" aria-live="polite">{mediaStatus}</p>}
            <fieldset className="commons-banner-framing-controls"><legend>Banner framing</legend>
              <label className="commons-banner-framing-row"><span>Banner zoom</span><input type="range" min={COMMONS_BANNER_ZOOM_MIN} max={COMMONS_BANNER_ZOOM_MAX} step="0.01" value={normalizeCommonsBannerZoom(draft.banner_zoom)} onChange={(event) => patchDraft({ banner_zoom: Number(event.target.value) })} /><strong className="commons-banner-framing-value">{formatZoom(draft.banner_zoom)}</strong></label>
              <label className="commons-banner-framing-row"><span>Horizontal position</span><input type="range" min={COMMONS_BANNER_POSITION_MIN} max={COMMONS_BANNER_POSITION_MAX} step="1" value={normalizeCommonsBannerPosition(draft.banner_position_x)} onChange={(event) => patchDraft({ banner_position_x: Number(event.target.value) })} /><strong className="commons-banner-framing-value">{formatPosition(draft.banner_position_x)}</strong></label>
              <label className="commons-banner-framing-row"><span>Vertical position</span><input type="range" min={COMMONS_BANNER_POSITION_MIN} max={COMMONS_BANNER_POSITION_MAX} step="1" value={normalizeCommonsBannerPosition(draft.banner_position_y)} onChange={(event) => patchDraft({ banner_position_y: Number(event.target.value) })} /><strong className="commons-banner-framing-value">{formatPosition(draft.banner_position_y)}</strong></label>
              <button type="button" className="commons-banner-framing-reset" onClick={() => patchDraft({ banner_zoom: DEFAULT_COMMONS_BANNER_ZOOM, banner_position_x: DEFAULT_COMMONS_BANNER_POSITION_X, banner_position_y: DEFAULT_COMMONS_BANNER_POSITION_Y })}>Reset banner framing</button>
            </fieldset>
          </div>
          <CommonsBackgroundAtmosphere backgroundStyle={draft.background_style} accentColor={draft.accent_color} variant="preview" className={`commons-customization-preview commons-homebase ${customizationClass(draft)}`} style={previewStyle}>
            <CommonsProfileLayoutFrame profileLayout={draft.profile_layout} variant="preview" className="commons-profile-preview-layout-frame">
              <section className="commons-profile-slot commons-profile-slot--summary"><div className={`commons-profile-summary-card commons-profile-summary-card--preview commons-profile-mantle commons-circle-customization-preview-mantle commons-profile-masthead commons-profile-masthead__banner${classic ? " commons-profile-masthead--classic-homebase" : ""}${draft.banner_url ? " has-public-banner" : ""}`} style={previewStyle}>{draft.banner_url && <img className="commons-public-banner commons-profile-banner-layer commons-profile-masthead__banner-image commons-circle-customization-preview-banner-image" src={draft.banner_url} alt="" aria-hidden="true" loading="lazy" />}<div className="commons-profile-masthead__banner-scrim" aria-hidden="true" /><div className="commons-profile-summary-card__avatar commons-profile-masthead__avatar"><CommonsAvatarViewer className={classic ? "commons-avatar--masthead" : ""} src={draft.avatar_url} alt="Draft Commons profile avatar preview" fallback={(profile?.display_name || profile?.username || "C").slice(0, 1).toUpperCase()} viewLabel="View full draft Commons profile picture" imageClassName="commons-profile-masthead__avatar-image" /></div><div className="commons-profile-summary-card__body commons-profile-masthead__identity commons-profile-masthead__body"><p className="commons-profile-summary-card__handle commons-profile-masthead__handle">@{profile?.username || "draft-profile"}</p><h3 className="commons-profile-summary-card__name commons-profile-masthead__name">{profile?.display_name || profile?.username || "Website member"}</h3><p>{getCommonsProfileLayoutOption(draft.profile_layout).previewNote}</p><div className="commons-customization-badges commons-profile-summary-card__chips commons-profile-masthead__chips"><span>{getCommonsThemeModeOption(draft.theme_mode).label}</span><span>{getCommonsBackgroundStyleOption(draft.background_style).label}</span><span>{getCommonsProfileLayoutOption(draft.profile_layout).label}</span></div></div></div></section>
              <section className="commons-profile-slot commons-profile-slot--identity"><article className="commons-public-section-card"><p className="commons-public-section-card__eyebrow">Identity</p><h4>Public identity</h4><p>Bio, interests, and links stay gated by Privacy Lanterns.</p></article></section>
              <section className="commons-profile-slot commons-profile-slot--recognition"><article className="commons-public-section-card"><p className="commons-public-section-card__eyebrow">Recognition</p><h4>Recognition, not authority</h4><p>Badges and medallions remain public recognition only.</p></article></section>
              <section className="commons-profile-slot commons-profile-slot--collections"><article className="commons-public-section-card"><p className="commons-public-section-card__eyebrow">Collections</p><p>Saved public collections arrange differently by layout.</p></article></section>
            </CommonsProfileLayoutFrame>
            {decals.length > 0 && <div className="commons-decal-strip" aria-label="Selected profile decals">{decals.map((decal) => <span className="commons-decal-chip" key={decal.key}>{decal.label}</span>)}</div>}
            <p className="commons-empty-state">This preview remains local until Save customization publishes the style choices.</p>
          </CommonsBackgroundAtmosphere>
          <p className="commons-empty-state">Decorative markers are public visual labels, not badges, rank, authority, or role claims.</p>
          <div className="button-row"><button className="button-primary" type="button" onClick={() => void save()} disabled={!changed}>Save customization</button>{changed && <button type="button" onClick={() => { setDraft(saved); pushMessage("Customization preview reverted to the saved public profile style."); }}>Revert preview</button>}<Link className="button-link" to="/commons-circle/settings">Account &amp; Profile Settings</Link></div>
        </section>
      </div>
    </RequireMember>
  </div>;
}
