"use client";

import { UserButton } from "@clerk/nextjs";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Network, NotebookPen, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import type { LexicalEditor } from "lexical";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMode } from "@/lib/api";
import type { SlashContext } from "@/lib/commands";
import { createFolder, createPage, createStarter, db, openWorkspace } from "@/lib/db";
import type { ModelMode } from "@/lib/model";
import type { PageType, Source } from "@/lib/schemas";
import { pageNotes } from "@/lib/suggest";
import { onSyncStatus, pull, queueRows, type SyncStatus } from "@/lib/sync";
import { ChatPanel } from "./ChatPanel";
import { Editor } from "./Editor";
import { Neurolib } from "./Neurolib";
import { CitePreview } from "./CitePreview";
import { ResearchPage } from "./ResearchPage";
import { ROLE, Sidebar } from "./Sidebar";
import { SourcePanel } from "./SourcePanel";

const MODE_TAG: Partial<Record<ModelMode, string>> = {
  standin: "Stand-in model: keyword heuristics, not AI",
  off: "Live AI is switched off",
};

const SYNC_TAG: Record<SyncStatus, string> = { saved: "Saved", saving: "Saving…", offline: "Not saved yet: retrying" };

// one boot per workspace, so React's double effects in development cannot create two starter folders
const booted = new Map<string, Promise<void>>();

function boot(userId?: string) {
  return async () => {
    if (!userId) {
      if (!(await db.folders.count())) await createStarter();
      return;
    }
    try {
      await pull();
    } catch (err) {
      // offline with a local copy: work from it, and the queue pushes once the server is back
      if (!(await db.folders.count())) throw err;
      return;
    }
    if (!(await db.folders.count())) await createStarter();
  };
}

export function Workspace({ userId }: { userId?: string }) {
  const name = userId ? `relib-${userId}` : "relib-demo";
  openWorkspace(name, userId ? queueRows : undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("saved");

  useEffect(() => {
    onSyncStatus(setSync);
    if (!booted.has(name)) booted.set(name, boot(userId)());
    booted
      .get(name)!
      .then(() => setReady(true))
      .catch(() => {
        booted.delete(name);
        setFailed(true);
      });
  }, [name, userId]);

  if (failed) {
    return (
      <p role="alert" className="p-8 text-sm">
        Could not load your workspace. Check your connection and{" "}
        <button onClick={() => location.reload()} className="underline">
          reload
        </button>
        .
      </p>
    );
  }
  if (!ready) return <p className="p-8 text-sm text-muted">Opening your workspace…</p>;
  return <WorkspaceView userId={userId} storageKey={`${name}:page`} sync={userId ? sync : undefined} />;
}

function remembered(key: string) {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function WorkspaceView({ userId, storageKey, sync }: { userId?: string; storageKey: string; sync?: SyncStatus }) {
  const folders = useLiveQuery(() => db.folders.toCollection().sortBy("createdAt"));
  const pages = useLiveQuery(() => db.pages.toCollection().sortBy("createdAt"));
  const sourceList = useLiveQuery(() => db.sources.toArray());
  const suggestions = useLiveQuery(() => db.suggestions.toArray());
  const presets = useLiveQuery(() => db.presets.toArray());
  const [pageId, setPageId] = useState(() => remembered(storageKey));
  const [view, setView] = useState<"page" | "neurolib">("page");
  const [chatOpen, setChatOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [ask, setAsk] = useState<{ text: string; at: number }>();
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [preview, setPreview] = useState<{ source: Source; pageId: string } | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const [mode, setMode] = useState<ModelMode>();

  useEffect(() => {
    getMode().then(setMode);
  }, []);

  const page = pages?.find((p) => p.id === pageId) ?? pages?.[0];
  const folder = folders?.find((f) => f.id === page?.folderId);

  const select = (id: string) => {
    setPageId(id);
    setView("page");
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      // only a convenience: without storage the workspace opens on the first page
    }
  };

  const sources = useMemo(() => new Map(sourceList?.map((s) => [s.id, s])), [sourceList]);
  const acceptedSources = (suggestions ?? [])
    .filter((s) => s.status === "accepted" && s.folderId === page?.folderId)
    .flatMap((s) => sources.get(s.sourceId) ?? []);

  const ctx: SlashContext = {
    openPanels: () => {
      setChatOpen(true);
      setSourcesOpen(true);
    },
    openNeurolib: () => setView("neurolib"),
    newPage: (type) => folder && newPage(folder.id, type),
    pageType: page?.type ?? "notes",
    explain: (text) => {
      setNavOpen(true);
      setChatOpen(true);
      setAsk({ text, at: Date.now() });
    },
  };

  const newFolder = async (name: string) => select(await createPage(await createFolder(name)));
  const newPage = async (folderId: string, type: PageType) => select(await createPage(folderId, type));

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* the left column holds either the folder tree or Relib v1, as in the design */}
      {navOpen && chatOpen && folder && page ? (
        <ChatPanel
          key={folder.id}
          folder={folder}
          role={ROLE[page.type ?? "notes"]}
          notes={pageNotes(page)}
          ask={ask}
          sources={acceptedSources.map((s) => `${s.title}${s.year ? ` (${s.year})` : ""}: ${s.abstract.slice(0, 500)}`)}
          onClose={() => setChatOpen(false)}
        />
      ) : (
        navOpen && (
          <Sidebar
            onCollapse={() => setNavOpen(false)}
            folders={folders ?? []}
            pages={pages ?? []}
            page={page}
            onSelect={select}
            onNewFolder={newFolder}
            onNewPage={newPage}
            onRelib={() => setChatOpen(true)}
            account={
              !userId ? (
                <Link href="/" className="text-xs text-muted underline hover:text-ink">
                  Demo workspace · sign in to keep your own
                </Link>
              ) : (
                <UserButton showName />
              )
            }
          />
        )
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-4">
          {!navOpen && (
            <button onClick={() => setNavOpen(true)} aria-label="Show sidebar" title="Show sidebar" className="mr-2 rounded-lg p-2 text-muted hover:bg-sand">
              <PanelLeftOpen size={18} strokeWidth={1.5} />
            </button>
          )}
          <p className="mr-auto flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="truncate">{folder?.name}</span>
            <span aria-hidden="true">/</span>
            <span className="truncate text-ink">{view === "neurolib" ? "Neurolib" : page?.title || "Untitled"}</span>
            {mode && MODE_TAG[mode] && <span className="ml-2 shrink-0 rounded-full bg-sand px-3 py-1 text-xs">{MODE_TAG[mode]}</span>}
            {sync && (
              <span role="status" className="ml-2 shrink-0 text-xs">
                {SYNC_TAG[sync]}
              </span>
            )}
          </p>
          <button
            onClick={() => setView(view === "neurolib" ? "page" : "neurolib")}
            aria-pressed={view === "neurolib"}
            aria-label="Neurolib"
            title="Neurolib"
            className="rounded-lg p-2 text-muted hover:bg-sand aria-pressed:text-spark-ink"
          >
            {view === "neurolib" ? <NotebookPen size={18} strokeWidth={1.5} /> : <Network size={18} strokeWidth={1.5} />}
          </button>
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            aria-pressed={sourcesOpen}
            aria-label="Sources"
            title="Sources"
            className="rounded-lg p-2 text-muted hover:bg-sand"
          >
            <BookOpen size={18} strokeWidth={1.5} />
          </button>
        </header>
        {view === "neurolib" && folder ? (
          <Neurolib key={folder.id} folder={folder} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {page?.type === "research" && (
              <ResearchPage
                key={page.id}
                page={page}
                folderPages={(pages ?? []).filter((p) => p.folderId === page.folderId)}
                presets={(presets ?? []).filter((p) => p.folderId === page.folderId)}
                sources={sources}
                accepted={acceptedSources}
                ctx={ctx}
                editorRef={editorRef}
              />
            )}
            {page && page.type !== "research" && (
              <div key={page.id} className="mx-auto max-w-2xl px-8 py-6">
                <input
                  autoFocus={!page.title}
                  value={page.title}
                  onChange={(e) => db.pages.update(page.id, { title: e.target.value, updatedAt: Date.now() })}
                  aria-label="Page title"
                  placeholder="Untitled"
                  className="mb-4 w-full bg-transparent font-display text-[34px] font-semibold tracking-[-0.02em] outline-none placeholder:text-muted"
                />
                <Editor page={page} ctx={ctx} sources={acceptedSources} />
              </div>
            )}
          </div>
        )}
      </main>
      {sourcesOpen && page && view === "page" && preview?.pageId === page.id && (
        <aside aria-label="Cite this source" className="w-96 shrink-0 overflow-y-auto bg-sand p-4">
          <CitePreview key={preview.source.id} source={sources.get(preview.source.id) ?? preview.source} page={page} editorRef={editorRef} onDone={() => setPreview(null)} />
        </aside>
      )}
      {sourcesOpen && page && view === "page" && preview?.pageId !== page.id && (
        <SourcePanel
          key={page.id}
          page={page}
          sources={sources}
          userId={userId}
          onAccept={page.type === "research" ? (source) => setPreview({ source, pageId: page.id }) : undefined}
        />
      )}
    </div>
  );
}
