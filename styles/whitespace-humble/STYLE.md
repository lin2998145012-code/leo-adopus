# Whitespace self-deprecation

- **Slug:** `whitespace-humble`
- **Family:** Type & Minimalism
- **Inspired by:** Volkswagen "Think Small" (1959)
- **Difficulty:** ★★★
- **Length:** 20–30 s, and the last frame is a finished print ad
- **Best for:** products with an obvious "flaw" that is secretly the point —
  small, slow, plain, cheap, simple, one-thing-only; honest brands; anything
  that wants to look confident by being modest
- **Not for:** products sold on spectacle, or copy that cannot admit a
  weakness

## The one-glance test

A black-and-white page, mostly empty gray photograph, with the product tiny
in the upper left. Below it, a two- or three-word headline ending in a
period, and three narrow columns of small text with a round logo at the
end.

## Keep — the technique

- **Layout:** the photograph takes the top three quarters of the page and
  runs to the edges. The product is small, about a sixth of the page wide,
  placed up and to the left, with a soft shadow on a seamless gray set.
  Below the picture: the headline, centered; under it, three columns of
  body copy, ragged right, set small; the logo at the foot of the third
  column; a line of small print above it.
- **Black and white.** The product photo is turned to gray; the page is
  paper white, the type near black.
- **Type:** a geometric sans (Jost, a free Futura-like face) for everything,
  semibold for the headline, regular for the copy. No other decoration.
- **Copy structure:** the headline admits the thing a skeptic would say
  ("Two cups."). The body answers it plainly in short paragraphs: concede,
  explain, turn the flaw into the reason, and end with a short line that
  sends you back to the headline. Conversational, specific, a little wry.
- **Motion:** the film is the ad being read. It opens on the empty field and
  lets the product appear in it; pulls back to the page as the headline
  lands; moves in and reads across the columns as the copy is set word by
  word; and pulls back to the finished page, which holds.
- **Sound:** quiet cool jazz — brushes and a ride cymbal, an upright bass
  that walks in with the headline, a vibraphone under the copy, one held
  chord on the finished page.

## Replace — the assets

| Original | Replace with |
|---|---|
| The Beetle photograph | The user's own product image, turned black and white |
| "Think small." and the original body copy | A new headline and body written for the product |
| The VW roundel | The user's logo, or a plain round badge with the initial |
| Futura | Jost (SIL Open Font License) |
| Doyle Dane Bernbach's page and credits | The product's own small print (`legal`) |

## Inputs

1. Product name and image with a transparent background (`--name`,
   `--product`); a dark product on the light set reads best. `scale` makes
   it bigger or smaller (keep it small: 0.7–1.2).
2. The honest thing: what a skeptic says first about the product. The
   headline is that, in two to four words, ending in a period.
3. Body copy: three to five short paragraphs, 80–130 words in all, and a
   sign-off line. Write it for the user if they want; never invent claims
   or numbers.
4. Optional logo (`--logo`), small print (`legal`), aspect (`4:5` default,
   `1:1`, `9:16`, `16:9`), music.

## Brief

```jsonc
{
  "style": "whitespace-humble",
  "product": {
    "name": "Pip",
    "image": "kettle.png",
    "logo": null,          // optional; a round badge with the initial if absent
    "scale": 0.8,          // size of the product in the field
    "color": false         // true keeps the photo in color
  },
  "aspect": "4:5",
  "music": { "file": null, "bpm": 112 },
  "headline": "Two cups.",
  "body": [
    "Pip is a small kettle. It holds two cups of water and not a drop more.",
    "People ask us to make a bigger one. We keep saying no."
  ],
  "signoff": "Small is the point.",
  "legal": "© 2026 Pip Kitchen Co.",
  "pace": 8,               // words per second while the copy is set
  "end": { "hold": 3.5 }   // seconds on the finished page
}
```

## Sound

Swung 4/4 at the brief's `bpm` (112 by default) over I–vi–ii–V in F. The
reveal, the headline, the first word of the copy and the pullback land on
bar lines.

## Render notes

- Everything is drawn with canvas 2D at the page's own coordinates, so type
  stays sharp at any zoom. The page is designed on a portrait page and
  adapts to other formats: on 16:9 the photograph is wider and the text
  block stays page-sized in the middle.
- The copy is flowed into three columns of equal height, the last one
  shorter and narrowed beside the logo.
- `adopus preview <dir> --times <last second>` gives the finished page as a
  still for print or social posts.

## Pitfalls

- **Bragging.** The style dies the moment the copy boasts. Admit first.
- **A big product.** The emptiness is the joke; resist making it larger.
- **Long copy.** Past about 140 words the columns get tall and the film
  long. Cut.
- **A light product on the light set** disappears in black and white.
- **Reusing the original lines** ("Think small.", "Lemon.") — write new ones.
