import { describe, expect, it } from 'vitest'
import type { League } from './espn'
import { livePicks, mergeLivePicks, parseInit, type LiveDraft } from './live'

// Two teams, snake with a traded pick: 1:A 2:B 3:B 4:A 5:B(traded from A) 6:B. Team A kept a player at pick 4.
const league: League = {
  teams: [],
  pickOrder: [1, 2],
  rosterSize: 3,
  draftDate: null,
  starters: [],
  owners: [1, 2, 2, 1, 2, 2],
  made: [{ overall: 4, teamId: 1, playerId: 900, keeper: true }],
}

/** Builds an INIT payload shaped like ESPN's: unrelated header bytes, then 45-byte pick records. */
const initFor = (records: [teamId: number, playerId: number][], headerBytes = 13) => {
  const bytes = new Uint8Array(headerBytes + records.length * 45 + 7)
  const view = new DataView(bytes.buffer)
  records.forEach(([teamId, playerId], i) => {
    const at = headerBytes + i * 45
    view.setInt32(at, 1)
    view.setInt32(at + 12, teamId)
    view.setInt32(at + 16, i + 1)
    view.setInt32(at + 20, playerId)
  })
  return btoa(String.fromCharCode(...bytes))
}

describe('parseInit', () => {
  it('reads made picks with their overall numbers and skips open ones', () => {
    const init = initFor([[1, 10], [2, 20], [2, -1], [1, 900], [2, -1], [2, -1]])
    expect(parseInit(init)).toEqual([
      { overall: 1, teamId: 1, playerId: 10 },
      { overall: 2, teamId: 2, playerId: 20 },
      { overall: 4, teamId: 1, playerId: 900 },
    ])
  })

  it('returns nothing for a payload without a pick board', () => {
    expect(parseInit(btoa('not a draft'))).toEqual([])
  })
})

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

  it('leaves a missed pick as a gap instead of shifting later picks into it', () => {
    // Three-team snake. Pick 1 (team 1) never arrived; team 1's next message is pick 6, not the hole at 1.
    const threeTeams: League = { ...league, owners: [1, 2, 3, 3, 2, 1], made: [] }
    const merged = mergeLivePicks(threeTeams, [
      { teamId: 2, playerId: 20 },
      { teamId: 3, playerId: 30 },
      { teamId: 3, playerId: 31 },
      { teamId: 2, playerId: 21 },
      { teamId: 1, playerId: 10 },
    ])
    expect(merged.made.map((m) => [m.overall, m.playerId])).toEqual([
      [2, 20],
      [3, 30],
      [4, 31],
      [5, 21],
      [6, 10],
    ])
  })

  it('recovers picks made while the room was closed from the reload snapshot', () => {
    // Picks 1-3 happened before this tab joined; the snapshot has them, then one live pick follows.
    const live: LiveDraft = {
      leagueId: '1',
      init: initFor([[1, 10], [2, 20], [2, 21], [1, 900], [2, -1], [2, -1]]),
      lines: ['SELECTED 2 22 1'],
      clock: null,
      done: false,
      seen: 0,
    }
    expect(mergeLivePicks(league, livePicks(live)).made.map((m) => [m.overall, m.playerId])).toEqual([
      [1, 10],
      [2, 20],
      [3, 21],
      [4, 900],
      [5, 22],
    ])
  })
})
