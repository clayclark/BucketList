import { useMemo, useState } from 'react'
import { input, textBtn } from '../format'
import { CAT_LABEL, CATS } from '../lib/cats'
import type { Valued } from '../lib/value'
import { useModel } from '../model'
import { useDraft } from '../store'
import { PlayerRow } from './PlayerRow'

type Sort = 'value' | 'fit' | 'adp' | 'avail'
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']
const LIMIT = 200

/** Everyone, not just your buckets. Same rows as Buckets so nothing has to be relearned. */
export function Players() {
  const { valued, draft, teams, tiersByPlayer, availAtTarget, byId } = useModel()
  const { selectedId } = useDraft()
  const [q, setQ] = useState('')
  const [pos, setPos] = useState('')
  const [showTaken, setShowTaken] = useState(false)
  const [sort, setSort] = useState<Sort>('value')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const key = (v: Valued): number => {
      const id = v.player.id
      if (sort === 'value') return v.value
      if (sort === 'fit') return teams.fit.get(id) ?? -99
      if (sort === 'adp') return -(v.player.adp ?? 999)
      return -(availAtTarget(id) ?? 2)
    }
    const list = valued
      .filter(
        (v) =>
          (showTaken || !draft.drafted.has(v.player.id)) &&
          (!pos || v.player.pos.split('/').includes(pos)) &&
          (!needle || v.player.name.toLowerCase().includes(needle)),
      )
      .sort((a, b) => key(b) - key(a))
      .slice(0, LIMIT)
    // Keep a player picked from search visible even if the filters would hide him.
    const picked = selectedId !== null ? byId.get(selectedId) : undefined
    return picked && !list.includes(picked) ? [picked, ...list] : list
  }, [valued, q, pos, showTaken, sort, draft.drafted, teams.fit, availAtTarget, selectedId, byId])

  const sortBtn = (s: Sort, label: string, className = '') => (
    <button className={`${className} text-right ${sort === s ? 'text-amber-300' : 'hover:text-zinc-300'}`} onClick={() => setSort(s)}>
      {label}
    </button>
  )

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-zinc-900 bg-black px-3 py-1 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className={`${input} w-24`} />
          <select value={pos} onChange={(e) => setPos(e.target.value)} className={input}>
            <option value="">All</option>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button className={showTaken ? 'text-zinc-200' : textBtn} onClick={() => setShowTaken(!showTaken)}>
            Taken
          </button>
          {sortBtn('adp', 'By ADP')}
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden gap-px lg:flex">
              {CATS.map((c) => (
                <span key={c} className="w-9 text-center">
                  {CAT_LABEL[c]}
                </span>
              ))}
            </span>
            {sortBtn('value', 'Val', 'hidden w-9 lg:inline')}
            {sortBtn('fit', 'Fit', 'w-10')}
            {sortBtn('avail', draft.target ? `#${draft.target}` : 'Left', 'w-9')}
          </span>
        </div>
      </div>
      <div className="px-3">
        {rows.map((v) => {
          const tier = tiersByPlayer.get(v.player.id)?.[0]
          return (
            <PlayerRow
              key={v.player.id}
              id={v.player.id}
              detailed
              tag={
                <span className="shrink-0 text-[11px] text-zinc-500">
                  {v.player.pos}
                  {tier && <span className="text-sky-400"> {tier.section.name.replace(/^Bucket /, 'B')}</span>}
                  <span className="ml-1">{v.player.adp ? Math.round(v.player.adp) : ''}</span>
                </span>
              }
            />
          )
        })}
      </div>
    </div>
  )
}
