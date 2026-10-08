import { CATS, emptyCatLine, STAT_KEYS, type Cat, type CatLine, type StatLine } from './cats'
import type { BasisKey, Player } from './espn'

export type ValueOptions = { basis: BasisKey; totals: boolean; punts: readonly Cat[]; poolSize: number }

export type Valued = {
  player: Player
  gp: number
  min: number
  line: StatLine
  z: CatLine
  value: number
  rank: number
}

export const activeCats = (punts: readonly Cat[]) => CATS.filter((c) => !punts.includes(c))

const scale = (s: StatLine, k: number) =>
  Object.fromEntries(STAT_KEYS.map((key) => [key, s[key] * k])) as StatLine

const sumLines = (lines: StatLine[]) => {
  const out: StatLine = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, to: 0, fgm: 0, fga: 0, ftm: 0, fta: 0 }
  for (const l of lines) for (const k of STAT_KEYS) out[k] += l[k]
  return out
}

/** Per-category contribution. Percentages become volume-weighted impact above the pool average. */
const impact = (l: StatLine, lgFg: number, lgFt: number): CatLine => ({
  fg: l.fgm - l.fga * lgFg,
  ft: l.ftm - l.fta * lgFt,
  tpm: l.tpm,
  reb: l.reb,
  ast: l.ast,
  stl: l.stl,
  blk: l.blk,
  to: -l.to,
  pts: l.pts,
})

/**
 * How much a player's weekly total swings around his average, as a share of it: the median player's
 * coefficient of variation in 2025-26 weekly totals, from Josh Lloyd's consistency study
 * (joshlloydfantasy.com/research/fantasy-basketball-consistency-study).
 */
const WEEKLY_CV = { pts: 0.533, reb: 0.539, ast: 0.644, to: 0.714, tpm: 0.753, stl: 0.841, blk: 1.145 }
// Average games in an active week, from the same study.
const GAMES_PER_WEEK = 2.78

type PoolRow = { line: StatLine; gp: number }

/** z-scores against the pool, plus each category's weekly swing for one player in z units. */
const zScorer = (pool: PoolRow[], totals: boolean) => {
  const total = sumLines(pool.map((r) => r.line))
  const lgFg = total.fgm / total.fga
  const lgFt = total.ftm / total.fta
  const impacts = pool.map((r) => impact(r.line, lgFg, lgFt))
  const mean = emptyCatLine()
  const sd = emptyCatLine()
  for (const c of CATS) {
    const xs = impacts.map((i) => i[c])
    mean[c] = xs.reduce((a, b) => a + b, 0) / xs.length
    sd[c] = Math.sqrt(xs.reduce((a, x) => a + (x - mean[c]) ** 2, 0) / xs.length) || 1
  }
  // Variance of one player's weekly result, in line units. Counting stats use the measured CV; makes
  // are binomial on attempts. Season-total lines cover gp games, so their weekly noise scales up to match.
  const shotNoise = (attempts: number, pct: number, gp: number) =>
    (attempts * (totals ? gp : 1) * pct * (1 - pct)) / GAMES_PER_WEEK
  const swing = emptyCatLine()
  for (const c of CATS) {
    const variance = pool.reduce((a, { line, gp }, i) => {
      if (c === 'fg') return a + shotNoise(line.fga, lgFg, gp)
      if (c === 'ft') return a + shotNoise(line.fta, lgFt, gp)
      return a + (WEEKLY_CV[c] * impacts[i][c]) ** 2
    }, 0)
    swing[c] = Math.sqrt(variance / pool.length) / sd[c]
  }
  const zOf = (l: StatLine) => {
    const i = impact(l, lgFg, lgFt)
    const z = emptyCatLine()
    for (const c of CATS) z[c] = (i[c] - mean[c]) / sd[c]
    return z
  }
  return { zOf, swing }
}

const sumCats = (z: CatLine, cats: readonly Cat[]) => cats.reduce((a, c) => a + z[c], 0)

/**
 * 9-cat z-score values. The comparison pool is the top `poolSize` players (everyone who gets rostered),
 * re-selected by value a few times so it settles on the right group. `swing` is how far one player's
 * weekly result in each category moves, in z units.
 */
export function valuePlayers(players: Player[], o: ValueOptions): { valued: Valued[]; swing: CatLine } {
  const cats = activeCats(o.punts)
  const rows = players.flatMap((player) => {
    const b = player[o.basis]
    if (!b || b.min <= 0) return []
    return [{ player, gp: b.gp, min: b.min, line: o.totals ? scale(b.stats, b.gp) : b.stats }]
  })
  let pool = rows.slice(0, o.poolSize)
  let valued: Omit<Valued, 'rank'>[] = []
  let swing = emptyCatLine()
  for (let pass = 0; pass < 3; pass++) {
    const scorer = zScorer(pool, o.totals)
    swing = scorer.swing
    valued = rows
      .map((r) => {
        const z = scorer.zOf(r.line)
        return { ...r, z, value: sumCats(z, cats) }
      })
      .sort((a, b) => b.value - a.value)
    pool = valued.slice(0, o.poolSize)
  }
  return { valued: valued.map((v, i) => ({ ...v, rank: i + 1 })), swing }
}

export const sumZ = (zs: CatLine[]) => {
  const out = emptyCatLine()
  for (const z of zs) for (const c of CATS) out[c] += z[c]
  return out
}

/** Average z of the players just outside the rosterable pool: what an empty roster spot is worth. */
export const replacementLevel = (valued: Valued[], poolSize: number) => {
  const band = valued.slice(poolSize, poolSize + 20)
  const total = sumZ(band.map((v) => v.z))
  for (const c of CATS) total[c] /= band.length || 1
  return total
}

/** Team category strength, with unfilled roster spots filled at replacement level so partial rosters compare fairly. */
export const teamStrength = (roster: CatLine[], rosterSize: number, replacement: CatLine) => {
  const out = sumZ(roster)
  const open = Math.max(0, rosterSize - roster.length)
  for (const c of CATS) out[c] += replacement[c] * open
  return out
}

/**
 * Logistic scale per category for a weekly matchup between two full rosters. Steadier categories get a
 * smaller scale, so the same z edge wins them more often: a rebounds lead holds up more often than a steals lead.
 */
export const winScales = (swing: CatLine, rosterSize: number): CatLine => {
  const out = emptyCatLine()
  // Both rosters' noise adds up; sqrt(3)/pi matches a logistic to a normal with the same spread.
  for (const c of CATS) out[c] = (swing[c] * Math.sqrt(2 * rosterSize) * Math.sqrt(3)) / Math.PI
  return out
}

export const winProb = (a: number, b: number, scale: number) => 1 / (1 + Math.exp(-(a - b) / scale))

export const expectedWins = (a: CatLine, b: CatLine, cats: readonly Cat[], scale: CatLine) =>
  cats.reduce((n, c) => n + winProb(a[c], b[c], scale[c]), 0)

/** Change in my expected category wins per matchup (averaged over opponents) from adding each candidate. */
export function fitScores(
  candidates: Valued[],
  mine: CatLine[],
  opponents: CatLine[],
  rosterSize: number,
  replacement: CatLine,
  cats: readonly Cat[],
  scale: CatLine,
) {
  const fit = new Map<number, number>()
  if (mine.length >= rosterSize) return fit
  const vsField = (team: CatLine) =>
    opponents.reduce((n, o) => n + expectedWins(team, o, cats, scale), 0) / (opponents.length || 1)
  const base = vsField(teamStrength(mine, rosterSize, replacement))
  for (const v of candidates) {
    fit.set(v.player.id, vsField(teamStrength([...mine, v.z], rosterSize, replacement)) - base)
  }
  return fit
}

/** Raw per-game (or season) category totals for a roster. */
export const teamTotals = (lines: StatLine[]): CatLine => {
  const t = sumLines(lines)
  return {
    fg: t.fga ? t.fgm / t.fga : 0,
    ft: t.fta ? t.ftm / t.fta : 0,
    tpm: t.tpm,
    reb: t.reb,
    ast: t.ast,
    stl: t.stl,
    blk: t.blk,
    to: t.to,
    pts: t.pts,
  }
}
