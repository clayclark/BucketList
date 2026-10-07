import { describe, expect, it } from 'vitest'
import { openSlots, startersFrom } from './slots'

describe('slots', () => {
  it('reads starting slots and ignores UTIL, bench and IR', () => {
    expect(startersFrom({ 4: 1, 5: 2, 6: 2, 11: 5, 12: 6, 13: 3 })).toEqual(['C', 'G', 'G', 'F', 'F'])
  })

  it('finds the best assignment, moving flexible players out of the way', () => {
    const starters = ['C', 'G', 'F']
    // A PF/C first would grab C; matching moves him to F so the pure C fits too.
    expect(openSlots(starters, [['PF', 'C'], ['C']])).toEqual(['G'])
    expect(openSlots(starters, [['PG'], ['SF'], ['C']])).toEqual([])
    expect(openSlots(starters, [['PG'], ['SG']])).toEqual(['C', 'F'])
  })
})
