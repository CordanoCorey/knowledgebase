// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CollaborativeEditor } from "./CollaborativeEditor";

type SyncState = {
  create: ReturnType<typeof vi.fn>;
  extension: unknown;
  initialContent: unknown;
  isLoading: boolean;
};

type EditorMock = {
  can: () => { chain: () => CommandChain };
  chain: () => CommandChain;
  commandCalls: string[];
  isActive: ReturnType<typeof vi.fn>;
};

type CommandChain = {
  focus: () => CommandChain;
  redo: () => CommandChain;
  run: () => boolean;
  toggleBlockquote: () => CommandChain;
  toggleBold: () => CommandChain;
  toggleBulletList: () => CommandChain;
  toggleHeading: (options: { level: number }) => CommandChain;
  toggleItalic: () => CommandChain;
  toggleOrderedList: () => CommandChain;
  undo: () => CommandChain;
};

const editorHarness = vi.hoisted(() => ({
  editor: null as EditorMock | null,
  lastEditorOptions: null as Record<string, unknown> | null,
  lastSyncOptions: null as { onSyncError?: (error: Error) => void } | null,
  sync: null as SyncState | null,
  syncCalls: [] as Array<{ documentId: string }>,
}));

vi.mock("@convex-dev/prosemirror-sync/tiptap", () => ({
  useTiptapSync: (_api: unknown, documentId: string, options: unknown) => {
    editorHarness.lastSyncOptions = options as { onSyncError?: (error: Error) => void };
    editorHarness.syncCalls.push({ documentId });
    return editorHarness.sync;
  },
}));

vi.mock("@tiptap/react", async () => {
  const React = await import("react");

  return {
    EditorContent: ({ editor }: { editor: unknown }) =>
      React.createElement("div", {
        "aria-label": "Mock editor content",
        "data-editor-ready": editor ? "true" : "false",
      }),
    useEditor: (options: Record<string, unknown>) => {
      editorHarness.lastEditorOptions = options;
      return editorHarness.editor;
    },
  };
});

vi.mock("@tiptap/starter-kit", () => ({
  default: "StarterKit",
}));

describe("CollaborativeEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    editorHarness.editor = createEditorMock();
    editorHarness.lastEditorOptions = null;
    editorHarness.lastSyncOptions = null;
    editorHarness.sync = {
      create: vi.fn().mockResolvedValue(undefined),
      extension: { name: "sync-extension" },
      initialContent: { type: "doc", content: [{ type: "paragraph" }] },
      isLoading: false,
    };
    editorHarness.syncCalls = [];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  test("renders a loading shell while sync state is not ready", async () => {
    editorHarness.sync = {
      create: vi.fn(),
      extension: null,
      initialContent: null,
      isLoading: true,
    };

    await render();

    expect(text()).toContain("Opening Logeion editor");
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(editorHarness.sync?.create).not.toHaveBeenCalled();
  });

  test("creates an empty synced document when no initial content exists", async () => {
    editorHarness.sync = {
      create: vi.fn().mockResolvedValue(undefined),
      extension: null,
      initialContent: null,
      isLoading: false,
    };

    await render();
    await flushAsyncWork();

    expect(editorHarness.sync.create).toHaveBeenCalledWith({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(text()).toContain("Opening Logeion editor");
  });

  test("renders synced editor chrome, header actions, and toolbar command wiring", async () => {
    await render(<button type="button">Extra action</button>);

    expect(editorHarness.syncCalls).toEqual([{ documentId: "doc-123" }]);
    expect(editorHarness.lastEditorOptions).toMatchObject({
      autofocus: "end",
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(text()).toContain("Logeion Editor");
    expect(text()).toContain("Synced");
    expect(text()).toContain("Extra action");
    expect(container.querySelector('[aria-label="Mock editor content"]')).toBeTruthy();

    await click(getButton("Bold"));
    await click(getButton("Heading 1"));
    await click(getButton("Undo"));

    expect(editorHarness.editor?.commandCalls).toEqual(
      expect.arrayContaining(["toggleBold", "toggleHeading:1", "undo"]),
    );
  });

  test("displays sync errors reported by the sync hook", async () => {
    await render();

    await act(async () => {
      editorHarness.lastSyncOptions?.onSyncError?.(
        new Error("Snapshot upload failed"),
      );
    });

    expect(text()).toContain("Snapshot upload failed");
    expect(container.querySelector(".sync-state")?.getAttribute("data-error")).toBe(
      "true",
    );
  });

  async function render(headerActions?: React.ReactNode) {
    await act(async () => {
      root.render(
        <CollaborativeEditor documentId="doc-123" headerActions={headerActions} />,
      );
    });
  }

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
  }

  async function flushAsyncWork() {
    await act(async () => {
      await Promise.resolve();
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

function createEditorMock(): EditorMock {
  const commandCalls: string[] = [];
  const chain: CommandChain = {
    focus: () => chain,
    redo: () => {
      commandCalls.push("redo");
      return chain;
    },
    run: () => true,
    toggleBlockquote: () => {
      commandCalls.push("toggleBlockquote");
      return chain;
    },
    toggleBold: () => {
      commandCalls.push("toggleBold");
      return chain;
    },
    toggleBulletList: () => {
      commandCalls.push("toggleBulletList");
      return chain;
    },
    toggleHeading: ({ level }) => {
      commandCalls.push(`toggleHeading:${level}`);
      return chain;
    },
    toggleItalic: () => {
      commandCalls.push("toggleItalic");
      return chain;
    },
    toggleOrderedList: () => {
      commandCalls.push("toggleOrderedList");
      return chain;
    },
    undo: () => {
      commandCalls.push("undo");
      return chain;
    },
  };

  return {
    can: () => ({ chain: () => chain }),
    chain: () => chain,
    commandCalls,
    isActive: vi.fn(() => false),
  };
}
