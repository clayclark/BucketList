import { describe, expect, it } from 'vitest'
import type { StatLine } from './cats'
import type { Player } from './espn'
import { fitScores, replacementLevel, teamStrength, valuePlayers, winProb, winScales } from './value'

const line = (o: Partial<StatLine>): StatLine => ({
  pts: 10, reb: 5, ast: 3, stl: 1, blk: 0.5, tpm: 1, to: 1.5, fgm: 4, fga: 9, ftm: 1.5, fta: 2, ...o,
})

const player = (id: number, stats: StatLine): Player => ({
  id, name: `P${id}`, team: 'DEN', pos: 'C', injury: null, adp: id, rank: id,
  proj: { gp: 70, min: 30, stats }, last: null,
})

const players = [
  player(1, line({ pts: 28, reb: 12, ast: 10, fgm: 11, fga: 19 })),
  player(2, line({ blk: 3.5, reb: 11, ftm: 1, fta: 4 })),
  player(3, line({ tpm: 4, pts: 22, ftm: 5, fta: 5.5 })),
  ...Array.from({ length: 30 }, (_, i) => player(10 + i, line({ pts: 8 + (i % 5), reb: 3 + (i % 4) }))),
]

describe('valuePlayers', () => {
  const opts = { basis: 'proj' as const, totals: false, punts: [], poolSize: 20 }

  it('ranks the all-around star first and gives percentages a volume weight', () => {
    const { valued: v } = valuePlayers(players, opts)
    expect(v[0].player.id).toBe(1)
    const big = v.find((x) => x.player.id === 2)!
    const shooter = v.find((x) => x.player.id === 3)!
    expect(big.z.ft).toBeLessThan(0)
    expect(shooter.z.ft).toBeGreaterThan(big.z.ft)
  })

  it('punting a category removes it from value', () => {
    const base = valuePlayers(players, opts).valued.find((x) => x.player.id === 2)!
    const punt = valuePlayers(players, { ...opts, punts: ['ft'] }).valued.find((x) => x.player.id === 2)!
    expect(punt.value).toBeCloseTo(base.value - base.z.ft, 5)
  })
})

describe('team fit', () => {
  const { valued: v, swing } = valuePlayers(players, { basis: 'proj', totals: false, punts: [], poolSize: 20 })
  const repl = replacementLevel(v, 20)
  const scale = winScales(swing, 13)
  const byId = (id: number) => v.find((x) => x.player.id === id)!

  it('fills empty roster spots at replacement level', () => {
    expect(teamStrength([], 2, repl).pts).toBeCloseTo(repl.pts * 2)
  })

  it('a better player adds more expected category wins', () => {
    const opponents = [teamStrength([byId(2).z], 13, repl)]
    const fit = fitScores([byId(1), byId(15)], [], opponents, 13, repl, ['pts', 'reb', 'ast'], scale)
    expect(fit.get(1)!).toBeGreaterThan(fit.get(15)!)
  })

  it('the same z edge wins a steady category more often than a streaky one', () => {
    // Points and steals spread the same relative to their averages, so only weekly volatility differs.
    const spread = Array.from({ length: 20 }, (_, i) => player(i, line({ pts: 10 + i, stl: (10 + i) / 10 })))
    const { swing } = valuePlayers(spread, { basis: 'proj', totals: false, punts: [], poolSize: 20 })
    const s = winScales(swing, 13)
    expect(winProb(3, 0, s.pts)).toBeGreaterThan(winProb(3, 0, s.stl))
  })
})
