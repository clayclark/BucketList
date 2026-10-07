import { useQuery } from '@tanstack/react-query'
import { createContext, use, useCallback, useMemo, type ReactNode } from 'react'
import type { CatLine } from './lib/cats'
import { availability, openPicks } from './lib/draft'
import { fetchPlayers, type Player } from './lib/espn'
import { fetchFantraxAdp } from './lib/fantrax'
import type { Section, TierEntry } from './lib/tiers'
import { activeCats, fitScores, replacementLevel, teamStrength, valuePlayers, type Valued } from './lib/value'
import { ownersOf, useDraft } from './store'

export type TierRef = { section: Section; entry: TierEntry }

const FIT_CANDIDATES = 250

function useBuildModel() {
  const espn = useQuery({ queryKey: ['players'], queryFn: fetchPlayers, staleTime: 60 * 60 * 1000 })
  const adp = useQuery({
    queryKey: ['fantrax-adp'],
    queryFn: () => fetchFantraxAdp(espn.data ?? []),
    enabled: !!espn.data,
    staleTime: 60 * 60 * 1000,
  })
  const data = useMemo(
    (): Player[] | undefined => espn.data?.map((p) => ({ ...p, adp: adp.data?.get(p.id) ?? null })),
    [espn.data, adp.data],
  )
  const players = { ...espn, data }
  const { teamCount, rosterSize, mySlot, punts, basis, totals, picks, sections, pickOwners } = useDraft()

  const poolSize = teamCount * rosterSize
  const valued = useMemo(
    () => valuePlayers(players.data ?? [], { basis, totals, punts, poolSize }),
    [players.data, basis, totals, punts, poolSize],
  )
  const byId = useMemo(() => new Map(valued.map((v) => [v.player.id, v])), [valued])
  const allPlayers = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data])

  const draft = useMemo(() => {
    const drafted = new Map(picks.map((p) => [p.playerId, { slot: p.slot, pick: p.overall, keeper: !!p.keeper }]))
    const byPick = new Map(picks.map((p) => [p.overall, p]))
    const owners = ownersOf({ pickOwners, teamCount, rosterSize })
    const open = openPicks(owners, new Set(byPick.keys()))
    const current = open[0] ?? owners.length + 1
    const onClock = open.length ? owners[current - 1] : null
    const mine = open.filter((o) => owners[o - 1] === mySlot)
    // When I'm on the clock, the useful question is whether a player lasts to my *following* pick.
    const target = onClock === mySlot ? mine[1] : mine[0]
    return { drafted, byPick, owners, current, onClock, mine, target: target ?? null }
  }, [picks, pickOwners, teamCount, rosterSize, mySlot])

  const teams = useMemo(() => {
    const replacement = replacementLevel(valued, poolSize)
    const rosters: Valued[][] = Array.from({ length: teamCount }, () => [])
    for (const p of picks) {
      const v = byId.get(p.playerId)
      if (v && rosters[p.slot]) rosters[p.slot].push(v)
    }
    const strengths: CatLine[] = rosters.map((r) => teamStrength(r.map((v) => v.z), rosterSize, replacement))
    const available = valued.filter((v) => !draft.drafted.has(v.player.id))
    const fit = fitScores(
      available.slice(0, FIT_CANDIDATES),
      (rosters[mySlot] ?? []).map((v) => v.z),
      strengths.filter((_, i) => i !== mySlot),
      rosterSize,
      replacement,
      activeCats(punts),
    )
    return { rosters, strengths, available, fit }
  }, [valued, byId, picks, teamCount, rosterSize, mySlot, poolSize, punts, draft])

  const tiersByPlayer = useMemo(() => {
    const out = new Map<number, TierRef[]>()
    for (const section of sections)
      for (const entry of section.entries)
        if (entry.playerId !== null) out.set(entry.playerId, [...(out.get(entry.playerId) ?? []), { section, entry }])
    return out
  }, [sections])

  const availAtTarget = useCallback(
    (id: number) => {
      const p = allPlayers.get(id)
      if (!p || draft.drafted.has(id) || draft.target === null) return null
      return p.adp === null ? 1 : availability(p.adp, draft.current, draft.target)
    },
    [allPlayers, draft],
  )

  return { players, adpError: adp.error, allPlayers, valued, byId, draft, teams, tiersByPlayer, availAtTarget, cats: activeCats(punts) }
}

export type Model = ReturnType<typeof useBuildModel>

const ModelContext = createContext<Model | null>(null)

export function ModelProvider({ children }: { children: ReactNode }) {
  return <ModelContext value={useBuildModel()}>{children}</ModelContext>
}

export const useModel = () => {
  const m = use(ModelContext)
  if (!m) throw new Error('useModel outside ModelProvider')
  return m
}
