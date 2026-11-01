"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, MessageCircle, Network } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getMode } from "@/lib/api";
import type { SlashContext } from "@/lib/commands";
import { createFolder, createPage, db, ensureSeed } from "@/lib/db";
import type { ModelMode } from "@/lib/model";
import { pageNotes } from "@/lib/suggest";
import { ChatPanel } from "./ChatPanel";
import { Editor } from "./Editor";
import { Sidebar } from "./Sidebar";
import { SourcePanel } from "./SourcePanel";

const MODE_TAG: Partial<Record<ModelMode, string>> = {
  standin: "Stand-in model: keyword heuristics, not AI",
  demo: "Demo: saved results only",
};

const LAST_PAGE = "relib:page";

function lastPage() {
  try {
    return localStorage.getItem(LAST_PAGE) ?? undefined;
  } catch {
    return undefined;
  }
}

export function Workspace() {
  const router = useRouter();
  const folders = useLiveQuery(() => db.folders.toCollection().sortBy("createdAt"));
  const pages = useLiveQuery(() => db.pages.toCollection().sortBy("createdAt"));
  const sourceList = useLiveQuery(() => db.sources.toArray());
  const accepted = useLiveQuery(() => db.suggestions.filter((s) => s.status === "accepted").toArray());
  const [pageId, setPageId] = useState(lastPage);
  const [chatOpen, setChatOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [mode, setMode] = useState<ModelMode>();

  useEffect(() => {
    ensureSeed();
    getMode().then(setMode);
  }, []);

  const page = pages?.find((p) => p.id === pageId) ?? pages?.[0];

  const select = (id: string) => {
    setPageId(id);
    try {
      localStorage.setItem(LAST_PAGE, id);
    } catch {
      // only a convenience: without storage the workspace opens on the first page
    }
  };

  const sources = useMemo(() => new Map(sourceList?.map((s) => [s.id, s])), [sourceList]);
  const folderAccepted = (accepted ?? []).filter((s) => s.folderId === page?.folderId);
  const acceptedSources = folderAccepted.flatMap((s) => sources.get(s.sourceId) ?? []);

  const ctx: SlashContext = {
    openPanels: () => {
      setChatOpen(true);
      setSourcesOpen(true);
    },
    openNeurolib: () => page && router.push(`/neurolib?folder=${page.folderId}`),
  };

  const newFolder = async () => {
    const name = window.prompt("Folder name")?.trim();
    if (name) select(await createFolder(name));
  };

  const newPage = async (folderId: string) => select(await createPage(folderId));

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar folders={folders ?? []} pages={pages ?? []} pageId={page?.id} onSelect={select} onNewFolder={newFolder} onNewPage={newPage} />
      {chatOpen && <ChatPanel notes={page ? pageNotes(page) : ""} sources={acceptedSources.map((s) => s.title)} />}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-1 px-4">
          {mode && MODE_TAG[mode] && <span className="mr-auto rounded-full bg-sand px-3 py-1 text-xs text-muted">{MODE_TAG[mode]}</span>}
          <button onClick={() => setChatOpen(!chatOpen)} aria-pressed={chatOpen} aria-label="Tutor" title="Tutor" className="rounded-lg p-2 text-muted hover:bg-sand">
            <MessageCircle size={18} strokeWidth={1.5} />
          </button>
          <button onClick={ctx.openNeurolib} aria-label="Neurolib" title="Neurolib" className="rounded-lg p-2 text-muted hover:bg-sand">
            <Network size={18} strokeWidth={1.5} />
          </button>
          <button onClick={() => setSourcesOpen(!sourcesOpen)} aria-pressed={sourcesOpen} aria-label="Sources" title="Sources" className="rounded-lg p-2 text-muted hover:bg-sand">
            <BookOpen size={18} strokeWidth={1.5} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {page && (
            <div key={page.id} className="mx-auto max-w-2xl px-8 py-6">
              <input
                autoFocus={!page.title}
                value={page.title}
                onChange={(e) => db.pages.update(page.id, { title: e.target.value, updatedAt: Date.now() })}
                aria-label="Page title"
                placeholder="Untitled"
                className="mb-4 w-full bg-transparent font-display text-4xl font-semibold tracking-[-0.02em] outline-none placeholder:text-muted"
              />
              <Editor page={page} ctx={ctx} sources={acceptedSources} />
            </div>
          )}
        </div>
      </main>
      {sourcesOpen && page && <SourcePanel key={page.id} page={page} sources={sources} />}
    </div>
  );
}
