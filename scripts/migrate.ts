import { readFileSync } from "node:fs";
import { sql } from "@/lib/sql";

await sql().unsafe(readFileSync("db/schema.sql", "utf8"));
console.log("Schema applied");
await sql().end();
