/** Draft slot (0-based) that owns the pick at `index` (0-based overall) in a snake draft. */
export const slotForPick = (index: number, teamCount: number) => {
  const round = Math.floor(index / teamCount)
  const pos = index % teamCount
  return round % 2 === 0 ? pos : teamCount - 1 - pos
}

/** Slot owning each overall pick (index = overall - 1) in a plain snake. Synced leagues use ESPN's real order instead. */
export const snakeOwners = (teamCount: number, rounds: number) =>
  Array.from({ length: teamCount * rounds }, (_, i) => slotForPick(i, teamCount))

/** Overall pick numbers (1-based) not yet used. Keepers fill future picks, so this isn't just "after the last pick". */
export const openPicks = (owners: number[], taken: Set<number>) =>
  owners.flatMap((_, i) => (taken.has(i + 1) ? [] : [i + 1]))

// Logistic draft-position model: heavier tails than a normal, so players who fall past
// their ADP still have a sensible chance of lasting a few more picks.
const survival = (pick: number, adp: number) => 1 / (1 + Math.exp((pick - adp) / (1.5 + adp * 0.1)))

/** Chance a still-available player lasts until overall pick `target` (1-based), given we're at pick `current`. */
export const availability = (adp: number, current: number, target: number) =>
  target <= current ? 1 : Math.min(1, survival(target, adp) / survival(current, adp))
