# Year-in-review cards

- **Slug:** `year-in-review`
- **Family:** Screen & Data
- **Inspired by:** Spotify Wrapped (2016–)
- **Difficulty:** ★★★
- **Length:** 25–40 s (one card per 2–3 bars; 30 s for seven cards)
- **Best for:** apps, SaaS, communities, shops, creators, anyone with a year
  of numbers to celebrate; December launches and year-end posts
- **Not for:** products with no data to show, or a single launch message
- **Kit:** [`kit/`](kit) renders this style from a brief; see the
  [examples](../../examples)

## The one-glance test

A vertical story card in a loud flat color, with segmented progress bars
across the top, a huge bold number or headline, and a playful shape that
pops in on the beat.

## Keep — the technique

- **Format:** Vertical 9:16 story cards, like a social story: thin segmented
  progress bars at the top (one per card, the current one filling), a small
  logo top left, and a white "Share this story" pill at the bottom of data
  cards. In 16:9, 1:1 or 4:5 the story sits on a phone over a contrasting
  backdrop, as in the campaign's marketing.
- **Color:** One flat, saturated background per card, never the same twice
  in a row, with clashing accents: electric purple with lime, red with
  yellow and mint, pink with yellow, black with lime.

  | Scheme | Background | Text | Accents |
  |---|---|---|---|
  | purple | `#4100F4` | white | `#CDF564`, `#FF6AE6` |
  | lime | `#CDF564` | `#141414` | `#4100F4`, `#FF4632` |
  | red | `#FF4632` | white | `#F7E61B`, `#3BE8B0` |
  | mint | `#3BE8B0` | `#141414` | `#FF4632`, `#4100F4` |
  | pink | `#FF8AD8` | `#141414` | `#F7E61B`, `#4100F4` |
  | yellow | `#F7E61B` | `#141414` | `#FF4632`, `#4100F4` |
  | black | `#141414` | white | `#CDF564`, `#FF6AE6` |

- **Type:** A round geometric sans in bold and black weights, set huge and
  tight, centered for statements and left-aligned for lists. Copy is short,
  second person and a little cheeky: "2026 was a feast for your ears."
- **Shapes:** Starbursts, scalloped flowers, pixel blobs, iridescent
  ribbons and checkered bands. They pop in with an overshoot, keep slowly
  rotating, and are often cropped by the frame.
- **Signature move: the number wall.** A big number counts up, then repeats
  in rows that fill the screen in alternating colors, sliding in from both
  sides, with a caption card on top.
- **The card set:** intro with the year, the number wall, a numbered top-5
  list, a bold statement, a "personality" card, and a summary share card
  that collects the highlights.
- **Pacing:** A card per 2–3 bars at about 120 BPM. Cards cut on the bar
  line with a small bounce; inside a card, lines and rows reveal one after
  another.

## Replace — the assets

| Original | Replace with |
|---|---|
| Spotify logo and green circle | The brand's own logo or name |
| The word "Wrapped" and #SpotifyWrapped | Plain words: "your year", "2026 in review" |
| Circular / Spotify Mix typefaces | DM Sans (SIL Open Font License) |
| Album covers and artist photos | The brand's own images, or shape tiles |
| Listening data and Spotify copy | The brand's real numbers and its own copy |
| Licensed music | Original music composed by the kit, or a track the user owns |

## Inputs

1. Brand or product name, logo (transparent PNG or SVG) and URL
   (`--name`, `--logo`, `--url`).
2. The year (`--year`) and aspect (`--aspect 9:16|4:5|1:1|16:9`).
3. The numbers and lists for the cards. Use real figures only.
4. Optional: palette order (`--palette purple,lime,red`) and music
   (`--music`, `--bpm`).

`adopus new` writes a skeleton with one card of each type; fill in the copy
and numbers in `brief.json`.

## Brief

```jsonc
{
  "style": "year-in-review",
  "product": { "name": "Brewly", "url": "brewly.app", "logo": "logo.svg" },
  "year": 2026,
  "aspect": "9:16",
  "music": { "file": null, "bpm": 120 },
  "palette": ["purple", "lime", "red", "mint", "pink", "yellow", "black"],
  "locale": "en-US",              // number formatting
  "shareText": "Share this story", // text on the share pill
  "cards": [
    { "type": "intro", "title": "Your 2026, one cup at a time", "text": "optional line" },
    { "type": "number", "label": "Cups brewed on Brewly", "value": 1284310,
      "prefix": "", "suffix": "", "text": "That’s a fresh cup every 25 seconds." },
    { "type": "list", "title": "The roasts you couldn’t put down",
      "items": [{ "title": "Ethiopia Yirgacheffe", "sub": "212K cups", "image": "cover1.png" }, "Colombia Huila"] },
    { "type": "statement", "title": "You brewed before sunrise 41,000 times.", "text": "Respect." },
    { "type": "persona", "kicker": "Your coffee personality", "title": "The Early Riser", "text": "Two sentences." },
    { "type": "summary", "title": "Brewly 2026",
      "list": { "title": "Top roasts", "items": ["Yirgacheffe", "Huila"] },
      "stats": [{ "label": "Cups brewed", "value": "1.28M" }], "cta": "brewly.app" },
    { "type": "outro", "title": "Thanks for brewing with us", "cta": "brewly.app" }
  ]
}
```

Any card can set `"bars"` (its length in bars) and `"scheme"` (a scheme name
above, or `{ "bg", "fg", "a", "b" }`). Cards may repeat or be left out, but
keep the intro first and the outro or summary last. Lists show up to five
items.

## Sound

Bright electro-pop at about 120 BPM: a soft pad and pluck arpeggio over the
intro, then four-on-the-floor kick, claps on 2 and 4, off-beat hats, a
pumping octave bass and a I–V–vi–IV progression. A whoosh rises into every
card change and a light crash lands on it; the closing card thins out to the
tonic chord.

## Render notes

- Stories are drawn at 1080×1920 with canvas 2D and placed into the output
  frame; other aspects show the story on a phone.
- Counting numbers ease out over about 1.4 s; reveals are 0.4 s with 0.08 s
  stagger; pops overshoot (back easing).

## Pitfalls

- **Long copy** kills the look. Keep headlines under about 8 words and
  supporting lines under 15.
- **Made-up numbers** turn a celebration into a liability. Use real data.
- **Low contrast:** keep dark text on light schemes and white on dark ones;
  the kit chooses ink automatically for panels.
- **Too many cards:** five to seven is the sweet spot for 25–40 seconds.
- **Using "Wrapped" or the Spotify logo** crosses from homage into
  imitation. Use plain words.
