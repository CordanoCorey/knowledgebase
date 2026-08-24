// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HeaderSidebarPrototype } from "./HeaderSidebarPrototype";
import { LayoutPrototype } from "./LayoutPrototype";
import { SmartStorageWorkflowPrototype } from "./SmartStorageWorkflowPrototype";

describe("prototype variant switchers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("HeaderSidebarPrototype reads, switches, and keyboard-cycles variants", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/?prototype=header-sidebar&variant=B",
    );
    const toggleTheme = vi.fn();

    await act(async () => {
      root.render(<HeaderSidebarPrototype onToggleTheme={toggleTheme} theme="light" />);
    });

    expect(text()).toContain("B - Header with place menu");
    expect(text()).toContain("Arche Classical Academy");
    expect(text()).toContain("Administrator");
    expect(text()).toContain("Teacher");
    expect(text()).toContain("Role labels summarize every capacity");

    await click(getButton("Next variant"));
    expect(text()).toContain("C - Compact rail and drawer");
    expect(text()).toContain("On this page");
    expect(text()).toContain("Arche Classical Academy");
    expect(
      container.querySelector(
        '[aria-label="Active Roles: Administrator, Teacher, Parent"]',
      ),
    ).toBeTruthy();
    expect(window.location.search).toContain("variant=C");

    await keyDown("ArrowLeft");
    expect(text()).toContain("B - Header with place menu");

    const searchInput = container.querySelector("input");
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Missing prototype search input.");
    }
    await keyDown("ArrowLeft", searchInput);
    expect(text()).toContain("B - Header with place menu");
  });

  test("LayoutPrototype falls back to A and wraps from T to A", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/?prototype=layout&variant=unknown",
    );

    await act(async () => {
      root.render(<LayoutPrototype onToggleTheme={vi.fn()} theme="dark" />);
    });

    expect(text()).toContain("A - Command center");

    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/?prototype=layout&variant=T",
    );
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    expect(text()).toContain("T - Questions sage, Answers clay");
    await click(getButton("Next variant"));
    expect(text()).toContain("A - Command center");
    expect(window.location.search).toContain("variant=A");
  });

  test("SmartStorageWorkflowPrototype renders wizard variants and wraps from F to A", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/?prototype=smart-storage-workflow&variant=A",
    );

    await act(async () => {
      root.render(
        <SmartStorageWorkflowPrototype onToggleTheme={vi.fn()} theme="light" />,
      );
    });

    expect(text()).toContain("A - Focused Dialog");
    expect(text()).toContain("Accept required speaker first");
    expect(text()).toContain("Courage in Christ's Kingdom");

    await click(getButton("Next variant"));
    expect(text()).toContain("B - Session Map");
    expect(window.location.search).toContain("variant=B");

    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/?prototype=smart-storage-workflow&variant=E",
    );
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    expect(text()).toContain("E - Entry Continuation");
    await click(getButton("Next variant"));
    expect(text()).toContain("F - Full-screen Focus");
    expect(text()).toContain("Accept required speaker first");

    await click(getButton("Next variant"));
    expect(text()).toContain("A - Focused Dialog");
    expect(window.location.search).toContain("variant=A");
  });

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
  }

  async function keyDown(key: string, target: EventTarget = window) {
    await act(async () => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }),
      );
      await Promise.resolve();
    });
  }

  function getButton(label: string) {
    const button = container.querySelector(`button[aria-label="${label}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing button: ${label}`);
    }
    return button;
  }

  function text() {
    return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
});
