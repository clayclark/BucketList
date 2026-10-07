import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { signed } from '../format'
import { useModel } from '../model'
import { useDraft } from '../store'
import { Avail, Fingerprint, Injury } from '../ui'
import { PlayerDetail } from './PlayerDetail'

export type DragProps = Pick<HTMLAttributes<HTMLDivElement>, 'draggable' | 'onDragStart' | 'onDragOver' | 'onDrop'>

/**
 * One player, the same everywhere: name and tags, the 9-category heat strip, fit and the chance he's
 * back at your next pick. Hover previews him in the category strip; click expands details in place.
 */
export function PlayerRow({
  id,
  tag,
  hint,
  detailed = false,
  dragProps,
  over = false,
  trailing,
}: {
  id: number
  tag?: ReactNode
  hint?: ReactNode
  detailed?: boolean
  dragProps?: DragProps
  over?: boolean
  trailing?: ReactNode
}) {
  const { byId, allPlayers, draft, availAtTarget, teams, slots, topFit } = useModel()
  const { mySlot, teamAbbrevs, selectedId, punts, espn, set, draft: draftPlayer } = useDraft()
  const ref = useRef<HTMLDivElement>(null)
  const selected = selectedId === id
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  // A row can disappear under the cursor (tab switch, player drafted) without a mouseleave.
  useEffect(
    () => () => {
      if (useDraft.getState().previewId === id) useDraft.getState().set({ previewId: null })
    },
    [id],
  )

  const player = allPlayers.get(id)
  if (!player) return null
  const v = byId.get(id)
  const taken = draft.drafted.get(id)
  const mine = taken?.slot === mySlot
  const fit = teams.fit.get(id)
  const noSlot = !taken && slots.tight && !slots.fills(player.pos)

  return (
    <div ref={ref} {...dragProps} className={`-mx-1 border-t px-1 ${over ? 'border-amber-300' : 'border-transparent'} ${selected ? 'bg-zinc-900' : ''}`}>
      <div
        className={`flex h-7 cursor-default items-center gap-1.5 ${selected ? '' : 'hover:bg-zinc-950'}`}
        onClick={() => set({ selectedId: selected ? null : id })}
        onDoubleClick={() => !espn.sync && !taken && draftPlayer(id)}
        onMouseEnter={() => set({ previewId: id })}
        onMouseLeave={() => set({ previewId: null })}
      >
        <span className={`truncate ${mine ? 'text-emerald-400' : taken ? 'text-zinc-600 line-through' : 'text-zinc-100'}`}>{player.name}</span>
        {tag}
        {!taken && <Injury status={player.injury} />}
        {noSlot && (
          <span className="shrink-0 text-[11px] text-rose-400" title={`You still need ${slots.open.join(', ')} and are running out of picks`}>
            no slot
          </span>
        )}
        {!taken && hint}
        <span className="ml-auto flex shrink-0 items-center gap-2 text-right">
          {taken ? (
            <span className={mine ? 'text-emerald-400' : 'text-zinc-600'}>
              {mine ? 'Mine' : teamAbbrevs[taken.slot]} {taken.keeper ? 'K' : `#${taken.pick}`}
            </span>
          ) : (
            <>
              {v && <Fingerprint z={v.z} punts={punts} detailed={detailed} />}
              <span className="hidden w-9 text-zinc-300 lg:inline">{v ? v.value.toFixed(1) : '-'}</span>
              <span
                className={`w-10 ${topFit.has(id) ? 'font-semibold text-amber-300' : fit !== undefined && fit > 0 ? 'text-zinc-400' : 'text-zinc-600'}`}
                title={topFit.has(id) ? 'Top 3 fit for your team' : 'Extra categories won per matchup'}
              >
                {fit === undefined ? '' : signed(fit, 2)}
              </span>
              <span className="w-9">
                <Avail p={availAtTarget(id)} />
              </span>
            </>
          )}
          {trailing}
        </span>
      </div>
      {/* Narrow panel: details open in place. Wide layout shows them in the side column instead. */}
      {selected && (
        <div className="pb-2 lg:hidden">
          <PlayerDetail variant="inline" />
        </div>
      )}
    </div>
  )
}
