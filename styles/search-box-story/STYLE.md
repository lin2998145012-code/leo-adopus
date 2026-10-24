# Search box story

- **Slug:** `search-box-story`
- **Family:** Screen & Data
- **Inspired by:** Google "Parisian Love" (2009)
- **Difficulty:** ★★★
- **Length:** 40–60 s (6–9 searches)
- **Best for:** apps, software, courses, services, anything that changes a
  customer's life over time; stories with a before and after
- **Not for:** products that need to be seen moving or held; one-line
  announcements
- **Kit:** [`kit/`](kit) renders this style from a brief; see the
  [examples](../../examples)

## The one-glance test

A plain white search page fills the screen. Someone types a query word by
word, autocomplete drops down, results load, the pointer clicks, and the
next search jumps ahead in their life.

## Keep — the technique

- **Only the screen.** No people, no footage, no titles until the end. The
  whole story is told by what someone searches, in order.
- **The page:** A late-2000s search page. Home page: a large centered
  wordmark, a rectangular box with a thin gray border, two small gray
  buttons. Results page: small wordmark and box on top, a pale blue results
  bar ("Results 1 - 10 of about …"), then results with underlined blue
  titles, snippets with the query's words in bold, green URLs and a
  "Cached" link. On phone formats the same page is laid out for a phone.
- **Typing:** Lowercase, word by word, with a human rhythm: small gaps
  between keys, longer ones after spaces, a hesitation where the story
  needs one. A blinking caret. Autocomplete updates as each word lands.
- **Special results carry the story:** a translation, a map with pins, a
  flight status, a "Did you mean", a fact card, and the product's own site
  with sitelinks.
- **The pointer:** A plain arrow that drifts to a result, hovers and clicks;
  clicked links turn visited purple.
- **Camera:** Leans in on the box while typing, pulls back when results
  load, pushes in on what gets clicked. Each new search is a jump cut, a
  jump in time.
- **Story arc:** A small, specific need at the start; the product arrives in
  the middle as a search result; the stakes rise; the last search is the
  quiet payoff, typed slowly. Then an empty box with a blinking caret, and a
  two-word tagline alone on white.
- **Sound:** A driving piano anthem that starts with single notes and builds
  with every search, steps up a key at the time jumps, and drops back for
  the last search, under the clicks of the keyboard and mouse.

## Replace — the assets

| Original | Replace with |
|---|---|
| The Google logo and its colors | A neutral one-color wordmark ("Search" by default, `engine.name`) |
| "Google Search" / "I'm Feeling Lucky" buttons | "Search" / "Surprise me" |
| Google's interface fonts | Arimo and Libre Baskerville (SIL Open Font License) |
| The Paris love story and its searches | The customer's own story, told through new searches |
| Real sites in the results | Plausible made-up sites, and the product's own site |
| "Search on." and the Google logo | The product's own tagline and name or logo |
| Licensed music | An original piano score composed by the kit, or a track the user owns |

## Inputs

1. Product name, URL and optional logo (`--name`, `--url`, `--logo`).
2. The story: who the customer is, where they start, how the product
   enters, and the payoff. Write 6–9 searches from it.
3. Aspect (`--aspect 16:9|1:1|4:5|9:16`) and an optional search engine
   name for the wordmark (`--engine`).
4. The closing tagline (`--tagline`), two or three words, ideally a play on
   "Search on.": "Write on.", "Brew on.", "Keep going."
5. Optional music (`--music`, `--bpm`).

`adopus new` writes a skeleton with four steps; rewrite them as the story.

## Brief

```jsonc
{
  "style": "search-box-story",
  "product": { "name": "Inkwell", "url": "inkwell.so", "logo": "logo.svg" },
  "engine": { "name": "Search" },           // the wordmark on the page
  "aspect": "16:9",
  "music": { "file": null, "bpm": 100 },
  "steps": [
    {
      "query": "how to start writing a novel",
      "suggest": ["how to start writing a novel", "how to start writing a book"],
      "results": [{ "title": "…", "url": "www.example.com/page", "text": "…" }],
      "click": 0,                           // result to click; false for none
      "pause": { "at": 18, "seconds": 0.9 },// hesitate after character 18
      "speed": 1,                           // typing speed; 0.7 is slower
      "hold": 0.5,                          // extra seconds on the results
      "home": false,                        // start from the home page
      "jump": true,                         // the music changes key here
      "sfx": "bells",                       // bells, chime or airplane
      "answer": { "type": "site", "title": "Inkwell — notes that grow into books",
        "url": "inkwell.so", "text": "One line.", "links": ["Download", "Pricing"] }
    }
  ],
  "end": { "tagline": "Write on." }
}
```

Answer types:

| `type` | Fields |
|---|---|
| `site` | `title`, `url`, `text`, `links` (up to 4 sitelinks); clicked by default |
| `translate` | `from`, `to`, `fromLang`, `toLang` |
| `map` | `title`, `places` (up to 3) |
| `flight` | `code`, `from`, `to`, `date`, `status`, `depart`, `arrive` |
| `card` | `title`, `text` |
| `didyoumean` | `text` (the corrected query) |

Missing `suggest` lists and results are filled in from the query, so a
step needs only its `query`; results pages always show at least four
results.

## Render notes

- The page is drawn at 1280 units wide on desktop formats and 340 on phone
  formats, then framed by a camera that eases between keyframes.
- Each step lasts a whole number of half bars, so cuts land on the beat;
  key changes come from `jump` or default to about 40% and 75% of the way.

## Pitfalls

- **Searches that read like ad copy** break the spell. Write them the way
  people really type: lowercase, short, a little clumsy.
- **The product too early or too often:** one site result in the middle, and
  maybe a branded search later, is enough.
- **Too many searches:** past nine the story blurs. Cut the weakest.
- **Long typing on the last search** is the moment to slow down
  (`speed: 0.7`), not the middle.
- **Real brand names in results** can read as endorsements. Use made-up
  sites, except for the product itself.
