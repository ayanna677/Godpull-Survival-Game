# GOD PULL — Survive the Pull

A real 3D browser game (Three.js) built for the [GOD PULL](https://thegodpull.com/) NFT collection ([@thegodpull](https://x.com/thegodpull), founded by [@betty_nft](https://x.com/betty_nft)).

Three rounds, inspired by the classic survival-game format:

1. **Red Light / Green Light** — hold the move button (or `SPACE` / `↑` on desktop) while the light is green, freeze the instant it turns red. A doll built from your logo physically rotates 180° to watch you.
2. **Glass Bridge** — tap `LEFT` / `RIGHT` (or arrow keys) across 9 steps of tempered glass, hoping it holds.
3. **Tug of War** — mash the pull button (or `SPACE`) faster than the rival team to drag them into the pit before time runs out.

Everything is fully self-contained — **zero external dependencies, zero CDN calls, works completely offline**:
- Character/logo/banner images are inlined as base64 data URIs in `assets-data.js` (never fails to load, no path or CORS issues, works even double-clicked straight from disk).
- Three.js is bundled locally as `three.min.js` (not loaded from a CDN — nothing to break if a CDN is slow, blocked, or down).
- Fonts (`Bebas Neue`, `Space Mono`) are bundled locally under `fonts/`.
- Sound effects are synthesized live with the Web Audio API — no audio files at all.

## Run it locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

You can also just double-click `index.html` — no server required, since there are no external assets to fetch.

## Deploy to GitHub Pages

1. Create a new GitHub repo and push all files in this folder (`index.html`, `style.css`, `game.js`, `assets-data.js`, `three.min.js`, `fonts/`, `README.md`) to the `main` branch.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save — GitHub will give you a URL like `https://<your-username>.github.io/<repo-name>/` within a minute or two.

No CI, no build step, works on phones, tablets, and desktops out of the box.

## File structure

```
index.html      → markup for all screens (start, how-to, round 1/2/3, result)
style.css       → design system — CSS variables at the top control the whole palette
game.js         → screen manager, Web Audio sound engine, all three Three.js scenes
assets-data.js  → your images (logo, banner, betty, cheese-guy, pink-fighter) as base64
three.min.js    → self-hosted Three.js r128
fonts/          → self-hosted Bebas Neue + Space Mono (woff2)
```

## Customizing

- **Swap/add characters:** edit the `ROSTER` array near the top of `game.js`, and add new base64 entries to `assets-data.js` (re-run the same base64 encoding for any new image).
- **Colors:** all colors are CSS custom properties in `:root` at the top of `style.css`.
- **Round 1 difficulty:** `lightDuration` ranges and the player-speed constant in the `Round1` module.
- **Round 2 length:** `TOTAL_STEPS` constant in the `Round2` module.
- **Round 3 difficulty:** `rivalPull` formula and `timeLeft` starting value in the `Round3` module.

