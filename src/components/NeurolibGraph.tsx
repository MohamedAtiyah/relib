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
  thin?: boolean; // little material covers it: drawn dashed, tagged "needs material"
};

// A stable number per node, so each neuron keeps the same dendrites and signal timing between frames.
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // Brain style: topics are solid (ink at the top level, muted below), the open path glows spark, sources are pale cells.
  const fill = (node: Drawn) => {
    if (node.kind === "source") return css("--surface");
    if (node.kind === "folder") return css("--spark-wash");
    if (node.selected) return css("--spark");
    return css(node.parentId === "centre" ? "--ink" : "--muted");
  };

  const draw = (node: Drawn, ctx: CanvasRenderingContext2D) => {
    const { x = 0, y = 0, radius, kind, selected, thin } = node;
    const colour = fill(node);
    if (kind === "topic") {
      // dendrites: 3 to 6 short curved branches around the body
      const seed = hash(node.id);
      const count = 3 + (seed % 4);
      ctx.strokeStyle = colour;
      ctx.lineCap = "round";
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (seed % 100) / 50;
        const reach = radius * (1.3 + ((seed >> (i + 2)) % 4) / 10);
        const bend = angle + 0.35;
        ctx.lineWidth = Math.max(0.5, radius / 18);
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * radius * 0.8, y + Math.sin(angle) * radius * 0.8);
        ctx.quadraticCurveTo(x + Math.cos(bend) * reach * 0.8, y + Math.sin(bend) * reach * 0.8, x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // a soft body: brighter at the centre, fading at the edge
    const body = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius / 6, x, y, radius);
    body.addColorStop(0, kind === "topic" ? colour : css("--surface"));
    body.addColorStop(1, colour);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = body;
    ctx.globalAlpha = thin && !selected ? 0.55 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (kind !== "topic" || thin) {
      ctx.lineWidth = 1;
      ctx.setLineDash(thin && kind === "topic" ? [3, 2] : []);
      ctx.strokeStyle = css(kind === "folder" || selected || thin ? "--spark" : "--hairline");
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (thin && kind === "topic") {
      ctx.font = `4px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = css("--spark-ink");
      ctx.textAlign = "center";
      ctx.fillText("needs material", x, y + radius + 6);
    }
    const label = node.label;

    ctx.fillStyle = css(kind === "topic" && !selected ? "--paper" : "--ink");
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

  // Curved, tapered links (thick at the parent), the open path in orange, and a slow signal dot travelling along each.
  const drawLink = (link: LinkObject<Drawn>, ctx: CanvasRenderingContext2D) => {
    const a = link.source as Drawn;
    const b = link.target as Drawn;
    if (a.x === undefined || b.x === undefined || a.y === undefined || b.y === undefined) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const cx = (a.x + b.x) / 2 + nx * length * 0.15;
    const cy = (a.y + b.y) / 2 + ny * length * 0.15;
    const start = Math.min(3, a.radius / 3);
    const end = 0.6;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * start, a.y + ny * start);
    ctx.quadraticCurveTo(cx, cy, b.x + nx * end, b.y + ny * end);
    ctx.lineTo(b.x - nx * end, b.y - ny * end);
    ctx.quadraticCurveTo(cx, cy, a.x - nx * start, a.y - ny * start);
    ctx.closePath();
    ctx.fillStyle = css(b.selected ? "--spark" : "--hairline");
    ctx.globalAlpha = b.selected ? 0.9 : 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (reducedMotion()) return;
    const t = ((Date.now() / 4000 + (hash(String(b.id)) % 100) / 100) % 1);
    const px = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x;
    const py = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
    ctx.beginPath();
    ctx.arc(px, py, 1.2, 0, 2 * Math.PI);
    ctx.fillStyle = css("--spark");
    ctx.fill();
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
          linkCanvasObject={drawLink}
          autoPauseRedraw={reducedMotion()}
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
