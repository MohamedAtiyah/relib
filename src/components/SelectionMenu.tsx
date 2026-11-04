import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW } from "lexical";
import { GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// A small button over selected text: "Explain from my materials".
export function SelectionMenu({ onExplain }: { onExplain(text: string): void }) {
  const [editor] = useLexicalComposerContext();
  const [at, setAt] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const update = () => {
      const selection = $getSelection();
      const text = $isRangeSelection(selection) ? selection.getTextContent().trim() : "";
      const range = text.length >= 3 ? window.getSelection()?.getRangeAt(0) : undefined;
      const box = range?.getBoundingClientRect();
      setAt(box && box.width ? { x: box.left + box.width / 2, y: box.top, text } : null);
      return false;
    };
    return editor.registerCommand(SELECTION_CHANGE_COMMAND, update, COMMAND_PRIORITY_LOW);
  }, [editor]);

  if (!at) return null;
  return createPortal(
    <button
      onMouseDown={(e) => e.preventDefault()} // keep the selection
      onClick={() => {
        onExplain(at.text);
        setAt(null);
      }}
      style={{ left: at.x, top: at.y - 40 }}
      className="fixed z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs text-paper"
    >
      <GraduationCap size={14} strokeWidth={1.5} /> Explain from my materials
    </button>,
    document.body,
  );
}
