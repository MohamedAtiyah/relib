# Decisions

- Model: `muse-spark-1.3`, the version Meta's docs recommend for new work. Base URL `https://api.meta.ai/v1`, Bearer auth, Chat Completions format.
- `chat()` takes a JSON schema instead of `json: true`: Meta documents `response_format: json_schema` but no plain JSON mode. Zod plus one retry still applies.
- `reasoning_effort: "low"` on every call to control cost; Muse Spark always reasons and rejects `"none"`.
- `temperature` stays unset by default, as Meta advises for Muse Spark.
- No API key available during the build, so a labelled keyword stand-in sits behind `model.ts`.
- Muse Spark Open skipped: it is not on the Model API and needs a separate host and key. Muse Image and Voice also skipped as optional.
- OpenAlex uses `search.semantic`: keyword search returned biology papers for "supply and demand". Same cost per call.
- OpenAlex filters to English articles with abstracts, so unreadable or abstract-less results never reach the model.
- Added `field` to topic output, appended to searches to keep short concepts in the right discipline.
- Regex parser for arXiv Atom instead of an XML dependency; the format is fixed and it is tested.
- War and politics terms are filtered from search results, because arXiv surfaced them from plain economics queries.
- Added `pageId` to `Suggestion` so suggestions shift by page, as the demo requires.
- Added `createdAt` and `analysedText` to `Page`, for stable ordering and to skip re-analysing unchanged notes.
- At most 4 new sources analysed per run, and only after 40 characters of change, to protect the credit budget.
- A decline is a ranking penalty, not a ban on similar papers, so one decline cannot empty the panel.
- Server-side cache files for demo mode live in `seed/demo-cache.json`; the browser seed is `seed/economics.json`.
- `/source` lists accepted sources directly in the slash menu instead of opening a separate picker.
- No rename or delete for pages and folders, as the brief does not ask for them.
- Neurolib has a centre folder bubble: without it the top-level topics drift apart in the force layout.
- Neurolib has a topic list beside the canvas, because a canvas has no keyboard or screen reader path.
- Rate limits and the arXiv gate are per server instance; good enough for a demo, noted in code.
- Dark mode follows the system setting; no manual switch.

## Final build (RELIB_FINAL.md)

- PDFs go to Vercel Blob, not R2: one token, and private blobs are served through `/api/files/[id]`, which checks the owner.
- The browser uploads straight to Blob under a `<userId>/` prefix; the server refuses any other prefix, then reads the PDF itself with unpdf. File text never travels back through the browser.
- The browser keeps an IndexedDB copy per workspace (`relib-<userId>`, `relib-demo`) for speed; Neon is the record. Writes sync through a Dexie middleware, last write wins by `updatedAt`.
- Deletes do not sync, except file deletes, which the server does itself. Nothing else in the app deletes yet.
- Every table has the key `(owner_id, id)`, and `owner_id` always comes from the Clerk session, never the request body.
- Tables skipped for now: `workspaces`, `connectors`, `connector_grants`, `activity_log`. They belong to v2 connectors; one workspace per user is enough today. `cache` exists but is unused: results are cached in the browser and in the demo file.
- `users.email` stays empty: storing it would need an extra Clerk call, and nothing uses it yet.
- Signed-out requests to AI routes always use saved results, even with `DEMO_MODE=false`, so the public demo cannot spend credit.
- Without Clerk keys the app still serves the demo; `/app` redirects to the landing page. Clerk 7 no longer creates keyless apps by itself.
- Sign-in uses Clerk's modal, so there are no sign-in pages to maintain.
- Neurolib moved inside the workspace as a view of the open folder; the `/neurolib` route is gone.
- "Since your last visit" lists counts and titles from the folder's records, with no model call, so it cannot invent anything. It shows after 6 hours away.
- One saved preset per workspace, as the brief asks. Blank Title and Date fill in from the page title and today.
- `/code` is now Python (Pyodide 314.0.7 in a Web Worker from jsDelivr, stopped after 30 seconds); the old monospace block is `/snippet`.
- Relib v1 is the tutor renamed: same no-ghostwriting prompt, plus the folder's role.
- Meta calls retry twice on a 60-second timeout, as well as on 429 and 5xx.
