import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorText, post } from "@/lib/api";
import type { Folder } from "@/lib/schemas";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = ["Explain the main idea on this page", "Write my notes for me"];

export function ChatPanel({ folder, role, notes, sources }: { folder: Folder; role: string; notes: string; sources: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (content: string) => {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: content.trim().slice(0, 4000) }].slice(-20) as Msg[];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const { reply } = await post<{ reply: string }>("chat", { notes, sources: sources.slice(0, 100), role, messages: next });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  return (
    <aside aria-label="Relib v1" className="flex w-72 shrink-0 flex-col border-r border-hairline">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="h-2 w-2 rounded-full bg-spark" aria-hidden="true" />
          Relib v1
        </h2>
        <span className="chip">{role}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 text-sm" aria-live="polite">
        {!messages.length && (
          <>
            <p className="text-muted">
              Your {role.toLowerCase()} for {folder.name}. Explains, questions and finds. It will not write your notes.
            </p>
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-card border border-hairline px-3 py-2 text-left text-xs hover:bg-sand">
                {s}
              </button>
            ))}
          </>
        )}
        {messages.map((m, i) => (
          <p key={i} className={`rounded-card px-3 py-2 whitespace-pre-wrap ${m.role === "user" ? "ml-6 bg-sand" : "border border-hairline bg-surface"}`}>
            {m.content}
          </p>
        ))}
        {busy && <p className="text-muted">Thinking…</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Ask Relib v1"
          placeholder="Ask about a concept"
          className="min-w-0 flex-1 rounded-card border border-hairline bg-surface px-3 py-2 text-sm placeholder:text-muted"
        />
        <button type="submit" aria-label="Send" disabled={busy} className="rounded-card p-2 text-muted hover:bg-sand">
          <Send size={18} strokeWidth={1.5} />
        </button>
      </form>
    </aside>
  );
}
