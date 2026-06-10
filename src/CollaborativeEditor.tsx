import { useEffect, useMemo, useRef, useState } from "react";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { AnyExtension, Content } from "@tiptap/core";
import {
  Bold,
  Cloud,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { api } from "../convex/_generated/api";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

type CollaborativeEditorProps = {
  documentId: string;
  headerActions?: React.ReactNode;
};

export function CollaborativeEditor({ documentId, headerActions }: CollaborativeEditorProps) {
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncOptions = useMemo(
    () => ({
      snapshotDebounceMs: 700,
      onSyncError: (error: Error) => setSyncError(error.message),
    }),
    [],
  );
  const sync = useTiptapSync(api.editor, documentId, syncOptions);
  const creating = useRef(false);

  useEffect(() => {
    if (sync.isLoading || sync.initialContent !== null || creating.current) {
      return;
    }
    creating.current = true;
    void sync.create(EMPTY_DOC).finally(() => {
      creating.current = false;
    });
  }, [sync]);

  if (sync.isLoading || sync.initialContent === null || sync.extension === null) {
    return (
      <section className="editor-panel editor-loading" aria-busy="true">
        <Cloud aria-hidden="true" />
        <span>Opening editor</span>
      </section>
    );
  }

  return (
    <SyncedEditor
      headerActions={headerActions}
      extension={sync.extension}
      initialContent={sync.initialContent}
      syncError={syncError}
    />
  );
}

type SyncedEditorProps = {
  extension: AnyExtension;
  headerActions?: React.ReactNode;
  initialContent: Content;
  syncError: string | null;
};

function SyncedEditor({
  extension,
  headerActions,
  initialContent,
  syncError,
}: SyncedEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        extension,
      ],
      content: initialContent,
      autofocus: "end",
      editorProps: {
        attributes: {
          class: "prose-editor",
          "aria-label": "Collaborative editor",
        },
      },
    },
    [extension],
  );

  return (
    <section className="editor-panel">
      <header className="editor-header">
        <div>
          <p className="eyebrow">Live document</p>
          <h1>Collaborative Editor</h1>
        </div>
        <div className="editor-header-actions">
          <div className="sync-state" data-error={syncError ? "true" : "false"}>
            <Cloud aria-hidden="true" />
            <span>{syncError ?? "Synced"}</span>
          </div>
          {headerActions}
        </div>
      </header>

      <EditorToolbar editor={editor} />
      <div className="editor-surface">
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  return (
    <div className="editor-toolbar" aria-label="Editor toolbar">
      <ToolButton
        label="Bold"
        active={editor?.isActive("bold")}
        disabled={!editor?.can().chain().focus().toggleBold().run()}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Italic"
        active={editor?.isActive("italic")}
        disabled={!editor?.can().chain().focus().toggleItalic().run()}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Heading 1"
        active={editor?.isActive("heading", { level: 1 })}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Heading 2"
        active={editor?.isActive("heading", { level: 2 })}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Bullet list"
        active={editor?.isActive("bulletList")}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={editor?.isActive("orderedList")}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Quote"
        active={editor?.isActive("blockquote")}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote aria-hidden="true" />
      </ToolButton>
      <span className="toolbar-divider" aria-hidden="true" />
      <ToolButton
        label="Undo"
        disabled={!editor?.can().chain().focus().undo().run()}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!editor?.can().chain().focus().redo().run()}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden="true" />
      </ToolButton>
    </div>
  );
}

type ToolButtonProps = {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

function ToolButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: ToolButtonProps) {
  return (
    <button
      aria-label={label}
      className="tool-button"
      data-active={active ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
