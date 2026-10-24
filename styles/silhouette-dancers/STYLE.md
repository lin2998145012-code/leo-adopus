# Silhouette dancers

- **Slug:** `silhouette-dancers`
- **Family:** Form
- **Inspired by:** Apple iPod "Silhouettes" (2003)
- **Difficulty:** ★★★
- **Length:** 15–30 s
- **Best for:** products you wear, hold or listen with: earbuds, headphones,
  players, phones, wearables, bottles
- **Not for:** large or stationary products such as furniture or appliances
- **Kit:** [`kit/`](kit) renders this style from a brief; see the
  [examples](../../examples) and the [skill](../../skills/make-ad/SKILL.md)

## The one-glance test

A pure black dancer fills a flat, bright color. A thin white wire runs from
both ears, joins on the chest and ends at a small white device held up in
one hand. The white things are the only things that are not black.

## Keep — the technique

- **Composition:** Tight. Most shots crop the dancer at the knees or the
  waist, with the head close to the top edge and the figure slightly off
  center. Full-body shots are for jumps and floor moves only. No floor, no
  shadow, no environment.
- **Color:** One flat background per shot, never the same color twice in a
  row. The palette below was sampled from the original backgrounds; it is
  softer than pure neon.

  | Name | Hex |
  |---|---|
  | lime | `#8DBF1F` |
  | pink | `#E0609A` |
  | orange | `#F7941D` |
  | cyan | `#03B5F0` |
  | yellow | `#F4C832` |
  | violet | `#9468B0` |

  The dancer is near black (`#050505`). The device, earbuds and wire are pure
  white (`#FFFFFF`).
- **The dancers:** Real human movement and real human outlines. Every cut is
  a different dancer, told apart by silhouette alone: big curly hair, a
  ponytail that flies, a bob, a cap brim, a skirt that flares. Free hands are
  open with fingers spread. Faces read in profile: brow, nose, chin.
- **Signature move: the Y wire.** One wire from each ear meets at a splitter
  on the chest, then a single wire with lots of slack swings down and out to
  the device. The wire must swing outside the body so it is seen against the
  color, and it must hide behind the head and torso when it passes behind
  them.
- **Showing the product:** The device hand is held up beside the shoulder,
  out to the side, so the device sits against the color, not against the
  chest.
- **Pacing & rhythm:** Hard cuts on the downbeat, one per bar at 120 BPM
  (2 s), then half-bar cuts (1 s) in the build. Each cut changes the dancer,
  the move, the angle and the color.
- **Copy structure:** No copy during the dance. The end card holds the last
  color: the product in white, then the name, then a short tagline.

## Replace — the assets

| Original | Replace with |
|---|---|
| iPod (white rectangle with click wheel) | The user's device in white, in its own shape. The demo uses a plain rounded pebble. |
| Apple earbuds | The user's earbuds or headphones, or another white line the product owns (strap, cable, lace) |
| Licensed pop or rock track | Original music. The demo track is synthesized in code. |
| Apple logo and iPod wordmark | The user's name or logo |
| Filmed dancers and their choreography | Motion-capture data with a license that allows reuse, retargeted to new dancers |

## Inputs

These map to the brief (`adopus new` options in parentheses).

1. Product name and a tagline of at most six words (`--name`, `--tagline`).
2. The product as a transparent PNG or an SVG, drawn as a white shape, and
   its height when held (`--product`, `--size`). Without an image the kit
   draws a plain white pebble.
3. The white line: a Y-shaped earbud wire or none (`--line earbuds|none`).
4. Length and aspect: 15 or 30 seconds; 16:9, 9:16, 1:1 or 4:5
   (`--length`, `--aspect`).
5. Optional: a music file the user owns and its BPM (`--music`, `--bpm`).
   Without one, the kit composes an original track to the cut plan.

## Brief

```jsonc
{
  "style": "silhouette-dancers",
  "product": {
    "name": "adopus",                 // end card title
    "tagline": "Move like nobody’s listening.",
    "image": "product.png",           // optional, relative to the brief
    "size": 0.092,                    // height in meters when held
    "tilt": 0.35,                     // 0 = always upright, 1 = follows the forearm
    "line": "earbuds"                 // or "none"
  },
  "length": 15,                       // seconds
  "aspect": "16:9",
  "music": { "file": null, "bpm": 120, "offset": 0 }, // offset: first downbeat (s)
  "palette": ["lime", "pink", "cyan", "yellow", "orange", "violet"], // names or hex
  "endColor": "violet"                // optional end card color
}
```

To control every shot, add a `shots` array. Each shot is
`{ "t": start, "d": duration, "seg": move, "char": dancer, "hand": "l"|"r", "color": hex }`
and may override `yaw`, `mirror`, `framing` (`full`, `knee`, `mid`), `fill`,
`x`, `followY` and `hold`. Moves: `groove`, `groove2`, `jumps`, `pump`,
`pump2`, `spin`, `spin2`, `lambada`, `freeze`, `sway`, `leap`. Dancers:
`afro`, `bob`, `cap`, `pony` (skirt; avoid `freeze`), `spike`. Cut on the
downbeat: shot boundaries should be multiples of one bar (`240 / bpm`
seconds).

## Shot list

The kit plans shots from the length and tempo: one shot per bar, cycling
through dancers and moves (mirrored on repeats), then a build of two
half-bar cuts and a closing leap. The default 15-second cut at 120 BPM (one
bar = 2 s), as in the earbuds example:

| Time | Color | Dancer | Move | Framing |
|---|---|---|---|---|
| 0–2 s | lime | big curly hair, flares | groove, arm swing | knees up |
| 2–4 s | pink | bob, shorts | tucked jumps | knees up, partial vertical follow |
| 4–6 s | cyan | cap, tee, baggy pants | arm-pump dance | knees up |
| 6–8 s | yellow | ponytail, skirt | leap into a spin; the skirt flares | knees up |
| 8–9 s | orange | spiky hair | breakdance, legs in the air | full body |
| 9–10 s | pink | bob | arm up, device held high | waist up |
| 10–12 s | violet | ponytail, skirt | grand jeté leaps, hair flying | full body |
| 12–15 s | violet | — | end card: product, name, tagline | — |

## Copy

- End card line 1: `<Product name>`
- End card line 2: `<tagline, at most 6 words>`

## Sound

Up-tempo electro-rock, 110–130 BPM: four-on-the-floor kick, snare on 2 and
4, driving eighth-note bass, syncopated overdriven guitar stabs. A snare roll
builds into the last dance shot; a crash and one sustained chord land on the
end card. Cuts land exactly on the downbeat.

## Render notes

- 1920×1080 (or 1080×1920, 1080×1080, 1080×1350) at 30 fps.
- **Motion:** use motion capture, not hand keyframes. The demo uses the CMU
  Graphics Lab Motion Capture Database, parsed from ASF/AMC with forward
  kinematics.
- **Body:** build the body from tapered capsules (trapezius, deltoids,
  chest, glutes, calves, separate fingers and thumb, brow, nose and chin)
  and draw their smooth union with a signed-distance shader. Convex hulls of
  spheres look like a mannequin; the smooth union looks like a person.
- **Secondary motion:** simulate hair, skirt strips and the wire with Verlet
  chains at 240 Hz; push cloth out of the thighs with sphere colliders.
- **Camera:** orthographic. On a flat background camera moves are invisible,
  so follow the dancer sideways (and partly vertically for jumps) to keep the
  figure large.
- **Device pose:** blend the device arm toward a held-up target with two-bone
  IK (about 75%), keeping the rest of the captured motion.

## Pitfalls

- **Small, centered, full-body figures** look like a stock illustration. Crop
  tight.
- **One cable from one ear** loses the signature. Keep the Y.
- **A device at the hip** disappears into the body. Hold it up and out.
- **Hard-edged shapes** (hulls, polygons) read as cardboard. Blend the body
  smoothly; soften cloth corners.
- **A skirt that rotates with the pelvis** balloons in crouches. Hang cloth
  from the waist and let gravity act on it.
- **Floor moves and flips** turn into black blobs. Use them only in short,
  fast cuts.
- **Pure neon colors** look harsher than the original. Use the sampled
  palette.
- **Hair strands simulated separately** can fly apart into "rabbit ears".
  Drive one main strand and offset the loose strands from it.
