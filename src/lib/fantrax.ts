import { nameMatcher } from './tiers'

type FantraxAdp = { name: string; ADP: number }

/** Fantrax's public ADP list, keyed by ESPN player id. Fantrax writes names as "Last, First". */
export async function fetchFantraxAdp(players: { id: number; name: string }[]) {
  const res = await fetch('https://www.fantrax.com/fxea/general/getAdp?sport=NBA&start=1&limit=1000&order=ADP')
  if (!res.ok) throw new Error(`Fantrax ADP ${res.status}`)
  const rows: FantraxAdp[] = await res.json()
  const match = nameMatcher(players)
  const adp = new Map<number, number>()
  for (const row of rows) {
    const id = match(row.name.split(', ').reverse().join(' '))
    if (id !== null && !adp.has(id)) adp.set(id, row.ADP)
  }
  return adp
}
