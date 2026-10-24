---
description: Make a product ad video in the style of a legendary ad, rendered entirely in code (leo-adopus). Use when someone wants a commercial, promo or social ad video for their product, or asks for an ad in a classic style such as the iPod-style silhouette dancers.
argument-hint: "[product name or description]"
---

# Make an ad with leo-adopus

The command-line tool is `node "${CLAUDE_PLUGIN_ROOT}/core/cli.mjs"`. Below,
`adopus` stands for that command. Films are folders with a `brief.json`;
create them in the user's project, under `./adopus-films/`, unless they ask
for another place.

## 1. Check the machine

Run `adopus doctor`. It needs Node 22+, ffmpeg and Chrome with WebGL 2. If a
check fails, give the user the one-line fix it prints and wait until it
passes.

## 2. Pick the style

Run `adopus styles` to list the styles that render today. Read the chosen
style's `${CLAUDE_PLUGIN_ROOT}/styles/<slug>/STYLE.md` before planning: its
Keep, Replace, Inputs and Pitfalls sections are the contract for the film.

If the user asks for one of the other styles in
`${CLAUDE_PLUGIN_ROOT}/styles/README.md`, say it is not ready yet and offer
the closest ready one.

## 3. Collect the brief

Ask in one message, and skip anything the user already told you:

- **Product name** and a **tagline** of at most six words. If they have no
  tagline, offer three.
- **Product image**: a PNG with a transparent background, or an SVG. It is
  drawn as a pure white silhouette in the dancers' hands and on the end card.
  Without one, a plain white device is used.
- **The white line**: `earbuds` (a Y-shaped earbud wire, for audio products)
  or `none`.
- **Length** (15 or 30 seconds) and **aspect**: `16:9`, `9:16` (TikTok,
  Reels, Shorts), `1:1` or `4:5`.
- **Music**: none (an original track is composed to match the cuts), or a
  file they own and its BPM.

## 4. Create the film

```sh
adopus new ./adopus-films/<slug> --style silhouette-dancers \
  --name "<name>" --tagline "<tagline>" \
  [--product <image>] [--size <meters>] [--line earbuds|none] \
  [--length 15|30] [--aspect 16:9|9:16|1:1|4:5] \
  [--music <file> --bpm <bpm>] [--palette lime,pink,cyan]
```

`--size` is the product's real height in meters as held in a hand: about
0.09 for a music player, 0.15 for a phone, 0.12 for a can, 0.22 for a
bottle. Image and music files are copied into the film folder.

## 5. Preview, look, fix

Run `adopus preview <dir>`. It writes `<dir>/out/storyboard.png` with one
frame per shot plus the end card. Open the image and check:

- the product is visible and recognizable in every shot;
- the end card's name and tagline fit and read well;
- the colors suit the brand.

Fix problems in `brief.json` (see the reference below), then preview again.
Show the user the storyboard before the final render.

## 6. Render

Run `adopus render <dir>`. It composes the music when none is given and
writes `<dir>/out/<folder name>.mp4` (1080p or 1080×1920, 30 fps, H.264 and
AAC). Rendering takes about 8 seconds per second of film, so start it in the
background when your tools allow and tell the user where the file is.

## Brief reference

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

## Rules

- Use only logos, product images and music the user owns or supplied. Never
  put another brand's name or logo in the film.
- The look comes from technique, not from copied assets. Keep to the Replace
  column of the style file.
