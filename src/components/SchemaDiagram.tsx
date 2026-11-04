import type { SchemaTable } from "@/lib/sqlrun";

const W = 190;
const HEAD = 26;
const ROW = 20;
const GAP = 40;
const PER_ROW = 3;

// Tables as boxes in a grid, with a line from each referencing column to the table it points at.
export function SchemaDiagram({ tables }: { tables: SchemaTable[] }) {
  const heights = tables.map((t) => HEAD + Math.max(1, t.columns.length) * ROW + 6);
  const rowTops: number[] = [];
  for (let r = 0; r * PER_ROW < tables.length; r++) {
    const prev = r ? rowTops[r - 1] + Math.max(...heights.slice((r - 1) * PER_ROW, r * PER_ROW)) + GAP : GAP / 2;
    rowTops.push(prev);
  }
  const pos = tables.map((_, i) => ({ x: GAP / 2 + (i % PER_ROW) * (W + GAP), y: rowTops[Math.floor(i / PER_ROW)] }));
  const width = GAP / 2 + Math.min(tables.length, PER_ROW) * (W + GAP);
  const height = Math.max(...pos.map((p, i) => p.y + heights[i])) + GAP / 2;
  const index = new Map(tables.map((t, i) => [t.name.toLowerCase(), i]));

  const links = tables.flatMap((t, i) =>
    t.columns.flatMap((c, r) => {
      const to = c.ref ? index.get(c.ref.toLowerCase()) : undefined;
      if (to === undefined) return [];
      // leave and arrive on the sides that face each other
      const right = pos[to].x >= pos[i].x;
      const from = { x: pos[i].x + (right ? W : 0), y: pos[i].y + HEAD + r * ROW + ROW / 2 };
      const target = { x: pos[to].x + (right ? 0 : W), y: pos[to].y + HEAD / 2 };
      const bend = (right ? 1 : -1) * Math.max(30, Math.abs(target.x - from.x) / 2);
      return [{ key: `${t.name}.${c.name}`, d: `M${from.x},${from.y} C${from.x + bend},${from.y} ${target.x - bend},${target.y} ${target.x},${target.y}` }];
    }),
  );

  return (
    <figure aria-label="Schema diagram" className="overflow-x-auto border-t border-[var(--code-line)] bg-[var(--code-bg)] p-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="font-sans">
        {links.map((l) => (
          <path key={l.key} d={l.d} fill="none" stroke="#e07a2e" strokeWidth={1.5} />
        ))}
        {tables.map((t, i) => (
          <g key={t.name} transform={`translate(${pos[i].x},${pos[i].y})`}>
            <rect width={W} height={heights[i]} rx={8} fill="#1e212c" stroke="#2e3240" />
            <text x={10} y={17} fill="#faf5eb" fontSize={12} fontWeight={600}>
              {t.name}
            </text>
            <line x1={0} x2={W} y1={HEAD} y2={HEAD} stroke="#2e3240" />
            {t.columns.map((c, r) => (
              <text key={c.name} x={10} y={HEAD + r * ROW + 14} fill={c.key ? "#f29a5a" : "#faf5eb"} fontSize={11}>
                {c.key ? "🔑 " : c.ref ? "→ " : ""}
                {c.name}
                <tspan fill="#a3a6b3"> {c.type.toLowerCase()}</tspan>
              </text>
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="px-1 pt-1 font-sans text-[11px] text-[var(--code-muted)]">Drawn from the CREATE TABLE statements. Nothing was run.</figcaption>
    </figure>
  );
}
