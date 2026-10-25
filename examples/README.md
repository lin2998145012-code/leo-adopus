# Examples

Each folder is a film: a `brief.json` plus the files it names. Render one
with:

```sh
node core/cli.mjs render examples/<name>
```

| Folder | Style | Product | Format |
|---|---|---|---|
| [`adopus-earbuds`](adopus-earbuds/brief.json) | silhouette-dancers | wired earbuds, built-in device, Y wire | 15 s, 16:9 |
| [`flow-bottle`](flow-bottle/brief.json) | silhouette-dancers | water bottle from `bottle.svg`, no wire | 30 s, 9:16 |
| [`brewly-year`](brewly-year/brief.json) | year-in-review | a fictional coffee app's year, seven cards | 30 s, 9:16 |
| [`inkwell-search`](inkwell-search/brief.json) | search-box-story | a fictional writing app, from first page to dedication | 59 s, 16:9 |
| [`orrin-speaker`](orrin-speaker/brief.json) | chain-reaction | a fictional speaker from `speaker.png`, five links | 34 s, 16:9 |
| [`pip-kettle`](pip-kettle/brief.json) | whitespace-humble | a fictional two-cup kettle, "Two cups." | 27 s, 4:5 |
| [`tessera-posters`](tessera-posters/brief.json) | red-poster-wit | a fictional language app, four posters | 33 s, 16:9 |

The rendered films are in [`docs/demos`](../docs/demos).
