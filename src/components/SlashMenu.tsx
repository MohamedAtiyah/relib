import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $insertNodes, $createParagraphNode } from "lexical";
import { BookMarked } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { COMMANDS, type SlashCommand, type SlashContext } from "@/lib/commands";
import type { Source } from "@/lib/schemas";
import { $createSourceNode } from "./nodes";

class SlashOption extends MenuOption {
  command: SlashCommand;
  constructor(command: SlashCommand) {
    super(command.name);
    this.command = command;
  }
}

const sourceCommands = (sources: Source[]): SlashCommand[] =>
  sources.length
    ? sources.map((source) => ({
        name: `source: ${source.title}`,
        keywords: "citation reference",
        icon: BookMarked,
        run: () => $insertNodes([$createSourceNode(source), $createParagraphNode()]),
      }))
    : [{ name: "source", keywords: "citation reference accept one first", icon: BookMarked, run: (_, ctx) => ctx.openPanels() }];

export function SlashMenu({ ctx, sources }: { ctx: SlashContext; sources: Source[] }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const trigger = useBasicTypeaheadTriggerMatch("/", { minLength: 0 });

  const options = useMemo(() => {
    const q = (query ?? "").toLowerCase();
    return [...COMMANDS, ...sourceCommands(sources)]
      .filter((c) => `${c.name} ${c.keywords}`.toLowerCase().includes(q))
      .map((c) => new SlashOption(c));
  }, [query, sources]);

  return (
    <LexicalTypeaheadMenuPlugin<SlashOption>
      onQueryChange={setQuery}
      triggerFn={trigger}
      options={options}
      onSelectOption={(option, textNode, closeMenu) => {
        editor.update(() => {
          textNode?.remove();
          option.command.run(editor, ctx);
          closeMenu();
        });
      }}
      menuRenderFn={(anchor, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchor.current && options.length
          ? createPortal(
              <ul
                role="listbox"
                aria-label="Commands"
                className="mt-6 max-h-72 w-72 overflow-y-auto rounded-card border border-hairline bg-surface p-1"
              >
                {options.map((option, i) => {
                  const Icon = option.command.icon;
                  return (
                    <li
                      key={option.key}
                      ref={option.setRefElement}
                      role="option"
                      aria-selected={selectedIndex === i}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onClick={() => selectOptionAndCleanUp(option)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${selectedIndex === i ? "bg-sand" : ""}`}
                    >
                      <Icon size={16} strokeWidth={1.5} className="shrink-0 text-muted" />
                      <span className="truncate">/{option.command.name}</span>
                    </li>
                  );
                })}
              </ul>,
              anchor.current,
            )
          : null
      }
    />
  );
}
