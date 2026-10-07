import { useState } from 'react'
import { rankStyle } from '../format'
import { CAT_LABEL, CATS, type Cat } from '../lib/cats'
import { expectedWins } from '../lib/value'
import { useModel } from '../model'
import { useDraft } from '../store'

const VIEWS = ['Standings', 'Board', 'Rosters'] as const

export function LeagueView() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('Standings')
  return (
    <div>
      <div className="flex gap-3 border-b border-zinc-900 px-3 py-1 text-[11px]">
        {VIEWS.map((v) => (
          <button key={v} onClick={() => setView(v)} className={v === view ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}>
            {v}
          </button>
        ))}
      </div>
      {view === 'Standings' && <Standings />}
      {view === 'Board' && <Board />}
      {view === 'Rosters' && <Rosters />}
    </div>
  )
}

function Standings() {
  const { teams, draft, cats } = useModel()
  const { teamAbbrevs, teamNames, mySlot } = useDraft()
  const { strengths } = teams
  const n = strengths.length
  const mine = strengths[mySlot]
  const rank = (i: number, c: Cat) => 1 + strengths.filter((s) => s[c] > strengths[i][c]).length
  const vsField = (i: number) =>
    strengths.reduce((sum, o, j) => (j === i ? sum : sum + expectedWins(strengths[i], o, CATS)), 0) / (n - 1 || 1)

  return (
    <div className="p-3">
      <table className="w-full table-fixed text-center">
        <thead className="text-[11px] text-zinc-500">
          <tr>
            <th className="w-14 text-left font-normal">Team</th>
            {CATS.map((c) => (
              <th key={c} className={`font-normal ${cats.includes(c) ? '' : 'line-through'}`}>
                {CAT_LABEL[c]}
              </th>
            ))}
            <th className="w-10 font-normal" title="Expected category wins vs an average opponent">
              Avg
            </th>
            <th className="w-14 font-normal" title="Your expected category record against this team">
              You
            </th>
          </tr>
        </thead>
        <tbody>
          {strengths.map((s, i) => {
            const me = i === mySlot
            const h2h = mine && !me ? expectedWins(mine, s, CATS) : null
            return (
              <tr key={i}>
                <td className={`truncate text-left ${me ? 'text-emerald-400' : 'text-zinc-300'}`} title={teamNames[i]}>
                  {draft.onClock === i ? <span className="text-amber-300">▸</span> : null}
                  {teamAbbrevs[i]}
                </td>
                {CATS.map((c) => {
                  const r = rank(i, c)
                  return (
                    <td key={c} className="py-0.5" style={rankStyle(r, n)}>
                      {r}
                    </td>
                  )
                })}
                <td className="text-zinc-400">{vsField(i).toFixed(1)}</td>
                <td className={h2h === null ? '' : h2h > 4.5 ? 'text-emerald-400' : 'text-rose-400'}>
                  {h2h === null ? '' : `${h2h.toFixed(1)}-${(9 - h2h).toFixed(1)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-zinc-600">Category ranks, 1 is best. Records are expected categories won per week.</p>
    </div>
  )
}

function Board() {
  const { allPlayers, draft } = useModel()
  const { teamAbbrevs, mySlot, set } = useDraft()
  const n = teamAbbrevs.length
  const rounds = Math.ceil(draft.owners.length / n)

  const cell = (overall: number) => {
    const owner = draft.owners[overall - 1]
    const pick = draft.byPick.get(overall)
    return { owner, pick, player: pick && allPlayers.get(pick.playerId), mine: owner === mySlot }
  }

  return (
    <>
      {/* Narrow: one pick per line. */}
      <div className="px-3 py-1 lg:hidden">
        {Array.from({ length: rounds }, (_, r) => (
          <div key={r} className="pb-2">
            <div className="border-b border-zinc-800 text-[11px] text-zinc-500">Round {r + 1}</div>
            {Array.from({ length: n }, (_, c) => {
              const overall = r * n + c + 1
              const { owner, pick, player, mine } = cell(overall)
              return (
                <button
                  key={overall}
                  onClick={() => pick && set({ selectedId: pick.playerId })}
                  className={`flex h-6 w-full items-center gap-2 text-left ${overall === draft.current ? 'bg-amber-300/15' : ''}`}
                >
                  <span className="w-7 text-zinc-600">{overall}</span>
                  <span className={`w-12 truncate ${mine ? 'text-emerald-400' : 'text-zinc-500'}`}>{teamAbbrevs[owner]}</span>
                  <span className={mine ? 'text-emerald-400' : 'text-zinc-200'}>{player?.name}</span>
                  {pick?.keeper && <span className="text-zinc-600">K</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {/* Wide: the classic grid. Columns are picks within the round so trades and reversals read correctly. */}
      <table className="m-3 hidden w-[calc(100%-1.5rem)] table-fixed lg:table">
        <tbody>
          {Array.from({ length: rounds }, (_, r) => (
            <tr key={r}>
              <td className="w-6 text-zinc-600">{r + 1}</td>
              {Array.from({ length: n }, (_, c) => {
                const overall = r * n + c + 1
                const { owner, pick, player, mine } = cell(overall)
                return (
                  <td
                    key={c}
                    onClick={() => pick && set({ selectedId: pick.playerId })}
                    className={`h-9 truncate border px-1 align-top leading-tight ${
                      overall === draft.current ? 'border-amber-300' : 'border-zinc-900'
                    } ${mine ? 'bg-zinc-950' : ''}`}
                  >
                    <div className={`truncate text-[10px] ${mine ? 'text-emerald-600' : 'text-zinc-600'}`}>
                      {overall} {teamAbbrevs[owner]}
                      {pick?.keeper && ' K'}
                    </div>
                    {player && <div className={`truncate ${mine ? 'text-emerald-400' : 'text-zinc-200'}`}>{player.name}</div>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Rosters() {
  const { teams } = useModel()
  const { teamNames, mySlot, set } = useDraft()
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-4 gap-y-3 p-3">
      {teams.rosters.map((roster, i) => (
        <div key={i}>
          <div className={`truncate border-b border-zinc-800 ${i === mySlot ? 'text-emerald-400' : 'text-zinc-200'}`}>{teamNames[i]}</div>
          {roster.map((v) => (
            <button key={v.player.id} className="flex w-full gap-1.5 text-left hover:bg-zinc-950" onClick={() => set({ selectedId: v.player.id })}>
              <span className="truncate">{v.player.name}</span>
              <span className="ml-auto text-zinc-500">{v.value.toFixed(1)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
