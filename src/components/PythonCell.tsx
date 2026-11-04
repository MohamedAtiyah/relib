import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";
import { Play } from "lucide-react";
import { useState } from "react";
import { runPython } from "@/lib/python";
import type { PythonNode } from "./nodes";

export function PythonCell({ nodeKey, code, output }: { nodeKey: NodeKey; code: string; output: string }) {
  const [editor] = useLexicalComposerContext();
  const [running, setRunning] = useState(false);

  const save = (nextCode: string, nextOutput: string) =>
    editor.update(() => ($getNodeByKey(nodeKey) as PythonNode | null)?.set(nextCode, nextOutput));

  const run = async () => {
    setRunning(true);
    save(code, await runPython(code));
    setRunning(false);
  };

  return (
    <div className="my-2 overflow-hidden rounded-card border border-hairline bg-surface">
      <div className="flex items-center justify-between bg-sand px-3 py-1.5 text-xs text-muted">
        <span>Python</span>
        <button onClick={run} disabled={running || !code.trim()} className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-paper disabled:opacity-50">
          <Play size={12} strokeWidth={1.5} /> {running ? "Running…" : "Run"}
        </button>
      </div>
      <textarea
        value={code}
        onChange={(e) => save(e.target.value, output)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey || e.shiftKey)) {
            e.preventDefault();
            run();
          }
        }}
        aria-label="Python code"
        placeholder="print(1 + 1)   ⇧↵ to run"
        spellCheck={false}
        rows={3}
        className="block min-h-[4.5rem] w-full resize-none bg-transparent px-3 py-2 font-mono text-sm outline-none [field-sizing:content] placeholder:text-muted"
      />
      {output && (
        <pre aria-label="Output" aria-live="polite" className="max-h-64 overflow-auto border-t border-hairline px-3 py-2 font-mono text-xs whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}
