// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthPanel } from "./AuthPanel";

type SignInMock = (
  provider: string,
  options: FormData | { redirectTo: string },
) => Promise<void>;

const mocks = vi.hoisted(() => ({
  authAvailability: {
    google: true,
    password: true,
    passwordReset: true,
    resend: true,
  },
  signIn: vi.fn<SignInMock>(async () => undefined),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: mocks.signIn,
    signOut: async () => undefined,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.authAvailability,
}));

describe("AuthPanel", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    mocks.signIn.mockClear();
    mocks.authAvailability = {
      google: true,
      password: true,
      passwordReset: true,
      resend: true,
    };
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

  test("starts Google sign-in with the configured redirect", async () => {
    await renderAuthPanel({ redirectTo: "/profile" });

    await click(getButton("Continue with Google"));

    expect(mocks.signIn).toHaveBeenCalledWith("google", {
      redirectTo: "/profile",
    });
  });

  test("sends a magic link through Resend", async () => {
    await renderAuthPanel({ redirectTo: "/settings" });

    await click(getButton("Email link"));
    await setFieldValue(getInput("email"), "person@example.com");
    await click(getButton("Email me a link"));

    const call = mocks.signIn.mock.calls[0];
    const formData = call[1] as FormData;
    expect(call[0]).toBe("resend");
    expect(formData.get("email")).toBe("person@example.com");
    expect(formData.get("redirectTo")).toBe("/settings");
  });

  test("requests a reset code and verifies it with a new password", async () => {
    await renderAuthPanel();

    await click(getButton("Forgot password?"));
    await setFieldValue(getInput("email"), "person@example.com");
    await click(getButton("Send reset code"));

    const resetRequestCall = mocks.signIn.mock.calls[0];
    const resetRequestFormData = resetRequestCall[1] as FormData;
    expect(resetRequestCall[0]).toBe("password");
    expect(resetRequestFormData.get("flow")).toBe("reset");
    expect(resetRequestFormData.get("email")).toBe("person@example.com");

    await setFieldValue(getInput("code"), "123456");
    await setFieldValue(getInput("newPassword"), "new-password");
    await click(getButton("Reset password"));

    const resetVerificationCall = mocks.signIn.mock.calls[1];
    const resetVerificationFormData = resetVerificationCall[1] as FormData;
    expect(resetVerificationCall[0]).toBe("password");
    expect(resetVerificationFormData.get("flow")).toBe("reset-verification");
    expect(resetVerificationFormData.get("email")).toBe("person@example.com");
    expect(resetVerificationFormData.get("code")).toBe("123456");
    expect(resetVerificationFormData.get("newPassword")).toBe("new-password");
  });

  async function renderAuthPanel(props: { redirectTo?: string } = {}) {
    root = createRoot(container);
    await act(async () => {
      root?.render(<AuthPanel {...props} />);
    });
  }

  function getButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => normalizeText(candidate) === label,
    );
    if (!button) {
      throw new Error(`Missing button: ${label}`);
    }

    return button;
  }

  function getInput(name: string) {
    const input = container.querySelector(`input[name="${name}"]`);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Missing input: ${name}`);
    }

    return input;
  }

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
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

  function normalizeText(element: Element | null) {
    return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
});
