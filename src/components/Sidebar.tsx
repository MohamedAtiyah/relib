import { FilePlus, FileText, FolderPlus, NotebookPen, SquareTerminal } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Folder, Page, PageType } from "@/lib/schemas";
import { Logo } from "./Logo";

// What Relib v1 is on each kind of page.
export const ROLE: Record<PageType, string> = { notes: "Tutor", research: "Research guide", programming: "Code agent" };
export const PAGE_ICON = { notes: NotebookPen, research: FileText, programming: SquareTerminal };

type Props = {
  folders: Folder[];
  pages: Page[];
  page?: Page;
  account: ReactNode;
  onSelect(id: string): void;
  onNewFolder(name: string): void;
  onNewPage(folderId: string, type: PageType): void;
  onRelib(): void;
};

export function Sidebar({ folders, pages, page: current, account, onSelect, onNewFolder, onNewPage, onRelib }: Props) {
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim().slice(0, 200);
    setAdding(false);
    if (name) onNewFolder(name);
  };

  return (
    <nav aria-label="Folders and pages" className="flex w-[248px] shrink-0 flex-col border-r border-hairline">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <button onClick={() => setAdding(!adding)} aria-expanded={adding} aria-label="New folder" title="New folder" className="rounded-lg p-1 text-muted hover:bg-sand">
          <FolderPlus size={18} strokeWidth={1.5} />
        </button>
      </div>
      {adding && (
        <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} className="mx-2 mb-3">
          <input name="name" required autoFocus maxLength={200} aria-label="Folder name" placeholder="Folder name, then Enter" className="w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm" />
        </form>
      )}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <h2 className="label px-2 pb-1">Folders</h2>
        {folders.map((folder) => (
          <div key={folder.id} className="mb-2">
            <div className="flex items-center justify-between px-2 py-1">
              <h3 className="truncate text-sm font-medium">{folder.name}</h3>
              <button
                onClick={() => setPicking(picking === folder.id ? null : folder.id)}
                aria-expanded={picking === folder.id}
                aria-label={`New page in ${folder.name}`}
                title="New page"
                className="rounded-lg p-1 text-muted hover:bg-sand"
              >
                <FilePlus size={15} strokeWidth={1.5} />
              </button>
            </div>
            {picking === folder.id && (
              <div role="menu" className="mx-2 mb-1 flex gap-1">
                {(Object.keys(ROLE) as PageType[]).map((type) => (
                  <button
                    key={type}
                    role="menuitem"
                    onClick={() => {
                      setPicking(null);
                      onNewPage(folder.id, type);
                    }}
                    className="rounded-full bg-sand px-2 py-0.5 text-xs hover:text-spark-ink"
                  >
                    /{type}
                  </button>
                ))}
              </div>
            )}
            <ul>
              {pages
                .filter((p) => p.folderId === folder.id)
                .map((page) => {
                  const Icon = PAGE_ICON[page.type ?? "notes"];
                  return (
                    <li key={page.id}>
                      <button
                        onClick={() => onSelect(page.id)}
                        aria-current={page.id === current?.id ? "page" : undefined}
                        className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 pl-5 text-left text-sm hover:bg-sand ${page.id === current?.id ? "bg-sand" : ""}`}
                      >
                        <Icon size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
                        <span className="truncate">{page.title || "Untitled"}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-hairline p-3">
        {current && (
          <button onClick={onRelib} className="flex w-full items-center gap-2 rounded-card bg-ink px-3 py-2.5 text-left text-sm text-paper">
            <span className="h-2 w-2 shrink-0 rounded-full bg-spark" aria-hidden="true" />
            <span className="truncate">
              Relib v1 · <span className="opacity-75">{ROLE[current.type ?? "notes"]}</span>
            </span>
          </button>
        )}
        <div className="px-1">{account}</div>
      </div>
    </nav>
  );
}
