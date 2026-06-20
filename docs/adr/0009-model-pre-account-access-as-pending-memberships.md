# Model Pre-Account Access as Pending Memberships

Status: Implemented checkpoint, 2026-06-18

## Decision

Organization admins may add a Person to an Organization before that Person has a User account by creating a Pending Membership, not a separate invitation object. Contact Identity such as an email address is evidence for claiming that Membership, while optional email delivery remains outreach state.

Once a User proves a matching Contact Identity, the Membership can become active and attach to the User's single Person when the placeholder has no meaningful identity beyond the Contact Identity and claimable Pending Memberships. Richer or ambiguous placeholders route through Person Consolidation review instead of silently merging Person Referents.

## Implemented Lifecycle

- Organization admins can add existing Users by email as active Organization members.
- Organization admins can add people by email before account creation, creating or updating a Pending Membership and the smallest valid Person placeholder.
- Users can claim Pending Memberships through a verified primary email or a verified alternate Contact Identity.
- Users who already have access can add and verify alternate Contact Identities from Settings.
- Clear placeholder Persons can be claimed automatically; richer placeholders create Person Consolidation reviews.
- Organization admins can approve, reject, and reopen rejected Person Consolidation reviews.
- Claimants see rejected-review results instead of recreating the same review indefinitely.
- In-app Notifications cover Person Consolidation review creation and resolution.
- Organization Settings preserves and displays claim evidence, including approved Person Consolidation evidence when relevant.
- Organization admins can withdraw unclaimed Pending Memberships by marking the Membership inactive.

## Consequences

- Pending Membership is the durable pre-account relationship. Email invitation, reminder, or resend delivery can fail, be skipped, or be retried without changing whether the Membership exists.
- Contact Identity proves control of a contact value, but it does not by itself define Person identity.
- User remains account/access infrastructure, and Person remains the taggable human Referent.
- Person Consolidation review is a narrow guardrail for ambiguous Membership Claims, not a generic Person merge engine.

## Non-Goals

- This decision does not implement email invitation delivery or resend state.
- This decision does not implement bulk member import, bulk withdrawal, or active member removal.
- This decision does not retarget historical relationships from old placeholder Persons after approved Person Consolidation.
- This decision does not implement general Person merge, split, or cleanup tooling.
