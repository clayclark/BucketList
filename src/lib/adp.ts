import { nameMatcher } from './tiers'

type Named = { id: number; name: string }
type Match = ReturnType<typeof nameMatcher>

const YAHOO = import.meta.env.DEV ? '/yahoo' : 'https://pub-api-ro.fantasysports.yahoo.com'

/** Fantrax writes names as "Last, First". */
async function fantrax(match: Match) {
  const res = await fetch('https://www.fantrax.com/fxea/general/getAdp?sport=NBA&start=1&limit=1000&order=ADP')
  if (!res.ok) throw new Error(`Fantrax ADP ${res.status}`)
  const rows: { name: string; ADP: number }[] = await res.json()
  return rows.map((r) => [match(r.name.split(', ').reverse().join(' ')), r.ADP] as const)
}

// Yahoo splits each player into one-key objects (and the odd empty array).
type YahooPlayer = { player: [{ name?: { full: string } }[], { draft_analysis: { average_pick?: string }[] }] }
type YahooPage = { fantasy_content: { league: [unknown, { players: Record<string, YahooPlayer | number> }] } }

async function yahoo(match: Match) {
  const res = await fetch(`${YAHOO}/fantasy/v2/league/nba.l.public/players;start=0;count=300;sort=AR;out=draft_analysis?format=json`)
  if (!res.ok) throw new Error(`Yahoo ADP ${res.status}`)
  const page: YahooPage = await res.json()
  return Object.values(page.fantasy_content.league[1].players).flatMap((p) => {
    if (typeof p === 'number') return []
    const [info, { draft_analysis }] = p.player
    const name = info.find((b) => b.name)?.name?.full
    const pick = Number(draft_analysis.find((b) => b.average_pick)?.average_pick)
    return name && Number.isFinite(pick) ? [[match(name), pick] as const] : []
  })
}

/** Yahoo and Fantrax ADP, each keyed by ESPN player id. A source that fails to load is left out. */
export async function fetchMarketAdp(players: Named[]) {
  const match = nameMatcher(players)
  const results = await Promise.allSettled([fantrax(match), yahoo(match)])
  return results.flatMap((r) => {
    if (r.status === 'rejected') return []
    const adp = new Map<number, number>()
    for (const [id, pick] of r.value) if (id !== null && !adp.has(id)) adp.set(id, pick)
    return [adp]
  })
}

/** Hashtag Basketball's blend: the plain average of every source that lists the player. */
export const blendAdp = (picks: (number | null | undefined)[]) => {
  const known = picks.filter((p): p is number => p != null && p > 0)
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null
}
