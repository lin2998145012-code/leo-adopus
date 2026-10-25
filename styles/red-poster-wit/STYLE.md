# Red poster wit

- **Slug:** `red-poster-wit`
- **Family:** Type & Minimalism
- **Inspired by:** The Economist red posters (1988–)
- **Difficulty:** ★★★ (the writing; the layout is simple)
- **Length:** 20–40 s (three to six posters); every poster is also a still
- **Best for:** brands with a clever customer: publications, newsletters,
  software, finance, education, language apps, anything that flatters the
  reader's intelligence
- **Not for:** products that need to be seen; copy that cannot be said in
  one line

## The one-glance test

A field of bright red, one witty line in white serif type set big and
centered, and the brand's name small in the bottom right corner. Nothing
else.

## Keep — the technique

- **Color:** one saturated red, edge to edge. White type. No pictures, no
  second color, no frames.
- **Type:** a high-contrast display serif (Playfair Display), regular
  weight, set large with tight letter spacing and tight leading, centered,
  in two or three lines of even length. Typographer's quotes and a real
  ellipsis.
- **The line:** one thought that flatters the reader — they are clever,
  they get it, the brand gets them. Wordplay, a twist, a deadpan aside.
  Short: under twelve words is best.
- **Signature:** the brand name small, bottom right, as if signing the
  poster.
- **Motion:** posters cut on the bar line, each held just long enough to
  read, with a slow push as if walking toward a billboard. A line written
  `setup | punchline` shows the setup first and lands the punchline on beat
  three. The film closes on the name, large and centered.
- **Sound:** dry and clever: plucked strings walking in a minor key, a
  wood block on two and four, a soft piano chord on every cut and a pluck
  where each punchline lands; a major chord on the name.

## Replace — the assets

| Original | Replace with |
|---|---|
| "The Economist" signature and masthead | The brand's own name or logo, in white |
| The original lines ("I never read The Economist." …) | New lines written for the brand and its customer |
| The magazine's own typeface | Playfair Display (SIL Open Font License) |
| Billboards and their sites | Full-frame posters, in any format |

## Inputs

1. Brand name (`--name`) and optional logo (`--logo`, drawn in white).
2. Three to six lines about the brand's customer. Write them for the user
   if they want; mark the turn with `|`.
3. Optional closing tagline (`--tagline`), color (`--color`, red by
   default), aspect (`16:9` default, `2:1` billboard, `1:1`, `4:5`, `9:16`).

## Brief

```jsonc
{
  "style": "red-poster-wit",
  "product": { "name": "Tessera", "logo": null },
  "aspect": "16:9",
  "color": "#f5170a",
  "music": { "file": null, "bpm": 96 },
  "posters": [
    "Order coffee in Lisbon | without pointing.",   // setup | punchline
    "Learn Italian. | Gesture less.",
    { "line": "Ten minutes a day.\nSubtitles optional.", "bars": 3 } // \n breaks a line; bars sets the hold
  ],
  "end": { "tagline": "Languages, ten minutes at a time." }
}
```

## Sound

4/4 at the brief's `bpm` (96 by default) over Dm–B♭–Gm–A, one chord a bar.
Each poster lasts a whole number of bars; its punchline lands two beats in.

## Render notes

- Canvas 2D. Each line is set at the largest size that fits the format's
  text box, then the measure is narrowed until the lines are even without
  adding one.
- `adopus preview` stops on the last moment of every poster, so the
  storyboard is a set of finished posters.

## Pitfalls

- **Explaining the joke.** If the line needs a second sentence, cut it.
- **Lines about the product instead of the reader.** The wit is about the
  customer; the product is the signature in the corner.
- **Long lines.** Past about fourteen words the type gets small and the
  poster stops working from across the street.
- **Decoration.** No pictures, icons or extra colors; the restraint is the
  style.
- **Reusing the original lines** or their famous structures word for word.
