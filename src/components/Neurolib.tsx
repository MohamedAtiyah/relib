"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { errorText, getMode, post } from "@/lib/api";
import { cached, db, treeKey } from "@/lib/db";
import type { EndPoint } from "@/lib/agent/neurolib";
import type { Folder, TreeNode } from "@/lib/schemas";
import { nodeWeight } from "@/lib/weight";
import type { GraphNode } from "./NeurolibGraph";
import { SourceCard } from "./SourceCard";

const NeurolibGraph = dynamic(() => import("./NeurolibGraph").then((m) => m.NeurolibGraph), { ssr: false });

const OTHER = "unsorted";
const CENTRE = "centre"; // ties top-level topics together, or the force layout drifts them apart

// Each folder has its own map; Workspace keys this by folder id.
export function Neurolib({ folder }: { folder: Folder }) {
  const pages = useLiveQuery(() => db.pages.where({ folderId: folder.id }).toArray(), [folder.id]);
  const suggestions = useLiveQuery(() => db.suggestions.where({ folderId: folder.id }).toArray(), [folder.id]);
  const sourceList = useLiveQuery(() => db.sources.toArray());
  const [tree, setTree] = useState<TreeNode[]>();
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

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
    if (!sourceList || !pages || !body.pages.length) return;
    let live = true;
    (async () => {
      try {
        const mode = await getMode();
        const { nodes } = await cached(["neurolib", mode, input], () => post<{ nodes: TreeNode[] }>("neurolib", { ...body, folderId: folder.id }));
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
  }, [input, folder.id, sourceList, pages]);

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
    const show: GraphNode[] = [{ id: CENTRE, label: folder.name, kind: "folder", radius: 16 }];
    const add = (n: TreeNode) => {
      const covered = n.sourceIds.some((id) => accepted.has(id)) || nodeWeight(n, nodes, weighed, accepted) >= 4;
      show.push({ id: n.id, label: n.label, kind: "topic", radius: radius(n), parentId: n.parentId ?? CENTRE, selected: expanded.has(n.id) || openTopic === n.id, thin: !covered });
      if (!expanded.has(n.id)) return;
      nodes.filter((c) => c.parentId === n.id).forEach(add);
      for (const id of n.sourceIds) {
        if (accepted.has(id)) show.push({ id: `s:${id}`, label: sources.get(id)?.title ?? id, kind: "source", radius: 5, parentId: n.id, selected: openSource === id });
      }
    };
    nodes.filter((n) => !n.parentId).forEach(add);
    return show;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- radius derives from these
  }, [nodes, expanded, accepted, sources, openSource, openTopic, weighed, folder.name]);

  const activate = (id: string) => {
    if (id === CENTRE) return;
    if (id.startsWith("s:")) return setOpenSource(id.slice(2));
    // an end point (no subtopics) opens its explanation as well as its sources
    if (!nodes.some((n) => n.parentId === id)) {
      setOpenSource(null);
      setOpenTopic(id === openTopic ? null : id);
    }
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
    <div className="flex min-h-0 flex-1 flex-col border-t border-hairline">
      {notice && <p role="status" className="px-4 py-2 text-xs text-muted">{notice}</p>}
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
          {openTopic && !open && (
            <aside aria-label="Concept" className="w-96 shrink-0 overflow-y-auto border-l border-hairline p-4">
              <button onClick={() => setOpenTopic(null)} aria-label="Close concept" className="mb-2 rounded-lg p-1 text-muted hover:bg-sand">
                <X size={18} strokeWidth={1.5} />
              </button>
              <EndPointCard
                key={openTopic}
                node={nodes.find((n) => n.id === openTopic)!}
                neighbours={nodes.filter((n) => n.parentId === nodes.find((m) => m.id === openTopic)?.parentId && n.id !== openTopic).map((n) => n.label)}
                pages={(pages ?? []).map((p) => ({ title: p.title || "Untitled", text: p.plainText }))}
                sources={[...accepted].flatMap((id) => sources.get(id)?.title ?? [])}
                folderId={folder.id}
                onOpenSource={setOpenSource}
                sourceTitle={(id) => sources.get(id)?.title}
                accepted={accepted}
              />
            </aside>
          )}
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

// What a concept is, how it relates to its neighbours, an example, and where each part comes from.
function EndPointCard({
  node,
  neighbours,
  pages,
  sources,
  folderId,
  accepted,
  sourceTitle,
  onOpenSource,
}: {
  node: TreeNode;
  neighbours: string[];
  pages: { title: string; text: string }[];
  sources: string[];
  folderId: string;
  accepted: Set<string>;
  sourceTitle(id: string): string | undefined;
  onOpenSource(id: string): void;
}) {
  const [card, setCard] = useState<EndPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const relevant = pages.filter((p) => p.text.toLowerCase().includes(node.label.toLowerCase().split(" ")[0])).slice(0, 8);
    post<EndPoint>("neurolib/explain", { concept: node.label, neighbours, notes: relevant.length ? relevant : pages.slice(0, 5), sources: sources.slice(0, 30), folderId })
      .then((c) => live && setCard(c))
      .catch((err) => live && setError(errorText(err)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one explanation per opened concept
  }, [node.id]);
  const own = node.sourceIds.filter((id) => accepted.has(id));
  return (
    <article className="space-y-3 text-sm">
      <h2 className="font-display text-xl font-semibold">{node.label}</h2>
      {!card && !error && (
        <p className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-spark" aria-hidden="true" /> Reading the folder…
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {card && (
        <>
          <section>
            <h3 className="label">What it is</h3>
            <p className="mt-1">{card.what}</p>
          </section>
          {card.relations.length > 0 && (
            <section>
              <h3 className="label">How it relates</h3>
              <ul className="mt-1 space-y-1">
                {card.relations.map((r) => (
                  <li key={r.neighbour}>
                    <span className="font-medium">{r.neighbour}:</span> {r.how}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-lg bg-sand p-3">
            <h3 className="label">Example</h3>
            <p className="mt-1">{card.example}</p>
          </section>
          <section>
            <h3 className="label">Where it comes from</h3>
            <ul className="mt-1 space-y-1">
              {card.from.map((f) => (
                <li key={f.label} className={f.kind === "outside" ? "text-spark-ink" : ""}>
                  {f.kind === "outside" ? "Outside your folder: " : ""}
                  {f.label}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {own.length > 0 && (
        <section>
          <h3 className="label">Sources</h3>
          <ul className="mt-1 space-y-1">
            {own.map((id) => (
              <li key={id}>
                <button onClick={() => onOpenSource(id)} className="text-left underline hover:text-spark-ink">
                  {sourceTitle(id) ?? id}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
