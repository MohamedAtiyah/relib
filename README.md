# relib

A research workspace where your sources find you. Write notes with `/` commands. An agent reads them, finds papers, and tells you how each one helps and where it falls short. Neurolib turns the folder into a bubble graph of what you have researched. The AI never writes your notes.

Built for the Meta Global AI Developer Hackathon (Indie track, theme: Build for Your World).

## How the agent works

1. **Extract:** after 3 seconds idle, Muse Spark lists the concepts in your notes.
2. **Search:** OpenAlex and arXiv are queried for each concept, using their official APIs.
3. **Rank:** results are ranked against your notes, then nudged by what you accepted and declined.
4. **Critique:** Muse Spark checks the top results against your notes and reports why each helps and its weak points. It only uses the abstract and says so.
5. **Learn:** Accept saves a source to the folder. Decline hides it and pushes similar ones down.

The tutor explains and quizzes but refuses to write notes. Abstracts are the only paper text read or stored; every card links to the original.

## Setup

```bash
npm install
cp .env.example .env.local   # add META_API_KEY from https://dev.meta.ai
npm run spike                # confirms the key works
npm run dev
```

Without a key the app still runs on a keyword stand-in, clearly labelled in the UI. Its output is not AI.

| Command | What it does |
|---|---|
| `npm run spike` | One chat call and one JSON call to Muse Spark |
| `npm run try:sources -- "market failure economics"` | Prints search results |
| `npm run try:agent` | Runs topics, search and critique on a sample note |
| `npm run seed` | Rebuilds `seed/` from the live pipeline |
| `npm test` | Unit tests |

## Deploying the public demo

Run `npm run seed` with a real key first, because the committed seed comes from the stand-in. Commit the result, then deploy to Vercel with `DEMO_MODE=true`. Demo mode serves saved results only and makes no model calls, so a public link cannot spend credits. Do not set `META_API_KEY` on the public deployment.

## Meta models used

- **Muse Spark** (`muse-spark-1.3`, Meta Model API): topic extraction, fit and gap analysis, tutor, Neurolib tree.

All model calls go through `src/lib/model.ts`, on the server only.

## Built during the event

All code in this repository was written during the event, starting from a repository holding only a licence file.

Stack: Next.js, TypeScript, Lexical, Tailwind CSS, react-force-graph-2d, Dexie, Zod. Paper data comes from [OpenAlex](https://openalex.org) and [arXiv](https://arxiv.org). Notes stay in your browser (IndexedDB); there is no account or database.
