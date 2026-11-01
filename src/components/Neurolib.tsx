"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { errorText, getMode, post } from "@/lib/api";
import { cached, db, ensureSeed, treeKey } from "@/lib/db";
import type { TreeNode } from "@/lib/schemas";
import { nodeWeight } from "@/lib/weight";
import { Logo } from "./Logo";
import type { GraphNode } from "./NeurolibGraph";
import { SourceCard } from "./SourceCard";

const NeurolibGraph = dynamic(() => import("./NeurolibGraph").then((m) => m.NeurolibGraph), { ssr: false });

const OTHER = "unsorted";
const CENTRE = "centre"; // ties top-level topics together, or the force layout drifts them apart

export function Neurolib({ folderId }: { folderId?: string }) {
  useEffect(() => {
    ensureSeed();
  }, []);

  const folder = useLiveQuery(
    async () => (folderId ? db.folders.get(folderId) : (await db.folders.toCollection().sortBy("createdAt"))[0]),
    [folderId],
  );
  const pages = useLiveQuery(() => (folder ? db.pages.where({ folderId: folder.id }).toArray() : []), [folder?.id]);
  const suggestions = useLiveQuery(() => (folder ? db.suggestions.where({ folderId: folder.id }).toArray() : []), [folder?.id]);
  const sourceList = useLiveQuery(() => db.sources.toArray());
  const [tree, setTree] = useState<TreeNode[]>();
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [openSource, setOpenSource] = useState<string | null>(null);

  const sources = useMemo(() => new Map(sourceList?.map((s) => [s.id, s])), [sourceList]);
  const accepted = useMemo(() => new Set(suggestions?.filter((s) => s.status === "accepted").map((s) => s.sourceId)), [suggestions]);

  const input = useMemo(
    () =>
      JSON.stringify({
        pages: (pages ?? []).filter((p) => p.plainText).map((p) => ({ title: p.title || "Untitled", text: p.plainText })),
        sources: (suggestions ?? []).flatMap((s) => {
          const source = sources.get(s.sourceId);
          return source && s.status !== "declined" ? [{ id: source.id, title: source.title }] : [];
        }),
      }),
    [pages, suggestions, sources],
  );

  useEffect(() => {
    const body = JSON.parse(input);
    if (!folder || !sourceList || !pages || !body.pages.length) return;
    let live = true;
    (async () => {
      try {
        const mode = await getMode();
        const { nodes } = await cached(["neurolib", mode, input], () => post<{ nodes: TreeNode[] }>("neurolib", body));
        await db.cache.put({ key: treeKey(folder.id), value: nodes });
        if (live) setTree(nodes);
      } catch (err) {
        const last = (await db.cache.get(treeKey(folder.id)))?.value as TreeNode[] | undefined;
        if (!live) return;
        setTree(last ?? []);
        // demo mode falls back to the saved tree by design, so only a live failure needs saying
        if (!last || (await getMode()) !== "demo") setNotice(errorText(err));
      }
    })();
    return () => {
      live = false;
    };
  }, [input, folder, sourceList, pages]);

  const nodes = useMemo(() => {
    if (!tree) return [];
    const placed = new Set(tree.flatMap((n) => n.sourceIds));
    const unsorted = [...accepted].filter((id) => !placed.has(id));
    return unsorted.length ? [...tree, { id: OTHER, label: "Unsorted sources", sourceIds: unsorted }] : tree;
  }, [tree, accepted]);

  const weighed = useMemo(() => pages?.map((p) => ({ plainText: `${p.title}\n${p.plainText}` })) ?? [], [pages]);
  const radius = (n: TreeNode) => 8 + 5 * Math.sqrt(nodeWeight(n, nodes, weighed, accepted));

  const visible = useMemo(() => {
    if (!nodes.length) return [];
    const show: GraphNode[] = [{ id: CENTRE, label: folder?.name ?? "", kind: "folder", radius: 16 }];
    const add = (n: TreeNode) => {
      show.push({ id: n.id, label: n.label, kind: "topic", radius: radius(n), parentId: n.parentId ?? CENTRE, selected: expanded.has(n.id) });
      if (!expanded.has(n.id)) return;
      nodes.filter((c) => c.parentId === n.id).forEach(add);
      for (const id of n.sourceIds) {
        if (accepted.has(id)) show.push({ id: `s:${id}`, label: sources.get(id)?.title ?? id, kind: "source", radius: 5, parentId: n.id, selected: openSource === id });
      }
    };
    nodes.filter((n) => !n.parentId).forEach(add);
    return show;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- radius derives from these
  }, [nodes, expanded, accepted, sources, openSource, weighed, folder?.name]);

  const activate = (id: string) => {
    if (id === CENTRE) return;
    if (id.startsWith("s:")) return setOpenSource(id.slice(2));
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const open = openSource ? sources.get(openSource) : undefined;
  const openFit = suggestions?.find((s) => s.sourceId === openSource)?.fitGap;
  const ready = tree !== undefined;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-hairline px-4">
        <Logo />
        <Link href="/" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} strokeWidth={1.5} /> Notes
        </Link>
        <h1 className="font-display text-lg font-semibold">Neurolib{folder ? `: ${folder.name}` : ""}</h1>
        {notice && <p role="status" className="ml-auto text-xs text-muted">{notice}</p>}
      </header>
      {!ready || !nodes.length ? (
        <p className="p-8 text-sm text-muted">{ready || !JSON.parse(input).pages.length ? "Write a page first, then Neurolib can map it." : "Mapping this folder…"}</p>
      ) : (
        <div className="flex min-h-0 flex-1">
          <nav aria-label="Topics" className="w-56 shrink-0 overflow-y-auto border-r border-hairline p-3 text-sm">
            <ul>
              {nodes
                .filter((n) => !n.parentId)
                .map((n) => (
                  <TopicItem key={n.id} node={n} nodes={nodes} expanded={expanded} accepted={accepted} sourceTitle={(id) => sources.get(id)?.title ?? id} onClick={activate} />
                ))}
            </ul>
          </nav>
          <NeurolibGraph nodes={visible} onClick={activate} />
          {open && openFit && (
            <aside aria-label="Source detail" className="w-96 shrink-0 overflow-y-auto border-l border-hairline p-4">
              <button onClick={() => setOpenSource(null)} aria-label="Close source" className="mb-2 rounded-lg p-1 text-muted hover:bg-sand">
                <X size={18} strokeWidth={1.5} />
              </button>
              <SourceCard key={open.id} source={open} fitGap={openFit} expanded />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

// The canvas has no keyboard or screen reader path; this list is the same tree as buttons.
function TopicItem({
  node,
  nodes,
  expanded,
  accepted,
  sourceTitle,
  onClick,
}: {
  node: TreeNode;
  nodes: TreeNode[];
  expanded: Set<string>;
  accepted: Set<string>;
  sourceTitle(id: string): string;
  onClick(id: string): void;
}) {
  const isOpen = expanded.has(node.id);
  return (
    <li>
      <button onClick={() => onClick(node.id)} aria-expanded={isOpen} className="w-full rounded-lg px-2 py-1 text-left hover:bg-sand">
        {node.label}
      </button>
      {isOpen && (
        <ul className="ml-3">
          {nodes
            .filter((c) => c.parentId === node.id)
            .map((c) => (
              <TopicItem key={c.id} node={c} nodes={nodes} expanded={expanded} accepted={accepted} sourceTitle={sourceTitle} onClick={onClick} />
            ))}
          {node.sourceIds
            .filter((id) => accepted.has(id))
            .map((id) => (
              <li key={id}>
                <button onClick={() => onClick(`s:${id}`)} className="w-full truncate rounded-lg px-2 py-1 text-left text-xs text-muted hover:bg-sand">
                  {sourceTitle(id)}
                </button>
              </li>
            ))}
        </ul>
      )}
    </li>
  );
}
