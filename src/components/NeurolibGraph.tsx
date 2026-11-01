"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";

export type GraphNode = {
  id: string;
  label: string;
  kind: "folder" | "topic" | "source";
  radius: number;
  parentId?: string;
  selected?: boolean;
};

type Drawn = NodeObject<GraphNode>;

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

export function NeurolibGraph({ nodes, onClick }: { nodes: GraphNode[]; onClick(id: string): void }) {
  const box = useRef<HTMLDivElement>(null);
  const graph = useRef<ForceGraphMethods<Drawn> | undefined>(undefined);
  const [placed] = useState(() => new Map<string, Drawn>()); // keeps positions when bubbles split
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize(entry.contentRect));
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => {
    const drawn = nodes.map((node) => {
      const known = placed.get(node.id);
      const parent = node.parentId ? placed.get(node.parentId) : undefined;
      const next: Drawn = Object.assign(known ?? { x: parent?.x, y: parent?.y }, node);
      placed.set(node.id, next);
      return next;
    });
    const links: LinkObject<Drawn>[] = nodes.flatMap((n) => (n.parentId ? [{ source: n.parentId, target: n.id }] : []));
    return { nodes: drawn, links };
  }, [nodes, placed]);

  useEffect(() => {
    graph.current?.d3Force("charge")?.strength((n: Drawn) => -22 * n.radius);
    graph.current?.d3Force("link")?.distance((l: { source: Drawn; target: Drawn }) => l.source.radius + l.target.radius + 40);
    graph.current?.d3ReheatSimulation();
  }, [data, size.width]);

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name);

  const draw = (node: Drawn, ctx: CanvasRenderingContext2D) => {
    const { x = 0, y = 0, radius, kind, label, selected } = node;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = css(kind === "source" ? "--sand" : "--surface");
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = css(selected ? "--spark" : "--hairline");
    ctx.stroke();

    ctx.fillStyle = css("--ink");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const family = getComputedStyle(document.body).fontFamily;
    if (kind === "source") {
      ctx.font = `4px ${family}`;
      const lines = wrap(ctx, label.length > 42 ? `${label.slice(0, 42)}…` : label, 56);
      lines.forEach((line, i) => ctx.fillText(line, x, y + radius + 5 + i * 5));
      return;
    }
    ctx.font = `10px ${family}`;
    const widest = Math.max(...label.split(" ").map((word) => ctx.measureText(word).width));
    const fontSize = Math.min(radius / 2.8, (10 * 1.7 * radius) / widest); // the longest word must fit the bubble
    ctx.font = `${fontSize}px ${family}`;
    const lines = wrap(ctx, label, radius * 1.7);
    const top = y - ((lines.length - 1) * fontSize * 1.15) / 2;
    lines.forEach((line, i) => ctx.fillText(line, x, top + i * fontSize * 1.15));
  };

  return (
    <div ref={box} className="min-h-0 min-w-0 flex-1">
      {size.width > 0 && (
        <ForceGraph2D<GraphNode>
          ref={graph}
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          linkColor={() => css("--hairline")}
          nodeLabel={(n) => n.label}
          nodeCanvasObject={draw}
          nodePointerAreaPaint={(n, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, n.radius, 0, 2 * Math.PI);
            ctx.fill();
          }}
          onNodeClick={(n) => onClick(String(n.id))}
          cooldownTicks={80}
          onEngineStop={() => graph.current?.zoomToFit(400, 90)}
        />
      )}
    </div>
  );
}
