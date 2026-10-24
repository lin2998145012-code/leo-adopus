// Playful shapes for year-in-review cards: starbursts, scallops, pixel
// blobs and neon ribbons. All draw into a canvas 2D context.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
export const easeInOut = (x) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
};
// Overshoots, then settles: the bouncy pop used for shapes and rows.
export const easeBack = (x, s = 1.9) => {
  const k = clamp(x) - 1;
  return 1 + (s + 1) * k * k * k + s * k * k;
};

// Deterministic pseudo-random numbers from a seed.
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function starburst(g, cx, cy, r, spikes, inner, rot, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * inner : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

export function scallop(g, cx, cy, r, bumps, depth, rot, color) {
  g.fillStyle = color;
  g.beginPath();
  const n = bumps * 16;
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = r * (1 - depth + depth * Math.abs(Math.cos((a - rot) * bumps * 0.5)));
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

// A blob made of square pixels, revealed from the center outward.
export function pixelBlob(g, cx, cy, r, cell, seed, progress, colors) {
  const rand = rng(seed);
  const wob = [rand(), rand(), rand(), rand()];
  const n = Math.ceil(r / cell);
  for (let y = -n; y <= n; y++) {
    for (let x = -n; x <= n; x++) {
      const a = Math.atan2(y, x);
      const edge = r * (0.78 + 0.16 * Math.sin(a * 3 + wob[0] * 6) + 0.08 * Math.sin(a * 5 + wob[1] * 6));
      const d = Math.hypot(x, y) * cell;
      if (d > edge || d > edge * easeOut(progress) * 1.05) continue;
      const pick = Math.floor(((x * 7 + y * 13 + seed * 31) % colors.length + colors.length) % colors.length);
      g.fillStyle = colors[pick];
      g.fillRect(cx + x * cell - cell / 2, cy + y * cell - cell / 2, cell + 0.5, cell + 0.5);
    }
  }
}

// A thick neon ribbon along a smooth curve, drawn up to `progress` (0-1),
// with an iridescent gradient.
export function ribbon(g, pts, width, progress, colors) {
  if (progress <= 0) return;
  const grad = g.createLinearGradient(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  // Sample a Catmull-Rom spline through the points.
  const samples = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 16; k++) {
      const t = k / 16;
      const t2 = t * t;
      const t3 = t2 * t;
      samples.push([0, 1].map((j) =>
        0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)
      ));
    }
  }
  samples.push(pts[pts.length - 1]);
  const count = Math.max(2, Math.floor(samples.length * clamp(progress)));
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = width;
  g.strokeStyle = grad;
  g.beginPath();
  samples.slice(0, count).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // A thin highlight gives the ribbon its glossy, folded look.
  g.lineWidth = width * 0.18;
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  samples.slice(0, count).forEach(([x, y], i) => (i ? g.lineTo(x - width * 0.18, y - width * 0.18) : g.moveTo(x - width * 0.18, y - width * 0.18)));
  g.stroke();
  g.restore();
}

// Random wavy ribbon path across a box, from a seed.
export function ribbonPath(seed, x0, y0, x1, y1, waves = 3) {
  const rand = rng(seed);
  const pts = [];
  const n = waves * 2 + 1;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const amp = (y1 - y0) * (0.25 + rand() * 0.35);
    pts.push([x0 + (x1 - x0) * k, (y0 + y1) / 2 + (i % 2 ? amp : -amp) * (0.6 + rand() * 0.4)]);
  }
  return pts;
}

// A band of alternating squares that scrolls sideways: the checkered edges
// on intro and closing cards.
export function checkerBand(g, y, h, width, offset, colors) {
  const cell = h / 2;
  const shift = ((offset % (cell * 2)) + cell * 2) % (cell * 2);
  for (let row = 0; row < 2; row++) {
    for (let x = -cell * 2 + shift, i = 0; x < width + cell; x += cell, i++) {
      g.fillStyle = colors[(i + row) % 2];
      g.fillRect(x, y + row * cell, cell + 0.5, cell + 0.5);
    }
  }
}
