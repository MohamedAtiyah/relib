import { searchSources } from "@/lib/sources";

const queries = process.argv.slice(2);
if (!queries.length) throw new Error('Usage: npm run try:sources -- "supply and demand economics"');
for (const q of queries) {
  const found = await searchSources([q]);
  console.log(`\n${q}: ${found.length} results`);
  for (const s of found) console.log(`- [${s.origin}] ${s.year} ${s.title}\n  ${s.abstract.slice(0, 120)}`);
}
