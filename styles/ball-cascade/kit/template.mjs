// Starter brief for `adopus new --style ball-cascade`.
export function template(args, copyIn) {
  return {
    product: { name: args.name, image: copyIn(args.product), logo: copyIn(args.logo), size: Number(args.size ?? 0.9) },
    aspect: args.aspect ?? '16:9',
    palette: args.palette ? String(args.palette).split(',') : undefined,
    music: { file: copyIn(args.music), bpm: Number(args.bpm ?? 92) },
    shots: ['wide', 'low', 'detail', 'downhill', 'close', 'product'],
    end: { tagline: args.tagline ?? `${args.name}. Like no other.` },
  };
}
