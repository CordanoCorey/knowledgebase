# Responsive frame decision prototype — #33

Status: A's responsive behavior was settled with the User on 2026-10-26.
Visual styling remains undecided. The canonical resolution is recorded in
[Define responsive and accessible frame behavior](https://github.com/CordanoCorey/knowledgebase/issues/33).
No product redesign is implemented.

## Earlier human feedback and scope boundary

The User initially disliked all three visual treatments and would choose A if required.
This is not approval to replace or restyle the homepage. Preserve the Dashboard
composition already decided in #25 and the shared frame hierarchy from #26.
The body content in this prototype is a fixture for testing navigation, focus,
and scrolling; it is not a proposed homepage design.

That initial feedback left the exact behavior unconfirmed. In the follow-up,
the User chose: "Settle A's behavior; visual styling stays undecided."
The earlier proposed interaction contract below is retained as prototype
history and superseded by the follow-up contract and canonical issue resolution.
Do not promote any of these prototype renderings into the application.

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

## Earlier proposed interaction contract — superseded

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

Original decision capture required leaving #33 open until human comparison
resolved placement and modality. The follow-up below records that decision.
Map #23 excludes implementing/deploying the redesign, so winner promotion is
a later implementation task despite the general prototype skill's cleanup flow.

## Follow-up behavior contract — 2026-10-26

Human decision: "Settle A's behavior; visual styling stays undecided."
The following contract captures A's behavior with the technical rules needed
for implementation. The issue's resolution comment is canonical. These details
do not approve its visual treatment or replace the Dashboard composition.

### Placement and fit

| Available CSS viewport width | Persistent destinations | One contextual drawer |
| --- | --- | --- |
| Below 700 px | Labeled bottom navigation | Modal left side sheet, width `min(360px, 100%)` |
| 700–1099 px | 76 px left rail | Modal left side sheet, up to 340 px, within the viewport |
| At least 1100 px | 76 px left rail | 340 px nonmodal dock beside the page |

Use viewport width after browser zoom, not device detection. The dock reserves
space instead of covering content. Header identity and Root Search sit beside
each other only when their remaining content container is at least 768 px;
below that, identity precedes a full-width Root Search on a separate row.
Long titles and all applicable Role labels wrap. Root Search stays visibly
separate from search within context and is never replaced by an unlabeled icon.
The header scrolls with the document so enlarged text does not consume the
reading viewport. These dimensions define responsive fit; colors, typography,
decoration, and final microcopy remain undecided.

Keep the five existing destinations: Dashboard, Places, Calendar, Notifications,
and the avatar/Account trigger. Bottom navigation has at least 44 px targets,
visible labels, and auto height sufficient for wrapped labels plus safe-area
padding. Reserve its actual measured height in page layout and scroll padding;
do not include the safe-area inset inside a fixed 80 px content budget.

### Drawer lifecycle and focus

- Start closed. Places, Contents, and Account use the same drawer. Activating
  the open mode's trigger closes it; another available trigger replaces its
  mode. Modal background, including persistent navigation, is inert, so close
  the modal before using a different background trigger.
- On opening or switching modes, focus the visible Close button. Name the
  panel with its visible heading and expose expanded/controls state on its
  trigger. Modal presentation uses dialog semantics and contained Tab and
  Shift+Tab; the desktop dock is a labeled nonmodal region with ordinary Tab
  order and no focus trap. Navigation links are links; disclosures are buttons.
- Escape dismisses the modal. In the dock, Escape dismisses only when focus
  is inside the dock; Escape elsewhere leaves it open. An inner control such
  as a suggestion popup handles Escape first. Close is always available.
  Backdrop dismissal applies only to modal presentation; outside clicks do
  not dismiss the dock. No gesture is required to dismiss either presentation.
- Dismissal returns focus to the mode's invoking trigger, or its responsive
  equivalent after reflow. If unavailable, use the current page heading or
  the main landmark. Merely closing restores the underlying scroll position.
- Following a destination keeps the drawer open while navigation is pending;
  close it on successful arrival. Move focus to the new page's heading after
  navigation and authorized content are ready, not after an arbitrary animation
  frame. If navigation fails, keep the drawer, preserve the selected item, and
  announce a concise failure without claiming arrival. A superseding navigation
  cancels the prior request. If the User dismisses the drawer while waiting,
  cancel that pending navigation; late results never reopen it or steal focus.
- A Contents link closes the drawer, reveals and scrolls to its existing
  section, and focuses that heading. Do not manufacture empty sections. If
  access or content changes remove the section, retain the page, focus its
  heading, and announce that the section is unavailable. Reflect a successful
  Contents selection in the URL fragment using history replacement, without
  adding a history entry. Loading that fragment directly focuses the section
  after it is ready; a missing fragment target falls back to the page heading.
- Drawer mode is ephemeral UI state, not a separate history entry. Browser
  Back/Forward follows real route history and closes the drawer. Reload starts
  closed. Selecting the current destination closes and focuses its heading
  without a new history entry. Preserve the existing route's Back/Forward
  scroll restoration; use the restored page's heading as its focus destination.
- Resize retains the mode, panel scroll, page scroll, and every draft. Preserve
  focus on the same control while it remains visible. If the modality change
  makes the currently focused page control inert, move focus to Close. Update
  focus containment and scroll locking together; never leave hidden focus or
  an inert page after closing. Widening alone does not move focus out of a panel.

### Page, search, draft, and announcement boundaries

- Knowledge Pages expose Contents only for visible, authorized page sections.
  Calendar, Notifications, To-do, and other User Views show their own title;
  they do not inherit a Knowledge Navigator, Active Knowledge Context, or
  Knowledge Page contents from the prototype fixture. Offer Contents on a User
  View only when it has a real section outline, named for that view.
- Root Search retains its existing accessible input/suggestion interactions:
  typing does not navigate, selecting a suggestion or submitting does, and
  Escape dismisses suggestions before an enclosing surface handles Escape.
  Opening a drawer dismisses search suggestions without clearing the query.
- Opening, switching, closing, or resizing the frame never submits or clears
  Composer Drafts. Retain the existing context/route/slot placement keys when
  navigating; returning restores that destination's draft rather than moving
  text into a new Knowledge Context. Preserve pending draft buffers before
  navigation: a delayed autosave canceled by unmount must not drop recent
  typing. Either finish preservation before leaving or retain the unsaved
  buffer under its original placement key until saving succeeds. No new draft
  lifecycle is introduced.
- Use a skip link to main, one main landmark, named navigation, visible focus,
  and current-page state on destination links. Role summaries are plain text.
  The Notifications accessible name includes unread count, but count changes
  do not repeatedly announce the frame or move focus.
- Update the document title on route arrival. Heading focus is the normal
  arrival cue; do not also announce the same title in a live region. Use polite
  status for asynchronous results or failures that focus does not convey.
  No global arrow-key interception belongs to the production frame.

### Scrolling, keyboard, and verification

Modal open locks the underlying document at its current scroll position. Its
Close/header stays visible while panel content scrolls independently with
contained overscroll. Closing restores the document scroll. The desktop dock
scrolls independently and leaves the page operable. Use available dynamic
viewport height and safe-area padding. With a virtual keyboard open, the active
input, its suggestions, and Close must remain reachable; navigation must not be
fixed over the input or its actions. Permit scrolling rather than squeezing
controls or forcing a new responsive mode from keyboard height alone.

Open/close and Contents navigation work without animation. Reduced-motion
preference disables drawer movement and smooth scrolling. No timed dismissal
or motion is needed for the frame to function.

Before implementation acceptance, cover widths 320, 390, 699, 700, 768, 1024,
1099, 1100, and 1440 px, short landscape, 200% text, and 400% zoom. Include
safe-area insets, virtual keyboard, long labels, many Roles, long Places,
empty/changing Contents, denied access, failed navigation, Back/Forward,
placement-keyed drafts, and both directions of resize while focus is in the
page or drawer. Check forward/reverse Tab, skip link, nested Escape handling,
return focus, no horizontal page overflow at 320 px, and visible focused
controls clear of bottom navigation. Manually exercise desktop and mobile
screen readers. These are future acceptance cases, not completed test results.

Accessibility references inform technical constraints; the responsive fit,
docked Escape, and history rules above are application behavior choices:

- [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): named modal, contained focus, Escape, and logical return focus.
- [WCAG 2.2 reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): usable content at 320 CSS px without two-dimensional page scrolling.
- [WCAG 2.2 focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): author-created chrome must not entirely hide the focused control. The proposal aims to keep it fully visible.

The current prototype does not implement every detail above: it retains a
single fixture textarea, renders Knowledge Page sections on User Views, and
has incomplete safe-area sizing. Its existing build/interaction observations
must not be read as verification of this behavior contract.
