import type { League } from './espn'

/** What draft-relay.js saves from the ESPN draft room socket. */
export type LiveDraft = {
  leagueId: string
  picks: { teamId: number; playerId: number }[]
  clock: { teamId: number; endsAt: number } | null
  done: boolean
  seen: number
}

/**
 * Adds draft-room picks to the league's known picks (keepers, anything ESPN already reports).
 * The socket doesn't say which overall pick it was, so each goes to its team's next open pick,
 * which follows ESPN's real order, trades and keepers included.
 */
export function mergeLivePicks(league: League, live: LiveDraft['picks']): League {
  const made = [...league.made]
  const players = new Set(made.map((m) => m.playerId))
  const used = new Set(made.map((m) => m.overall))
  for (const { teamId, playerId } of live) {
    if (players.has(playerId)) continue
    const index = league.owners.findIndex((owner, i) => owner === teamId && !used.has(i + 1))
    if (index < 0) continue
    used.add(index + 1)
    players.add(playerId)
    made.push({ overall: index + 1, teamId, playerId, keeper: false })
  }
  return { ...league, made: made.sort((a, b) => a.overall - b.overall) }
}
