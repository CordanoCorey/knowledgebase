// @vitest-environment happy-dom

import { getFunctionName } from "convex/server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  formatClaimResult,
  OrganizationAccessRequestScreen,
} from "./OrganizationAccessRequest";

const claimMock = vi.hoisted(() => ({
  actionCalls: [] as Array<Record<string, unknown>>,
  claimVerifiedEmailMemberships: vi.fn(),
  mutationCalls: [] as Array<Record<string, unknown>>,
  sendEmailVerificationCode: vi.fn(),
  signOut: vi.fn(),
  verifyEmailAndClaimPendingMemberships: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signOut: claimMock.signOut,
  }),
}));

vi.mock("convex/react", () => ({
  useAction: (action: unknown) => async (args: Record<string, unknown>) => {
    claimMock.actionCalls.push({
      ...args,
      functionName: getFunctionName(
        action as Parameters<typeof getFunctionName>[0],
      ),
    });
    return await claimMock.sendEmailVerificationCode(args);
  },
  useMutation: (mutation: unknown) => {
    const functionName = getFunctionName(
      mutation as Parameters<typeof getFunctionName>[0],
    );
    if (functionName === "contactIdentities:claimVerifiedEmailMemberships") {
      return async (args: Record<string, unknown>) => {
        claimMock.mutationCalls.push({ ...args, functionName });
        return await claimMock.claimVerifiedEmailMemberships(args);
      };
    }

    return async (args: Record<string, unknown>) => {
      claimMock.mutationCalls.push({ ...args, functionName });
      return await claimMock.verifyEmailAndClaimPendingMemberships(args);
    };
  },
}));

describe("formatClaimResult", () => {
  test("formats claimed, review, rejection, and empty claim results", () => {
    expect(formatClaimResult({ claimedMembershipCount: 1 })).toBe(
      "1 membership claimed.",
    );
    expect(
      formatClaimResult({
        claimedMembershipCount: 2,
        personConsolidationReviewCount: 1,
        personConsolidationRejectionCount: 2,
      }),
    ).toBe(
      "2 memberships claimed. 1 membership needs identity review. 2 memberships were not approved after identity review. Contact the organization admin.",
    );
    expect(formatClaimResult({ claimedMembershipCount: 0 })).toBe(
      "Email verified. No pending memberships found.",
    );
  });
});

describe("OrganizationAccessRequestScreen", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    claimMock.actionCalls = [];
    claimMock.mutationCalls = [];
    claimMock.claimVerifiedEmailMemberships.mockResolvedValue({
      claimedMembershipCount: 1,
    });
    claimMock.sendEmailVerificationCode.mockResolvedValue({
      email: "teacher@example.com",
      verificationStatus: "pending",
    });
    claimMock.signOut.mockResolvedValue(undefined);
    claimMock.verifyEmailAndClaimPendingMemberships.mockResolvedValue({
      claimedMembershipCount: 2,
      personConsolidationReviewCount: 1,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  test("renders blocked-access copy and prefilled create/join mailto links", async () => {
    await render();

    expect(text()).toContain("Create or join an organization");
    expect(text()).toContain("Signed in as blocked@example.com");
    expect(text()).toContain(
      "This Logeion account needs an active organization membership",
    );

    expect(getLink("Request to join").href).toContain(
      "subject=Logeion%20organization%20join%20request",
    );
    expect(decodeURIComponent(getLink("Request to join").href)).toContain(
      "Account: blocked@example.com",
    );
    expect(getLink("Request to create").href).toContain(
      "subject=Logeion%20organization%20creation%20request",
    );
  });

  test("requests a claim code and then verifies it", async () => {
    await render();
    await setFieldValue(getInput("claimEmail"), " Teacher@Example.com ");
    await submitForm(getInput("claimEmail"));

    expect(claimMock.actionCalls).toContainEqual(
      expect.objectContaining({
        email: "Teacher@Example.com",
        functionName: "contactIdentities:sendEmailVerificationCode",
      }),
    );
    expect(text()).toContain("Verification code requested.");
    expect(getInput("claimCode").disabled).toBe(false);

    await setFieldValue(getInput("claimCode"), "123456");
    await submitForm(getInput("claimCode"));

    expect(claimMock.mutationCalls).toContainEqual(
      expect.objectContaining({
        code: "123456",
        email: "teacher@example.com",
        functionName: "contactIdentities:verifyEmailAndClaimPendingMemberships",
      }),
    );
    expect(text()).toContain("2 memberships claimed.");
    expect(text()).toContain("1 membership needs identity review.");
  });

  test("claims memberships immediately when the email is already verified", async () => {
    claimMock.sendEmailVerificationCode.mockResolvedValue({
      email: "verified@example.com",
      verificationStatus: "verified",
    });
    claimMock.claimVerifiedEmailMemberships.mockResolvedValue({
      claimedMembershipCount: 0,
    });

    await render();
    await setFieldValue(getInput("claimEmail"), "verified@example.com");
    await submitForm(getInput("claimEmail"));

    expect(claimMock.mutationCalls).toContainEqual(
      expect.objectContaining({
        email: "verified@example.com",
        functionName: "contactIdentities:claimVerifiedEmailMemberships",
      }),
    );
    expect(text()).toContain("Email verified. No pending memberships found.");
  });

  test("shows action errors without enabling the verification form", async () => {
    claimMock.sendEmailVerificationCode.mockRejectedValue(
      new Error("Email is already owned by another account."),
    );

    await render();
    await setFieldValue(getInput("claimEmail"), "taken@example.com");
    await submitForm(getInput("claimEmail"));

    expect(text()).toContain("Email is already owned by another account.");
    expect(getInput("claimCode").disabled).toBe(true);
  });

  async function render() {
    await act(async () => {
      root.render(
        <OrganizationAccessRequestScreen
          email="blocked@example.com"
          reason="needsOrganization"
        />,
      );
    });
  }

  function getInput(name: string) {
    const input = container.querySelector(`input[name="${name}"]`);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Missing input: ${name}`);
    }
    return input;
  }

  function getLink(label: string) {
    const link = Array.from(container.querySelectorAll("a")).find(
      (candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === label,
    );
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error(`Missing link: ${label}`);
    }
    return link;
  }

  async function setFieldValue(element: HTMLInputElement, value: string) {
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function submitForm(element: HTMLInputElement) {
    await act(async () => {
      element.form?.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function text() {
    return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
});
