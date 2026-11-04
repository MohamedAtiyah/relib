import { useMemo } from "react";
import { highlightCode, LANGUAGES, type Language } from "@/lib/lang";

// A plain code editor: line numbers, highlighted text underneath, a textarea on top that takes the typing.
export function CodeEditor({
  value,
  language,
  onChange,
  onRun,
  className = "max-h-[28rem]",
}: {
  value: string;
  language: Language | null;
  onChange(value: string): void;
  onRun?(): void;
  className?: string;
}) {
  const lines = value.split("\n");
  const highlighted = useMemo(() => (language ? highlightCode(value, language) : value.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)), [value, language]);
  return (
    <div className={`flex overflow-auto text-sm leading-6 ${className}`}>
      <div aria-hidden="true" className="shrink-0 py-2 pr-2 pl-3 text-right text-[var(--code-muted)] select-none">
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        {/* highlight.js escapes the code it marks up */}
        <pre aria-hidden="true" className="hljs pointer-events-none m-0 bg-transparent py-2 pr-3 whitespace-pre" dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }} />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey || e.shiftKey) && onRun) {
              e.preventDefault();
              onRun();
            }
            if (e.key === "Tab") {
              e.preventDefault();
              const t = e.currentTarget;
              const at = t.selectionStart;
              onChange(`${value.slice(0, at)}  ${value.slice(t.selectionEnd)}`);
              requestAnimationFrame(() => t.setSelectionRange(at + 2, at + 2));
            }
          }}
          aria-label={`${language ? LANGUAGES[language] : "Plain"} code`}
          placeholder={onRun ? "Paste or type code. ⇧↵ runs it." : "Type here."}
          spellCheck={false}
          wrap="off"
          className="absolute inset-0 resize-none overflow-hidden bg-transparent py-2 pr-3 whitespace-pre text-transparent caret-[var(--code-fg)] outline-none placeholder:text-[var(--code-muted)]"
        />
      </div>
    </div>
  );
}
