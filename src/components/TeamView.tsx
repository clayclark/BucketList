import { fmtCat, ordinal, rankStyle, textBtn } from '../format'
import { CAT_LABEL, CATS } from '../lib/cats'
import { puntAdvice } from '../lib/punt'
import { assignSlots } from '../lib/slots'
import { expectedWins, teamTotals, type Valued } from '../lib/value'
import { useModel } from '../model'
import { useDraft } from '../store'

export function TeamView() {
  const { teams, draft, slots, ranks } = useModel()
  const { mySlot, teamNames, punts, togglePunt, set, totals, starters } = useDraft()
  const roster = teams.rosters[mySlot] ?? []
  const mine = teams.strengths[mySlot]
  const myRanks = ranks.now
  if (!mine || !myRanks) return null

  const n = ranks.teams
  const others = teams.strengths.filter((_, i) => i !== mySlot)
  const record = others.length ? others.reduce((w, o) => w + expectedWins(mine, o, CATS, teams.winScale), 0) / others.length : 0
  const raw = teamTotals(roster.map((v) => v.line))
  const advice = puntAdvice({
    mine,
    opponents: others,
    topAvailable: teams.available.slice(0, 20).map((v) => v.z),
    punts,
    rosterCount: roster.length,
    scale: teams.winScale,
  })
  const holder = assignSlots(starters, roster.map((v) => v.player.pos.split('/')))
  const flex = roster.filter((_, i) => !holder.includes(i))

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-baseline gap-3">
        <span className="text-base font-semibold text-white">{teamNames[mySlot]}</span>
        <span className="text-zinc-400" title="Expected category record in an average weekly matchup">
          {record.toFixed(1)}-{(9 - record).toFixed(1)} per week
        </span>
      </div>

      <div className="border-l-2 border-amber-300 pl-2">
        {advice[0] ? (
          <div className="flex items-baseline gap-3">
            <span className="text-zinc-300">
              Punt <span className="font-semibold text-amber-300">{CAT_LABEL[advice[0].cat]}</span>? You win it{' '}
              {Math.round(advice[0].winRate * 100)}% of weeks and the best players left hurt it.
              {advice[1] && (
                <span className="text-zinc-500">
                  {' '}
                  Also: {CAT_LABEL[advice[1].cat]} ({Math.round(advice[1].winRate * 100)}%)
                </span>
              )}
            </span>
            <button className="ml-auto shrink-0 font-semibold text-amber-300 hover:text-amber-200" onClick={() => togglePunt(advice[0].cat)}>
              Punt {CAT_LABEL[advice[0].cat]}
            </button>
          </div>
        ) : (
          <span className="text-zinc-500">
            {roster.length < 2 ? 'Punt advice starts after your first two picks.' : punts.length >= 2 ? 'Two punts is the most worth running.' : 'No clear punt yet. Stay balanced.'}
          </span>
        )}
      </div>

      <table className="w-full">
        <thead className="text-[11px] text-zinc-500">
          <tr className="text-left">
            <th className="w-12 font-normal">Cat</th>
            <th className="font-normal">Rank of {n}</th>
            <th className="w-16 text-right font-normal">{totals ? 'Season' : 'Per game'}</th>
            <th className="w-12 text-right font-normal" />
          </tr>
        </thead>
        <tbody>
          {CATS.map((c) => {
            const punted = punts.includes(c)
            const r = myRanks[c]
            return (
              <tr key={c} className={punted ? 'text-zinc-600' : ''}>
                <td className={punted ? 'line-through' : 'text-zinc-200'}>{CAT_LABEL[c]}</td>
                <td className="py-0.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 bg-zinc-900">
                      <div className="h-full" style={{ width: `${((n - r + 1) / n) * 100}%`, ...rankStyle(r, n) }} />
                    </div>
                    <span className="w-8 text-right">{ordinal(r)}</span>
                  </div>
                </td>
                <td className="text-right text-zinc-400">{roster.length ? fmtCat(c, raw[c]) : '-'}</td>
                <td className="text-right">
                  <button className={punted ? 'text-rose-400' : textBtn} onClick={() => togglePunt(c)}>
                    {punted ? 'Punted' : 'Punt'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div>
        <div className="flex border-b border-zinc-800 pb-0.5 text-[11px] text-zinc-500">
          <span>Lineup</span>
          <span className={`ml-auto ${slots.tight ? 'text-rose-400' : ''}`}>
            {slots.open.length ? `Open: ${slots.open.join(' · ')}` : 'Starters filled'}
          </span>
        </div>
        {starters.map((slot, i) => {
          const at = holder[i]
          const v = at === undefined ? undefined : roster[at]
          return <LineupRow key={i} slot={slot} v={v} pick={v && draft.drafted.get(v.player.id)} onSelect={(id) => set({ selectedId: id })} />
        })}
        {flex.map((v) => (
          <LineupRow key={v.player.id} slot="UTIL" v={v} pick={draft.drafted.get(v.player.id)} onSelect={(id) => set({ selectedId: id })} />
        ))}
        {draft.mine.length > 0 && (
          <div className="mt-2 text-zinc-600">
            Your picks: <span className="text-zinc-400">{draft.mine.join(' · ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function LineupRow({
  slot,
  v,
  pick,
  onSelect,
}: {
  slot: string
  v: Valued | undefined
  pick: { pick: number; keeper: boolean } | undefined
  onSelect: (id: number) => void
}) {
  if (!v)
    return (
      <div className="flex h-6 items-center gap-2">
        <span className="w-10 text-zinc-500">{slot}</span>
        <span className="text-rose-400">Empty</span>
      </div>
    )
  return (
    <button className="flex h-6 w-full items-center gap-2 text-left hover:bg-zinc-950" onClick={() => onSelect(v.player.id)}>
      <span className="w-10 text-zinc-500">{slot}</span>
      <span className="text-emerald-400">{v.player.name}</span>
      <span className="text-zinc-500">{v.player.pos}</span>
      <span className="ml-auto text-zinc-600">{pick?.keeper ? 'K' : pick ? `#${pick.pick}` : ''}</span>
      <span className="w-8 text-right text-zinc-300">{v.value.toFixed(1)}</span>
    </button>
  )
}
