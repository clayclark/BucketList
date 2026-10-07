import { useQuery } from '@tanstack/react-query'
import { createContext, use, useCallback, useMemo, type ReactNode } from 'react'
import { CATS, type Cat, type CatLine } from './lib/cats'
import { availability, openPicks } from './lib/draft'
import { fetchPlayers, type Player } from './lib/espn'
import { fetchFantraxAdp } from './lib/fantrax'
import { openSlots } from './lib/slots'
import { tagApplies, type Section, type TierEntry } from './lib/tiers'
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
  const { teamCount, rosterSize, mySlot, punts, basis, totals, picks, sections, pickOwners, starters } = useDraft()

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
    return { rosters, strengths, available, fit, replacement }
  }, [valued, byId, picks, teamCount, rosterSize, mySlot, poolSize, punts, draft])

  // My category ranks now, and what they'd be with a given player added.
  const ranks = useMemo(() => {
    const others = teams.strengths.filter((_, i) => i !== mySlot)
    const rankOf = (team: CatLine) =>
      Object.fromEntries(CATS.map((c) => [c, 1 + others.filter((o) => o[c] > team[c]).length])) as Record<Cat, number>
    const mineZ = (teams.rosters[mySlot] ?? []).map((v) => v.z)
    const now = teams.strengths[mySlot] ? rankOf(teams.strengths[mySlot]) : null
    const withPlayer = (id: number) => {
      const v = byId.get(id)
      return v ? rankOf(teamStrength([...mineZ, v.z], rosterSize, teams.replacement)) : null
    }
    return { now, withPlayer, teams: teams.strengths.length }
  }, [teams, mySlot, byId, rosterSize])

  // Starting slots my roster can't fill yet. Once my remaining picks only just cover them, a player who
  // fills none of them costs a starter.
  const slots = useMemo(() => {
    const roster = (teams.rosters[mySlot] ?? []).map((v) => v.player.pos.split('/'))
    const open = openSlots(starters, roster)
    const tight = open.length > 0 && draft.mine.length <= open.length
    const fills = (pos: string) => openSlots(starters, [...roster, pos.split('/')]).length < open.length
    return { open, tight, fills }
  }, [teams.rosters, mySlot, starters, draft.mine.length])

  const tiersByPlayer = useMemo(() => {
    const out = new Map<number, TierRef[]>()
    for (const section of sections)
      for (const entry of section.entries)
        if (entry.playerId !== null) out.set(entry.playerId, [...(out.get(entry.playerId) ?? []), { section, entry }])
    return out
  }, [sections])

  // Sheet entries tagged for a punt you aren't running (or "No Punt" when you are) don't count.
  const entryApplies = useCallback(
    (e: TierEntry) =>
      e.playerId === null ||
      tagApplies(
        e.tag,
        punts,
        (tiersByPlayer.get(e.playerId) ?? []).filter((r) => r.entry.id !== e.id).map((r) => r.entry.tag),
      ),
    [punts, tiersByPlayer],
  )

  // Best three available fits among tiered players, highlighted on the board.
  const topFit = useMemo(() => {
    const tiered = teams.available.filter((v) => tiersByPlayer.has(v.player.id) && teams.fit.has(v.player.id))
    return new Set(
      tiered
        .sort((a, b) => (teams.fit.get(b.player.id) ?? 0) - (teams.fit.get(a.player.id) ?? 0))
        .slice(0, 3)
        .map((v) => v.player.id),
    )
  }, [teams, tiersByPlayer])

  const availAtTarget = useCallback(
    (id: number) => {
      const p = allPlayers.get(id)
      if (!p || draft.drafted.has(id) || draft.target === null) return null
      return p.adp === null ? 1 : availability(p.adp, draft.current, draft.target)
    },
    [allPlayers, draft],
  )

  return { players, adpError: adp.error, allPlayers, valued, byId, draft, teams, ranks, slots, topFit, tiersByPlayer, entryApplies, availAtTarget, cats: activeCats(punts) }
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
