// Starter brief for `adopus new --style red-poster-wit`. The lines are a
// skeleton: replace them with the brand's own wit.
export function template(args, copyIn) {
  return {
    product: { name: args.name, logo: copyIn(args.logo) },
    aspect: args.aspect ?? '16:9',
    color: args.color ?? '#f5170a',
    music: { file: copyIn(args.music), bpm: Number(args.bpm ?? 96) },
    posters: [
      'One line about your customer | that makes them smile.',
      'A second line, | shorter.',
      'A third line that flatters the reader.',
    ],
    end: { tagline: args.tagline ?? '' },
  };
}

export const next = 'Write the poster lines in brief.json before rendering: one thought each, setup | punchline.';
