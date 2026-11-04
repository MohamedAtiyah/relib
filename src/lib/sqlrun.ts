import type { SqlJsStatic } from "sql.js";

const VERSION = "1.15.2"; // matches package.json, so the wasm and its loader agree
let engine: Promise<SqlJsStatic> | undefined;

const sqlite = () =>
  (engine ??= import("sql.js").then((m) => m.default({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@${VERSION}/dist/${file}` })));

export type SqlTable = { columns: string[]; values: unknown[][] };

// Run: a fresh in-memory database each time, so nothing persists between runs.
export async function runSql(code: string): Promise<{ tables: SqlTable[]; error?: string }> {
  const SQL = await sqlite();
  const db = new SQL.Database();
  try {
    return { tables: db.exec(code).map((r) => ({ columns: r.columns, values: r.values.slice(0, 200) })) };
  } catch (err) {
    return { tables: [], error: String(err instanceof Error ? err.message : err) };
  } finally {
    db.close();
  }
}

export type SchemaTable = { name: string; columns: { name: string; type: string; key?: boolean; ref?: string }[] };

// Design only: read the CREATE TABLE statements, never run queries on data.
export function parseSchema(code: string): SchemaTable[] {
  const tables: SchemaTable[] = [];
  for (const m of code.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi)) {
    const table: SchemaTable = { name: m[1], columns: [] };
    // split on commas that are not inside brackets
    const parts: string[] = [];
    let depth = 0;
    let part = "";
    for (const ch of m[2]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(part);
        part = "";
      } else part += ch;
    }
    parts.push(part);
    for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
      const fk = raw.match(/^foreign\s+key\s*\(\s*["`]?(\w+)["`]?\s*\)\s*references\s+["`]?(\w+)/i);
      if (fk) {
        const col = table.columns.find((c) => c.name === fk[1]);
        if (col) col.ref = fk[2];
        continue;
      }
      const pk = raw.match(/^primary\s+key\s*\(([^)]*)\)/i);
      if (pk) {
        for (const name of pk[1].split(",").map((n) => n.trim().replace(/["`]/g, ""))) {
          const col = table.columns.find((c) => c.name === name);
          if (col) col.key = true;
        }
        continue;
      }
      if (/^(constraint|unique|check|index|key)\b/i.test(raw)) continue;
      const col = raw.match(/^["`]?(\w+)["`]?\s*([\w ,()]*?)(?=\s+(?:primary|not|null|default|references|unique|check)\b|$)/i);
      if (!col) continue;
      table.columns.push({
        name: col[1],
        type: col[2].trim(),
        key: /primary\s+key/i.test(raw) || undefined,
        ref: raw.match(/references\s+["`]?(\w+)/i)?.[1],
      });
    }
    tables.push(table);
  }
  return tables;
}

// Checks the schema by creating it in an empty, throwaway database. Only CREATE statements are run.
export async function checkSchema(code: string): Promise<string | null> {
  const ddl = [...code.matchAll(/create\s+(?:table|index|view|unique\s+index)[\s\S]*?;/gi)].map((m) => m[0]).join("\n");
  if (!ddl) return "No CREATE TABLE statements found.";
  const SQL = await sqlite();
  const db = new SQL.Database();
  try {
    db.exec(ddl);
    return null;
  } catch (err) {
    return String(err instanceof Error ? err.message : err);
  } finally {
    db.close();
  }
}
