import { ChevronLeft, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TutorTopic } from "@/lib/agent/tutor";
import { errorText, post } from "@/lib/api";
import type { Folder } from "@/lib/schemas";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = ["Explain the main idea on this page", "Write my notes for me"];
const TOPIC_PAUSE = 4000; // after the student stops typing
const TOPIC_CHANGE = 150; // characters of new writing before the topic is worked out again

export function ChatPanel({
  folder,
  role,
  notes,
  sources,
  ask,
  onClose,
}: {
  folder: Folder;
  role: string;
  notes: string;
  sources: string[];
  ask?: { text: string; at: number };
  onClose(): void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<TutorTopic | null>(null);
  const topicFor = useRef(0);

  const send = async (content: string) => {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: content.trim().slice(0, 4000) }].slice(-20) as Msg[];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const { reply } = await post<{ reply: string }>("chat", { notes, sources: sources.slice(0, 100), role, folderId: folder.id, messages: next });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  };

  // "Explain from my materials" on a selection in the editor
  const asked = useRef(0);
  useEffect(() => {
    if (!ask || ask.at === asked.current) return;
    asked.current = ask.at;
    send(`Explain this from my materials and sources, citing the slide, page or source: "${ask.text.slice(0, 1500)}"`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request
  }, [ask]);

  // The topic-aware tutor: narrows to what the student is writing about, after a pause.
  useEffect(() => {
    if (notes.length < 80 || Math.abs(notes.length - topicFor.current) < TOPIC_CHANGE) return;
    const timer = setTimeout(async () => {
      topicFor.current = notes.length;
      try {
        setTopic(await post<TutorTopic>("topic", { notes, sources: sources.slice(0, 50), folderId: folder.id }));
      } catch {
        topicFor.current = 0; // try again on the next pause
      }
    }, TOPIC_PAUSE);
    return () => clearTimeout(timer);
  }, [notes, sources, folder.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  return (
    <aside aria-label="Relib v1" className="flex w-80 shrink-0 flex-col border-r border-hairline">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <button onClick={onClose} aria-label="Back to folders" title="Back to folders" className="rounded-lg p-1 text-muted hover:bg-sand">
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
        <h2 className="mr-auto flex items-center gap-2 font-display text-lg font-semibold">
          <span className="h-2 w-2 rounded-full bg-spark" aria-hidden="true" />
          Relib v1
        </h2>
        <span className="text-xs text-muted">{role}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 text-sm" aria-live="polite">
        {topic && (
          <section aria-label="Current topic" className="space-y-2 rounded-card border border-hairline bg-surface p-3">
            <span className="chip" title="What the tutor thinks you are writing about">
              {topic.topic} · {topic.subject}
            </span>
            <p>{topic.explanation}</p>
            {topic.connections.length > 0 && (
              <div>
                <h3 className="label">How it connects</h3>
                <ul className="mt-1 space-y-1">
                  {topic.connections.map((c) => (
                    <li key={c.field}>
                      <span className="font-medium">{c.field}:</span> {c.why}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topic.next.length > 0 && (
              <div>
                <h3 className="label">Look at next</h3>
                <ul className="mt-1 list-disc pl-4">
                  {topic.next.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            {topic.citations.length > 0 && <p className="text-xs text-spark-ink">From: {topic.citations.join("; ")}</p>}
          </section>
        )}
        {!messages.length && (
          <>
            <p className="text-muted">
              Your {role.toLowerCase()} for {folder.name}. Explains from your materials and sources, and cites them. It will not write your notes.
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
        {busy && (
          <p className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-spark" aria-hidden="true" /> Thinking…
          </p>
        )}
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
