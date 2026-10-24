// Starter brief for `adopus new --style whitespace-humble`. The copy is a
// skeleton: replace it with an honest headline and body for the product.
export function template(args, copyIn) {
  const name = args.name;
  return {
    product: { name, image: copyIn(args.product), logo: copyIn(args.logo), scale: Number(args.scale ?? 1) },
    aspect: args.aspect ?? '4:5',
    music: { file: copyIn(args.music), bpm: Number(args.bpm ?? 112) },
    headline: args.headline ?? 'Admit the small thing.',
    body: [
      `Start with the thing everyone notices first about ${name}, and admit it.`,
      'Then explain, plainly and with a little wit, why it is that way on purpose.',
      'Turn the flaw into the reason to buy. Short sentences. No adjectives you would not say out loud.',
      'End on a line that sends the reader back to the headline.',
    ],
    signoff: args.signoff ?? 'Think it over.',
    legal: args.legal ?? '',
  };
}

export const next = 'Write the headline, body and sign-off in brief.json before rendering.';
