import { FilePlus, FileText, FolderPlus } from "lucide-react";
import type { Folder, Page } from "@/lib/schemas";
import { Logo } from "./Logo";

type Props = {
  folders: Folder[];
  pages: Page[];
  pageId?: string;
  onSelect(id: string): void;
  onNewFolder(): void;
  onNewPage(folderId: string): void;
};

export function Sidebar({ folders, pages, pageId, onSelect, onNewFolder, onNewPage }: Props) {
  return (
    <nav aria-label="Folders and pages" className="flex w-56 shrink-0 flex-col border-r border-hairline">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <button onClick={onNewFolder} aria-label="New folder" title="New folder" className="rounded-lg p-1 text-muted hover:bg-sand">
          <FolderPlus size={18} strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {folders.map((folder) => (
          <section key={folder.id} className="mb-3">
            <div className="flex items-center justify-between px-2 py-1">
              <h2 className="truncate text-xs font-medium text-muted">{folder.name}</h2>
              <button
                onClick={() => onNewPage(folder.id)}
                aria-label={`New page in ${folder.name}`}
                title="New page"
                className="rounded-lg p-1 text-muted hover:bg-sand"
              >
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
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sand ${page.id === pageId ? "bg-sand" : ""}`}
                    >
                      <FileText size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
                      <span className="truncate">{page.title || "Untitled"}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
