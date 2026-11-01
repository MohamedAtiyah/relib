import type { Source } from "../schemas";

const STOP = new Set(
  "about above after again also among another because been before being below between both could does each every first from have having here into itself just like made make many more most much must only other over same should since some such than that their them then there these they this those through under until upon very were what when where which while will with within without would your using used".split(
    " ",
  ),
);

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter((w) => !STOP.has(w));
}

const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / (a.size || 1);
};

export type Feedback = { accepted: string[]; declined: string[] }; // source titles

// Accepts pull similar sources up, declines push them down. This is the agent's memory.
export function rankSources(sources: Source[], notes: string, feedback: Feedback): Source[] {
  const noteTerms = new Set(words(notes));
  const liked = new Set(feedback.accepted.flatMap(words));
  const disliked = new Set(feedback.declined.flatMap(words));
  const score = (s: Source) => {
    const terms = new Set(words(`${s.title} ${s.title} ${s.abstract}`));
    return overlap(terms, noteTerms) + 0.3 * overlap(terms, liked) - 0.5 * overlap(terms, disliked);
  };
  return sources
    .filter((s) => s.abstract.length >= 200)
    .map((s) => ({ s, rank: score(s) }))
    .sort((a, b) => b.rank - a.rank)
    .map(({ s }) => s);
}
