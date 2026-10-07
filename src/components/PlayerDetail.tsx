import { fmtCat, input, signed, textBtn, zStyle } from '../format'
import { CAT_LABEL, CATS } from '../lib/cats'
import { teamTotals } from '../lib/value'
import { useModel } from '../model'
import { useDraft } from '../store'
import { Avail, Injury } from '../ui'

export function PlayerDetail({ closable = false }: { closable?: boolean }) {
  const { byId, allPlayers, draft, availAtTarget, teams, tiersByPlayer } = useModel()
  const { selectedId, teamNames, mySlot, espn, sections, set, draft: draftPlayer, removePick, addEntry } = useDraft()
  const player = selectedId === null ? undefined : allPlayers.get(selectedId)
  if (!player) return null
  const id = player.id
  const v = byId.get(id)
  const raw = v && teamTotals([v.line])
  const taken = draft.drafted.get(id)
  const fit = teams.fit.get(id)
  const tiers = tiersByPlayer.get(id) ?? []
  const avail = availAtTarget(id)

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-baseline gap-2">
        <span className="truncate text-base font-semibold text-white">{player.name}</span>
        <span className="shrink-0 text-zinc-500">
          {player.team} · {player.pos}
        </span>
        <Injury status={player.injury} />
        {closable && (
          <button className={`${textBtn} ml-auto px-1 text-base`} onClick={() => set({ selectedId: null })}>
            ×
          </button>
        )}
      </div>

      <dl className="grid grid-cols-5 gap-x-2 text-center">
        {[
          ['Rank', v?.rank ?? '-'],
          ['Value', v?.value.toFixed(1) ?? '-'],
          ['Fit', fit === undefined ? '-' : signed(fit, 2)],
          ['ADP', player.adp?.toFixed(1) ?? '-'],
          [draft.target ? `@${draft.target}` : 'Left', taken ? '-' : <Avail key="a" p={avail} />],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-[11px] text-zinc-500">{label}</dt>
            <dd className="text-sm text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>

      {v && raw && (
        <table className="w-full table-fixed text-center">
          <thead className="text-[11px] text-zinc-500">
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
                <td key={c} className="py-0.5" style={zStyle(v.z[c])}>
                  {v.z[c].toFixed(1)}
                </td>
              ))}
            </tr>
            <tr className="text-zinc-500">
              {CATS.map((c) => (
                <td key={c}>{fmtCat(c, raw[c])}</td>
              ))}
            </tr>
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap gap-x-3 text-zinc-500">
        {v && (
          <span>
            {v.gp.toFixed(0)} GP · {v.min.toFixed(1)} MIN
          </span>
        )}
        {tiers.map(({ section, entry }) => (
          <span key={entry.id} className="text-zinc-300">
            {section.name}
            {entry.tag && <span className="text-sky-400"> {entry.tag}</span>}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
