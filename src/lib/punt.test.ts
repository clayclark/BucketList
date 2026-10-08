import { describe, expect, it } from 'vitest'
import { CATS, emptyCatLine, type CatLine } from './cats'
import { puntAdvice } from './punt'

const line = (patch: Partial<CatLine>): CatLine => ({ ...emptyCatLine(), ...patch })

describe('puntAdvice', () => {
  // My team is far behind in TO and FT; the best players left are bad at TO but fine at FT.
  const mine = line({ to: -8, ft: -6, reb: 4 })
  const opponents = [line({}), line({ to: 1 }), line({ ft: 1 })]
  const topAvailable = [line({ to: -1, ft: 0.5 }), line({ to: -0.6, ft: 0.2 })]
  const scale = Object.fromEntries(CATS.map((c) => [c, 3])) as CatLine

  it('suggests a category you lose that the remaining board also hurts', () => {
    const advice = puntAdvice({ mine, opponents, topAvailable, punts: [], rosterCount: 3, scale })
    expect(advice.map((a) => a.cat)).toEqual(['to'])
    expect(advice[0].winRate).toBeLessThan(0.1)
  })

  it('skips categories the board helps, ones you win, and anything already punted', () => {
    const advice = puntAdvice({ mine, opponents, topAvailable, punts: ['to'], rosterCount: 3, scale })
    expect(advice).toEqual([])
  })

  it('waits until a couple of picks are in', () => {
    expect(puntAdvice({ mine, opponents, topAvailable, punts: [], rosterCount: 1, scale })).toEqual([])
  })
})
