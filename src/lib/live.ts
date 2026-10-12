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
 * The rest of the format is unknown, so find the run by its overall numbers counting 1, 2, 3. Round one's
 * team ids also count 1, 2, 3 four bytes earlier, so take the longest run: that's the whole board.
 */
export function parseInit(base64: string): LivePick[] {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  const int = (offset: number) => view.getInt32(offset)
  const fits = (start: number, i: number) => start + RECORD * i + 24 <= bytes.length
  const runAt = (start: number) => {
    let n = 0
    while (fits(start, n) && int(start + RECORD * n + 16) === n + 1) n++
    return n
  }

  let best = { start: 0, length: 0 }
  for (let start = 0; fits(start, 2); start++) {
    const length = runAt(start)
    if (length >= 3 && length > best.length) best = { start, length }
  }
  const picks: LivePick[] = []
  for (let i = 0; i < best.length; i++) {
    const record = best.start + RECORD * i
    const playerId = int(record + 20)
    if (playerId > 0) picks.push({ overall: i + 1, teamId: int(record + 12), playerId })
  }
  return picks
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
