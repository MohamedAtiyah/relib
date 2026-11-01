import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorText, post } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = ["Explain price elasticity of demand", "Write my notes on supply and demand for me"];

export function ChatPanel({ notes, sources }: { notes: string; sources: string[] }) {
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
      const { reply } = await post<{ reply: string }>("chat", { notes, sources: sources.slice(0, 100), messages: next });
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
    <aside aria-label="Tutor" className="flex w-72 shrink-0 flex-col border-r border-hairline">
      <div className="flex h-14 items-center px-4">
        <h2 className="font-display text-lg font-semibold">Tutor</h2>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 text-sm" aria-live="polite">
        {!messages.length && (
          <>
            <p className="text-muted">Explains and quizzes. It will not write your notes.</p>
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-card border border-hairline px-3 py-2 text-left text-xs hover:bg-sand">
                {s}
              </button>
            ))}
          </>
        )}
        {messages.map((m, i) => (
          <p key={i} className={`whitespace-pre-wrap rounded-card px-3 py-2 ${m.role === "user" ? "ml-6 bg-sand" : "border border-hairline bg-surface"}`}>
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
          aria-label="Ask the tutor"
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
