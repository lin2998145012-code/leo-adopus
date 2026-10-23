# Silhouette dancers

- **Slug:** `silhouette-dancers`
- **Family:** Form
- **Inspired by:** Apple iPod "Silhouettes" (2003)
- **Difficulty:** ★★★
- **Length:** 15–30 s
- **Best for:** products you wear, hold or listen with — headphones, phones,
  sneakers, bottles, wearables, apps shown on a device
- **Not for:** large or stationary products such as furniture or appliances

## The one-glance test

A pure black silhouette dances against a single saturated color, and the only
thing that is not black is the product, glowing white.

## Keep — the technique

- **Composition:** One dancer, full body, centered, filling about 70% of the
  frame height. Feet always in frame. No floor line, no shadows, no
  environment.
- **Color:** Every shot uses exactly one flat background color from the
  palette: lime `#A6E22E`, hot pink `#FF2E88`, orange `#FF7A00`, cyan
  `#00C2FF`, yellow `#FFD400`, violet `#8A3FFC`. The dancer is pure `#000000`.
  The product, plus one thin line connected to it, is pure `#FFFFFF`.
- **Motion & camera:** The camera is locked off. All energy comes from the
  dancer: big, joyful, full-body moves with clear outlines (kicks, spins,
  jumps, hair and clothing flicks). Silhouette edges stay crisp.
- **Pacing & rhythm:** Hard cuts on the beat, about every two bars at
  110–130 BPM. Each cut changes both the dancer's pose and the background
  color. Two colors in a row are never the same.
- **Copy structure:** No copy during the dance. The end card has the product
  name in one line, then a short tagline below it, centered on the last color.
- **Signature move:** The white line. In the original it is an earbud cable.
  Here it is the product's own line — a strap, a charging cable, a shoelace, a
  light trail — that whips with the dancer's motion and draws the eye to the
  product.

## Replace — the assets

| Original | Replace with |
|---|---|
| iPod and white earbuds | The user's product in white, with its own white line |
| Licensed pop track | Original music, or a track the user owns |
| Apple logo end card | The user's product name or logo |
| Specific shots and choreography of the original | New choreography generated per film |

## Inputs

1. Product name and a one-line tagline.
2. A clean product image, or a description to draw it as a white shape.
3. What the white line is: strap, cable, lace, trail or none.
4. Length: 15 or 30 seconds.
5. Optional: music file and BPM.

## Shot list

Default 15-second cut at 120 BPM (one bar = 2 s):

| Time | Beat | On screen |
|---|---|---|
| 0–2 s | Intro | Lime. Dancer bursts into frame with a jump. |
| 2–4 s | Groove | Pink. Spin; the white line whips around the body. |
| 4–6 s | Groove | Orange. Kick; the product catches the light. |
| 6–8 s | Groove | Cyan. Hair or clothing flick. |
| 8–10 s | Build | Yellow. Faster cuts, one per bar. |
| 10–12 s | Peak | Violet. The biggest move; the product is held up. |
| 12–15 s | End card | Last color holds. Product name, then the tagline. |

## Copy

- End card line 1: `<Product name>`
- End card line 2: `<tagline, at most 6 words>`

## Sound

Up-tempo, guitar- or synth-driven, 110–130 BPM, strong kick on every beat.
Cuts land exactly on the downbeat.

## Render notes

- 1920×1080 at 30 fps; 1080×1920 for vertical.
- Draw dancers as SVG or Canvas silhouettes driven by pose keyframes; ease
  between key poses with overshoot so moves feel springy.
- Draw the white line as a simulated rope (a verlet chain) attached to the
  product so it whips naturally.
- Use a sans-serif display font with an open license for the end card.

## Pitfalls

- Stiff, puppet-like dancers kill the style. Use exaggerated poses and
  overshoot.
- Gray or soft-edged silhouettes look cheap. Keep them pure black and crisp.
- If more than one element is white, the eye no longer goes to the product.
- Don't place a real brand logo on the product unless it is the user's own.
