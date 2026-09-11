// Bounded public explanation corrections. Existing consent versions remain frozen.
export const wordingCleanupLegalVersion = "2026-09-10-wording-cleanup";
export const wordingCleanupLegalSlugs = new Set([
  "acceptable-use-policy", "add-on-submission-policy", "code-of-conduct",
  "dmca-copyright-policy", "security-review-policy", "vulnerability-disclosure-policy",
  "privacy-policy", "terms-of-use"
]);

export function applyWordingCleanupLegal(slug: string, body: string): string {
  let current = body.replace(/https:\/\/elysia-ecobotics-online\.pages\.dev/g, "https://elysiaecobotics.com");
  if (slug === "privacy-policy") {
    current = current
      .replace("The Elysia Commune may eventually process", "Depending on the enabled feature you use, the Elysia Commune processes")
      .replace("At launch, some Commune functions may be local draft-only and stored in the user’s browser until a backend review queue exists.", "Local drafts remain in your browser until you explicitly submit them through an available account-backed workflow.")
      .replace("Some features use local browser storage before backend account sync is built.", "Some features use local browser storage for drafts and preferences alongside account-backed features.")
      .replace("and privacy preference placeholders.", "and privacy preferences.")
      .replace("Local browser storage remains in your browser unless you clear it, export it, or a future account-sync feature is deliberately built.", "Locally stored data remains in your browser until you explicitly export, submit, or sync it through an available feature. You can clear local browser storage yourself.")
      .replace("Users should be able to request correction, deletion, or export of personal account data", "You can request correction, deletion, or export of personal account data");
  }
  if (slug === "terms-of-use") {
    current = current.replace("These Terms are intended for a United States/Colorado-based project posture, but final governing law and venue language should be reviewed before publication.", "The governing-law and venue provisions remain subject to legal review.");
  }
  return current.replace(/\*\*Last updated:\*\* [^\n]+/, "**Last updated:** 2026-09-10 (wording clarification)");
}
