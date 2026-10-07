<img src="public/icon.svg" width="64" height="64" alt="">

# Bucket List

Live draft companion for ESPN 9-cat H2H fantasy basketball, as a Chrome/Helium side panel extension.

## Install

```sh
pnpm install
pnpm build
```

Then in Helium (or Chrome): open `helium://extensions` (`chrome://extensions`), turn on Developer mode, **Load unpacked**, and pick the `dist` folder. Click the toolbar icon to open the side panel next to the ESPN draft room. `⤢` opens it in a full tab.

Be logged in to espn.com in the same browser. The extension reads your private league with that login and finds your team from it. If the panel shows an **Allow** banner, the browser is withholding site access (Helium can); allow it and reload the ESPN tab. After code changes, `pnpm build` and hit reload on the extensions page.

**On draft night, keep the ESPN draft room open.** Picks come from the draft room itself: ESPN's league API doesn't update during a draft, so the extension reads the room's live pick feed. Reloading or opening the room late is fine; it sends a full board snapshot on join and the panel catches up. ESPN's practice drafts work the same way and make a full rehearsal.

## What's in it

- **Category strip**: your rank in each of the 9 categories, always under the clock. Hover or select an available player to preview how drafting him moves each rank.
- **Buckets**: your bucket sheet. Taken players drop out, and each bucket says how many should still be there at your next pick. Near your pick, the highest bucket that won't last says "take one now", players who'll likely come back say "can wait", and a line lists who's likely still there next time. The three best fits for your team are highlighted. Edit mode re-tiers by drag and drop.
- **Players**: everyone, on the same rows, sortable by value, fit, ADP or availability.
- **Every player row**: a 9-cell category heat strip, fit, and the chance he's back at your next pick. Click to expand details in place, including exactly which of your ranks he changes.
- **Team**: category ranks with punt toggles, and your roster placed into your league's lineup slots.
- **League**: category standings with your expected record against each team, the draft board, rosters.

Values are z-scores against the top `teams × roster` players from ESPN's projections. ADP comes from Fantrax. Fit is how many more categories per week a player is expected to win you, given your roster. Picks arrive live from the open draft room and land on ESPN's real pick order (traded picks, third-round reversal), with keepers placed at their reserved picks. Turn sync off in Setup to enter picks by hand (search + Enter, Cmd+Z to undo).

## Dev

`pnpm dev` runs the same UI at http://localhost:5173. To reach a private league there, put `ESPN_S2` and `ESPN_SWID` (your espn.com cookies) in `.env.local`; the dev server proxies them. They never reach the built extension.
