import { FilePlus, FileText, FolderPlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { FOLDER_KINDS, type Folder, type Page, type Suggestion } from "@/lib/schemas";
import { Logo } from "./Logo";

export const DEFAULT_ROLE: Record<Folder["kind"], string> = {
  study: "Tutor",
  research: "Research assistant",
  work: "Analyst",
  personal: "Organiser",
};

type Props = {
  folders: Folder[];
  pages: Page[];
  suggestions: Suggestion[];
  pageId?: string;
  folder?: Folder;
  account: ReactNode;
  onSelect(id: string): void;
  onNewFolder(name: string, kind: Folder["kind"], role: string): void;
  onNewPage(folderId: string): void;
  onRelib(): void;
};

// suggestions that arrived after the folder was last opened
export const newSince = (folder: Folder, suggestions: Suggestion[]) =>
  suggestions.filter((s) => s.folderId === folder.id && s.status === "new" && (s.createdAt ?? 0) > (folder.lastOpenedAt ?? Infinity));

export function Sidebar({ folders, pages, suggestions, pageId, folder: current, account, onSelect, onNewFolder, onNewPage, onRelib }: Props) {
  const [adding, setAdding] = useState(false);

  return (
    <nav aria-label="Folders and pages" className="flex w-[248px] shrink-0 flex-col border-r border-hairline">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <button onClick={() => setAdding(!adding)} aria-expanded={adding} aria-label="New folder" title="New folder" className="rounded-lg p-1 text-muted hover:bg-sand">
          <FolderPlus size={18} strokeWidth={1.5} />
        </button>
      </div>
      {adding && (
        <NewFolderForm
          onDone={(name, kind, role) => {
            setAdding(false);
            if (name) onNewFolder(name, kind, role);
          }}
        />
      )}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {FOLDER_KINDS.map((kind) => {
          const group = folders.filter((f) => f.kind === kind);
          if (!group.length) return null;
          return (
            <section key={kind} aria-label={kind} className="mb-4">
              <h2 className="px-2 pb-1 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{kind}</h2>
              {group.map((folder) => {
                const fresh = folder.id === current?.id ? 0 : newSince(folder, suggestions).length;
                return (
                  <div key={folder.id} className="mb-1">
                    <div className="flex items-center justify-between px-2 py-1">
                      <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <span className="truncate">{folder.name}</span>
                        {fresh > 0 && (
                          <span className="shrink-0 rounded-full bg-spark-wash px-1.5 text-[11px] text-spark-ink" title="New since your last visit">
                            {fresh} new
                          </span>
                        )}
                      </h3>
                      <button onClick={() => onNewPage(folder.id)} aria-label={`New page in ${folder.name}`} title="New page" className="rounded-lg p-1 text-muted hover:bg-sand">
                        <FilePlus size={15} strokeWidth={1.5} />
                      </button>
                    </div>
                    <ul>
                      {pages
                        .filter((p) => p.folderId === folder.id)
                        .map((page) => (
                          <li key={page.id}>
                            <button
                              onClick={() => onSelect(page.id)}
                              aria-current={page.id === pageId ? "page" : undefined}
                              className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 pl-5 text-left text-sm hover:bg-sand ${page.id === pageId ? "bg-sand" : ""}`}
                            >
                              <FileText size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
                              <span className="truncate">{page.title || "Untitled"}</span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <div className="space-y-3 border-t border-hairline p-3">
        {current && (
          <button onClick={onRelib} className="flex w-full items-center gap-2 rounded-card bg-ink px-3 py-2.5 text-left text-sm text-paper">
            <span className="h-2 w-2 shrink-0 rounded-full bg-spark" aria-hidden="true" />
            <span className="truncate">
              Relib v1 · <span className="opacity-75">{current.agentRole}</span>
            </span>
          </button>
        )}
        <div className="px-1">{account}</div>
      </div>
    </nav>
  );
}

function NewFolderForm({ onDone }: { onDone(name: string, kind: Folder["kind"], role: string): void }) {
  const [kind, setKind] = useState<Folder["kind"]>("study");
  const [role, setRole] = useState(DEFAULT_ROLE.study);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim().slice(0, 200);
    onDone(name, kind, role.trim().slice(0, 200) || DEFAULT_ROLE[kind]);
  };

  const field = "w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm";
  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onDone("", kind, role)} className="mx-2 mb-3 space-y-2 rounded-card bg-sand p-3">
      <label className="block text-xs text-muted">
        Name
        <input name="name" required autoFocus maxLength={200} className={field} />
      </label>
      <label className="block text-xs text-muted">
        Kind
        <select
          value={kind}
          onChange={(e) => {
            const next = e.target.value as Folder["kind"];
            if (role === DEFAULT_ROLE[kind]) setRole(DEFAULT_ROLE[next]);
            setKind(next);
          }}
          className={field}
        >
          {FOLDER_KINDS.map((k) => (
            <option key={k} value={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        Relib v1 role in this folder
        <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={200} className={field} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onDone("", kind, role)} className="rounded-full border border-hairline px-3 py-1 text-xs hover:bg-surface">
          Cancel
        </button>
        <button type="submit" className="rounded-full bg-ink px-3 py-1 text-xs text-paper">
          Create
        </button>
      </div>
    </form>
  );
}
