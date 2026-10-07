import { describe, expect, it } from 'vitest'
import { parseLeague, type EspnLeague } from './espn'

const pick = (overall: number, roundId: number, teamId: number, extra = {}) => ({
  overallPickNumber: overall, roundId, teamId, playerId: -1, ...extra,
})

const league: EspnLeague = {
  teams: [
    { id: 7, name: 'A', owners: ['{me}'], roster: { entries: [{ playerId: 100, playerPoolEntry: { keeperValue: 2 } }] } },
    { id: 3, name: 'B', roster: { entries: [] } },
  ],
  settings: {
    draftSettings: { pickOrder: [7, 3] },
    rosterSettings: { lineupSlotCounts: { '11': 2, '12': 1, '13': 3 } },
  },
  draftDetail: {
    picks: [
      pick(2, 1, 3, { playerId: 200 }),
      pick(1, 1, 7, { playerId: 201 }),
      pick(3, 2, 3),
      pick(4, 2, 7, { reservedForKeeper: true }),
      pick(5, 3, 3),
      pick(6, 3, 3),
    ],
  },
}

describe('parseLeague', () => {
  const parsed = parseLeague(league)

  it('keeps ESPN pick ownership as-is, trades included, and skips IR in roster size', () => {
    expect(parsed.owners).toEqual([7, 3, 3, 7, 3, 3])
    expect(parsed.rosterSize).toBe(3)
  })

  it('places pre-draft keepers on their reserved pick', () => {
    expect(parsed.made).toEqual([
      { overall: 1, teamId: 7, playerId: 201, keeper: false },
      { overall: 2, teamId: 3, playerId: 200, keeper: false },
      { overall: 4, teamId: 7, playerId: 100, keeper: true },
    ])
  })

  it('falls back to the team’s reserved pick when the keeper round moved', () => {
    const moved = structuredClone(league)
    moved.teams![0].roster!.entries![0].playerPoolEntry!.keeperValue = 3
    expect(parseLeague(moved).made.find((m) => m.playerId === 100)?.overall).toBe(4)
  })

  it('does not double count a keeper once ESPN fills the pick', () => {
    const started = structuredClone(league)
    started.draftDetail!.picks![3] = pick(4, 2, 7, { playerId: 100, keeper: true, reservedForKeeper: true })
    expect(parseLeague(started).made.filter((m) => m.playerId === 100)).toHaveLength(1)
  })
})
