// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const mockState = vi.hoisted(() => ({
  appAccess: {
    email: "gelbaughcm@gmail.com",
    organizations: [
      {
        name: "Arche Classical Academy",
        organizationEntryId: "organizationEntry",
        organizationKind: "school",
        organizationReferentId: "organizationReferent",
        role: "admin",
      },
    ],
    status: "allowed",
    userId: "user",
  } as unknown,
  auth: {
    isAuthenticated: true,
    isLoading: false,
  },
  mutationCalls: [] as unknown[],
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: async () => undefined,
    signOut: async () => undefined,
  }),
  useConvexAuth: () => mockState.auth,
}));

vi.mock("convex/react", () => ({
  useMutation: () => async (args: unknown) => {
    mockState.mutationCalls.push(args);
    return {};
  },
  useQuery: (_query: unknown, args?: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    if (
      args &&
      typeof args === "object" &&
      "popularLimit" in args
    ) {
      return {
        navigatorUsage: [
          {
            activeTagCount: 2,
            id: "navigator-usage-1",
            occurredAt: Date.UTC(2026, 5, 12, 12, 30),
            resolvedTagCount: 1,
            usageKind: "select",
          },
        ],
        popularTargets: [
          {
            href: "/scripture/romans-8-28",
            label: "Romans 8:28",
            lastVisitedAt: Date.UTC(2026, 5, 12, 12, 25),
            pageType: "referent",
            targetKey: "romans-8-28",
            targetKind: "biblePassage",
            totalVisits: 4,
          },
        ],
        recentPageVisits: [
          {
            href: "/scripture/romans-8-28",
            id: "page-visit-1",
            label: "Romans 8:28",
            pageType: "referent",
            rawPath: "/scripture/romans-8-28",
            targetKey: "romans-8-28",
            targetKind: "biblePassage",
            visitedAt: Date.UTC(2026, 5, 12, 12, 25),
          },
        ],
      };
    }

    if (
      args &&
      typeof args === "object" &&
      "passageString" in args
    ) {
      return {
        canonicalKey: "romans-8-28",
        hasText: true,
        isTruncated: false,
        label: "Romans 8:28",
        passageString: "romans-8-28",
        ranges: [{ endOrdinal: 28232, startOrdinal: 28232 }],
        slug: "romans-8-28",
        status: "resolved",
        translation: {
          code: "KJV",
          name: "King James Version",
          textStatus: "available",
        },
        verses: [
          {
            bookCode: "ROM",
            bookName: "Romans",
            bookShortName: "Rom",
            chapterNumber: 8,
            ordinal: 28232,
            text: "And we know that all things work together for good...",
            verseNumber: 28,
          },
        ],
      };
    }

    if (
      args &&
      typeof args === "object" &&
      Object.keys(args).length === 0
    ) {
      return mockState.appAccess;
    }

    return {
      google: false,
      password: true,
      resend: false,
    };
  },
}));

const CONTRIBUTION_TITLE = "Comfort by the Spirit";
const CONTRIBUTION_BODY =
  "A deterministic lesson contribution on Romans 8:28 and the Holy Spirit.";

describe("MVP Explore/Contribute loop", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/scripture/romans-8-28",
    );
    window.localStorage.clear();
    mockState.auth = {
      isAuthenticated: true,
      isLoading: false,
    };
    mockState.appAccess = {
      email: "gelbaughcm@gmail.com",
      organizations: [
        {
          name: "Arche Classical Academy",
          organizationEntryId: "organizationEntry",
          organizationKind: "school",
          organizationReferentId: "organizationReferent",
          role: "admin",
        },
      ],
      status: "allowed",
      userId: "user",
    };
    mockState.mutationCalls = [];
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
  });

  test("navigates from Scripture Explore to Slot Contribute and returns the contribution as an Answer", async () => {
    await renderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        rawPath: "/scripture/romans-8-28",
        targetKey: "romans-8-28",
        targetKind: "biblePassage",
      }),
    );
    expect(getButton("Remove Romans 8:28")).toBeTruthy();
    expect(queryButton("Remove Holy Spirit")).toBeNull();

    await click(getButton("Add Holy Spirit"));

    expect(window.location.pathname + window.location.search).toBe(
      "/explore?tagIds=holy-spirit,romans-8-28",
    );
    expect(getButton("Remove Holy Spirit")).toBeTruthy();

    const initialAnswerItems = getFeedItems("answer");
    expect(initialAnswerItems.map(getCardTitle)).toEqual([
      "Romans 8 and Life in the Spirit",
      "Spirit-led Hope in Hard Providences",
    ]);
    expect(initialAnswerItems.map(getHumanWeightText)).toEqual([
      "94/100",
      "68/100",
    ]);
    for (const answerItem of initialAnswerItems) {
      expect(answerItem.textContent).toContain("Romans 8:28");
      expect(answerItem.textContent).toContain("Holy Spirit");
    }

    const slotItem = getFeedItems("slot")[0];
    expect(slotItem).toBeTruthy();
    expect(slotItem.textContent).toContain("Knowledge Slot");
    expect(slotItem.textContent).toContain("Lesson on Romans 8 and the Holy Spirit");
    expect(slotItem.textContent).toContain("Romans 8:28");
    expect(slotItem.textContent).toContain("Holy Spirit");

    const slotContributionCta = getLinkIn(slotItem, "Contribute Lesson");
    await click(slotContributionCta);

    const editor = getContributionEditor();
    expect(editor.textContent).toContain("Lesson on Romans 8 and the Holy Spirit");
    expect(getContributionContextLabels(editor)).toEqual([
      "Holy Spirit",
      "Romans 8:28",
    ]);
    const knowledgeTypeSelect = editor.querySelector("select");
    expect(knowledgeTypeSelect?.getAttribute("disabled")).not.toBeNull();
    expect(knowledgeTypeSelect?.getAttribute("value") ?? knowledgeTypeSelect?.value).toBe(
      "lesson",
    );

    await setFieldValue(getTextInputIn(editor), CONTRIBUTION_TITLE);
    await setFieldValue(getTextareaIn(editor), CONTRIBUTION_BODY);
    await click(getButtonIn(editor, "Submit Lesson"));

    const finalAnswerItems = getFeedItems("answer");
    expect(finalAnswerItems.map(getCardTitle)).toEqual([
      "Romans 8 and Life in the Spirit",
      CONTRIBUTION_TITLE,
      "Spirit-led Hope in Hard Providences",
    ]);

    const contributionAnswer = finalAnswerItems.find(
      (item) => getCardTitle(item) === CONTRIBUTION_TITLE,
    );
    expect(contributionAnswer).toBeTruthy();
    expect(contributionAnswer?.textContent).toContain("Knowledge Entry");
    expect(contributionAnswer?.textContent).toContain(CONTRIBUTION_BODY);
    expect(contributionAnswer?.textContent).toContain("Human Weight");
    expect(contributionAnswer?.textContent).toContain("82/100");
    expect(contributionAnswer?.textContent).toContain("Romans 8:28");
    expect(contributionAnswer?.textContent).toContain("Holy Spirit");
    expect(contributionAnswer?.innerHTML).toContain(
      'href="/entries/simulated-slot-romans-8-spirit-lesson"',
    );
  });

  test("opens organization settings as an organization subroute", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/orgs/ruler-of-kings-church",
    );

    await renderApp();

    expect(container.textContent).toContain("Organization Home");

    const organizationRoutes = getLabelledElement("Organization subroutes");
    await click(getLinkIn(organizationRoutes, "Settings"));

    expect(window.location.pathname).toBe("/orgs/ruler-of-kings-church/settings");
    expect(container.textContent).toContain("Organization Settings");
    expect(container.textContent).toContain("ruler-of-kings-church");
    expect(getLinkIn(container, "Organization Home").getAttribute("href")).toBe(
      "/orgs/ruler-of-kings-church",
    );
    expect(
      container
        .querySelector('a[aria-label="Organization Home"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
  });

  test("shows a create-or-join organization request when access is blocked", async () => {
    mockState.appAccess = {
      email: "outside@example.com",
      status: "needsOrganization",
      userId: "outsideUser",
    };

    await renderApp();

    expect(container.textContent).toContain("Create or join an organization");
    expect(container.textContent).toContain("outside@example.com");
    expect(container.textContent).toContain("Request to join");
    expect(container.textContent).toContain("Request to create");
    expect(container.querySelector(".kb-shell")).toBeNull();
  });

  test("renders user settings with account context and persisted theme control", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/settings");

    await renderApp();

    expect(container.textContent).toContain("User Settings");
    expect(container.textContent).toContain("gelbaughcm@gmail.com");
    expect(container.textContent).toContain("Arche Classical Academy");
    expect(container.textContent).toContain("School");
    expect(container.textContent).toContain("Admin");

    const themeSwitch = getButton("Use dark theme");
    expect(themeSwitch.getAttribute("role")).toBe("switch");
    expect(themeSwitch.getAttribute("aria-checked")).toBe("false");

    await click(themeSwitch);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("knowledgebase-theme")).toBe("dark");
    expect(getButton("Use light theme").getAttribute("aria-checked")).toBe("true");
  });

  test("opens the user profile page from the avatar route", async () => {
    await renderApp();

    await click(getLabelledElement("Profile"));

    expect(window.location.pathname).toBe("/profile");
    expect(container.querySelector(".kb-profile-main")).toBeTruthy();
    expect(container.textContent).toContain("gelbaughcm@gmail.com");
    expect(container.textContent).toContain("Arche Classical Academy");
    expect(container.textContent).toContain("Admin");
    expect(container.textContent).toContain("1 membership");
    expect(container.textContent).not.toContain("Route scaffold");
  });

  test("renders the calendar route with month and agenda content", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/calendar");

    await renderApp();

    expect(container.querySelector(".kb-calendar-grid")).toBeTruthy();
    expect(container.textContent).toContain("June 2026");
    expect(container.textContent).toContain("Community Q&A review");
    expect(container.textContent).toContain("Knowledge Slot triage");
    expect(
      container.querySelector('[aria-current="page"][aria-label="Calendar"]'),
    ).toBeTruthy();
  });

  test("renders the typed overview on referent pages", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/goto/holy-spirit");

    await renderApp();

    const overview = container.querySelector(".kb-knowledge-overview");
    expect(overview).toBeTruthy();
    expect(overview?.getAttribute("data-knowledge-type")).toBe("topic");
    expect(overview?.textContent).toContain("Topic Overview");
    expect(overview?.textContent).toContain("Base Words Layer");
    expect(overview?.textContent).toContain("Holy Spirit");
    expect(overview?.textContent).toContain("Doctrine, theme, or subject.");
  });

  test("renders the analytics route with visit and navigator summaries", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/analytics");

    await renderApp();

    expect(container.querySelector(".kb-analytics-main")).toBeTruthy();
    expect(container.textContent).toContain("Popular targets");
    expect(container.textContent).toContain("Romans 8:28");
    expect(container.textContent).toContain("Navigator Actions");
    expect(
      container.querySelector('[aria-current="page"][aria-label="Analytics"]'),
    ).toBeTruthy();
  });

  test("renders the notifications route with filterable user notices", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/notifications");

    await renderApp();

    expect(container.querySelector(".kb-notifications-main")).toBeTruthy();
    expect(container.textContent).toContain("Notifications");
    expect(container.textContent).toContain("3 unread");
    expect(container.textContent).toContain(
      "Lesson on Romans 8 and the Holy Spirit is due soon",
    );
    expect(getNotificationItems()).toHaveLength(4);
    expect(
      container.querySelector('[aria-current="page"][aria-label="Notifications"]'),
    ).toBeTruthy();

    await click(getButton("Unread"));

    expect(normalizeText(container.querySelector("#kb-notification-feed-heading"))).toBe(
      "Unread Notifications",
    );
    expect(getNotificationItems()).toHaveLength(3);
    expect(container.textContent).not.toContain(
      "A Short Note on Atonement received new activity",
    );

    await click(getButton("Events"));

    expect(normalizeText(container.querySelector("#kb-notification-feed-heading"))).toBe(
      "Event Notifications",
    );
    expect(getNotificationItems()).toHaveLength(1);
    expect(container.textContent).toContain("Community Q&A review was confirmed");
  });

  async function renderApp() {
    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });
  }

  function queryButton(label: string) {
    return (
      Array.from(container.querySelectorAll("button")).find(
        (button) =>
          button.getAttribute("aria-label") === label ||
          normalizeText(button) === label,
      ) ?? null
    );
  }

  function getButton(label: string) {
    const button = queryButton(label);
    if (!button) {
      throw new Error(`Missing button: ${label}`);
    }

    return button;
  }

  function getButtonIn(element: Element, label: string) {
    const button = Array.from(element.querySelectorAll("button")).find(
      (candidate) =>
        candidate.getAttribute("aria-label") === label ||
        normalizeText(candidate) === label,
    );
    if (!button) {
      throw new Error(`Missing scoped button: ${label}`);
    }

    return button;
  }

  function getFeedItems(kind: "answer" | "slot") {
    return Array.from(
      container.querySelectorAll(`.kb-answer-feed-list li[data-feed-kind="${kind}"]`),
    );
  }

  function getNotificationItems() {
    return Array.from(container.querySelectorAll(".kb-notification-list li"));
  }

  function getCardTitle(item: Element) {
    return normalizeText(item.querySelector("h3"));
  }

  function getHumanWeightText(item: Element) {
    return normalizeText(item.querySelector(".kb-human-weight-metric dd"));
  }

  function getLinkIn(element: Element, text: string) {
    const link = Array.from(element.querySelectorAll("a")).find(
      (candidate) => normalizeText(candidate) === text,
    );
    if (!link) {
      throw new Error(`Missing link: ${text}`);
    }

    return link;
  }

  function getLabelledElement(label: string) {
    const element = container.querySelector(`[aria-label="${label}"]`);
    if (!element) {
      throw new Error(`Missing labelled element: ${label}`);
    }

    return element;
  }

  function getContributionEditor() {
    const editor = container.querySelector(".kb-contribution-editor");
    if (!editor) {
      throw new Error("Missing Contribution Editor");
    }

    return editor;
  }

  function getContributionContextLabels(editor: Element) {
    return Array.from(
      editor.querySelectorAll(".kb-contribution-context-tags li"),
    ).map(normalizeText);
  }

  function getTextInputIn(element: Element) {
    const input = element.querySelector('input[type="text"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing text input");
    }

    return input;
  }

  function getTextareaIn(element: Element) {
    const textarea = element.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("Missing textarea");
    }

    return textarea;
  }

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
  }

  async function setFieldValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) {
    await act(async () => {
      const valueSetter =
        element instanceof HTMLTextAreaElement
          ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")
              ?.set
          : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

      valueSetter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
  }

  function normalizeText(element: Element | null) {
    return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
});
