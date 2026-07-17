# GOD PULL — Survive the Pull

A free, mobile-and-desktop browser game built for the [GOD PULL](https://thegodpull.com/) NFT collection ([@thegodpull](https://x.com/thegodpull), founded by [@betty_nft](https://x.com/betty_nft)).

Two rounds, inspired by the classic survival-game format:

1. **Red Light / Green Light** — hold the move button (or `SPACE` / `↑` on desktop) while the light is green, freeze the instant it turns red.
2. **Glass Bridge** — tap `LEFT` / `RIGHT` (or arrow keys) to pick the panel that holds.

No build tools, no dependencies, no external audio files — sound effects are synthesized live with the Web Audio API, and everything runs from three static files.

## Run it locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Any static file server works — there is no backend.

## File structure

```
index.html      → markup + all four screens (start, how-to, round 1, round 2, result)
style.css       → design system (CSS variables at the top control the whole palette)
game.js         → screen manager, Web Audio sound engine, both round's canvas game loops
assets/         → banner.jpeg, logo.jpg, betty.jpg (founder), cheese-guy.jpg, pink-fighter.jpg
```

## Customizing

- **Swap/add characters:** edit the `ROSTER` array at the top of `game.js` and drop new images into `assets/`.
- **Colors:** all colors are CSS custom properties in `:root` at the top of `style.css`.
- **Round 1 timing / difficulty:** `lightDuration` ranges and `player.y -= 78*dt` (player speed) in `game.js`.
- **Round 2 length:** `TOTAL_STEPS` constant in the `Round2` module.
