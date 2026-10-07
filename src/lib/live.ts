import type { League } from './espn'

/** What draft-relay.js saves from the ESPN draft room socket. */
export type LiveDraft = {
  leagueId: string
  /** Base64 board snapshot from the latest join. */
  init: string | null
  /** "SELECTED <teamId> <playerId> ..." lines since that snapshot. */
  lines: string[]
  clock: { teamId: number; endsAt: number } | null
  done: boolean
  seen: number
}

export type LivePick = { teamId: number; playerId: number; overall?: number }

const RECORD = 45

/**
 * Reads picks out of the draft room's INIT snapshot. The board is a run of 45-byte records in pick
 * order: team id at byte 12, overall pick at 16, player id at 20 (-1 until made). Keepers are included.
 * The rest of the format is unknown, so find the run by its overall numbers counting 1, 2, 3.
 */
export function parseInit(base64: string): LivePick[] {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  const int = (offset: number) => view.getInt32(offset)
  const overallAt = (start: number, i: number) => int(start + RECORD * i + 16)

  for (let start = 0; start + RECORD * 2 + 24 <= bytes.length; start++) {
    if (overallAt(start, 0) !== 1 || overallAt(start, 1) !== 2 || overallAt(start, 2) !== 3) continue
    const picks: LivePick[] = []
    for (let i = 0; start + RECORD * i + 24 <= bytes.length && overallAt(start, i) === i + 1; i++) {
      const record = start + RECORD * i
      const playerId = int(record + 20)
      if (playerId > 0) picks.push({ overall: i + 1, teamId: int(record + 12), playerId })
    }
    return picks
  }
  return []
}

export const livePicks = (live: LiveDraft): LivePick[] => [
  ...(live.init ? parseInit(live.init) : []),
  ...live.lines.map((line) => {
    const [, teamId, playerId] = line.split(' ')
    return { teamId: Number(teamId), playerId: Number(playerId) }
  }),
]

/**
 * Adds draft-room picks to the league's known picks (keepers, anything ESPN already reports).
 * Snapshot picks carry their overall number. Socket picks don't, but arrive in draft order, so each
 * goes to its team's next open pick after the last one placed. If a pick was missed, it stays a gap
 * instead of pulling later picks backwards; the next snapshot fills it.
 */
export function mergeLivePicks(league: League, live: LivePick[]): League {
  const made = [...league.made]
  const players = new Set(made.map((m) => m.playerId))
  const used = new Set(made.map((m) => m.overall))
  let cursor = 0
  for (const { teamId, playerId, overall } of live) {
    if (players.has(playerId)) continue
    const at =
      overall !== undefined && !used.has(overall)
        ? overall
        : league.owners.findIndex((owner, i) => i >= cursor && owner === teamId && !used.has(i + 1)) + 1
    if (at < 1) continue
    used.add(at)
    players.add(playerId)
    made.push({ overall: at, teamId, playerId, keeper: false })
    cursor = Math.max(cursor, at)
  }
  return { ...league, made: made.sort((a, b) => a.overall - b.overall) }
}
