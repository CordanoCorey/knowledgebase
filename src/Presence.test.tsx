// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Presence } from "./Presence";

describe("Presence", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  test("renders entering content and keeps exiting content until the duration elapses", async () => {
    await render(true, 50);
    expect(container.textContent).toBe("enter");

    await render(false, 50);
    expect(container.textContent).toBe("exit");

    act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(container.textContent).toBe("exit");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.textContent).toBe("");
  });

  test("cancels a pending exit when content becomes present again", async () => {
    await render(true, 50);
    await render(false, 50);

    act(() => {
      vi.advanceTimersByTime(25);
    });
    await render(true, 50);

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(container.textContent).toBe("enter");
  });

  test("starts hidden when not present and enters later", async () => {
    await render(false, 50);
    expect(container.textContent).toBe("");

    await render(true, 50);
    expect(container.textContent).toBe("enter");
  });

  async function render(present: boolean, durationMs: number) {
    await act(async () => {
      root.render(
        <Presence durationMs={durationMs} present={present}>
          {(presenceState) => <span>{presenceState}</span>}
        </Presence>,
      );
    });
  }
});
