# Parts chain reaction

- **Slug:** `chain-reaction`
- **Family:** One Take & Chain Reaction
- **Inspired by:** Honda "Cog" (2003)
- **Difficulty:** ★★★
- **Length:** 30–45 s (five links and the finale)
- **Best for:** engineered products — speakers, appliances, tools, bikes,
  cars, watches, hardware; any brand whose story is that every part was
  made to work together
- **Not for:** apps and services with nothing physical to show; products
  that are sold on mood rather than build
- **Kit:** [`kit/`](kit) renders this style from a brief; see the
  [examples](../../examples)

## The one-glance test

A low camera glides along a polished wooden floor in a white paneled room.
A machined part rolls into another, and one contraption sets off the next,
in a single unbroken shot, until the last one rolls the finished product
to a stop under a hanging black banner.

## Keep — the technique

- **One take.** No cuts from the first part to the product. The camera is
  a dolly that only ever moves right, low to the floor, leaning in on small
  parts and pulling back for big ones, with a shallow depth of field.
- **The room:** oak floorboards running along the shot, glossy enough to
  hold a soft reflection; an off-white wall with baseboards, a chair rail
  and panel moldings; soft daylight from above; slightly faded, cool-green
  whites.
- **The parts:** real machined pieces, not toys — gears, bearings,
  valves-like plates, a brake disc, a wheel, a silencer — on plain plywood
  ramps, blocks and shelves. Gray steel, black rubber, raw wood, and one
  painted part in the accent color.
- **The links:** each one a small surprise that plays fair with physics:
  a slow start, a wave of falling plates, a plank that balances and tips, a
  gear train, a weighted wheel that rolls uphill, a pendulum.
- **Timing:** slow at first — the first part takes its time — then
  accelerating, with one held breath in the middle (the uphill wheel), and
  the product rolling in slowly at the end.
- **Finale:** the product arrives and stops exactly in place under a black
  banner with its name in widely spaced capitals. A beat. It switches on.
  Then white, and the name and tagline.
- **Sound:** no music while the machine runs — only the parts, in a quiet
  room with a little reverb: steel ringing on steel, wood knocking, rolling,
  gears ticking. Music arrives only when the product does.

## Replace — the assets

| Original | Replace with |
|---|---|
| Honda Accord parts and the car | Generic machined parts made in code, and the user's own product image |
| The "ACCORD" banner and the Honda logo | A banner with the product's name, and the product's own logo |
| "Isn't it nice when things just work?" | The product's own tagline, on the end card |
| "Rapper's Delight" | An original groove composed by the kit, or a track the user owns |
| The exact contraptions of the film | The kit's own links: dominoes, seesaw, gear train, uphill wheel, pendulum |

## Inputs

1. Product name (`--name`) and a product image with a transparent
   background (`--product`): a cutout photo or render, seen from the front
   and slightly above. Without one, the name is shown in its place.
2. The product's height in meters (`--size`, default 0.36), which sets the
   cart and the final framing.
3. Optional logo for the banner and end card (`--logo`), accent color for
   the painted part (`--accent`), aspect (`--aspect 16:9|1:1|4:5|9:16`).
4. The tagline (`--tagline`): one short line about everything working
   together.
5. Which links, in order (`--links dominoes,seesaw,gearbox,uphill,pendulum`).
   Fewer links make a shorter film; each lasts 3–7 seconds.

## Brief

```jsonc
{
  "style": "chain-reaction",
  "product": {
    "name": "Orrin",
    "image": "speaker.png",   // transparent PNG or SVG
    "logo": null,             // optional, for the banner and end card
    "size": 0.36              // height in meters
  },
  "aspect": "16:9",
  "accent": "#c8261e",        // the one painted part
  // Any order, any subset; the opener and the finale are always there.
  "links": ["dominoes", "seesaw", "gearbox", "uphill", "pendulum"],
  "music": { "file": null },  // your own track replaces the whole soundtrack
  "end": {
    "tagline": "Every part, in tune.",
    "hold": 2.6,              // seconds on the product before white
    "seconds": 3.4            // seconds of end card
  }
}
```

| Link | What happens | Sends out |
|---|---|---|
| (opener) | A bearing rolls along a shelf into a hub, the hub into a gear, the gear off the end | a gear |
| `dominoes` | Eleven steel plates fall in a wave; the last knocks a ball off a post | a ball |
| `seesaw` | The part rolls up a plank, it balances, tips, and the part rolls on | the same part |
| `gearbox` | A lever turns three meshed gears on a board; an arm knocks a ball off a shelf | a ball |
| `uphill` | A weighted wheel, nudged, rolls up a ramp by itself and down the far side | the wheel |
| `pendulum` | A hanging brake disc is struck, swings out and sends a silencer rolling | a silencer |
| (finale) | The part bumps the cart; the product rolls to a stop under the banner | — |

## Sound

The kit composes the soundtrack from the same simulation as the picture:
every collision, roll and gear tick becomes a synthesized sound at the
frame it happens, panned with the camera and sent into a room reverb. When
the product stops it chimes twice and starts an original 98 bpm groove that
plays under the end card.

## Render notes

- The scene is real 3D, rendered with three.js (MIT, vendored in
  `assets/vendor/three`), with soft shadows, reflections from a room
  environment, depth of field and a film grade in one post pass.
- Motion is simulated, not keyframed: rolling parts are discs on the
  machine's ramps and floors with gravity, rolling friction and bounces;
  plates, plank, gears and pendulum have their own equations. Every link
  adapts to the speed of the part that arrives, so any order works.
- The camera follows the simulated action with a slow, smoothed dolly that
  never moves left.
- Rendering is heavier than the 2D styles: plan on several minutes for a
  30-second film without a GPU.

## Pitfalls

- **Too many links:** past five or six the film gets long and the camera
  hurries. The original is two minutes; an ad is not.
- **A product image shot from the side or from below** looks pasted in.
  Use a front view from slightly above, with a transparent background.
- **A wrong size:** a 3 cm product scaled to 40 cm looks like a toy; keep
  `size` close to the real height, or between 0.25 and 0.6 for small items.
- **Music during the chain** breaks the spell. The parts are the
  soundtrack until the product arrives.
