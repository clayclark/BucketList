import type { Cat } from './lib/cats'

export const zStyle = (z: number) => {
  const a = Math.min(Math.abs(z) / 2.5, 1) * 0.45
  return { backgroundColor: z >= 0 ? `rgba(52, 211, 153, ${a})` : `rgba(251, 113, 133, ${a})` }
}

/** Rank 1 of n maps to strong green, rank n to strong red. */
export const rankStyle = (rank: number, n: number) => zStyle((((n + 1) / 2 - rank) / ((n - 1) / 2 || 1)) * 2.5)

export const fmtCat = (c: Cat, v: number) => (c === 'fg' || c === 'ft' ? v.toFixed(3).replace(/^0/, '') : v.toFixed(1))

export const signed = (n: number, d = 1) => `${n > 0 ? '+' : ''}${n.toFixed(d)}`

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${s}`
}

export const fmtDraftDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export const input = 'bg-black border border-zinc-800 px-1.5 py-0.5 text-zinc-200 outline-none focus:border-zinc-500'
export const textBtn = 'text-zinc-500 hover:text-zinc-200 disabled:text-zinc-800'
