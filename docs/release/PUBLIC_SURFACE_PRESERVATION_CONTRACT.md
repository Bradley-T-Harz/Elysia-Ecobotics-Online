# Public surface preservation contract

Established Bradley-approved product surfaces are release contracts, not cleanup candidates.

## Required change order

When an established route, navigation entrance, page, CTA, or backend workflow is incomplete or broken, the release process must:

1. identify the exact surface and its current behavior;
2. trace its route, navigation, data, role, and backend contracts;
3. repair it and preserve its information architecture wherever possible;
4. add or update regression proof;
5. disclose by name what would disappear if repair is impossible;
6. obtain Bradley's explicit approval by name before removal, hiding, or a redirect away from the surface.

`Not release-ready` means repair or declare a named release blocker. It does not authorize a homepage redirect, silent navigation removal, test removal, static mock, or erased backend doorway.

## Protected website surfaces

The machine-readable inventory is `docs/navigation/protected-public-surfaces.json`. It protects at least:

- The Archive and the Get Elysia navigation territory;
- Products;
- Lab;
- Commune, including rooms, conversations, community voting, code review, sandbox request, realtime and moderation routes;
- Marketplace;
- Developer Forge;
- Living Library;
- Commons Circle;
- administrator/reviewer entrances under their role gates.

Protection means:

- the route resolves to its real component, not `Navigate` to `/`;
- public entrances remain present for public surfaces;
- restricted entrances retain their intended role gate;
- backend-integrated surfaces retain focused contract/integration tests;
- a release test may not redefine a working surface as hidden merely to make the gate pass.

## Deprecation record

Any approved future removal must update the inventory with a named approval reference, replacement/redirect reason, data-retention effect, migration path, and test change. Absence of that record is a failing release condition.
