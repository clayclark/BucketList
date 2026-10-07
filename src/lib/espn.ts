import type { StatLine } from './cats'

// ESPN's season id is the year the season ends; the 2026-27 season is 2027.
export const SEASON = (() => {
  const now = new Date()
  return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear()
})()

const HOST = import.meta.env.DEV ? '/espn' : 'https://lm-api-reads.fantasy.espn.com'
const BASE = `${HOST}/apis/v3/games/fba/seasons/${SEASON}`

export type Basis = { gp: number; min: number; stats: StatLine }

export type Player = {
  id: number
  name: string
  team: string
  pos: string
  injury: string | null
  /** Fantrax ADP, merged in by the model. */
  adp: number | null
  rank: number
  proj: Basis | null
  last: Basis | null
}

export type BasisKey = 'proj' | 'last'

const PRO_TEAMS: Record<number, string> = {
  0: 'FA', 1: 'ATL', 2: 'BOS', 3: 'NO', 4: 'CHI', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GS', 10: 'HOU',
  11: 'IND', 12: 'LAC', 13: 'LAL', 14: 'MIA', 15: 'MIL', 16: 'MIN', 17: 'BKN', 18: 'NY', 19: 'ORL', 20: 'PHI',
  21: 'PHX', 22: 'POR', 23: 'SAC', 24: 'SA', 25: 'OKC', 26: 'UTAH', 27: 'WSH', 28: 'TOR', 29: 'MEM', 30: 'CHA',
}

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const

type EspnStatEntry = { id: string; averageStats?: Record<string, number> }

type EspnPlayer = {
  id: number
  fullName: string
  proTeamId: number
  eligibleSlots: number[]
  injuryStatus?: string
  draftRanksByRankType?: { STANDARD?: { rank: number } }
  stats?: EspnStatEntry[]
}

const toBasis = (entry: EspnStatEntry | undefined): Basis | null => {
  const s = entry?.averageStats
  if (!s || !s['42']) return null
  return {
    gp: s['42'],
    min: s['40'] ?? 0,
    stats: {
      pts: s['0'] ?? 0,
      blk: s['1'] ?? 0,
      stl: s['2'] ?? 0,
      ast: s['3'] ?? 0,
      reb: s['6'] ?? 0,
      to: s['11'] ?? 0,
      fgm: s['13'] ?? 0,
      fga: s['14'] ?? 0,
      ftm: s['15'] ?? 0,
      fta: s['16'] ?? 0,
      tpm: s['17'] ?? 0,
    },
  }
}

export async function fetchPlayers(): Promise<Omit<Player, 'adp'>[]> {
  const filter = {
    players: {
      limit: 1200,
      filterStatsForExternalIds: { value: [SEASON - 1, SEASON] },
      filterStatsForSourceIds: { value: [0, 1] },
      sortDraftRanks: { sortPriority: 100, sortAsc: true, value: 'STANDARD' },
    },
  }
  const res = await fetch(`${BASE}/segments/0/leaguedefaults/3?view=kona_player_info`, {
    headers: { 'X-Fantasy-Filter': JSON.stringify(filter) },
  })
  if (!res.ok) throw new Error(`ESPN players ${res.status}`)
  const data: { players: { player: EspnPlayer }[] } = await res.json()

  return data.players.map(({ player: p }) => ({
    id: p.id,
    name: p.fullName,
    team: PRO_TEAMS[p.proTeamId] ?? '?',
    pos: POSITIONS.filter((_, i) => p.eligibleSlots.includes(i)).join('/'),
    injury: p.injuryStatus && p.injuryStatus !== 'ACTIVE' ? p.injuryStatus : null,
    rank: p.draftRanksByRankType?.STANDARD?.rank ?? 999,
    proj: toBasis(p.stats?.find((s) => s.id === `10${SEASON}`)),
    last: toBasis(p.stats?.find((s) => s.id === `00${SEASON - 1}`)),
  }))
}

export type League = {
  teams: { id: number; name: string; abbrev: string; owners: string[] }[]
  pickOrder: number[]
  rosterSize: number
  draftDate: number | null
  /** Team id owning each overall pick (index = overall - 1), including trades and third-round reversal. */
  owners: number[]
  made: { overall: number; teamId: number; playerId: number; keeper: boolean }[]
}

export type EspnLeague = {
  teams?: {
    id: number
    name?: string
    abbrev?: string
    location?: string
    nickname?: string
    owners?: string[]
    roster?: { entries?: { playerId: number; playerPoolEntry?: { keeperValue?: number } }[] }
  }[]
  settings?: {
    draftSettings?: { pickOrder?: number[]; date?: number }
    rosterSettings?: { lineupSlotCounts?: Record<string, number> }
  }
  draftDetail?: {
    picks?: {
      overallPickNumber: number
      roundId: number
      teamId: number
      playerId: number
      keeper?: boolean
      reservedForKeeper?: boolean
    }[]
  }
}

const IR_SLOT = '13'

export function parseLeague(data: EspnLeague): League {
  const teams = (data.teams ?? []).map((t) => {
    const name = (t.name ?? `${t.location ?? ''} ${t.nickname ?? ''}`).trim() || `Team ${t.id}`
    return { id: t.id, name, abbrev: t.abbrev?.trim() || name.slice(0, 4), owners: t.owners ?? [] }
  })
  const slotCounts = data.settings?.rosterSettings?.lineupSlotCounts ?? {}
  const pickOrder = data.settings?.draftSettings?.pickOrder ?? []
  const picks = [...(data.draftDetail?.picks ?? [])].sort((a, b) => a.overallPickNumber - b.overallPickNumber)

  const made = picks
    .filter((p) => p.playerId > 0)
    .map((p) => ({ overall: p.overallPickNumber, teamId: p.teamId, playerId: p.playerId, keeper: !!p.keeper }))

  // Before the draft starts, keepers only show up on rosters. Place each on its team's reserved keeper pick.
  const takenPlayers = new Set(made.map((m) => m.playerId))
  const usedPicks = new Set(made.map((m) => m.overall))
  for (const team of data.teams ?? []) {
    for (const entry of team.roster?.entries ?? []) {
      if (takenPlayers.has(entry.playerId)) continue
      const reserved = picks.filter((p) => p.reservedForKeeper && p.teamId === team.id && !usedPicks.has(p.overallPickNumber))
      // keeperValue is usually the keeper round, but pick trades can move the reserved pick to another round.
      const spot = reserved.find((p) => p.roundId === entry.playerPoolEntry?.keeperValue) ?? reserved[0]
      if (!spot) continue
      usedPicks.add(spot.overallPickNumber)
      made.push({ overall: spot.overallPickNumber, teamId: team.id, playerId: entry.playerId, keeper: true })
    }
  }

  return {
    teams,
    pickOrder: pickOrder.length ? pickOrder : teams.map((t) => t.id),
    rosterSize: Object.entries(slotCounts).reduce((n, [slot, c]) => (slot === IR_SLOT ? n : n + c), 0),
    draftDate: data.settings?.draftSettings?.date ?? null,
    owners: picks.map((p) => p.teamId),
    made: made.sort((a, b) => a.overall - b.overall),
  }
}

export async function fetchLeague(leagueId: string): Promise<League> {
  const res = await fetch(
    `${BASE}/segments/0/leagues/${leagueId}?view=mDraftDetail&view=mSettings&view=mTeam&view=mRoster`,
    { credentials: 'include' },
  )
  if (!res.ok) throw new Error(res.status === 401 ? 'Log in to espn.com in this browser' : `ESPN league ${res.status}`)
  return parseLeague(await res.json())
}

/** Your ESPN user id, read from the espn.com login cookie. Only available inside the extension. */
export async function espnSwid(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.cookies) return null
  const cookie = await chrome.cookies.get({ url: 'https://www.espn.com', name: 'SWID' })
  return cookie?.value ?? null
}
