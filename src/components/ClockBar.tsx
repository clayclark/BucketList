import { useEffect, useState } from 'react'
import { fmtDraftDate, ordinal, textBtn, untilText } from '../format'
import type { LiveDraft } from '../lib/live'
import { useModel } from '../model'
import { useDraft } from '../store'

const inExtensionPanel = () => typeof chrome !== 'undefined' && !!chrome.tabs && !location.search.includes('tab')

function Countdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])
  const s = Math.max(0, Math.round((endsAt - now) / 1000))
  return <span className="tabular-nums">{s}s</span>
}

function DraftCountdown({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])
  return (
    <>
      Draft {fmtDraftDate(at)}
      {at > now && <span className="text-zinc-300"> · in {untilText(at - now)}</span>}
      {' · '}
    </>
  )
}

export function ClockBar({
  syncError,
  synced,
  live,
  practice,
}: {
  syncError: string | null
  synced: boolean
  live: LiveDraft | null
  practice: boolean
}) {
  const { draft, allPlayers } = useModel()
  const { teamNames, mySlot, espn, undo, picks, draftDate } = useDraft()
  const n = teamNames.length
  const round = Math.ceil(draft.current / n)
  const myTurn = draft.onClock === mySlot
  const next = draft.mine[0]
  const away = next === undefined ? null : next - draft.current
  const last = picks.filter((p) => !p.keeper).sort((a, b) => b.overall - a.overall)[0]
  const started = !!last
  // Picks made before any draft room tab was open never reached us. Rare, but say so rather than guess.
  const lastFilled = last?.overall ?? 0
  const missing = draft.owners.slice(0, lastFilled).filter((_, i) => !draft.byPick.has(i + 1)).length
  const clock = live?.clock && !live.done ? live.clock : null

  return (
    <header className={`shrink-0 border-b px-3 py-1.5 ${myTurn ? 'border-amber-300 bg-amber-300 text-black' : 'border-zinc-900'}`}>
      <div className="flex items-baseline gap-2">
        {draft.onClock === null ? (
          <span className="text-sm font-semibold">Draft complete</span>
        ) : myTurn ? (
          <span className="text-sm font-bold">
            You're on the clock · #{draft.current}
            {clock && (
              <>
                {' · '}
                <Countdown endsAt={clock.endsAt} />
              </>
            )}
          </span>
        ) : (
          <>
            <span className="text-sm font-semibold text-zinc-100">#{draft.current}</span>
            {clock && (
              <span className="text-zinc-400">
                <Countdown endsAt={clock.endsAt} />
              </span>
            )}
            <span className="text-zinc-500">R{round}</span>
            <span className="truncate text-zinc-300">{teamNames[draft.onClock]}</span>
          </>
        )}
        <span className="ml-auto flex shrink-0 items-baseline gap-3">
          {!myTurn && away !== null && (
            <span className={away <= 2 ? 'text-amber-300' : 'text-zinc-400'}>
              <span className="text-sm font-semibold">{away}</span> to you <span className="text-zinc-600">#{next}</span>
            </span>
          )}
          {!espn.sync && (
            <button className={myTurn ? 'text-black/60 hover:text-black' : textBtn} onClick={undo} disabled={!picks.length}>
              Undo
            </button>
          )}
          {inExtensionPanel() && (
            <button
              className={myTurn ? 'text-black/60 hover:text-black' : textBtn}
              title="Open in a full tab"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('index.html?tab') })}
            >
              ⤢
            </button>
          )}
        </span>
      </div>
      <div className={`flex gap-2 truncate text-[11px] ${myTurn ? 'text-black/70' : 'text-zinc-500'}`}>
        {syncError ? (
          <span className="text-rose-400">ESPN: {syncError}</span>
        ) : missing > 0 ? (
          <span className={myTurn ? '' : 'text-rose-400'}>{missing} earlier picks unknown. Keep the draft room open from the start.</span>
        ) : started ? (
          <span className="truncate">
            Last #{last.overall} {teamNames[last.slot]}: <span className={myTurn ? '' : 'text-zinc-300'}>{allPlayers.get(last.playerId)?.name}</span>
          </span>
        ) : (
          <span>
            {draftDate ? <DraftCountdown at={draftDate} /> : null}You pick {ordinal(next ?? mySlot + 1)}
          </span>
        )}
        <span className="ml-auto shrink-0">
          {!espn.sync ? 'Manual' : live ? (practice ? 'Practice draft · live' : 'Draft room live') : synced ? 'ESPN' : 'ESPN…'}
        </span>
      </div>
    </header>
  )
}
