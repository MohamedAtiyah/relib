import { upload } from "@vercel/blob/client";
import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { errorText, post } from "@/lib/api";
import { db } from "@/lib/db";
import { MAX_PDF } from "@/lib/files";
import type { FitGap, Source } from "@/lib/schemas";
import { pageNotes } from "@/lib/suggest";

// Upload a PDF to this folder; it is checked against the open page on its full text.
export function UploadButton({ userId, folderId, pageId }: { userId: string; folderId: string; pageId?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const send = async (file: File) => {
    if (file.type !== "application/pdf") return setStatus("Only PDF files.");
    if (file.size > MAX_PDF) return setStatus("PDFs up to 20 MB.");
    try {
      setStatus("Uploading…");
      const blob = await upload(`${userId}/${file.name}`, file, { access: "private", handleUploadUrl: "/api/files/upload" });
      setStatus("Reading the PDF…");
      const { source } = await post<{ source: Source }>("files", { pathname: blob.pathname, folderId, filename: file.name });
      await db.sources.put(source);
      const page = pageId ? await db.pages.get(pageId) : undefined;
      if (page) {
        setStatus("Checking it against your notes…");
        const fitGap = await post<FitGap>("analyze", { notes: pageNotes(page) || page.title || "(empty page)", source, useFullText: true });
        await db.suggestions.put({ pageId: page.id, sourceId: source.id, folderId, fitGap, status: "new", createdAt: Date.now() });
      }
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error && err.message.includes("token") ? "Uploads are not set up on this server." : errorText(err));
    }
  };

  return (
    <>
      {status && (
        <span role="status" className="text-xs text-muted">
          {status}
        </span>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) send(file);
        }}
      />
      <button onClick={() => input.current?.click()} aria-label="Upload a PDF" title="Upload a PDF" className="rounded-lg p-2 text-muted hover:bg-sand">
        <FileUp size={18} strokeWidth={1.5} />
      </button>
    </>
  );
}
