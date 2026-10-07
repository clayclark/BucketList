import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { AccessBanner } from './components/AccessBanner'
import { ClockBar } from './components/ClockBar'
import { LeagueView } from './components/LeagueView'
import { PlayerDetail } from './components/PlayerDetail'
import { PlayersTable } from './components/PlayersTable'
import { RecentPicks } from './components/RecentPicks'
import { Search } from './components/Search'
import { Setup } from './components/Setup'
import { TeamView } from './components/TeamView'
import { Targets } from './components/Targets'
import { espnSwid, fetchLeague } from './lib/espn'
import { livePicks, mergeLivePicks, type LiveDraft } from './lib/live'
import { importSheet } from './lib/importSheet'
import { useModel } from './model'
import { useDraft } from './store'

const TABS = { Targets, Players: PlayersTable, Team: TeamView, League: LeagueView, Setup } as const
export type Tab = keyof typeof TABS

const LIVE_FRESH_MS = 90_000

/**
 * The draft room's live picks, saved by the extension's content script. Used while a draft room tab is
 * open and the draft isn't over; a finished practice draft's league is deleted, so fall back to yours.
 */
function useLiveDraft() {
  const [live, setLive] = useState<LiveDraft | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return
    const load = () => chrome.storage.local.get('liveDraft').then((s) => setLive((s.liveDraft as LiveDraft | undefined) ?? null))
    load()
    chrome.storage.onChanged.addListener(load)
    const tick = setInterval(() => setNow(Date.now()), 10_000)
    return () => {
      chrome.storage.onChanged.removeListener(load)
      clearInterval(tick)
    }
  }, [])
  return live && !live.done && now - live.seen < LIVE_FRESH_MS ? live : null
}

function useLeagueSync(live: LiveDraft | null) {
  const espn = useDraft((s) => s.espn)
  const applyLeague = useDraft((s) => s.applyLeague)
  // An open draft room wins, so a practice draft (its own temporary league) works like the real one.
  const leagueId = live?.leagueId ?? espn.leagueId
  const swid = useQuery({ queryKey: ['swid'], queryFn: espnSwid, staleTime: Infinity })
  const league = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => fetchLeague(leagueId),
    enabled: espn.sync && !!leagueId,
    refetchInterval: 5000,
    retry: 1,
  })
  const picks = useMemo(() => (live ? livePicks(live) : null), [live])
  useEffect(() => {
    if (league.data) applyLeague(picks ? mergeLivePicks(league.data, picks) : league.data, swid.data ?? null)
  }, [league.data, picks, swid.data, applyLeague])
  return { league, practice: !!live && live.leagueId !== espn.leagueId }
}

function useFirstImport() {
  const { players } = useModel()
  const { sections, sheetUrl, setSections } = useDraft()
  const empty = sections.length === 0
  useEffect(() => {
    if (empty && players.data) importSheet(sheetUrl, players.data).then(setSections, console.error)
  }, [empty, players.data, sheetUrl, setSections])
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useDraft.getState().set({ selectedId: null })
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '/') {
        e.preventDefault()
        document.getElementById('player-search')?.focus()
      }
      const { espn, undo } = useDraft.getState()
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !espn.sync) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Targets')
  const live = useLiveDraft()
  const { league, practice } = useLeagueSync(live)
  const selectedId = useDraft((s) => s.selectedId)
  useFirstImport()
  useShortcuts()
  const View = TABS[tab]

  return (
    <div className="flex h-full flex-col">
      <AccessBanner />
      <ClockBar syncError={league.error?.message ?? null} synced={league.isSuccess} live={live} practice={practice} />
      <nav className="flex h-8 shrink-0 items-center gap-3 border-b border-zinc-900 px-3">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-full border-b ${t === tab ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            {t}
          </button>
        ))}
        <Search />
      </nav>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto">
          <View />
        </main>
        {/* Wide (full tab): detail docks on the right. Narrow (side panel): it's a bottom sheet. */}
        <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-zinc-900 lg:block">
          {selectedId !== null ? <PlayerDetail /> : <div className="p-3 text-zinc-600">Select a player</div>}
          <RecentPicks />
        </aside>
      </div>
      {selectedId !== null && (
        <div className="max-h-[55%] shrink-0 overflow-y-auto border-t border-zinc-700 bg-black lg:hidden">
          <PlayerDetail closable />
        </div>
      )}
    </div>
  )
}
