"use client";

import { UserButton } from "@clerk/nextjs";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Network, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMode } from "@/lib/api";
import type { SlashContext } from "@/lib/commands";
import { createFolder, createPage, db, DEFAULT_PRESET, ensureSeed, openWorkspace } from "@/lib/db";
import type { ModelMode } from "@/lib/model";
import type { Folder } from "@/lib/schemas";
import { pageNotes } from "@/lib/suggest";
import { onSyncStatus, pull, queueRows, type SyncStatus } from "@/lib/sync";
import { CatchUp } from "./CatchUp";
import { ChatPanel } from "./ChatPanel";
import { Editor } from "./Editor";
import { Neurolib } from "./Neurolib";
import { PresetDialog } from "./PresetDialog";
import { Sidebar } from "./Sidebar";
import { SourcePanel } from "./SourcePanel";
import { UploadButton } from "./UploadButton";

const MODE_TAG: Partial<Record<ModelMode, string>> = {
  standin: "Stand-in model: keyword heuristics, not AI",
  demo: "Demo: saved results only",
};

const SYNC_TAG: Record<SyncStatus, string> = { saved: "Saved", saving: "Saving…", offline: "Not saved yet: retrying" };

// one boot per workspace, so React's double effects in development cannot create two starter folders
const booted = new Map<string, Promise<void>>();

function boot(userId?: string) {
  return async () => {
    if (!userId) return ensureSeed();
    try {
      await pull();
    } catch (err) {
      // offline with a local copy: work from it, and the queue pushes once the server is back
      if (!(await db.folders.count())) throw err;
      return;
    }
    if (!(await db.folders.count())) await createFolder("My first folder", "study", "Tutor");
    if (!(await db.presets.count())) await db.presets.put(DEFAULT_PRESET);
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
  const preset = useLiveQuery(() => db.presets.toCollection().first());
  const [pageId, setPageId] = useState(() => remembered(storageKey));
  const [view, setView] = useState<"page" | "neurolib">("page");
  const [chatOpen, setChatOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [presetOpen, setPresetOpen] = useState(false);
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
    openPreset: () => setPresetOpen(true),
    preset: () => preset,
    pageTitle: () => page?.title ?? "",
  };

  const newFolder = async (name: string, kind: Folder["kind"], role: string) => select(await createFolder(name, kind, role));
  const newPage = async (folderId: string) => select(await createPage(folderId));

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        folders={folders ?? []}
        pages={pages ?? []}
        suggestions={suggestions ?? []}
        pageId={page?.id}
        folder={folder}
        onSelect={select}
        onNewFolder={newFolder}
        onNewPage={newPage}
        onRelib={() => setChatOpen(!chatOpen)}
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
      {chatOpen && folder && (
        <ChatPanel key={folder.id} folder={folder} notes={page ? pageNotes(page) : ""} sources={acceptedSources.map((s) => s.title)} />
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-4">
          <p className="mr-auto flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="truncate">{folder?.name}</span>
            <span aria-hidden="true">/</span>
            <span className="truncate text-ink">{view === "neurolib" ? "Neurolib" : page?.title || "Untitled"}</span>
            {mode && MODE_TAG[mode] && <span className="ml-2 shrink-0 rounded-full bg-sand px-3 py-1 text-xs">{MODE_TAG[mode]}</span>}
            {sync && <span role="status" className="ml-2 shrink-0 text-xs">{SYNC_TAG[sync]}</span>}
          </p>
          {userId && folder && <UploadButton userId={userId} folderId={folder.id} pageId={page?.id} />}
          <button
            onClick={() => setView(view === "neurolib" ? "page" : "neurolib")}
            aria-pressed={view === "neurolib"}
            aria-label="Neurolib"
            title="Neurolib"
            className="rounded-lg p-2 text-muted hover:bg-sand aria-pressed:text-spark-ink"
          >
            {view === "neurolib" ? <NotebookPen size={18} strokeWidth={1.5} /> : <Network size={18} strokeWidth={1.5} />}
          </button>
          <button onClick={() => setSourcesOpen(!sourcesOpen)} aria-pressed={sourcesOpen} aria-label="Sources" title="Sources" className="rounded-lg p-2 text-muted hover:bg-sand">
            <BookOpen size={18} strokeWidth={1.5} />
          </button>
        </header>
        {view === "neurolib" && folder ? (
          <Neurolib key={folder.id} folder={folder} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {folder && <CatchUp key={folder.id} folder={folder} sources={sources} />}
            {page && (
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
      {sourcesOpen && page && view === "page" && <SourcePanel key={page.id} page={page} sources={sources} />}
      {presetOpen && <PresetDialog preset={preset ?? DEFAULT_PRESET} onClose={() => setPresetOpen(false)} />}
    </div>
  );
}
