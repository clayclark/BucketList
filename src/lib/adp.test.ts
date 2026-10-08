import { describe, expect, it } from 'vitest'
import { blendAdp } from './adp'

describe('blendAdp', () => {
  it('averages every source that lists the player', () => {
    expect(blendAdp([5.7, 6.8, 8.4])).toBeCloseTo(6.97)
    expect(blendAdp([5.7, undefined, 8.3])).toBe(7)
  })

  it('treats a missing or zero ESPN ADP as unlisted', () => {
    expect(blendAdp([null, 0, 12])).toBe(12)
    expect(blendAdp([null, undefined])).toBeNull()
  })
})
