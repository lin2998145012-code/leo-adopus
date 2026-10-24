// Starter brief for `adopus new --style silhouette-dancers`.
export function template(args, copyIn) {
  return {
    product: {
      name: args.name,
      tagline: args.tagline ?? '',
      image: copyIn(args.product),
      size: args.size ? Number(args.size) : undefined,
      line: args.line ?? 'earbuds',
    },
    length: Number(args.length ?? 15),
    aspect: args.aspect ?? '16:9',
    music: { file: copyIn(args.music), bpm: Number(args.bpm ?? 120) },
    palette: args.palette ? String(args.palette).split(',') : undefined,
  };
}
