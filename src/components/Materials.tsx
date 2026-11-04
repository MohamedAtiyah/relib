import { ChevronLeft, FileUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, errorText, post } from "@/lib/api";
import { MAX_FILE } from "@/lib/files";

type Concept = { name: string; explanation: string; location: string };
type Material = { id: string; filename: string; kind: string; size: number; concepts: Concept[] | null; createdAt: number };

const ACCEPT = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const uploadError = (err: unknown) => {
  const code = err instanceof Error ? err.message : "";
  if (code === "storage_off") return "File storage is not set up on this server yet.";
  if (code === "too_large") return "Files can be up to 20 MB.";
  if (code === "put_failed") return "The upload was refused. The storage bucket may need CORS for this site.";
  return errorText(err);
};

// Lecture slides, readings and spreadsheets for this folder. Text is read on the server with its slide or page.
export function Materials({ folderId, userId }: { folderId: string; userId?: string }) {
  const [files, setFiles] = useState<Material[]>();
  const [open, setOpen] = useState<Material | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetch(`/api/files?folderId=${encodeURIComponent(folderId)}`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d: { files: Material[] }) => live && setFiles(d.files))
      .catch(() => live && setFiles([]));
    return () => {
      live = false;
    };
  }, [userId, folderId]);

  const upload = async (file: File) => {
    if (!ACCEPT.includes(file.type)) return setStatus("PDF, PowerPoint, Word or Excel files only.");
    if (file.size > MAX_FILE) return setStatus("Files can be up to 20 MB.");
    try {
      setStatus(`Uploading ${file.name}…`);
      const { key, url } = await post<{ key: string; url: string }>("files/upload", { filename: file.name, size: file.size, mime: file.type });
      const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } }).catch(() => null);
      if (!put?.ok) throw new ApiError("put_failed");
      setStatus("Reading it and finding the key concepts…");
      const { file: saved } = await post<{ file: Material }>("files", { key, folderId, filename: file.name, mime: file.type });
      setFiles((list) => [...(list ?? []), saved]);
      setOpen(saved);
      setStatus(null);
    } catch (err) {
      setStatus(uploadError(err));
    }
  };

  const remove = async (file: Material) => {
    if (!window.confirm(`Delete ${file.filename}? This cannot be undone.`)) return;
    const res = await fetch(`/api/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) return setStatus("Could not delete the file. Try again.");
    setOpen(null);
    setFiles((list) => list?.filter((f) => f.id !== file.id));
  };

  return (
    <section aria-label="Materials" className="flex max-h-[45%] min-h-40 flex-col border-t border-hairline">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        {open ? (
          <button onClick={() => setOpen(null)} className="flex min-w-0 items-center gap-1 text-sm font-medium">
            <ChevronLeft size={16} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{open.filename}</span>
          </button>
        ) : (
          <h2 className="font-display text-lg font-semibold">Materials</h2>
        )}
        {userId && !open && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT.join(",")}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
            <button onClick={() => input.current?.click()} aria-label="Upload material" title="Upload PDF, PowerPoint, Word or Excel (20 MB max)" className="rounded-lg p-1.5 text-muted hover:bg-surface">
              <FileUp size={16} strokeWidth={1.5} />
            </button>
          </>
        )}
        {open && (
          <button onClick={() => remove(open)} aria-label={`Delete ${open.filename}`} title="Delete file" className="rounded-lg p-1.5 text-muted hover:bg-surface">
            <Trash2 size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 text-sm">
        {status && <p role="status" className="text-xs text-muted">{status}</p>}
        {!userId && <p className="text-muted">Sign in to upload your slides, readings and spreadsheets. The tutor then explains from them and cites the slide or page.</p>}
        {userId && !open && files?.length === 0 && <p className="text-muted">Upload lecture slides, readings or spreadsheets (PDF, PowerPoint, Word, Excel; 20 MB each).</p>}
        {!open &&
          files?.map((f) => (
            <button key={f.id} onClick={() => setOpen(f)} className="flex w-full items-center justify-between gap-2 rounded-card border border-hairline bg-surface px-3 py-2 text-left hover:border-ink">
              <span className="truncate">{f.filename}</span>
              <span className="label shrink-0">{f.kind}</span>
            </button>
          ))}
        {open && (
          <>
            <a href={`/api/files/${encodeURIComponent(open.id)}`} target="_blank" rel="noreferrer" className="text-xs text-muted underline hover:text-ink">
              Open the file
            </a>
            {!open.concepts?.length && <p className="text-muted">No key concepts yet: the file had no readable text, or the AI was unavailable when it was uploaded.</p>}
            {open.concepts?.map((c) => (
              <article key={c.name} className="rounded-card border border-hairline bg-surface p-3">
                <h3 className="font-medium">{c.name}</h3>
                <p className="mt-1">{c.explanation}</p>
                <p className="mt-1 text-xs text-spark-ink">{c.location}</p>
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
