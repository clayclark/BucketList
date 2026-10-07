import { describe, expect, it } from 'vitest'
import { availability, openPicks, slotForPick, snakeOwners } from './draft'

describe('snake order', () => {
  it('reverses every other round', () => {
    expect([0, 9, 10, 19, 20].map((i) => slotForPick(i, 10))).toEqual([0, 9, 9, 0, 0])
  })

  it('skips picks already used, including future keeper picks', () => {
    const owners = snakeOwners(3, 2)
    expect(owners).toEqual([0, 1, 2, 2, 1, 0])
    expect(openPicks(owners, new Set([1, 5]))).toEqual([2, 3, 4, 6])
  })
})

describe('availability', () => {
  it('falls as the target pick passes ADP', () => {
    const early = availability(30, 10, 20)
    const late = availability(30, 10, 40)
    expect(early).toBeGreaterThan(0.8)
    expect(late).toBeLessThan(0.2)
  })

  it('keeps a fallen player alive for a few picks rather than zeroing out', () => {
    expect(availability(5, 25, 28)).toBeGreaterThan(0.05)
    expect(availability(5, 25, 28)).toBeLessThan(0.5)
  })
})
