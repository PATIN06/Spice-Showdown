# Spice Showdown (ศึกจานเผ็ด)

A head-to-head spicy food game for presentations, with a Thai interface. Pick one of two dishes, the loser is swapped for a fresh challenger, the winner stays. When the menu runs out you get a final pick and a chart of what everyone chose as their final dish.

Static site (HTML, CSS, JS) for GitHub Pages. The host edits the menu, photos, title and "how to play" text on `admin.html` and presses **บันทึกและเผยแพร่** (save and publish), which commits `data/menu.json` and the photos to the repo through the GitHub API. Shared stats use a small Google Apps Script + Sheet (optional).

Thai documentation is the main one: [README.th.md](README.th.md), [docs/GITHUB.th.md](docs/GITHUB.th.md) (token and publishing), [docs/STATS.th.md](docs/STATS.th.md) (shared stats).

## Quick facts

- Menu, photos and texts live in the repo (`data/menu.json`, `images/`). The admin page needs a fine-grained GitHub token with **Contents: Read and write** on that one repo.
- Shared stats count only each player's final pick (one vote per device, replaying replaces it) and show on the start page and after the game. Without a stats backend (`statsUrl` empty in `config.js`) stats stay per device.
- Local test: `python3 -m http.server 8000`, then open `http://localhost:8000/`.
