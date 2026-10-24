// Starter brief for `adopus new --style chain-reaction`.
export function template(args, copyIn) {
  return {
    product: {
      name: args.name,
      image: copyIn(args.product),
      logo: copyIn(args.logo),
      size: Number(args.size ?? 0.36),
    },
    aspect: args.aspect ?? '16:9',
    accent: args.accent ?? '#c8261e',
    links: args.links ? String(args.links).split(',').map((s) => s.trim()) : ['dominoes', 'seesaw', 'gearbox', 'uphill', 'pendulum'],
    music: { file: copyIn(args.music) },
    end: { tagline: args.tagline ?? `${args.name}. Every part, working together.` },
  };
}
