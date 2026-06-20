# Pre-Account Membership Claiming Done Checkpoint

Checkpoint date: 2026-06-18

## Status

The pre-account Organization Membership feature is checkpointed as done for the agreed scope. The audit found no remaining core implementation slice for this feature.

## Completed Capabilities

- Organization admins can add existing Users by email as active Organization members.
- Organization admins can add people by email before account creation, creating or updating a Pending Membership and the smallest valid Person placeholder.
- Active and Pending Memberships appear together in Organization Settings with status making unclaimed access clear.
- Users can claim Pending Memberships through a verified primary email.
- Users can add and verify alternate Contact Identities from Settings and claim matching Pending Memberships after they already have access.
- A clear placeholder Person can be claimed automatically when it has no meaningful identity beyond the verified Contact Identity and claimable Pending Memberships.
- A richer placeholder Person routes to Person Consolidation review instead of silently merging Person Referents.
- Organization admins can approve, reject, and reopen rejected Person Consolidation reviews.
- Claimants see rejected-review results instead of recreating the same rejected review indefinitely.
- In-app Notifications cover Person Consolidation review creation and resolution.
- Active member rows preserve and display claim evidence, including approved Person Consolidation evidence when relevant.
- Organization admins can withdraw unclaimed Pending Memberships by marking the Membership inactive.

## Code Map

- `convex/organizationAccounts.ts`: Organization member add/withdraw mutations, Organization Settings query, Person Consolidation review approve/reject/reopen, claim evidence returned to Settings.
- `convex/lib/pendingMembershipClaims.ts`: verified-email claim helper, automatic-claim guard, Person Consolidation review creation, rejected-review handling.
- `convex/contactIdentities.ts`: primary and alternate Contact Identity verification and claim flows.
- `convex/lib/userNotificationWrites.ts`: notification rows for Person Consolidation review lifecycle.
- `convex/userNotifications.ts`: user notification inbox behavior.
- `convex/schema.ts`: Membership, Contact Identity, Membership Claim, Person Consolidation Review, and Notification schemas.
- `src/auth/OrganizationAccessRequest.tsx`: blocked-access claim-by-email surface and claim result formatting.
- `src/App.tsx`: Settings Contact Identity panel, Organization Settings member actions, claim evidence display, withdrawal action, and Notifications route.

## Test Map

- `convex/appAccess.test.ts`: app access, organization member management, pending member withdrawal, Person Consolidation review resolution, approved claim evidence, and primary-email claim behavior.
- `convex/contactIdentities.test.ts`: alternate Contact Identity verification, claim behavior, review creation, claimant notification, rejected-review result behavior, and uniqueness protection.
- `convex/userNotifications.test.ts`: current-user notification inbox, unread summary, read state, and access checks.
- `src/App.integrated.test.tsx`: visible Organization Settings, Contact Identity Settings, claim result copy, review actions, withdrawal action, and Notifications UI behavior.

## Verification Results

- `npm.cmd test -- convex/appAccess.test.ts convex/contactIdentities.test.ts convex/userNotifications.test.ts src/App.integrated.test.tsx`
  - Passed: 4 files, 70 tests.
- `npx.cmd convex codegen --typecheck=disable`
  - Blocked by environment: `TypeError: fetch failed` with `AggregateError [EACCES]`.
- `npm.cmd run build`
  - Passed. Vite reported the existing large chunk warning.

## Intentional Boundaries

- Pending Membership is the durable pre-account relationship; email invitation, reminder, or resend delivery remains optional outreach state.
- Contact Identity proves control of a contact value, but does not define Person identity by itself.
- Person Consolidation review is the guardrail for richer or ambiguous placeholders, not a generic Person merge engine.
- Withdrawing a Pending Membership marks the Membership inactive; it does not delete or clean up placeholder Person, Referent, Tag, or Knowledge Entry rows.

## Optional Follow-Ups

- Add email invitation/resend outreach as delivery state separate from Pending Membership existence.
- Add bulk member import or bulk withdrawal.
- Add active member removal or deactivation workflows.
- Add placeholder Person cleanup tools after withdrawn or approved claims.
- Add general Person merge/split tooling and relationship retargeting for broader identity maintenance.
- Add notification cleanup or backfill for old review/member events.

## Done Criteria

The agreed core flow is complete when docs and code keep these facts true:

- Admins can create Pending Memberships before account creation.
- Users can prove Contact Identity and claim matching Pending Memberships.
- Ambiguous Person identity routes through review.
- Admins can resolve or reopen review where appropriate.
- Settings and Notifications make the state legible.
- Admins can withdraw unclaimed Pending Memberships.

No known core slice remains after this checkpoint.
