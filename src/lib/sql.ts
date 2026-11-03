import postgres from "postgres";

let client: postgres.Sql | undefined;

// camel transform: rows come back as the same objects the client stores
export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return (client ??= postgres(process.env.DATABASE_URL, { transform: postgres.camel, prepare: false, max: 5 }));
}
