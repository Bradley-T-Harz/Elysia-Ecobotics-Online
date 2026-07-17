import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AuthPanel from "../The-Elysia-Marketplace/components/AuthPanel";
import CommonsAvatarViewer from "../../shared/components/CommonsAvatarViewer";
import { loadCurrentProfile } from "../The-Elysia-Marketplace/lib/marketplaceApi";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { createReviewItem } from "../../shared/review/reviewClient";
import type { MarketplaceProfile, MarketplaceProfileDraft } from "../The-Elysia-Marketplace/types";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { commonsStewardshipOrganizations, type CommonsStewardshipOrganization } from "./commonsStewardshipOrganizations";
import { loadCommonsHomebase, removeProfileMedia, uploadProfileMedia } from "./commonsCircleApi";

type SetupStep = "profile" | "stewardship" | "work-with" | "confirm";
type SetupStatus = "draft_local" | "pending_admin_review_local" | "pending_review";

type ProfileWithSetup = MarketplaceProfile & {
  commons_onboarding_completed_at?: string | null;
  stewardship_onboarding_skipped_at?: string | null;
  work_with_onboarding_skipped_at?: string | null;
};

type StewardshipDraft = {
  organizationId: string;
  organizationName: string;
  organizationUrl: string;
  supportNote: string;
  amountRange: string;
  donationDate: string;
  redactionConfirmed: boolean;
  skipped: boolean;
  status: "draft_local" | "skipped";
};

type WorkWithDraft = {
  requestType: string;
  availability: string;
  areasOfInterest: string[];
  message: string;
  skills: string;
  github: string;
  gitlabCodeberg: string;
  portfolio: string;
  linkedin: string;
  understandsVolunteer: boolean;
  understandsPublicPrivacy: boolean;
  understandsReview: boolean;
  skipped: boolean;
  prepared: boolean;
};

const setupSteps: SetupStep[] = ["profile", "stewardship", "work-with", "confirm"];
const sessionKeys = {
  profileDraft: "commonsCircle.profileSetupDraft.v1",
  stewardshipDraft: "commonsCircle.setupStewardshipDraft.v1",
  workWithDraft: "commonsCircle.setupWorkWithDraft.v1"
} as const;
const localStorageKeys = {
  onboarding: "commonsCircle.onboarding.v1",
  stewardshipDrafts: "commonsCircle.stewardshipVerificationDrafts.v1",
  contributionRequests: "commonsCircle.contributionInterestRequests.v1"
} as const;

const requestTypes = [
  "Volunteer", "Contributor", "Collaborator", "Future paid role interest", "Research help", "Documentation help", "Developer / add-on help", "Living Library curation", "Marketplace review interest", "Security review interest", "UI/UX/design help", "Ecological data / GIS / remote sensing help", "Product testing", "Community/moderation help", "Other"
];
const areaOptions = [
  "Elysia core architecture", "Website/public commons", "Developer Forge", "Marketplace/add-ons", "Living Library", "Commune/community", "Documentation/tutorials", "Security/trust/review", "Environmental/ecological systems", "Products/hardware ideas", "Accessibility/testing"
];
const amountRanges = ["Under $10", "$10-$24", "$25-$49", "$50-$99", "$100-$249", "$250+", "Prefer not to say"];
const resumeBucketName = "work-with-attachments";
const receiptBucketName = "stewardship-receipts";

const setupMissingTablePattern = /Could not find the table 'public\.([^']+)' in the schema cache|relation "public\.([^"]+)" does not exist/i;

function setupBackendMessage(label: string, message: string) {
  if (import.meta.env.DEV) console.warn(`[Commons Circle setup] ${label}: ${message}`);
  if (setupMissingTablePattern.test(message)) return `${label}: account-backed setup storage is not configured yet.`;
  if (/permission denied|row-level security|violates row-level security/i.test(message)) return `${label}: account storage is not available for this step yet.`;
  return `${label}: account-backed setup is temporarily unavailable.`;
}
const maxResumeSizeBytes = 10 * 1024 * 1024;
const acceptedResumeExtensions = new Set(["pdf", "doc", "docx", "odt", "txt", "md"]);
const acceptedResumeMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream"
]);
const acceptedReceiptExtensions = new Set(["pdf", "png", "jpg", "jpeg", "txt", "md"]);
const acceptedReceiptMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain", "text/markdown", "text/x-markdown", "application/octet-stream"]);

const initialProfileDraft: MarketplaceProfileDraft = {
  username: "",
  display_name: "",
  headline: "",
  bio: "",
  interests: "",
  website_url: "",
  github_url: "",
  organization: "",
  featured_public_links: [],
  is_developer: false
};
const initialStewardshipDraft: StewardshipDraft = {
  organizationId: "",
  organizationName: "",
  organizationUrl: "",
  supportNote: "",
  amountRange: "Prefer not to say",
  donationDate: "",
  redactionConfirmed: false,
  skipped: false,
  status: "draft_local"
};
const initialWorkWithDraft: WorkWithDraft = {
  requestType: requestTypes[0],
  availability: "not sure yet",
  areasOfInterest: [],
  message: "",
  skills: "",
  github: "",
  gitlabCodeberg: "",
  portfolio: "",
  linkedin: "",
  understandsVolunteer: false,
  understandsPublicPrivacy: false,
  understandsReview: false,
  skipped: false,
  prepared: false
};

function readSession<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeSession<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function groupOrganizations() {
  return commonsStewardshipOrganizations.reduce<Record<string, CommonsStewardshipOrganization[]>>((groups, org) => {
    groups[org.category] = [...(groups[org.category] ?? []), org];
    return groups;
  }, {});
}

function extensionForFile(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function validateResumeFile(file: File | null): string | null {
  if (!file) return null;
  const extension = extensionForFile(file);
  if (!acceptedResumeExtensions.has(extension)) return "Resume/CV must be a PDF, DOC, DOCX, ODT, TXT, or Markdown file.";
  if (file.size > maxResumeSizeBytes) return "Resume/CV must be 10 MB or smaller.";
  if (file.type && !acceptedResumeMimeTypes.has(file.type)) return `Resume/CV MIME type is not accepted: ${file.type}`;
  return null;
}

function validateReceiptFile(file: File | null): string | null {
  if (!file) return null;
  const extension = extensionForFile(file);
  if (!acceptedReceiptExtensions.has(extension)) return "Receipt/proof must be a PDF, PNG, JPG, TXT, or Markdown file.";
  if (file.size > maxResumeSizeBytes) return "Receipt/proof must be 10 MB or smaller.";
  if (file.type && !acceptedReceiptMimeTypes.has(file.type)) return `Receipt/proof MIME type is not accepted: ${file.type}`;
  return null;
}

function sanitizeFilename(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(0, 120) || "resume-cv";
}

async function sha256File(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notifyCommonsCircle() {
  if (typeof window === "undefined") return;
  const payload = { type: "commons-circle-onboarding-complete", completedAt: new Date().toISOString() };
  try {
    const channel = new BroadcastChannel("commons-circle-onboarding");
    channel.postMessage(payload);
    channel.close();
  } catch {
    window.localStorage.setItem(localStorageKeys.onboarding, JSON.stringify({ completed: true, welcomed: true, membershipTier: "Free Member", completedAt: payload.completedAt }));
  }
}

function profileFromExisting(profile: ProfileWithSetup | null): MarketplaceProfileDraft {
  if (!profile) return readSession(sessionKeys.profileDraft, initialProfileDraft);
  return {
    username: profile.username ?? "",
    display_name: profile.display_name ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    interests: profile.interests ?? "",
    website_url: profile.website_url ?? "",
    github_url: profile.github_url ?? "",
    organization: profile.organization ?? "",
    featured_public_links: profile.featured_public_links ?? [],
    is_developer: Boolean(profile.is_developer)
  };
}

function formatFeaturedLinks(links: MarketplaceProfileDraft["featured_public_links"]) {
  return (links ?? []).map((link) => `${link.label} | ${link.url}${link.kind ? ` | ${link.kind}` : ""}`).join("\n");
}

function parseFeaturedLinks(value: string): MarketplaceProfileDraft["featured_public_links"] {
  return value.split("\n").slice(0, 8).flatMap((line) => {
    const [labelPart, urlPart, kindPart] = line.split("|").map((part) => part.trim());
    if (!labelPart || !urlPart || !/^https?:\/\/[^\s<>"']+$/i.test(urlPart)) return [];
    return [{ label: labelPart.slice(0, 80), url: urlPart, kind: kindPart ? kindPart.slice(0, 32) : undefined }];
  });
}

export default function CommonsCircleSetupPage() {
  const { step = "profile" } = useParams<{ step: SetupStep }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithSetup | null>(null);
  const [profileDraft, setProfileDraft] = useState<MarketplaceProfileDraft>(() => readSession(sessionKeys.profileDraft, initialProfileDraft));
  const [stewardshipDraft, setStewardshipDraft] = useState<StewardshipDraft>(() => readSession(sessionKeys.stewardshipDraft, initialStewardshipDraft));
  const [workWithDraft, setWorkWithDraft] = useState<WorkWithDraft>(() => readSession(sessionKeys.workWithDraft, initialWorkWithDraft));
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const groupedOrganizations = useMemo(groupOrganizations, []);
  const stepIndex = Math.max(0, setupSteps.indexOf(step as SetupStep));

  const pushMessage = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessages((current) => current.includes(trimmed) ? current : [trimmed, ...current].slice(0, 6));
  }, []);

  function logSetupDiagnostics(scope: string, warnings: string[]) {
    if (import.meta.env.DEV && warnings.length) console.warn(`[Commons Circle setup ${scope}]`, warnings);
  }

  const refreshProfile = useCallback(async () => {
    const result = await loadCurrentProfile();
    result.warnings.forEach(pushMessage);
    const loaded = result.data as ProfileWithSetup | null;
    setProfile(loaded);
    setAvatarUrl(loaded?.avatar_url ?? null);
    if (loaded) {
      const nextDraft = profileFromExisting(loaded);
      setProfileDraft(nextDraft);
      writeSession(sessionKeys.profileDraft, nextDraft);
    }
    const homebaseResult = await loadCommonsHomebase();
    logSetupDiagnostics("homebase", homebaseResult.warnings);
    if (homebaseResult.customization.avatar_url) {
      setAvatarUrl(homebaseResult.customization.avatar_url);
    }
  }, [pushMessage]);

  useEffect(() => { void refreshProfile(); }, [refreshProfile]);

  if (!setupSteps.includes(step as SetupStep)) return <Navigate to="/commons-circle/setup/profile" replace />;

  function go(next: SetupStep) {
    navigate(`/commons-circle/setup/${next}`);
  }

  function updateProfileDraft(next: MarketplaceProfileDraft) {
    setProfileDraft(next);
    writeSession(sessionKeys.profileDraft, next);
  }

  function updateStewardshipDraft(next: StewardshipDraft) {
    setStewardshipDraft(next);
    writeSession(sessionKeys.stewardshipDraft, next);
  }

  function updateWorkWithDraft(next: WorkWithDraft) {
    setWorkWithDraft(next);
    writeSession(sessionKeys.workWithDraft, next);
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await uploadProfileMedia(file, "avatar");
      result.warnings.forEach(pushMessage);
      if (result.publicUrl) {
        setAvatarUrl(result.publicUrl);
        pushMessage("Public profile picture uploaded. This image is public and separate from any private local Elysia identity photo.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setBusy(true);
    try {
      const warnings = await removeProfileMedia("avatar");
      warnings.forEach(pushMessage);
      if (!warnings.length) {
        setAvatarUrl(null);
        pushMessage("Public profile picture removed. The public profile will use initials fallback.");
      }
    } finally {
      setBusy(false);
    }
  }

  function continueFromProfile() {
    if (!profileDraft.username.trim()) {
      pushMessage("Choose a Commons username before continuing.");
      return;
    }
    writeSession(sessionKeys.profileDraft, profileDraft);
    go("stewardship");
  }

  function chooseOrganization(org: CommonsStewardshipOrganization) {
    updateStewardshipDraft({ ...stewardshipDraft, organizationId: org.id, organizationName: org.name, organizationUrl: org.officialUrl, skipped: false, status: "draft_local" });
  }

  function skipStewardship() {
    updateStewardshipDraft({ ...initialStewardshipDraft, skipped: true, status: "skipped" });
    pushMessage("Stewardship support skipped for now. You can return later from Commons Circle.");
    go("work-with");
  }

  function prepareStewardship() {
    if (!stewardshipDraft.organizationId) {
      pushMessage("Choose an organization or skip stewardship for now.");
      return;
    }
    updateStewardshipDraft({ ...stewardshipDraft, skipped: false, status: "draft_local" });
    pushMessage("Stewardship recognition draft prepared locally for the setup summary. Receipt upload is not enabled yet.");
    go("work-with");
  }

  function toggleArea(area: string) {
    updateWorkWithDraft({ ...workWithDraft, areasOfInterest: workWithDraft.areasOfInterest.includes(area) ? workWithDraft.areasOfInterest.filter((item) => item !== area) : [...workWithDraft.areasOfInterest, area] });
  }

  function skipWorkWith() {
    updateWorkWithDraft({ ...initialWorkWithDraft, skipped: true });
    pushMessage("Work With request skipped for now. You can use the Work With page later.");
    go("confirm");
  }

  function prepareWorkWith() {
    const validation = validateResumeFile(resumeFile);
    if (validation) {
      pushMessage(validation);
      return;
    }
    updateWorkWithDraft({ ...workWithDraft, prepared: true, skipped: false });
    pushMessage("Work With request prepared for final confirmation.");
    go("confirm");
  }

  async function persistWorkWithRequest(userId: string): Promise<string | null> {
    if (!workWithDraft.prepared || workWithDraft.skipped) return null;
    if (!hasSupabaseConfig || !supabase) {
      const localDraft = { id: `pending_admin_review_local-${Date.now()}`, ...workWithDraft, status: "pending_admin_review_local" as SetupStatus, createdAt: new Date().toISOString() };
      writeStorage(localStorageKeys.contributionRequests, [localDraft, ...readStorage<unknown[]>(localStorageKeys.contributionRequests, [])]);
      return `${supabaseNotConfiguredMessage} Work With request saved locally as a pending-review draft.`;
    }
    const validation = validateResumeFile(resumeFile);
    if (validation) throw new Error(validation);

    const requestId = newRequestId();
    const { error: requestError } = await supabase.from("work_with_requests").insert({
      id: requestId,
      user_id: userId,
      name: profileDraft.display_name.trim() || profileDraft.username.trim() || null,
      preferred_contact: null,
      commons_username: profileDraft.username.trim() || null,
      request_type: workWithDraft.requestType,
      availability: workWithDraft.availability,
      areas_of_interest: workWithDraft.areasOfInterest,
      message: workWithDraft.message.trim() || null,
      skills_experience: workWithDraft.skills.trim() || null,
      github_url: workWithDraft.github.trim() || null,
      gitlab_codeberg_url: workWithDraft.gitlabCodeberg.trim() || null,
      portfolio_url: workWithDraft.portfolio.trim() || null,
      linkedin_url: workWithDraft.linkedin.trim() || null,
      source_context: "commons_profile_onboarding",
      acknowledgements: {
        volunteer_understanding: workWithDraft.understandsVolunteer,
        public_privacy_boundary: workWithDraft.understandsPublicPrivacy,
        administrator_review_required: workWithDraft.understandsReview,
        resume_cv_private_admin_review: Boolean(resumeFile),
        created_during_commons_setup: true
      },
      status: "pending_review"
    });
    if (requestError) throw new Error(setupBackendMessage("Work With request", requestError.message));

    const reviewResult = await createReviewItem({
      domain: "work_with",
      sourceTable: "work_with_requests",
      sourceId: requestId,
      submittedBy: userId,
      title: `${workWithDraft.requestType} request from ${profileDraft.username.trim() || "Commons setup"}`,
      summary: workWithDraft.message.trim().slice(0, 280)
    });
    if (!reviewResult.ok) throw new Error(setupBackendMessage("Work With review routing", reviewResult.warning ?? "review routing failed"));

    if (resumeFile) {
      const safeName = sanitizeFilename(resumeFile.name);
      const storagePath = `${userId}/${requestId}/${Date.now()}-${safeName}`;
      const uploadResult = await supabase.storage.from(resumeBucketName).upload(storagePath, resumeFile, {
        cacheControl: "3600",
        contentType: resumeFile.type || undefined,
        upsert: false
      });
      if (uploadResult.error) throw new Error(setupBackendMessage("Private resume/CV upload", uploadResult.error.message));

      const { error: fileError } = await supabase.from("work_with_request_files").insert({
        request_id: requestId,
        user_id: userId,
        bucket: resumeBucketName,
        storage_path: storagePath,
        original_filename: resumeFile.name,
        mime_type: resumeFile.type || null,
        size_bytes: resumeFile.size,
        file_role: "resume_cv"
      });
      if (fileError) throw new Error(setupBackendMessage("Private resume/CV metadata", fileError.message));
    }
    return "Work With request saved for administrator review.";
  }

  async function persistStewardshipRequest(userId: string): Promise<string | null> {
    if (stewardshipDraft.skipped || !stewardshipDraft.organizationId) return null;
    if (!hasSupabaseConfig || !supabase) {
      const localDraft = {
        id: `draft_local-${Date.now()}`,
        organizationId: stewardshipDraft.organizationId,
        organizationName: stewardshipDraft.organizationName,
        organizationUrl: stewardshipDraft.organizationUrl,
        donationDate: stewardshipDraft.donationDate,
        amountRange: stewardshipDraft.amountRange,
        memberNote: stewardshipDraft.supportNote,
        redactionConfirmed: stewardshipDraft.redactionConfirmed,
        status: "draft_local",
        createdAt: new Date().toISOString(),
        note: "Created during Commons Profile setup. Supabase is not configured."
      };
      writeStorage(localStorageKeys.stewardshipDrafts, [localDraft, ...readStorage<unknown[]>(localStorageKeys.stewardshipDrafts, [])]);
      return `${supabaseNotConfiguredMessage} Stewardship recognition saved locally as a draft.`;
    }
    const validation = validateReceiptFile(receiptFile);
    if (validation) throw new Error(validation);
    if (receiptFile && !stewardshipDraft.redactionConfirmed) throw new Error("Confirm receipt/proof redaction before uploading private stewardship proof.");

    const organizationRow = await supabase
      .from("stewardship_organizations")
      .select("id,name,official_url")
      .eq("slug", stewardshipDraft.organizationId)
      .maybeSingle();
    if (organizationRow.error) throw new Error(setupBackendMessage("Stewardship organizations", organizationRow.error.message));
    const organization = organizationRow.data as { id: string; name: string; official_url: string } | null;
    const requestId = newRequestId();
    const { error: requestError } = await supabase.from("stewardship_recognition_requests").insert({
      id: requestId,
      user_id: userId,
      organization_id: organization?.id ?? null,
      organization_name: organization?.name ?? stewardshipDraft.organizationName,
      organization_url: organization?.official_url ?? stewardshipDraft.organizationUrl,
      support_note: stewardshipDraft.supportNote.trim() || null,
      amount_range: stewardshipDraft.amountRange,
      donation_date: stewardshipDraft.donationDate || null,
      redaction_confirmed: stewardshipDraft.redactionConfirmed,
      status: "pending_review"
    });
    if (requestError) throw new Error(setupBackendMessage("Stewardship recognition request", requestError.message));

    const reviewResult = await createReviewItem({
      domain: "stewardship",
      sourceTable: "stewardship_recognition_requests",
      sourceId: requestId,
      submittedBy: userId,
      title: `Stewardship recognition: ${organization?.name ?? stewardshipDraft.organizationName}`,
      summary: stewardshipDraft.supportNote.trim().slice(0, 280)
    });
    if (!reviewResult.ok) throw new Error(setupBackendMessage("Stewardship review routing", reviewResult.warning ?? "review routing failed"));

    if (receiptFile) {
      const fileId = newRequestId();
      const safeName = sanitizeFilename(receiptFile.name);
      const storagePath = `${userId}/${requestId}/${fileId}-${safeName}`;
      const uploadResult = await supabase.storage.from(receiptBucketName).upload(storagePath, receiptFile, {
        cacheControl: "3600",
        contentType: receiptFile.type || undefined,
        upsert: false
      });
      if (uploadResult.error) throw new Error(setupBackendMessage("Private stewardship receipt upload", uploadResult.error.message));
      const hash = await sha256File(receiptFile);
      const { error: fileError } = await supabase.from("stewardship_receipt_files").insert({
        id: fileId,
        request_id: requestId,
        user_id: userId,
        bucket: receiptBucketName,
        storage_path: storagePath,
        original_filename: receiptFile.name,
        mime_type: receiptFile.type || null,
        size_bytes: receiptFile.size,
        sha256_hash: hash
      });
      if (fileError) throw new Error(setupBackendMessage("Private stewardship receipt metadata", fileError.message));
      await supabase.from("stewardship_recognition_requests").update({ receipt_file_id: fileId, updated_at: new Date().toISOString() }).eq("id", requestId);
    }
    return receiptFile ? "Stewardship recognition request and private receipt/proof saved for administrator review." : "Stewardship recognition request saved for administrator review.";
  }

  async function finalizeProfile() {
    if (busy) return;
    if (!profileDraft.username.trim()) {
      pushMessage("Username is required before creating the Commons Profile.");
      go("profile");
      return;
    }
    setBusy(true);
    try {
      if (!hasSupabaseConfig || !supabase) {
        writeStorage(localStorageKeys.onboarding, { completed: true, welcomed: true, membershipTier: "Free Member", completedAt: new Date().toISOString(), demoMode: true });
        pushMessage("Demo mode: Commons Profile setup completed locally. Supabase is not configured, so no remote profile was created.");
        notifyCommonsCircle();
        navigate("/commons-circle");
        return;
      }
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        pushMessage("Sign in to a Website Account before creating your Commons Profile.");
        go("profile");
        return;
      }
      const { data: existingProfile, error: existingError } = await supabase
        .from("profiles")
        .select("id,is_admin,is_developer")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (existingError) throw new Error(setupBackendMessage("Commons Profile lookup", existingError.message));

      const now = new Date().toISOString();
      const baseProfileFields = {
        username: profileDraft.username.trim(),
        display_name: profileDraft.display_name.trim(),
        headline: profileDraft.headline?.trim() || null,
        bio: profileDraft.bio.trim(),
        interests: profileDraft.interests?.trim() || null,
        website_url: profileDraft.website_url?.trim() || null,
        github_url: profileDraft.github_url?.trim() || null,
        organization: profileDraft.organization?.trim() || null,
        featured_public_links: profileDraft.featured_public_links ?? [],
        commons_onboarding_completed_at: now,
        stewardship_onboarding_skipped_at: stewardshipDraft.skipped ? now : null,
        work_with_onboarding_skipped_at: workWithDraft.skipped ? now : null
      };

      if (!baseProfileFields.username) throw new Error("Username is required.");

      if (existingProfile) {
        const existingFlags = existingProfile as { is_admin?: boolean | null; is_developer?: boolean | null };
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            ...baseProfileFields,
            is_developer: Boolean(existingFlags.is_developer || profileDraft.is_developer)
          })
          .eq("id", auth.user.id);
        if (updateError) throw new Error(setupBackendMessage("Commons Profile update", updateError.message));
      } else {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: auth.user.id,
          ...baseProfileFields,
          is_developer: Boolean(profileDraft.is_developer),
          is_admin: false
        });
        if (insertError) throw new Error(setupBackendMessage("Commons Profile creation", insertError.message));
      }

      const { error: freeMemberError } = await supabase.rpc("grant_free_member_for_user", { p_target_user_id: auth.user.id });
      if (freeMemberError) pushMessage(setupBackendMessage("Free Member badge", freeMemberError.message));

      const stewardshipMessage = await persistStewardshipRequest(auth.user.id);
      if (stewardshipMessage) pushMessage(stewardshipMessage);
      const workWithMessage = await persistWorkWithRequest(auth.user.id);
      if (workWithMessage) pushMessage(workWithMessage);
      writeStorage(localStorageKeys.onboarding, { completed: true, welcomed: true, membershipTier: "Free Member", completedAt: now });
      notifyCommonsCircle();
      pushMessage("Commons Profile onboarding completed. Free Member recognition is granted from this account-backed completion; optional higher recognition still requires its own administrator review.");
      navigate("/commons-circle");
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Could not finish Commons Profile setup.");
    } finally {
      setBusy(false);
    }
  }

  const progressLabels = [
    ["profile", "1. Commons Profile draft"],
    ["stewardship", "2. Stewardship"],
    ["work-with", "3. Work With"],
    ["confirm", "4. Final confirmation"]
  ] as const;

  return (
    <div className="page-stack commons-circle-page commons-setup-page">
      <PageHero eyebrow="Commons Circle setup" title="Create your Commons Profile">
        <p>Website Account first, Commons Profile draft next, then optional stewardship and Work With steps before the profile is finalized.</p>
        <p>This setup flow does not connect to private local Elysia memory, files, logs, vaults, passwords, or credentials.</p>
      </PageHero>

      {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}

      <section className="section-card commons-setup-progress" aria-label="Commons Profile setup progress">
        {progressLabels.map(([name, label], index) => <button key={name} type="button" className={step === name ? "button-primary" : ""} onClick={() => go(name)}>{label}{index < stepIndex ? " ✓" : ""}</button>)}
      </section>

      {step === "profile" && <section className="two-column commons-account-panels">
        <AuthPanel
          onMessage={pushMessage}
          onAuthChanged={refreshProfile}
          copy={{
            eyebrow: "Website Account",
            title: "Create or Sign In to Website Account",
            description: "This is your public Elysia Ecobotics Online account. It is separate from the private local Elysia core. Do not use your local Elysia password here.",
            signedOutText: "No active website session.",
            confirmationPath: "/commons-circle/setup/profile",
            confirmationCopy: "If email confirmation is enabled, open the confirmation link to return to this setup flow."
          }}
        />
        <section className="section-card commons-setup-form-card">
          <p className="eyebrow">Commons Profile draft</p>
          <h2>{profile ? "Review Commons Profile draft" : "Draft Commons Profile"}</h2>
          <p>Your Commons Profile is the public profile connected to your signed-in Website Account. It is not a second account and not a second login. It will not be created or updated until the final confirmation step.</p>
          <section className="commons-profile-mantle" aria-label="Public profile picture preview">
            <CommonsAvatarViewer src={avatarUrl} alt="Public Commons profile picture" fallback={(profileDraft.display_name || profileDraft.username || "C").slice(0, 1).toUpperCase()} viewLabel="View full public Commons profile picture" />
            <div>
              <p className="eyebrow">Public profile picture</p>
              <p className="boundary-note">This image is public on your Commons Profile. Choose an online profile picture explicitly; this does not import or sync a private local Elysia identity photo.</p>
              <div className="button-row">
                <label className="button-link"><span>Choose profile picture</span><input style={{ display: "none" }} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleAvatarUpload(event.target.files?.[0] ?? null)} /></label>
                <button type="button" onClick={() => void handleAvatarRemove()} disabled={!avatarUrl || busy}>Remove profile picture</button>
              </div>
            </div>
          </section>
          <div className="commons-form-grid">
            <label><span>Username</span><input value={profileDraft.username} placeholder="bradley-harz" onChange={(event) => updateProfileDraft({ ...profileDraft, username: event.target.value })} /></label>
            <label><span>Display name</span><input value={profileDraft.display_name} placeholder="Bradley T. Harz" onChange={(event) => updateProfileDraft({ ...profileDraft, display_name: event.target.value })} /></label>
            <label className="wide-field"><span>Headline, optional</span><input value={profileDraft.headline ?? ""} placeholder="Public Commons profile headline" onChange={(event) => updateProfileDraft({ ...profileDraft, headline: event.target.value })} /></label>
            <label className="wide-field"><span>Bio</span><textarea rows={3} value={profileDraft.bio} placeholder="Short public Commons bio" onChange={(event) => updateProfileDraft({ ...profileDraft, bio: event.target.value })} /></label>
            <label><span>Interests</span><input value={profileDraft.interests ?? ""} onChange={(event) => updateProfileDraft({ ...profileDraft, interests: event.target.value })} /></label>
            <label><span>Website</span><input value={profileDraft.website_url ?? ""} onChange={(event) => updateProfileDraft({ ...profileDraft, website_url: event.target.value })} /></label>
            <label><span>GitHub</span><input value={profileDraft.github_url ?? ""} onChange={(event) => updateProfileDraft({ ...profileDraft, github_url: event.target.value })} /></label>
            <label><span>Organization, optional</span><input value={profileDraft.organization ?? ""} onChange={(event) => updateProfileDraft({ ...profileDraft, organization: event.target.value })} /></label>
            <label className="wide-field"><span>Featured public links, optional</span><textarea rows={3} value={formatFeaturedLinks(profileDraft.featured_public_links)} placeholder={"Label | https://example.com | website"} onChange={(event) => updateProfileDraft({ ...profileDraft, featured_public_links: parseFeaturedLinks(event.target.value) })} /></label>
            <label className="checkbox-line"><input type="checkbox" checked={profileDraft.is_developer} onChange={(event) => updateProfileDraft({ ...profileDraft, is_developer: event.target.checked })} /><span>Request developer profile flag. This is not reviewer, moderator, admin, or authority access.</span></label>
          </div>
          <div className="button-row"><button type="button" className="button-primary" onClick={continueFromProfile}>Continue: Stewardship & Donations</button><a className="button-link" href="/commons-circle">Cancel setup</a></div>
        </section>
      </section>}

      {step === "stewardship" && <section className="section-card commons-setup-panel">
        <p className="eyebrow">Step 2: Stewardship & Donation Options</p>
        <h2>Optional stewardship support</h2>
        <WarningCallout title="Optional and direct"><p>Donations are optional and made directly to independent organizations. Elysia Ecobotics does not process these donations. Stewardship recognition may be requested, but it requires administrator review and does not grant authority, paid status, moderator access, reviewer access, or administrator access.</p></WarningCallout>
        <p className="boundary-note">Receipt/proof uploads are private administrator-review materials stored in the private stewardship-receipts bucket only after final confirmation. Do not upload identity documents, medical records, passwords, API keys, .env files, bank account numbers, full card numbers, or unredacted third-party personal data.</p>
        {Object.entries(groupedOrganizations).map(([category, orgs]) => <section className="commons-org-category" key={category}>
          <div className="section-heading section-heading--inline"><h3>{category}</h3><span className="trust-badge">{orgs.length} organizations</span></div>
          <div className="commons-org-grid">
            {orgs.map((org) => <article className={org.id === stewardshipDraft.organizationId ? "commons-org-card commons-org-card--selected" : "commons-org-card"} key={org.id}>
              <p className="eyebrow">{org.status}</p>
              <h3>{org.name}</h3>
              <p>{org.shortDescription}</p>
              <p><strong>Why listed:</strong> {org.whyListed}</p>
              <p><strong>Caution:</strong> {org.cautionNote}</p>
              <p>This listing is informational and does not imply affiliation, sponsorship, or partnership.</p>
              <div className="button-row"><a className="button-link" href={org.officialUrl} target="_blank" rel="noreferrer">Visit organization site</a><button type="button" onClick={() => chooseOrganization(org)}>{org.id === stewardshipDraft.organizationId ? "Selected" : "Choose for recognition draft"}</button></div>
            </article>)}
          </div>
        </section>)}
        <div className="commons-form-grid">
          <label><span>Amount range, optional</span><select value={stewardshipDraft.amountRange} onChange={(event) => updateStewardshipDraft({ ...stewardshipDraft, amountRange: event.target.value })}>{amountRanges.map((range) => <option key={range}>{range}</option>)}</select></label>
          <label><span>Donation date, optional</span><input type="date" value={stewardshipDraft.donationDate} onChange={(event) => updateStewardshipDraft({ ...stewardshipDraft, donationDate: event.target.value })} /></label>
          <label className="wide-field"><span>Support note, optional</span><textarea rows={3} value={stewardshipDraft.supportNote} onChange={(event) => updateStewardshipDraft({ ...stewardshipDraft, supportNote: event.target.value })} /></label>
          <label className="wide-field"><span>Receipt/proof file, optional</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md,application/pdf,image/png,image/jpeg,text/plain,text/markdown,text/x-markdown" onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            const validation = validateReceiptFile(nextFile);
            if (validation) {
              setReceiptFile(null);
              event.currentTarget.value = "";
              pushMessage(validation);
              return;
            }
            setReceiptFile(nextFile);
          }} /></label>
          <div className="wide-field boundary-note">{receiptFile ? `Selected private receipt/proof: ${receiptFile.name} (${Math.ceil(receiptFile.size / 1024)} KB).` : "No receipt/proof selected. You may request recognition without uploading a file."}</div>
          <label className="checkbox-line wide-field"><input type="checkbox" checked={stewardshipDraft.redactionConfirmed} onChange={(event) => updateStewardshipDraft({ ...stewardshipDraft, redactionConfirmed: event.target.checked })} /><span>I understand this file will be stored privately in Elysia Ecobotics Online's Supabase backend for administrator review, I have redacted unnecessary sensitive information, and stewardship recognition does not grant authority, paid status, moderation access, reviewer access, administrator access, or employment.</span></label>
        </div>
        <div className="button-row"><button type="button" onClick={prepareStewardship}>Prepare stewardship recognition</button><button type="button" onClick={skipStewardship}>Skip stewardship for now</button><button type="button" className="button-primary" onClick={() => go("work-with")}>Continue to Work With Elysia Ecobotics</button></div>
      </section>}

      {step === "work-with" && <section className="section-card commons-setup-panel">
        <p className="eyebrow">Step 3: Work With Elysia Ecobotics</p>
        <h2>Optional help and collaboration request</h2>
        <WarningCallout title="Administrator review required"><p>Helping Elysia Ecobotics is optional. Volunteer, contributor, developer, reviewer, moderator, and guardian roles require administrator review. No role is self-assigned.</p></WarningCallout>
        <div className="commons-form-grid">
          <label><span>Request type</span><select value={workWithDraft.requestType} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, requestType: event.target.value })}>{requestTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Availability</span><select value={workWithDraft.availability} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, availability: event.target.value })}>{["occasional", "weekly", "project-based", "not sure yet"].map((option) => <option key={option}>{option}</option>)}</select></label>
          <fieldset className="work-area-fieldset wide-field"><legend>Areas of interest</legend><div className="work-checkbox-grid">{areaOptions.map((area) => <label className="checkbox-line" key={area}><input type="checkbox" checked={workWithDraft.areasOfInterest.includes(area)} onChange={() => toggleArea(area)} /><span>{area}</span></label>)}</div></fieldset>
          <label className="wide-field"><span>Message / why you want to help</span><textarea rows={4} value={workWithDraft.message} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, message: event.target.value })} /></label>
          <label className="wide-field"><span>Skills / experience</span><textarea rows={3} value={workWithDraft.skills} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, skills: event.target.value })} /></label>
          <label><span>GitHub</span><input value={workWithDraft.github} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, github: event.target.value })} /></label>
          <label><span>GitLab / Codeberg</span><input value={workWithDraft.gitlabCodeberg} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, gitlabCodeberg: event.target.value })} /></label>
          <label><span>Portfolio</span><input value={workWithDraft.portfolio} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, portfolio: event.target.value })} /></label>
          <label><span>LinkedIn, optional</span><input value={workWithDraft.linkedin} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, linkedin: event.target.value })} /></label>
          <label className="wide-field"><span>Resume or CV, optional</span><input type="file" accept=".pdf,.doc,.docx,.odt,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain,text/markdown,text/x-markdown" onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            const validation = validateResumeFile(nextFile);
            if (validation) {
              setResumeFile(null);
              event.currentTarget.value = "";
              pushMessage(validation);
              return;
            }
            setResumeFile(nextFile);
          }} /></label>
          <div className="wide-field boundary-note">Resume/CV upload uses the existing private Work With storage path only after final confirmation, while signed in. It never creates a public URL. {resumeFile ? `Selected: ${resumeFile.name} (${Math.ceil(resumeFile.size / 1024)} KB).` : "No resume/CV selected."}</div>
          <label className="checkbox-line wide-field"><input type="checkbox" checked={workWithDraft.understandsVolunteer} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, understandsVolunteer: event.target.checked })} /><span>I understand current opportunities are generally volunteer, contributor, or collaborator roles unless explicitly marked paid.</span></label>
          <label className="checkbox-line wide-field"><input type="checkbox" checked={workWithDraft.understandsPublicPrivacy} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, understandsPublicPrivacy: event.target.checked })} /><span>I will not include secrets, private Elysia memory, credentials, .env files, private logs, or sensitive personal/customer data.</span></label>
          <label className="checkbox-line wide-field"><input type="checkbox" checked={workWithDraft.understandsReview} onChange={(event) => updateWorkWithDraft({ ...workWithDraft, understandsReview: event.target.checked })} /><span>I understand this request requires administrator review and does not automatically grant a role, badge, membership tier, moderator authority, reviewer authority, or paid position.</span></label>
        </div>
        <div className="button-row"><button type="button" onClick={prepareWorkWith}>Prepare Work With request</button><button type="button" onClick={skipWorkWith}>Skip for now</button><button type="button" className="button-primary" onClick={() => go("confirm")}>Continue to final confirmation</button></div>
      </section>}

      {step === "confirm" && <section className="section-card commons-setup-panel">
        <p className="eyebrow">Final confirmation</p>
        <h2>Your Commons Profile is ready</h2>
        <p>Review your profile setup. When you click Create Commons Profile, your public Commons Profile will be created or updated. Optional stewardship and Work With requests will be saved for administrator review only if their backend persistence is available.</p>
        <dl className="mini-facts">
          <div><dt>Username</dt><dd>{profileDraft.username || "Not set"}</dd></div>
          <div><dt>Display name</dt><dd>{profileDraft.display_name || "Not set"}</dd></div>
          <div><dt>Stewardship</dt><dd>{stewardshipDraft.skipped ? "Skipped" : stewardshipDraft.organizationName || "No organization selected"}</dd></div>
          <div><dt>Receipt upload</dt><dd>{receiptFile ? `Private upload after final confirmation: ${receiptFile.name}` : "None selected"}</dd></div>
          <div><dt>Work With request</dt><dd>{workWithDraft.skipped ? "Skipped" : workWithDraft.prepared ? "Prepared" : "Not prepared"}</dd></div>
          <div><dt>Resume/CV</dt><dd>{resumeFile ? `Private upload after final confirmation: ${resumeFile.name}` : "None selected"}</dd></div>
        </dl>
        <p className="boundary-note">When final confirmation successfully records this signed-in Commons Profile's onboarding completion, Free Member recognition is granted. A browser-local flag or minimal Marketplace profile alone does not qualify. Existing legitimate awards remain preserved. Steward, Contributor, Guardian / Reviewer, Founding Steward, moderator, administrator, developer trust, or paid roles require their own administrator review and cannot be self-assigned.</p>
        <div className="button-row"><button type="button" onClick={() => go("profile")}>Back to profile draft</button><button type="button" className="button-primary" onClick={() => void finalizeProfile()} disabled={busy}>{busy ? "Creating profile..." : "Create Commons Profile"}</button></div>
      </section>}
    </div>
  );
}
