import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Cat } from './lib/cats'
import { openPicks, snakeOwners } from './lib/draft'
import type { BasisKey, League } from './lib/espn'
import { DEFAULT_SHEET, type Section, type TierEntry } from './lib/tiers'

export type Pick = { playerId: number; slot: number; overall: number; keeper?: boolean }

export const ownersOf = (s: { pickOwners: number[] | null; teamCount: number; rosterSize: number }) =>
  s.pickOwners ?? snakeOwners(s.teamCount, s.rosterSize)

const defaultNames = (n: number) => Array.from({ length: n }, (_, i) => `Team ${i + 1}`)

type State = {
  teamCount: number
  rosterSize: number
  mySlot: number
  teamNames: string[]
  teamAbbrevs: string[]
  draftDate: number | null
  starters: string[]
  punts: Cat[]
  basis: BasisKey
  totals: boolean
  showTaken: boolean
  sheetUrl: string
  espn: { leagueId: string; sync: boolean }
  /** Slot owning each overall pick, from ESPN. Null means a plain snake. */
  pickOwners: number[] | null
  picks: Pick[]
  sections: Section[]
  selectedId: number | null
}

type Actions = {
  set: (patch: Partial<State>) => void
  setTeamCount: (n: number) => void
  togglePunt: (c: Cat) => void
  draft: (playerId: number, slot?: number) => void
  undo: () => void
  removePick: (playerId: number) => void
  applyLeague: (league: League, swid: string | null) => void
  setSections: (sections: Section[]) => void
  moveEntry: (entryId: string, toSection: string, beforeEntry: string | null) => void
  moveSection: (id: string, beforeId: string | null) => void
  addEntry: (sectionId: string, entry: Omit<TierEntry, 'id'>) => void
  updateEntry: (entryId: string, patch: Partial<Omit<TierEntry, 'id'>>) => void
  removeEntry: (entryId: string) => void
  addSection: () => void
  renameSection: (id: string, name: string) => void
  removeSection: (id: string) => void
}

type Persisted = Omit<State, 'selectedId'>

export const useDraft = create<State & Actions>()(
  persist<State & Actions, [], [], Persisted>(
    (set, get) => ({
      teamCount: 10,
      rosterSize: 13,
      mySlot: 0,
      teamNames: defaultNames(10),
      teamAbbrevs: defaultNames(10).map((_, i) => `T${i + 1}`),
      draftDate: null,
      starters: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'],
      punts: [],
      basis: 'proj',
      totals: false,
      showTaken: false,
      sheetUrl: DEFAULT_SHEET,
      espn: { leagueId: '54896', sync: true },
      pickOwners: null,
      picks: [],
      sections: [],
      selectedId: null,

      set: (patch) => set(patch),

      setTeamCount: (n) =>
        set((s) => ({
          teamCount: n,
          mySlot: Math.min(s.mySlot, n - 1),
          teamNames: Array.from({ length: n }, (_, i) => s.teamNames[i] ?? `Team ${i + 1}`),
          teamAbbrevs: Array.from({ length: n }, (_, i) => s.teamAbbrevs[i] ?? `T${i + 1}`),
        })),

      togglePunt: (c) => set((s) => ({ punts: s.punts.includes(c) ? s.punts.filter((p) => p !== c) : [...s.punts, c] })),

      draft: (playerId, slot) => {
        const s = get()
        if (s.picks.some((p) => p.playerId === playerId)) return
        const owners = ownersOf(s)
        const open = openPicks(owners, new Set(s.picks.map((p) => p.overall)))
        // A specific team means "they took him": use that team's next open pick.
        const overall = slot === undefined ? open[0] : open.find((o) => owners[o - 1] === slot)
        if (overall === undefined) return
        set({ picks: [...s.picks, { playerId, slot: owners[overall - 1], overall }] })
      },

      undo: () => set((s) => ({ picks: s.picks.slice(0, -1) })),

      removePick: (playerId) => set((s) => ({ picks: s.picks.filter((p) => p.playerId !== playerId) })),

      applyLeague: (league, swid) => {
        const order = league.pickOrder
        const byId = new Map(league.teams.map((t) => [t.id, t]))
        const mine = swid ? order.findIndex((id) => byId.get(id)?.owners.includes(swid)) : -1
        set((s) => ({
          teamCount: order.length || s.teamCount,
          rosterSize: league.rosterSize || s.rosterSize,
          teamNames: order.map((id) => byId.get(id)?.name ?? `Team ${id}`),
          teamAbbrevs: order.map((id) => byId.get(id)?.abbrev ?? `T${id}`),
          draftDate: league.draftDate,
          starters: league.starters,
          mySlot: mine >= 0 ? mine : s.mySlot,
          pickOwners: league.owners.length ? league.owners.map((id) => Math.max(0, order.indexOf(id))) : null,
          picks: league.made.map((p) => ({
            playerId: p.playerId,
            slot: Math.max(0, order.indexOf(p.teamId)),
            overall: p.overall,
            keeper: p.keeper,
          })),
        }))
      },

      setSections: (sections) => set({ sections }),

      moveEntry: (entryId, toSection, beforeEntry) =>
        set((s) => {
          const entry = s.sections.flatMap((x) => x.entries).find((e) => e.id === entryId)
          if (!entry || entryId === beforeEntry) return s
          const without = s.sections.map((x) => ({ ...x, entries: x.entries.filter((e) => e.id !== entryId) }))
          return {
            sections: without.map((x) => {
              if (x.id !== toSection) return x
              const at = beforeEntry ? x.entries.findIndex((e) => e.id === beforeEntry) : -1
              const entries = [...x.entries]
              entries.splice(at < 0 ? entries.length : at, 0, entry)
              return { ...x, entries }
            }),
          }
        }),

      moveSection: (id, beforeId) =>
        set((s) => {
          const section = s.sections.find((x) => x.id === id)
          if (!section || id === beforeId) return s
          const rest = s.sections.filter((x) => x.id !== id)
          const at = beforeId ? rest.findIndex((x) => x.id === beforeId) : -1
          rest.splice(at < 0 ? rest.length : at, 0, section)
          return { sections: rest }
        }),

      addEntry: (sectionId, entry) =>
        set((s) => ({
          sections: s.sections.map((x) =>
            x.id === sectionId ? { ...x, entries: [...x.entries, { ...entry, id: crypto.randomUUID() }] } : x,
          ),
        })),

      updateEntry: (entryId, patch) =>
        set((s) => ({
          sections: s.sections.map((x) => ({
            ...x,
            entries: x.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
          })),
        })),

      removeEntry: (entryId) =>
        set((s) => ({
          sections: s.sections.map((x) => ({ ...x, entries: x.entries.filter((e) => e.id !== entryId) })),
        })),

      addSection: () =>
        set((s) => ({
          sections: [...s.sections, { id: crypto.randomUUID(), name: `Bucket ${s.sections.length + 1}`, note: null, entries: [] }],
        })),

      renameSection: (id, name) =>
        set((s) => ({ sections: s.sections.map((x) => (x.id === id ? { ...x, name } : x)) })),

      removeSection: (id) => set((s) => ({ sections: s.sections.filter((x) => x.id !== id) })),
    }),
    {
      name: 'fhd-draft',
      version: 1,
      // v0 kept ESPN cookies in settings. The extension uses the browser login instead, so drop them.
      migrate: (persisted) => {
        const s = persisted as Persisted
        return { ...s, espn: { leagueId: s.espn.leagueId, sync: s.espn.sync } }
      },
      partialize: ({ selectedId: _, ...rest }) => rest,
    },
  ),
)
