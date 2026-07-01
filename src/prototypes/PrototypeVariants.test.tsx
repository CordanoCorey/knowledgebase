// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HeaderSidebarPrototype } from "./HeaderSidebarPrototype";
import { LayoutPrototype } from "./LayoutPrototype";

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
      "http://localhost:3000/?prototype=header-sidebar&variant=D",
    );
    const toggleTheme = vi.fn();

    await act(async () => {
      root.render(<HeaderSidebarPrototype onToggleTheme={toggleTheme} theme="light" />);
    });

    expect(text()).toContain("D - Knowledge shelf header");
    expect(text()).toContain("Arche Classical Academy");

    await click(getButton("Next variant"));
    expect(text()).toContain("E - Command bar shell");
    expect(window.location.search).toContain("variant=E");

    await keyDown("ArrowLeft");
    expect(text()).toContain("D - Knowledge shelf header");

    const searchInput = container.querySelector("input");
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Missing prototype search input.");
    }
    await keyDown("ArrowLeft", searchInput);
    expect(text()).toContain("D - Knowledge shelf header");
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
