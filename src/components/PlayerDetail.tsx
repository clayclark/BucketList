import type { ReactNode } from 'react'
import { fmtCat, input, ordinal, signed, textBtn, zStyle } from '../format'
import { CAT_LABEL, CATS } from '../lib/cats'
import { teamTotals } from '../lib/value'
import { useModel } from '../model'
import { useDraft } from '../store'
import { Avail, Injury } from '../ui'

/**
 * Player details. `inline` sits under an expanded row (the row already shows the name),
 * `sheet` is the narrow panel's bottom sheet, `aside` is the wide layout's side column.
 */
export function PlayerDetail({ variant }: { variant: 'inline' | 'sheet' | 'aside' }) {
  const { byId, allPlayers, draft, availAtTarget, teams, tiersByPlayer, ranks } = useModel()
  const { selectedId, teamNames, mySlot, espn, sections, set, draft: draftPlayer, removePick, addEntry } = useDraft()
  const player = selectedId === null ? undefined : allPlayers.get(selectedId)
  if (!player) return null
  const id = player.id
  const v = byId.get(id)
  const raw = v && teamTotals([v.line])
  const taken = draft.drafted.get(id)
  const fit = teams.fit.get(id)
  const tiers = tiersByPlayer.get(id) ?? []
  const before = ranks.now
  const after = !taken ? ranks.withPlayer(id) : null
  // Categories whose rank he'd change, biggest improvement first.
  const changes = after && before ? CATS.filter((c) => after[c] !== before[c]).sort((a, b) => before[b] - after[b] - (before[a] - after[a])) : []

  const stat = (label: string, value: ReactNode) => (
    <span className="whitespace-nowrap">
      <span className="text-zinc-500">{label} </span>
      <span className="text-zinc-100">{value}</span>
    </span>
  )

  return (
    <div className={variant === 'inline' ? 'space-y-1.5 pt-1' : 'space-y-1.5 px-3 py-2'}>
      {variant !== 'inline' && (
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-white">{player.name}</span>
          <span className="shrink-0 text-zinc-500">
            {player.team} · {player.pos}
          </span>
          <Injury status={player.injury} />
          {variant === 'sheet' && (
            <button className={`${textBtn} ml-auto px-1 text-base leading-none`} onClick={() => set({ selectedId: null })}>
              ×
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3">
        {variant === 'inline' && <span className="text-zinc-500">{player.team} · {player.pos}</span>}
        {stat('Val', v?.value.toFixed(1) ?? '-')}
        {stat('Fit', fit === undefined ? '-' : `${signed(fit, 2)} cats/wk`)}
        {stat('ADP', player.adp?.toFixed(1) ?? '-')}
        {!taken && draft.target && stat(`#${draft.target}`, <Avail p={availAtTarget(id)} />)}
        {v && stat('GP', v.gp.toFixed(0))}
        {v && stat('MIN', v.min.toFixed(1))}
        {v && stat('Rank', v.rank)}
      </div>

      {v && raw && (
        <table className="w-full table-fixed text-center">
          <thead className="text-[10px] text-zinc-500">
            <tr>
              {CATS.map((c) => (
                <th key={c} className="font-normal">
                  {CAT_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {CATS.map((c) => (
                <td key={c} style={zStyle(v.z[c])}>
                  {v.z[c].toFixed(1)}
                </td>
              ))}
            </tr>
            <tr className="text-[11px] text-zinc-500">
              {CATS.map((c) => (
                <td key={c}>{fmtCat(c, raw[c])}</td>
              ))}
            </tr>
          </tbody>
        </table>
      )}

      {after && before && (
        <div className="text-zinc-500">
          {changes.length === 0 ? (
            'No change to your category ranks'
          ) : (
            <>
              Your ranks:{' '}
              {changes.map((c, i) => (
                <span key={c}>
                  {i > 0 && ' · '}
                  <span className={after[c] < before[c] ? 'text-emerald-400' : 'text-rose-400'}>
                    {CAT_LABEL[c]} {ordinal(before[c])}→{ordinal(after[c])}
                  </span>
                </span>
              ))}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {tiers.map(({ section, entry }) => (
          <span key={entry.id} className="text-zinc-300">
            {section.name}
            {entry.tag && <span className="text-sky-400"> {entry.tag}</span>}
          </span>
        ))}
        {taken ? (
          <>
            <span className={taken.slot === mySlot ? 'text-emerald-400' : 'text-zinc-400'}>
              {taken.keeper ? 'Kept' : `Taken #${taken.pick}`} by {teamNames[taken.slot]}
            </span>
            {!espn.sync && (
              <button className={textBtn} onClick={() => removePick(id)}>
                Remove pick
              </button>
            )}
          </>
        ) : (
          !espn.sync &&
          draft.onClock !== null && (
            <>
              <button className="font-semibold text-amber-300 hover:text-amber-200" onClick={() => draftPlayer(id)}>
                Draft to {draft.onClock === mySlot ? 'me' : teamNames[draft.onClock]}
              </button>
              <select className={input} value="" onChange={(e) => draftPlayer(id, Number(e.target.value))}>
                <option value="">Other team…</option>
                {teamNames.map((n, i) => (
                  <option key={i} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </>
          )
        )}
        <select
          className={`${input} ml-auto`}
          value=""
          onChange={(e) => addEntry(e.target.value, { playerId: id, name: player.name, tag: null })}
        >
          <option value="">Add to bucket…</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
