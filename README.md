# relib

A workspace where the right information finds you. Write notes with `/` commands. An agent reads them, finds papers, and tells you how each one fits and where it falls short. Neurolib turns each folder into a bubble map of what you have researched. Relib v1, the folder's agent, explains and questions; it never writes your notes.

Built for the Meta Global AI Developer Hackathon (Indie track, theme: Build for Your World).

## What it does

- **Sources panel:** each suggestion shows fit, why it helps, weak points, and whether it was judged on the **full text** (your uploaded PDF) or the **abstract only**. Accept or decline; both change later suggestions.
- **Folders with a kind and a role:** study, research, work or personal. Each folder sets Relib v1's role (Tutor, Analyst, …). The no-ghostwriting rule applies in every role.
- **Neurolib in every folder:** a brain-style map of the folder's topics, sized by depth. Click to expand, open a source.
- **`/research`** inserts your saved preset's title block and required sections; **`/preset`** edits it. **`/code`** runs Python in your browser and saves the output with the note.
- **Since your last visit:** opening a folder after a while shows what arrived since, from the folder's own records.
- **Accounts:** Clerk sign-in, notes stored in Neon (Postgres), PDFs in private Vercel Blob storage.
- **Try the demo:** no sign-in, seeded data, saved results only.

## How the agent works

1. **Extract:** after 3 seconds idle, Muse Spark lists the concepts in your notes.
2. **Search:** OpenAlex and arXiv are queried for each concept, using their official APIs.
3. **Rank:** results are ranked against your notes, then nudged by what you accepted and declined.
4. **Critique:** Muse Spark checks the top results against your notes and reports why each helps and its weak points. It uses the abstract, or the full text of a PDF you uploaded, and says which.
5. **Learn:** Accept saves a source to the folder. Decline hides it and pushes similar ones down.

Paper and file text is treated as data: instructions inside a PDF are reported as a weak point, never followed. The agent has no tools that send, post or delete.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values; names are explained in the file
npm run db:migrate     # creates the tables in Neon
npm run spike          # confirms the Meta key works
npm run dev
```

| Variable | Needed for |
|---|---|
| `META_API_KEY`, `META_API_BASE_URL`, `META_MODEL_SPARK` | All AI work |
| `OPENALEX_API_KEY`, `OPENALEX_MAILTO` | Paper search (optional key) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Sign-in. Without them only the demo runs. |
| `DATABASE_URL` | Accounts' notes and files metadata (Neon) |
| `BLOB_READ_WRITE_TOKEN` | PDF uploads (private Vercel Blob store) |
| `DEMO_MODE` | `true` makes every visitor use saved results only |

Only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is public. Every other value is secret and lives in `.env` locally and in Vercel's environment settings.

| Command | What it does |
|---|---|
| `npm run spike` | One chat call and one JSON call to Muse Spark |
| `npm run try:sources -- "market failure economics"` | Prints search results |
| `npm run try:agent` | Runs topics, search and critique on a sample note |
| `npm run seed` | Rebuilds `seed/` (demo data and saved results) from the live pipeline |
| `npm run db:migrate` | Applies `db/schema.sql` |
| `npm test` | Unit tests; with `DATABASE_URL` set, also the cross-user isolation tests |

## Who spends credit

- Signed-out visitors (the demo) only get saved results from `seed/demo-cache.json`. They cannot trigger a model call.
- Signed-in users get live calls, rate-limited per user.
- `DEMO_MODE=true` turns live calls off for everyone.

## Meta models used

- **Muse Spark** (`muse-spark-1.3`, Meta Model API): topic extraction, fit and gap analysis on abstracts and full text, Relib v1, Neurolib tree.

All model calls go through `src/lib/model.ts`, on the server only.

## Built during the event

All code in this repository was written during the event, starting from a repository holding only a licence file.

Stack: Next.js, TypeScript, Lexical, Tailwind CSS, react-force-graph-2d, Dexie, Zod, Clerk, postgres.js on Neon, Vercel Blob, unpdf, Pyodide. Paper data comes from [OpenAlex](https://openalex.org) and [arXiv](https://arxiv.org).
