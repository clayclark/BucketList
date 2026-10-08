import { CATS, type Cat, type CatLine } from './cats'
import { winProb } from './value'

export type PuntOption = {
  cat: Cat
  /** Share of weekly matchups you'd win this category right now, averaged over opponents. */
  winRate: number
  /** Average score in this category among the best players still available. Negative means they hurt it. */
  boardTilt: number
}

/**
 * Which category to give up. A good punt is one you're already losing most weeks and that the best
 * players left on the board hurt anyway, so dropping it costs little and frees you to take them.
 * Suggest at most one beyond what you've punted, and nothing until a couple of picks are in.
 */
export function puntAdvice({
  mine,
  opponents,
  topAvailable,
  punts,
  rosterCount,
  scale,
}: {
  mine: CatLine
  opponents: CatLine[]
  topAvailable: CatLine[]
  punts: readonly Cat[]
  rosterCount: number
  scale: CatLine
}): PuntOption[] {
  if (rosterCount < 2 || punts.length >= 2 || !opponents.length || !topAvailable.length) return []
  const losingBelow = punts.length === 0 ? 0.4 : 0.2
  return CATS.filter((c) => !punts.includes(c))
    .map((cat) => ({
      cat,
      winRate: opponents.reduce((n, o) => n + winProb(mine[cat], o[cat], scale[cat]), 0) / opponents.length,
      boardTilt: topAvailable.reduce((n, z) => n + z[cat], 0) / topAvailable.length,
    }))
    .filter((o) => o.winRate < losingBelow && o.boardTilt < 0)
    .sort((a, b) => a.winRate - b.winRate)
}
