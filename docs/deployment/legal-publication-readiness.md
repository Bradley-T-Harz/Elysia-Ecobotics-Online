# Internal legal publication readiness

Operational checklist, reconciled 2026-09-09. This is internal release material,
not public legal policy, a completed legal review, or authority to enable payments.
The canonical public hub is https://elysiaecobotics.com/legal.

## Preserved checklist

The historical `/legal/legal` index contained these useful release checks. Keep
them available for future releases; this reconciliation does not certify them as
completed or make optional/conditional items mandatory public policy.

- Maintain the role-based contacts listed at `/legal`; verify delivery and ownership
  through the appropriate operational process before relying on a contact.
- Determine whether a legal/business mailing address needs to be published. Any
  address and disclosure decision requires owner/legal review.
- Confirm designated-agent registration and public contact details if relying on
  DMCA safe harbor. The existence of a copyright policy is not proof of registration.
- Keep `/legal` reachable from the footer and its current policy pages reachable
  from the hub. Check compatibility links and unknown-policy behavior on release.
- Check that account/submission flows present and record the applicable Terms and
  Privacy consent where required. Preserve historical versions and recorded hashes;
  follow [economic legal-content integrity](../economics/legal-content-integrity.md)
  for substantive economic-policy changes.
- Maintain a security reporting contact and the existing
  `public/.well-known/security.txt`. The old index described that file as optional;
  it is now implemented, so check its contact details and expiry when releasing.
- Keep policy version/effective-date records accurate and immutable where consent
  refers to them. Verify version-specific URLs still resolve to the original text.
- Arrange appropriate legal review before high-risk growth, paid add-ons, uploads,
  or major user-generated-content changes. This cleanup does not complete that
  review or authorize a new financial capability.

## Historical index reconciliation

Source: `src/pages/Legal/legalPolicyPages.ts`, slug `legal`, as recorded in commit
`7608623330e0260b3c82c752bd2b17b21ed9680b` (index dated 2026-06-09).
Its previous content remains retrievable in Git; no consent archive is removed.

| Old section | Disposition and canonical coverage |
| --- | --- |
| Site/brand/operator/status header | Already represented by `/legal` and current policy headers. Retire the duplicate header and old Pages-host public URL; use the custom-domain hub above. |
| Proposed routes | Retire from public content. All twelve policy destinations already exist and are linked from the current Legal hub. These are no longer proposals. |
| Public doctrine: public cloud site / private, governed, user-controlled local core | Already explicit in the current Legal hub, Privacy introduction and private-core sections. No duplicate text needed. |
| Public doctrine: accounts/membership must not become local identity, memory or access | Privacy distinguishes website/local accounts, says Commons Profile data does not overwrite local identity or memory, and requires explicit, narrow, revocable local linking. |
| Public doctrine: Marketplace listings must not grant local access | Privacy states catalog listings do not silently install add-ons; Marketplace Developer Agreement reserves installation, permissions and execution to local Elysia. |
| Public doctrine: Living Library / Commune must not become private local memory or access | Privacy's Library section excludes connection to private memory; its Commune and local-linking sections keep public content separate. Security Review Policy explicitly separates public code sharing from execution and public website data from private local data. Terms' website/core boundary remains intact. |
| Publication readiness checklist | Preserve the still-relevant operational substance above, outside the public bundle. It is not participant-facing legal policy. |

No unique active doctrine was missing from canonical policies. Do not restore
the old index or its proposed routes to make an obsolete container reachable.
`/legal/legal` redirects to `/legal` at the Pages edge and during client navigation.
Current policy bodies and all archived consent/version records are unchanged.

## Release verification

Verify the two Creator Studio destinations separately: **Review outcomes** opens
Marketplace-filtered notifications; **Submission timeline** opens the whole Forge
submission timeline. Record rows must not imply an individual submission detail
view where the destination ignores the ID. The historical Signals domain activity
view remains separately labeled in Signals.

Check the Legal alias both as an HTTP redirect and as client navigation. Recheck
current and archived policy semantics, role boundaries, mobile layout, route
compatibility and disabled financial publication markers before deployment. This
change requires no database migration, provider action or new payment setting.
