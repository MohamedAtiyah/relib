import { $createCodeNode } from "@lexical/code";
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
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
  Quote,
  Settings2,
  Table,
  type LucideIcon,
} from "lucide-react";
import { $createCalloutNode, $createPythonNode, $createToggleNode } from "@/components/nodes";
import { DEFAULT_PRESET } from "./db";
import type { Preset } from "./schemas";

export type SlashContext = {
  openPanels(): void;
  openNeurolib(): void;
  openPreset(): void;
  preset(): Preset | undefined;
  pageTitle(): string;
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

// The title block from the saved preset: the page title and today's date fill in when the preset leaves them blank.
function $titleBlock(preset: Preset, title: string) {
  const fill: Record<string, string> = { title, date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) };
  const lines = [
    ...preset.fields.map((f) => `${f.label}: ${f.value || fill[f.label.toLowerCase()] || ""}`),
    `Citation style: ${preset.citationStyle}`,
  ];
  return $createCalloutNode().append(...lines.flatMap((line, i): LexicalNode[] => (i ? [$createLineBreakNode(), $createTextNode(line)] : [$createTextNode(line)])));
}

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
  {
    name: "research",
    keywords: "paper template report preset",
    icon: FileText,
    run(_, ctx) {
      const preset = ctx.preset() ?? DEFAULT_PRESET;
      $insertNodes([
        $titleBlock(preset, ctx.pageTitle()),
        ...preset.sections.flatMap((title) => [$createHeadingNode("h2").append($createTextNode(title)), $createParagraphNode()]),
      ]);
      ctx.openPanels();
    },
  },
  { name: "preset", keywords: "template title block sections citation", icon: Settings2, run: (_, ctx) => ctx.openPreset() },
  { name: "neurolib", keywords: "graph map bubbles", icon: Network, run: (_, ctx) => ctx.openNeurolib() },
];
