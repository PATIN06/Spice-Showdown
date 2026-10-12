# Spice Showdown

A head-to-head spicy food game for presentations. Two dishes appear, you pick one, the loser is swapped for a fresh challenger, and the winner stays to defend. When the menu runs out, your last pick is crowned and a chart shows which dish was picked the most.

It is a static site (HTML, CSS and JavaScript only). No build step, no server, no dependencies. It runs on GitHub Pages.

Thai version: [README.th.md](README.th.md)

## Two sites in one repo

| Page | Who uses it | What it does |
| --- | --- | --- |
| `index.html` | Players | Plays the game with the published menu. |
| `admin.html` | The host | Edits dishes, heat levels and photos, then exports `menu.json`. Optional PIN. |

Players never see a link to the admin page. Open it by adding `/admin.html` to the site address.

## Deploy on GitHub Pages

1. Create a repository and push these files to the `main` branch.
2. In the repository, open **Settings, Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and the `/ (root)` folder, then save.
4. After a minute the game is live at `https://<your-username>.github.io/<repo-name>/` and the admin at `.../admin.html`.

The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

## Change the menu (host workflow)

1. Open `admin.html`. Add dishes, set heat levels, upload photos, change the title and intro text.
2. Press **Preview draft as a player** to try the game with your unpublished draft.
3. Press **Download menu.json**.
4. Replace `data/menu.json` in your repo with the downloaded file, commit and push.
5. GitHub Pages updates the player in about a minute.

Your draft is stored in the browser you used, so you can close the page and come back. **Import menu.json** loads an existing file into the draft.

## Run it on your computer

The player loads `data/menu.json` with `fetch`, so open it through a local server instead of double-clicking the file:

```bash
cd spice-showdown
python3 -m http.server 8000
```

Then visit `http://localhost:8000/` and `http://localhost:8000/admin.html`. If you do open `index.html` straight from the disk, it falls back to the built-in sample menu.

## menu.json format

```json
{
  "version": 1,
  "title": "Spice Showdown",
  "tagline": "Intro text shown on the start screen.",
  "shuffle": true,
  "adminPinHash": "optional, written by the admin page",
  "dishes": [
    { "id": "tomyum", "name": "Tom Yum Goong", "heat": 3, "art": "tomyum" },
    { "id": "mala", "name": "Mala Hot Pot", "heat": 5, "img": "images/mala.jpg" }
  ]
}
```

- `heat` is 1 to 5. A menu holds 3 to 16 dishes.
- `img` can be a path inside `images/`, an `https://` address, or a `data:image/...` string (what the admin page exports). If you prefer files, drop photos into `images/` and reference them by path.
- `art` picks one of the built-in drawings: `tomyum`, `somtam`, `krapao`, `mala`, `tteok`, `buldak`, `vindaloo`, `nashville`. `img` wins when both are set.
- `shuffle: false` keeps your list order. The first two dishes meet first.

## Project layout

```
index.html        player
admin.html        host page
css/base.css      shared tokens and components
css/player.css    player screens
css/admin.css     admin screens
js/common.js      shared helpers, menu loading, sample drawings
js/effects.js     embers, bursts and confetti (player)
js/player.js      game logic (player)
js/admin.js       menu editor and export (admin)
data/menu.json    the published menu
images/           optional photo files
```

## Limits to know about

- **No server.** The admin page cannot change the live menu by itself. The live menu only changes when `data/menu.json` is committed.
- **The PIN is a courtesy lock.** It is checked in the browser against a hash stored in `menu.json`. It keeps casual visitors out of the admin page, but anyone can read the site files. Real control is who can push to your repo.
- **Stats stay on each device.** "This device" counts games played in that browser (localStorage). There is no combined total across players. Adding one needs a small backend, for example Google Apps Script or Firebase.
- **Photos are resized to 720 px** in the browser. Exported photos are embedded in `menu.json`, so a menu with 16 photos can reach a megabyte or two.
- Fonts load from Google Fonts. Offline, the page falls back to system fonts.
