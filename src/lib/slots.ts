// ESPN lineup slot ids for basketball. UTIL, bench and IR take anyone, so they never constrain a roster.
const SLOT_LABELS: Record<string, string> = {
  0: 'PG', 1: 'SG', 2: 'SF', 3: 'PF', 4: 'C', 5: 'G', 6: 'F', 7: 'SG/SF', 8: 'G/F', 9: 'PF/C', 10: 'F/C',
}

const COVERS: Record<string, string[]> = { G: ['PG', 'SG'], F: ['SF', 'PF'] }

export const startersFrom = (slotCounts: Record<string, number>) =>
  Object.entries(slotCounts).flatMap(([id, n]) => (SLOT_LABELS[id] ? Array<string>(n).fill(SLOT_LABELS[id]) : []))

const fits = (slot: string, positions: string[]) =>
  slot.split('/').some((part) => (COVERS[part] ?? [part]).some((p) => positions.includes(p)))

/** Starting slots the roster can't fill, using the best possible assignment (bipartite matching). */
export function openSlots(starters: string[], roster: string[][]): string[] {
  const holder: (number | undefined)[] = starters.map(() => undefined)
  const place = (player: number, seen: Set<number>): boolean =>
    starters.some((slot, s) => {
      if (seen.has(s) || !fits(slot, roster[player])) return false
      seen.add(s)
      const current = holder[s]
      if (current === undefined || place(current, seen)) {
        holder[s] = player
        return true
      }
      return false
    })
  roster.forEach((_, player) => place(player, new Set()))
  return starters.filter((_, s) => holder[s] === undefined)
}
