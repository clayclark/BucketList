import { fmtCat, ordinal, rankStyle, textBtn } from '../format'
import { CAT_LABEL, CATS, type Cat } from '../lib/cats'
import { expectedWins, teamTotals } from '../lib/value'
import { useModel } from '../model'
import { useDraft } from '../store'

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']

export function TeamView() {
  const { teams, draft } = useModel()
  const { mySlot, teamNames, punts, togglePunt, set, totals } = useDraft()
  const roster = teams.rosters[mySlot] ?? []
  const mine = teams.strengths[mySlot]
  if (!mine) return null

  const n = teams.strengths.length
  const rankOf = (c: Cat) => 1 + teams.strengths.filter((s) => s[c] > mine[c]).length
  const others = teams.strengths.filter((_, i) => i !== mySlot)
  const record = others.length ? others.reduce((w, o) => w + expectedWins(mine, o, CATS), 0) / others.length : 0
  const raw = teamTotals(roster.map((v) => v.line))
  const posCount = (p: string) => roster.filter((v) => v.player.pos.split('/').includes(p)).length

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-baseline gap-3">
        <span className="text-base font-semibold text-white">{teamNames[mySlot]}</span>
        <span className="text-zinc-400" title="Expected category record in an average weekly matchup">
          {record.toFixed(1)}-{(9 - record).toFixed(1)} per week
        </span>
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
            const r = rankOf(c)
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
      <p className="text-[11px] text-zinc-600">Open roster spots count as replacement-level players. Punts re-rank every player.</p>

      <div className="flex gap-3 text-zinc-500">
        {POSITIONS.map((p) => (
          <span key={p}>
            {p} <span className={posCount(p) ? 'text-zinc-200' : 'text-rose-400'}>{posCount(p)}</span>
          </span>
        ))}
      </div>

      <div>
        {roster.map((v) => {
          const k = draft.drafted.get(v.player.id)
          return (
            <button
              key={v.player.id}
              className="flex h-6 w-full items-center gap-2 text-left hover:bg-zinc-950"
              onClick={() => set({ selectedId: v.player.id })}
            >
              <span className="w-8 text-zinc-600">{k?.keeper ? 'K' : `#${k?.pick}`}</span>
              <span className="text-emerald-400">{v.player.name}</span>
              <span className="text-zinc-500">{v.player.pos}</span>
              <span className="ml-auto text-zinc-300">{v.value.toFixed(1)}</span>
            </button>
          )
        })}
        {draft.mine.length > 0 && (
          <div className="mt-2 text-zinc-600">
            Your picks: <span className="text-zinc-400">{draft.mine.join(' · ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
