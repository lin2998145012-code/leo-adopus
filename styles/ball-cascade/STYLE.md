# Ball cascade

- **Slug:** `ball-cascade`
- **Family:** Spectacle
- **Inspired by:** Sony Bravia "Balls" (2005)
- **Difficulty:** ★★★
- **Length:** 30–45 s (six shots)
- **Best for:** anything sold on color, joy or abundance: screens, cameras,
  speakers, paint, sweets, toys, sneakers, festivals; brands with a
  palette of their own
- **Not for:** serious, technical or quiet products; brands whose colors are
  muted

## The one-glance test

A steep sunny street of painted row houses, and thousands of bright
bouncy balls pouring down it in slow motion, filling the air.

## Keep — the technique

- **The place:** a steep residential street on a clear day: pastel row
  houses stepped down the hill with bay windows and garages, telephone
  poles and wires, an old pickup at the curb, the city hazy at the bottom.
- **The balls:** small, glossy, saturated — pink, yellow, green, orange,
  blue, violet, teal, red — in such numbers that they fill the street and
  the air, bouncing high and scattering, each with a little motion blur.
- **Slow motion:** everything at about a third of real speed, so each
  bounce floats.
- **Shots:** the whole hill from across the street, the street tilted
  across the frame; low on the asphalt with balls coming at the lens; balls
  ricocheting around something on the sidewalk; down the hill toward the
  city; close and shallow through the bounce; and last, the product on the
  sidewalk with balls bouncing past.
- **Copy:** nothing on screen until the end: a short tagline in thin white
  type, then the name small in the corner.
- **Sound:** one gentle acoustic song, fingerpicked, warm and unhurried;
  cuts on the bar line.

## Replace — the assets

| Original | Replace with |
|---|---|
| San Francisco footage and its 250,000 real balls | A street and balls made in code |
| "Heartbeats" | An original fingerpicked guitar piece composed by the kit, or the user's own track |
| "Colour like no other" and the Sony and BRAVIA marks | The product's own tagline, name and logo |
| The television | The user's product image on the sidewalk |

## Inputs

1. Product name and image with a transparent background (`--name`,
   `--product`), and its height in meters on the sidewalk (`--size`,
   default 0.9).
2. A short tagline (`--tagline`), ideally about color, joy or abundance;
   not "… like no other".
3. Optional ball colors in the brand's palette (`--palette
   '#ff2d95,#ffd400,…'`), logo, aspect and music.

## Brief

```jsonc
{
  "style": "ball-cascade",
  "product": { "name": "Orrin", "image": "speaker.png", "logo": null, "size": 0.9 },
  "aspect": "16:9",
  "palette": null,            // ball colors; the classic rainbow when null
  "slowmo": 0.3,              // fraction of real speed
  "music": { "file": null, "bpm": 92 },
  // Any order; each may be { "kind": "wide", "bars": 4 }.
  "shots": ["wide", "low", "detail", "downhill", "close", "product"],
  "end": { "tagline": "Every colour, out loud." }
}
```

| Shot | View | Bars |
|---|---|---|
| `wide` | the hill from across the street, the pickup at the curb | 3 |
| `low` | low on the asphalt, looking up the hill | 2 |
| `detail` | balls ricocheting off a mailbox and trash cans | 2 |
| `downhill` | from high on the hill toward the city | 2 |
| `close` | a long lens through the bounce, by a fire hydrant | 2 |
| `product` | the product on the sidewalk; tagline, then the name | 4 |

## Sound

Fingerpicked eighth notes over D–Bm–G–A at the brief's `bpm` (92 by
default), a simple tune from the third bar, a glockenspiel in the last
shot, and the last chord left to ring.

## Render notes

- Real 3D with three.js: a street, houses and props built in code, sun and
  sky lighting with soft shadows, depth of field and a warm grade.
- Up to 9,000 balls per shot, simulated with gravity, air drag and bounces
  on the hill, curbs, house fronts and props. Each shot runs its own
  stream: balls that leave the bottom are thrown back in at the top. Balls
  are stretched along their motion to fake a film shutter.
- Rendering without a GPU is slow (about 2 s a frame); a 40-second film
  takes around half an hour.

## Pitfalls

- **Muted palettes** kill the joy. If the brand's colors are dull, keep the
  rainbow and let the product carry the brand.
- **Text during the cascade.** Nothing until the last shot.
- **A tiny product.** On the sidewalk it needs to be at least knee high to
  read; scale it up rather than shrink the balls.
- **Reusing the original tagline structure** ("… like no other").
