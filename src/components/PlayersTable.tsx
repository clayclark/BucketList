import { useMemo, useState } from 'react'
import { fmtCat, input, signed, textBtn, zStyle } from '../format'
import { CAT_LABEL, CATS, type Cat } from '../lib/cats'
import { teamTotals, type Valued } from '../lib/value'
import { useModel } from '../model'
import { useDraft } from '../store'
import { Avail, Injury } from '../ui'

type SortKey = 'value' | 'adp' | 'fit' | 'avail' | Cat
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']
const LIMIT = 250

export function PlayersTable() {
  const { valued, draft, teams, tiersByPlayer, availAtTarget } = useModel()
  const { mySlot, teamAbbrevs, selectedId, set, draft: draftPlayer, espn } = useDraft()
  const [q, setQ] = useState('')
  const [showTaken, setShowTaken] = useState(false)
  const [pos, setPos] = useState('')
  const [raw, setRaw] = useState(false)
  const [sort, setSort] = useState<SortKey>('value')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const key = (v: Valued): number => {
      const id = v.player.id
      if (sort === 'value') return v.value
      if (sort === 'adp') return -(v.player.adp ?? 999)
      if (sort === 'fit') return teams.fit.get(id) ?? -99
      if (sort === 'avail') return -(availAtTarget(id) ?? 2)
      return v.z[sort]
    }
    return valued
      .filter(
        (v) =>
          (showTaken || !draft.drafted.has(v.player.id)) &&
          (!pos || v.player.pos.split('/').includes(pos)) &&
          (!needle || v.player.name.toLowerCase().includes(needle)),
      )
      .sort((a, b) => key(b) - key(a))
      .slice(0, LIMIT)
  }, [valued, q, showTaken, pos, sort, draft.drafted, teams.fit, availAtTarget])

  const th = (k: SortKey, label: string, className = '') => (
    <th
      className={`cursor-pointer px-1 font-normal ${className} ${sort === k ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
      onClick={() => setSort(k)}
    >
      {label}
    </th>
  )

  return (
    <div>
      <div className="sticky left-0 top-0 z-20 flex items-center gap-3 border-b border-zinc-900 bg-black px-3 py-1 text-[11px]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className={`${input} w-28`} />
        <select value={pos} onChange={(e) => setPos(e.target.value)} className={input}>
          <option value="">All</option>
          {POSITIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button className={showTaken ? 'text-zinc-200' : textBtn} onClick={() => setShowTaken(!showTaken)}>
          Taken
        </button>
        <button className={raw ? 'text-zinc-200' : textBtn} onClick={() => setRaw(!raw)}>
          {raw ? 'Stats' : 'Z'}
        </button>
      </div>
      <table className="w-full whitespace-nowrap">
        <thead className="sticky top-[29px] z-10 bg-black text-right text-[11px]">
          <tr>
            <th className="sticky left-0 bg-black px-1 pl-3 text-left font-normal text-zinc-500">Player</th>
            {th('adp', 'ADP')}
            {th('avail', draft.target ? `@${draft.target}` : 'Left')}
            {th('fit', 'Fit')}
            {th('value', 'Val')}
            {CATS.map((c) => th(c, CAT_LABEL[c], 'w-9'))}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const id = v.player.id
            const taken = draft.drafted.get(id)
            const tier = tiersByPlayer.get(id)?.[0]
            const fit = teams.fit.get(id)
            const totals = raw ? teamTotals([v.line]) : null
            const selected = selectedId === id
            return (
              <tr
                key={id}
                className={`h-6 text-right ${selected ? 'bg-zinc-900' : 'hover:bg-zinc-950'} ${taken ? 'text-zinc-600' : ''}`}
                onClick={() => set({ selectedId: id })}
                onDoubleClick={() => !espn.sync && !taken && draftPlayer(id)}
              >
                <td className={`sticky left-0 max-w-48 truncate px-1 pl-3 text-left ${selected ? 'bg-zinc-900' : 'bg-black'}`}>
                  <span className={taken?.slot === mySlot ? 'text-emerald-400' : taken ? 'line-through' : 'text-zinc-100'}>
                    {v.player.name}
                  </span>
                  <Injury status={v.player.injury} />
                  <span className="ml-1.5 text-[11px] text-zinc-500">
                    {taken ? teamAbbrevs[taken.slot] : tier ? tier.section.name.replace(/^Bucket /, 'B') : v.player.pos}
                  </span>
                </td>
                <td className="px-1 text-zinc-500">{v.player.adp?.toFixed(0) ?? '-'}</td>
                <td className="px-1">
                  <Avail p={availAtTarget(id)} />
                </td>
                <td className="px-1 text-zinc-400">{fit === undefined ? '' : signed(fit, 2)}</td>
                <td className="px-1 font-semibold text-zinc-100">{v.value.toFixed(1)}</td>
                {CATS.map((c) => (
                  <td key={c} className="px-1" style={zStyle(v.z[c])}>
                    {totals ? fmtCat(c, totals[c]) : v.z[c].toFixed(1)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
