# Silhouette dancers — demo film

A 15-second spot for a fictional product, **adopus** earbuds, in the
[silhouette-dancers](../../styles/silhouette-dancers/STYLE.md) style.

![Storyboard](../../docs/demos/silhouette-dancers-storyboard.jpg)

[Watch the MP4](../../docs/demos/silhouette-dancers.mp4)

## Render it

Requirements: Node 20+, ffmpeg and Chromium (Playwright's build works).

```sh
npm install
node films/silhouette-dancers/music.mjs out/silhouette-dancers.wav
node core/render.mjs films/silhouette-dancers --audio out/silhouette-dancers.wav --out out/silhouette-dancers.mp4
```

Set `CHROME_PATH` if Chromium is not found automatically. To preview frames
as a contact sheet instead of a video:

```sh
node core/render.mjs films/silhouette-dancers --times 1,5,9,11 --sheet out/sheet.png
```

## Files

| File | What it does |
|---|---|
| `film.js` | Shot list, palette, timing and end card |
| `silhouette.js` | Dancers: body capsules, hair, cloth and wire physics, arm IK, camera, GPU silhouette shader |
| `music.mjs` | The original 120 BPM soundtrack, synthesized in code |
| `segments.json` | Which motion-capture clips and time ranges the film uses |
| `motion.json` | Joint positions extracted from those clips (generated) |

To change the motion, edit `segments.json` and regenerate `motion.json`:

```sh
node core/mocap/extract.mjs films/silhouette-dancers/segments.json films/silhouette-dancers/motion.json
```

## Credits

Motion data: the data used in this project was obtained from
[mocap.cs.cmu.edu](http://mocap.cs.cmu.edu). The database was created with
funding from NSF EIA-0196217. Clips used: 05_06, 05_17, 15_05, 49_02,
55_02 and 90_28.

The film, the music and the product are original. The film is released
under CC BY 4.0.
