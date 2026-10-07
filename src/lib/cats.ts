export const CATS = ['fg', 'ft', 'tpm', 'reb', 'ast', 'stl', 'blk', 'to', 'pts'] as const
export type Cat = (typeof CATS)[number]

export const CAT_LABEL: Record<Cat, string> = {
  fg: 'FG%',
  ft: 'FT%',
  tpm: '3PM',
  reb: 'REB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  to: 'TO',
  pts: 'PTS',
}

export const STAT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'to', 'fgm', 'fga', 'ftm', 'fta'] as const
export type StatLine = Record<(typeof STAT_KEYS)[number], number>

export type CatLine = Record<Cat, number>

export const emptyCatLine = (): CatLine => ({ fg: 0, ft: 0, tpm: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pts: 0 })
