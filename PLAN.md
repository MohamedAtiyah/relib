# Plan: academic rebuild

Spec: `RELIB_CLAUDE_CODE_PROMPT.md` (outside the repo). Started 4 Nov, 22:09 Dubai; feature freeze 02:00.

## What exists
- Next.js 16 app: landing `/`, `/app` (Clerk), `/demo` (no sign-in).
- Lexical editor with slash commands, Python cell (Pyodide worker), callouts, toggles, source blocks.
- Source agent: topics → OpenAlex/arXiv → rank → fit/gap (Muse Spark via `src/lib/model.ts`), sources panel with accept/decline.
- Relib v1 chat (no-ghostwriting prompt), Neurolib force graph per folder.
- Neon via `postgres`, Dexie copy in the browser synced through `/api/sync`, per-user `(owner_id, id)` keys, isolation tests.
- PDF upload to Vercel Blob with unpdf text extraction.

## Removed
- Seeded economics content, `seed/`, `scripts/build-seed.ts`, the demo cache (the demo now makes capped live calls).
- Folder kinds (work, personal) and per-folder roles; the "Since your last visit" card (replaced by Pick up where you left off).
- Vercel Blob (replaced by Cloudflare R2).
- Nothing to remove for Google, Resend, Slack, Zoho, Discord, MCP, quizzes, `/study`, `/deck`, `/sheet`, restaurant or finance screens: they were never built here.

## Change
- Pages get a type: notes, research, programming. `/notes`, `/research`, `/programming` create that page.
- Demo: live calls with a per-visitor daily cap, a global daily cap and rate limits.

## Order (spec section 9)
1. Strip, Start here page, demo caps
2. UI pass
3. `/notes`: Sources toggle, Materials (R2), topic-aware tutor
4. `/research` and citations
5. `/code` block languages
6. Maths
7. E2B sandbox
8. `/programming`
9. Neurolib restyle
10. Workspace home
— cut line —

## Status (4 Nov, about 23:10 Dubai)
Done and checked in the browser or by tests: steps 1 to 8, and most of step 9.
- 9 Neurolib: neuron drawing, tapered links, signal dots, "needs material", and material concepts feeding the map all render. The end-point explanation panel is written but was not clicked through.
- Not started: 10 Workspace home (Pick up where you left off, time and weather widgets) and everything below the cut line.
- Not done inside earlier steps: the research editor's toolbar (fonts, alignment, footnotes, table of contents, page breaks), copying an equation as an image, and linking formulas into Neurolib.
- Never tested end to end: Clerk sign-in, Neon sync and R2 uploads (no keys locally; R2 also needs a CORS rule allowing PUT from the site). The sandbox was tested with the key from `.env`, which is named `E2B_AP_KEY` there; the code reads `E2B_API_KEY`.
