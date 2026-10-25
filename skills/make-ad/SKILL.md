---
description: Make a product ad video in the style of a legendary ad, rendered entirely in code (leo-adopus). Use when someone wants a commercial, promo, social ad or year-in-review video for their product or brand, or asks for an ad in a classic style such as the iPod-style silhouette dancers, Wrapped-style year-in-review cards, a story told through searches a one-take chain reaction of parts, a Think-Small-style black-and-white print ad, or witty white-on-red posters.
argument-hint: "[product name or description]"
---

# Make an ad with leo-adopus

The command-line tool is `node "${CLAUDE_PLUGIN_ROOT}/core/cli.mjs"`. Below,
`adopus` stands for that command. A film is a folder with a `brief.json`;
create films in the user's project under `./adopus-films/<slug>/`, unless
they ask for another place.

## 1. Check the machine

Run `adopus doctor`. It needs Node 22+, ffmpeg and Chrome with WebGL 2. If a
check fails, give the user the one-line fix it prints and wait until it
passes.

## 2. Pick the style

Run `adopus styles` to list the styles that render today, and match the
request:

| The user wants | Style |
|---|---|
| A product shown off by dancers, music and energy; audio, wearables, drinks, anything held in the hand | `silhouette-dancers` |
| A recap of a year, a launch or a milestone in numbers; apps, SaaS, shops, communities, creators | `year-in-review` |
| A customer's story over time told through their searches; apps, software, courses, services | `search-box-story` |
| One unbroken shot of machined parts setting each other off until the product rolls into place; engineered products, hardware, appliances, tools | `chain-reaction` |
| An honest, self-deprecating print ad (and a video of it being read): a small product in a vast gray photo, a short headline, three columns of copy; products whose flaw is the point | `whitespace-humble` |
| One witty line per poster, white serif on red, the brand signed small in the corner; brands with clever customers: publications, software, finance, education | `red-poster-wit` |

Then read `${CLAUDE_PLUGIN_ROOT}/styles/<slug>/STYLE.md`. Its Keep, Replace,
Inputs, Brief and Pitfalls sections are the contract for the film.

If the user asks for one of the other styles in
`${CLAUDE_PLUGIN_ROOT}/styles/README.md`, say it is not ready yet and offer
the closest ready one.

## 3. Collect the brief

Ask in one message for what the style's Inputs section lists, and skip
anything the user already told you. Always cover:

- **Name** of the product or brand, and its **image or logo** (a transparent
  PNG or an SVG).
- **Aspect**: `16:9`, `9:16` (TikTok, Reels, Shorts), `1:1` or `4:5`.
- **Music**: none (an original track is composed to match the cuts), or a
  file the user owns and its BPM.
- Style-specific content, such as a tagline for `silhouette-dancers`, the
  real numbers and top-5 lists for `year-in-review`, the customer's story
  for `search-box-story`, or the product's real height and the order of the
  links for `chain-reaction`, the honest headline and body copy for
  `whitespace-humble`, or the poster lines (`setup | punchline`) for
  `red-poster-wit`. Write the copy and the searches for them when they
  want; never invent numbers.

## 4. Create the film

```sh
adopus new ./adopus-films/<slug> --style <style> --name "<name>" [options]
```

Options per style are in its Inputs section. Files passed in (images, logo,
music) are copied into the film folder. Then edit `brief.json` to match the
style's Brief section: for `year-in-review`, replace the skeleton cards with
the user's real numbers and copy; for `search-box-story`, write the searches
that tell the story.

## 5. Preview, look, fix

Run `adopus preview <dir>`. It writes `<dir>/out/storyboard.png` with one
frame per shot or card. Open the image and check:

- the product, logo and numbers are visible and readable on every frame;
- text fits and no headline is cramped;
- the colors suit the brand, and the style's Pitfalls are avoided.

Fix problems in `brief.json`, then preview again. Show the user the
storyboard before the final render.

## 6. Render

Run `adopus render <dir>`. It composes the music when none is given and
writes `<dir>/out/<folder name>.mp4` (30 fps, H.264 and AAC). Rendering takes
about 6–8 seconds per second of film (`chain-reaction` renders in 3D and can
take 20–30 seconds per second of film without a GPU), so start it in the
background when your tools allow and tell the user where the file is.

## Rules

- Use only logos, product images, data and music the user owns or supplied.
  Never put another brand's name or logo in the film, and never use the
  original campaign's name (for example "Wrapped").
- The look comes from technique, not from copied assets. Keep to the Replace
  column of the style file.
