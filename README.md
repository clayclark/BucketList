<img src="public/icon.svg" width="64" height="64" alt="">

# Bucket List

A live draft companion for ESPN 9-cat H2H fantasy basketball. It sits in the browser's side panel next to ESPN's draft room, follows every pick as it happens, and answers the two questions that matter on the clock: **who fits my team**, and **who won't last until my next pick**.

## Install

```sh
pnpm install
pnpm build
```

1. Open `helium://extensions` (or `chrome://extensions`) and turn on **Developer mode**.
2. **Load unpacked** and pick the `dist` folder.
3. Log in to espn.com in the same browser, then click the toolbar icon to open the panel. `⤢` opens it in a full tab.

If the panel shows an **Allow** banner, the browser is withholding site access (Helium can do this). Allow it and reload the ESPN tab. After code changes, run `pnpm build` and hit reload on the extensions page.

## Draft night

1. Open the panel. It reads your league with your ESPN login and finds your team on its own.
2. Set any punts in **Team** (or let the punt advisor suggest one once you have a few picks).
3. **Join ESPN's draft room and keep it open.** Picks come from the room's live feed, because ESPN's league API doesn't update during a draft. Joining late or reloading is fine: the room sends a full board on join and the panel catches up.
4. On the clock, start in **Buckets**: take from the highest bucket marked "take one now", and skip players marked "can wait".

ESPN's practice drafts work the same way, so a mock is a full rehearsal.

## Reading a player row

| | What it means |
|---|---|
| **Heat strip** | 9 cells, one per category. Green helps, red hurts, brighter is stronger. |
| **Val** | How good he is in a vacuum: a z-score total across the 9 categories (minus any you punt), against the top `teams × roster` players. |
| **Fit** | How many more categories per week he's expected to win *you*, given your roster. Amber marks your top 3 fits. |
| **%** | The chance he's still there at your next pick. |

Bucket headers say how many should be left at your next pick. Near your pick, the highest bucket that won't last says **take one now**, players likely to come back say **can wait**, and a line lists who's likely still there next time.

## Tabs

- **Category strip**: your rank in each category, always visible under the clock. Hover or select a player to preview how he moves each rank.
- **Buckets**: your tier sheet, with taken players dropping out. Sheet tags are understood: `Cade (TO)` and `Cade (No Punt)` follow your punt settings, and `Kawhi (30+)` lights up once the draft reaches pick 30. **Edit** re-tiers by drag and drop; Setup → **Copy as sheet** copies your buckets back in the sheet's layout.
- **Players**: everyone, sortable by value, fit, ADP or availability. Click a row (or use the arrow keys) for details, including exactly which of your ranks he changes.
- **Team**: the punt advisor, category ranks with punt toggles, and your roster placed into your league's lineup slots.
- **League**: category standings with your expected record against each team, the draft board, and rosters.

## In ESPN's draft room

While the panel is open, ESPN's own player list gets badges. Your bucket players get an edge bar (red take now, green can wait, blue in your buckets, grey not for your punts) and their bucket code under ESPN's rank. `4.1 +.43 50%` next to the position is value, fit, and his chance of lasting to your pick (shown when under 95%). Hover a row for his heat strip.

## Where the numbers come from

- **Projections**: ESPN.
- **ADP**: an equal blend of ESPN, Yahoo and Fantrax, the same blend Hashtag Basketball publishes. A source that fails to load is left out.
- **Picks**: the draft room's live feed, placed on ESPN's real pick order (traded picks, third-round reversal) with keepers at their reserved picks. Turn sync off in Setup to enter picks by hand (search + Enter, Cmd+Z to undo).
- **Buckets**: your Google Sheet, set in Setup.

## Dev

`pnpm dev` runs the same UI at http://localhost:5173. To reach a private league there, put `ESPN_S2` and `ESPN_SWID` (your espn.com cookies) in `.env.local`; the dev server proxies them. They never reach the built extension.

`pnpm test`, `pnpm lint` and `pnpm build` should all pass before a merge.
