import { describe, expect, it } from 'vitest'
import type { League } from './espn'
import { mergeLivePicks } from './live'

// Two teams, snake with a traded pick: 1:A 2:B 3:B 4:A 5:B(traded from A) 6:B. Team A kept a player at pick 4.
const league: League = {
  teams: [],
  pickOrder: [1, 2],
  rosterSize: 3,
  draftDate: null,
  owners: [1, 2, 2, 1, 2, 2],
  made: [{ overall: 4, teamId: 1, playerId: 900, keeper: true }],
}

describe('mergeLivePicks', () => {
  it('fills each team’s next open pick, skipping keeper picks', () => {
    const merged = mergeLivePicks(league, [
      { teamId: 1, playerId: 10 },
      { teamId: 2, playerId: 20 },
      { teamId: 2, playerId: 21 },
      { teamId: 2, playerId: 22 },
    ])
    expect(merged.made.map((m) => [m.overall, m.playerId])).toEqual([
      [1, 10],
      [2, 20],
      [3, 21],
      [4, 900],
      [5, 22],
    ])
  })

  it('ignores repeats and players ESPN already reports', () => {
    const merged = mergeLivePicks(league, [
      { teamId: 1, playerId: 900 },
      { teamId: 1, playerId: 10 },
      { teamId: 1, playerId: 10 },
    ])
    expect(merged.made).toHaveLength(2)
  })
})
