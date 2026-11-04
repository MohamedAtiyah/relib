import { $createCodeNode } from "@lexical/code";
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type ElementNode,
  type LexicalEditor,
} from "lexical";
import {
  Braces,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Minus,
  Network,
  NotebookPen,
  Quote,
  Settings2,
  SquareTerminal,
  Table,
  type LucideIcon,
} from "lucide-react";
import { $createCalloutNode, $createPythonNode, $createToggleNode } from "@/components/nodes";
import type { PageType } from "./schemas";

export type SlashContext = {
  openPanels(): void;
  openNeurolib(): void;
  openPreset(): void;
  newPage(type: PageType): void;
  explain(text: string): void;
};

export type SlashCommand = {
  name: string;
  keywords: string;
  icon: LucideIcon;
  run(editor: LexicalEditor, ctx: SlashContext): void;
};

const block = (create: () => ElementNode) => () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) $setBlocksType(selection, create);
};

export const COMMANDS: SlashCommand[] = [
  { name: "h1", keywords: "heading title", icon: Heading1, run: block(() => $createHeadingNode("h1")) },
  { name: "h2", keywords: "heading subtitle", icon: Heading2, run: block(() => $createHeadingNode("h2")) },
  { name: "h3", keywords: "heading", icon: Heading3, run: block(() => $createHeadingNode("h3")) },
  { name: "bullet", keywords: "list unordered", icon: List, run: (e) => e.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined) },
  { name: "numbered", keywords: "list ordered", icon: ListOrdered, run: (e) => e.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined) },
  { name: "todo", keywords: "check task list", icon: ListChecks, run: (e) => e.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined) },
  { name: "quote", keywords: "blockquote", icon: Quote, run: block($createQuoteNode) },
  { name: "snippet", keywords: "code block monospace", icon: Braces, run: block($createCodeNode) },
  {
    name: "code",
    keywords: "python run",
    icon: Code,
    run: () => $insertNodes([$createPythonNode(), $createParagraphNode()]),
  },
  { name: "divider", keywords: "rule line", icon: Minus, run: (e) => e.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined) },
  { name: "callout", keywords: "note highlight", icon: Info, run: block($createCalloutNode) },
  {
    name: "toggle",
    keywords: "collapse details",
    icon: ListTree,
    run() {
      const toggle = $createToggleNode();
      $insertNodes([toggle, $createParagraphNode()]);
      toggle.getFirstChildOrThrow().selectEnd();
    },
  },
  { name: "table", keywords: "grid", icon: Table, run: (e) => e.dispatchCommand(INSERT_TABLE_COMMAND, { rows: "3", columns: "3" }) },
  // these make a new page of that type in the folder, so they work from any line
  { name: "notes", keywords: "page lecture new", icon: NotebookPen, run: (_, ctx) => ctx.newPage("notes") },
  { name: "research", keywords: "page paper essay new", icon: FileText, run: (_, ctx) => ctx.newPage("research") },
  { name: "programming", keywords: "page project notebook new", icon: SquareTerminal, run: (_, ctx) => ctx.newPage("programming") },
  { name: "preset", keywords: "template title block sections citation", icon: Settings2, run: (_, ctx) => ctx.openPreset() },
  { name: "neurolib", keywords: "graph map bubbles", icon: Network, run: (_, ctx) => ctx.openNeurolib() },
];
