// Starter brief for `adopus new --style year-in-review`. The cards are a
// skeleton to fill in with real numbers and copy.
export function template(args, copyIn) {
  const name = args.name;
  const year = Number(args.year ?? new Date().getFullYear());
  return {
    product: { name, url: args.url, logo: copyIn(args.logo) },
    year,
    aspect: args.aspect ?? '9:16',
    music: { file: copyIn(args.music), bpm: Number(args.bpm ?? 120) },
    palette: args.palette ? String(args.palette).split(',') : undefined,
    cards: [
      { type: 'intro', title: `Your ${year} with ${name}` },
      { type: 'number', label: 'Replace with what you counted', value: 100000, text: 'One line that makes the number feel real.' },
      { type: 'list', title: 'Your top five', items: ['First', 'Second', 'Third', 'Fourth', 'Fifth'] },
      { type: 'statement', title: 'One surprising fact from the year.', text: 'A short punchline.' },
      { type: 'persona', kicker: `Your ${name} personality`, title: 'The Regular', text: 'Two sentences about who your customers were this year.' },
      { type: 'summary', title: `${name} ${year}`, list: { title: 'Top five', items: ['First', 'Second', 'Third', 'Fourth', 'Fifth'] }, stats: [{ label: 'Replace me', value: '100K' }], cta: args.url ?? '' },
      { type: 'outro', title: `Thanks for an incredible ${year}`, cta: args.url ?? '' },
    ],
  };
}

export const next = 'Fill in the cards in brief.json with real numbers and copy before rendering.';
