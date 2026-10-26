# Responsive frame decision prototype — #33

Status: human feedback recorded; A is a fallback preference for responsive frame
behavior only. None of the visual treatments is approved. No product redesign
is implemented.

## Human feedback and scope boundary

The User dislikes all three visual treatments and would choose A if required.
This is not approval to replace or restyle the homepage. Preserve the Dashboard
composition already decided in #25 and the shared frame hierarchy from #26.
The body content in this prototype is a fixture for testing navigation, focus,
and scrolling; it is not a proposed homepage design.

Use A only as the preferred direction for responsive/accessibility behavior
when refining the existing design. Exact dimensions, breakpoints, styling, and
the proposed interaction details below remain unconfirmed. #33 stays open;
do not promote any of these prototype renderings into the application.

Run `npm run dev -- --port 5178 --strictPort`, then open
`http://localhost:5178/?prototype=header-sidebar&responsive=1&variant=A`.
The existing #26 comparison remains available by omitting `responsive`.

## Question and alternatives

Compare the already chosen compact frame at narrow widths, rather than reopening
its destination hierarchy. All alternatives retain Dashboard, Places, Calendar,
Notifications, Account, distinct Root Search, plural non-interactive Roles, and
one drawer with Places, Contents, and account modes.

| Variant | Below 700 CSS px | Drawer | At least 1100 CSS px |
| --- | --- | --- | --- |
| A (recommended) | Labeled bottom navigation | Modal side sheet, at most 360 px | 76 px rail and 340 px nonmodal docked drawer |
| B | Labeled top navigation | Full-screen modal | Rail with modal overlay |
| C | Retained 64 px side rail | Modal bottom sheet, 70dvh | Rail and nonmodal docked drawer |

700–1099 px uses the 76 px rail with a modal side overlay in every variant.
These are proposed fit thresholds, not device classifications. Browser zoom
uses the same CSS viewport rules. Resize retains the drawer mode and draft;
crossing the modality boundary reopens the same dialog and focuses Close.

Recommendation: A preserves phone reading width and thumb access while the
desktop dock permits reading and navigation together. Compare against B's
larger navigation surface and C's consistent left edge before deciding.

## Proposed interaction contract

- Start closed. A trigger toggles its current drawer mode; another trigger
  replaces that mode in the same surface. Modal background is inert, including
  the persistent destinations; close before choosing another trigger.
- Use native buttons, normal Tab order, Enter/Space activation, visible focus,
  and a skip link to main. This is navigation, not an ARIA menu or tablist:
  arrow-key navigation is not a product requirement.
- Each trigger names its purpose and exposes expanded/controls state. Native
  dialog is named by its visible heading. Modal dialogs trap focus natively;
  nonmodal desktop dialogs leave the page reachable by Tab.
- On open, focus Close. Escape, Close, or modal backdrop dismisses and restores
  focus to the trigger; if removed, focus the page heading. Do not dismiss the
  desktop dock on an outside click. No swipe-only dismissal.
- Selecting a destination closes the drawer, updates the page, then focuses
  its heading. Selecting a Contents item closes, scrolls to the matching section,
  and focuses its heading. Only visible, authorized sections enter the outline.
- Modal open locks document scroll; drawer content has independent contained
  scrolling. Desktop dock leaves document scrolling available. Reserve bottom
  navigation space and account for safe-area insets; use dynamic viewport height
  so a short viewport still exposes the Close control and scrolling content.
- Keep Root Search separately labeled from search within context. Wrap long
  page names and Role summaries; never turn Roles into selectors.
- Announce destination arrival once with a polite status; do not repeatedly
  announce the whole frame or notification count during rerenders. The unread
  count is part of the Notifications control's accessible name.
- No movement is necessary: prototype opens/closes immediately. Production
  must honor reduced motion without animated scrolling or drawer slides.

## Verification before implementation acceptance

Exercise A/B/C at 320, 390, 768, 1024, and 1440 CSS px, short landscape,
200% text, and 400% browser zoom. Check long names, many Roles, long Places,
empty Contents, authorization changes, and virtual keyboard. Check all three
drawer modes, switching, repeated open/close, Escape, backdrop, forward/reverse
Tab, return focus, section focus, draft preservation, resize while open, and
safe-area clearance. Modal background must not scroll or receive focus;
nonmodal page must remain operable. No horizontal page scrolling at 320 px.
Run screen-reader checks with desktop and mobile assistive technology; automated
checks alone do not establish WCAG conformance.

Prototype limits: navigation is a fixture, no search/backend writes occur,
account authorization is illustrative, and content is intentionally repeated
to expose scrolling. This does not decide specialized User View content,
notification workflows, exact visual styling, or production conformance.

Observed checks: TypeScript/production build and existing prototype switcher
suite pass. In-app browser narrow view renders; Places opens as a named modal
with focus on Close; Escape closes and returns focus to Places; variant switch
updates the URL. The full device/assistive-technology matrix remains pending.

Decision capture: keep #33 open until human comparison resolves placement and
modality; record the chosen contract and link this throwaway branch in #33.
Map #23 excludes implementing/deploying the redesign, so winner promotion is
a later implementation task despite the general prototype skill's cleanup flow.
