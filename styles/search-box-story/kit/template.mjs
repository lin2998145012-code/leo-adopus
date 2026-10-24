// Starter brief for `adopus new --style search-box-story`. The steps are a
// skeleton: replace them with the searches that tell your customer's story.
export function template(args, copyIn) {
  const name = args.name;
  return {
    product: { name, url: args.url, logo: copyIn(args.logo) },
    engine: { name: args.engine ?? 'Search' },
    aspect: args.aspect ?? '16:9',
    music: { file: copyIn(args.music), bpm: Number(args.bpm ?? 100) },
    steps: [
      { query: 'the problem your customer has, as they would search it' },
      { query: `best tool for that problem`, answer: { type: 'site', title: `${name} — your one-line promise`, url: args.url ?? '', text: 'One sentence about what it does.', links: ['Download', 'Features', 'Pricing', 'Stories'] } },
      { query: 'what they try next with your product', click: 0 },
      { query: 'the moment it pays off', sfx: 'bells' },
    ],
    end: { tagline: args.tagline ?? `${name}. On.` },
  };
}

export const next = 'Rewrite the steps in brief.json as the searches that tell your story before rendering.';
