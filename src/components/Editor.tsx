"use client";

import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { TRANSFORMERS } from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $findMatchingParent } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  type EditorState,
} from "lexical";
import { useEffect, useRef } from "react";
import type { SlashContext } from "@/lib/commands";
import { db } from "@/lib/db";
import type { Page, Source } from "@/lib/schemas";
import { $isToggleNode, CalloutNode, SourceNode, ToggleNode } from "./nodes";
import { SlashMenu } from "./SlashMenu";

const theme = {
  code: "rl-code",
  list: {
    ul: "rl-ul",
    ol: "rl-ol",
    nested: { listitem: "rl-nested" },
    listitemChecked: "rl-todo-on",
    listitemUnchecked: "rl-todo-off",
  },
  table: "rl-table",
  hr: "rl-hr",
  hrSelected: "selected",
  text: { bold: "rl-bold", italic: "rl-italic", underline: "rl-underline", strikethrough: "rl-strike" },
};

const nodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  HorizontalRuleNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  CalloutNode,
  ToggleNode,
  SourceNode,
];

function SavePlugin({ pageId }: { pageId: string }) {
  const pending = useRef<EditorState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = () => {
    const state = pending.current;
    if (!state) return;
    pending.current = null;
    db.pages.update(pageId, {
      editorState: JSON.stringify(state.toJSON()),
      plainText: state.read(() => $getRoot().getTextContent()),
      updatedAt: Date.now(),
    });
  };

  // switching pages unmounts the editor; the last keystrokes must still save
  useEffect(() => () => {
    clearTimeout(timer.current);
    flush();
  });

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(state) => {
        pending.current = state;
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, 400);
      }}
    />
  );
}

// Cmd/Ctrl+Enter opens and closes a toggle, so it works without a mouse.
function ToggleKeyPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!event || !$isRangeSelection(selection)) return false;
          const toggle = $findMatchingParent(selection.anchor.getNode(), $isToggleNode);
          if (!$isToggleNode(toggle)) return false;
          if (!event.metaKey && !event.ctrlKey) {
            if (toggle.isClosed()) toggle.toggle(); // a new line typed into a closed toggle would vanish
            return false;
          }
          event.preventDefault();
          toggle.toggle();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  );
  return null;
}

export function Editor({ page, ctx, sources }: { page: Page; ctx: SlashContext; sources: Source[] }) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "relib",
        theme,
        nodes,
        editorState: page.editorState || undefined,
        onError: (error) => {
          throw error;
        },
      }}
    >
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="rl-editor"
              aria-label="Notes"
              aria-placeholder="Write, or press / for commands"
              placeholder={
                <p className="pointer-events-none absolute top-0 left-0 mt-[0.35em] text-muted">
                  Write, or press / for commands
                </p>
              }
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <CheckListPlugin />
      <LinkPlugin />
      <TablePlugin />
      <HorizontalRulePlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <SlashMenu ctx={ctx} sources={sources} />
      <ToggleKeyPlugin />
      <SavePlugin pageId={page.id} />
    </LexicalComposer>
  );
}
