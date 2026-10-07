import { useState, type DragEvent, type HTMLAttributes, type ReactNode } from 'react'
import { input, signed, textBtn } from '../format'
import type { Section, TierEntry } from '../lib/tiers'
import { useModel } from '../model'
import { useDraft } from '../store'
import { Avail, Injury } from '../ui'

type Drag = { kind: 'entry' | 'section'; id: string }
type DragProps = Pick<HTMLAttributes<HTMLDivElement>, 'draggable' | 'onDragStart' | 'onDragOver' | 'onDrop'>
const DRAG_TYPE = 'application/x-fhd'

type Order = 'sheet' | 'value' | 'fit' | 'avail'

const readDrag = (e: DragEvent): Drag | null => {
  const raw = e.dataTransfer.getData(DRAG_TYPE)
  return raw ? (JSON.parse(raw) as Drag) : null
}

export function Targets() {
  const { sections, showTaken, set, addSection, mySlot } = useDraft()
  const { draft, players, availAtTarget } = useModel()
  const [editing, setEditing] = useState(false)
  const [over, setOver] = useState<string | null>(null)
  const [order, setOrder] = useState<Order>('sheet')
  // Column headers sort within each bucket; clicking the active one goes back to your sheet order.
  const sortBy = (o: Order) => setOrder(order === o ? 'sheet' : o)
  const col = (o: Order, label: string, width: string, title: string) => (
    <button className={`${width} text-right ${order === o ? 'text-amber-300' : 'hover:text-zinc-300'}`} title={title} onClick={() => sortBy(o)}>
      {label}
    </button>
  )
  const isOpen = (e: TierEntry) => e.playerId === null || !draft.drafted.has(e.playerId)
  const current = sections.find((s) => s.entries.some(isOpen))?.id
  // How many of each bucket should still be on the board at your next pick.
  const expected = new Map(
    sections.map((s) => {
      const ids = new Set(s.entries.flatMap((e) => (e.playerId !== null && isOpen(e) ? [e.playerId] : [])))
      return [s.id, draft.target ? [...ids].reduce((n, id) => n + (availAtTarget(id) ?? 0), 0) : null] as const
    }),
  )
  // Close to your pick, flag only the highest bucket that won't last: that's the decision in front of you.
  const soon = draft.onClock === mySlot || (draft.mine[0] ?? Infinity) - draft.current <= 2
  const lastChance = soon
    ? sections.find((s) => s.entries.some(isOpen) && (expected.get(s.id) ?? Infinity) < 1)?.id
    : undefined

  if (!sections.length) {
    return <div className="p-3 text-zinc-500">{players.isPending ? 'Loading players…' : 'Importing tier sheet…'}</div>
  }

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-900 bg-black px-3 py-1 text-[11px] text-zinc-500">
        <button className={showTaken ? 'text-zinc-200' : textBtn} onClick={() => set({ showTaken: !showTaken })}>
          {showTaken ? 'Hide taken' : 'Show taken'}
        </button>
        <button className={editing ? 'text-amber-300' : textBtn} onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit'}
        </button>
        {players.isPending && <span>Loading players…</span>}
        <span className="ml-auto flex">
          {col('value', 'Val', 'w-10', 'Value: 9-cat z-score total')}
          {col('fit', 'Fit', 'w-11', 'Fit: extra categories won per matchup')}
          {col('avail', draft.target ? `@${draft.target}` : 'Left', 'w-10', "Chance he's still there at your next pick")}
          {editing && <span className="w-4" />}
        </span>
      </div>
      <div className="gap-6 px-3 lg:columns-[340px]" onDragLeave={() => setOver(null)}>
        {sections
          .filter((s) => showTaken || editing || s.entries.some(isOpen))
          .map((s) => (
            <Bucket
              key={s.id}
              section={s}
              current={s.id === current}
              expected={expected.get(s.id) ?? null}
              lastChance={s.id === lastChance}
              editing={editing}
              order={order}
              over={over}
              setOver={setOver}
            />
          ))}
        {editing && (
          <button className={`${textBtn} my-3`} onClick={addSection}>
            + Bucket
          </button>
        )}
      </div>
    </div>
  )
}

function Bucket({
  section,
  current,
  expected,
  lastChance,
  editing,
  order,
  over,
  setOver,
}: {
  section: Section
  current: boolean
  expected: number | null
  lastChance: boolean
  editing: boolean
  order: Order
  over: string | null
  setOver: (id: string | null) => void
}) {
  const { moveEntry, moveSection, renameSection, removeSection, showTaken } = useDraft()
  const { draft, availAtTarget, byId, teams } = useModel()
  const [renaming, setRenaming] = useState(false)

  const open = section.entries.filter((e) => e.playerId === null || !draft.drafted.has(e.playerId))
  const visible = showTaken || editing ? section.entries : open
  const score = (e: TierEntry) => {
    if (e.playerId === null || draft.drafted.has(e.playerId)) return -Infinity
    if (order === 'value') return byId.get(e.playerId)?.value ?? -99
    if (order === 'fit') return teams.fit.get(e.playerId) ?? -99
    return availAtTarget(e.playerId) ?? 2
  }
  const shown = order === 'sheet' ? visible : [...visible].sort((a, b) => score(b) - score(a))
  const onDrop = (e: DragEvent, beforeEntry: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(null)
    const d = readDrag(e)
    if (d?.kind === 'entry') moveEntry(d.id, section.id, beforeEntry)
    if (d?.kind === 'section') moveSection(d.id, section.id)
  }

  return (
    <section
      className="break-inside-avoid pb-3 pt-2"
      onDragOver={(e) => {
        e.preventDefault()
        setOver(section.id)
      }}
      onDrop={(e) => onDrop(e, null)}
    >
      <header
        draggable={editing && !renaming}
        onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: 'section', id: section.id }))}
        className={`flex items-baseline gap-2 border-b pb-0.5 ${over === section.id ? 'border-amber-300' : 'border-zinc-800'} ${editing ? 'cursor-grab' : ''}`}
      >
        {renaming ? (
          <input
            autoFocus
            defaultValue={section.name}
            className={`${input} w-36`}
            onBlur={(e) => {
              renameSection(section.id, e.target.value.trim() || section.name)
              setRenaming(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <span
            className={`shrink-0 whitespace-nowrap font-semibold ${current ? 'text-amber-300' : open.length ? 'text-zinc-100' : 'text-zinc-600'}`}
            onClick={() => editing && setRenaming(true)}
          >
            {section.name}
          </span>
        )}
        <span className="shrink-0 whitespace-nowrap text-zinc-500">{open.length} left</span>
        {expected !== null && open.length > 0 && (
          <span className={`shrink-0 whitespace-nowrap ${lastChance ? 'font-semibold text-rose-400' : expected < 1 ? 'text-rose-400' : expected < 2 ? 'text-amber-300' : 'text-zinc-600'}`}>
            ~{expected.toFixed(1)} at #{draft.target}
            {lastChance && ' · take one now'}
          </span>
        )}
        {section.note && <span className="truncate text-[11px] text-zinc-600">{section.note}</span>}
        {editing && (
          <button
            className="ml-auto text-zinc-600 hover:text-rose-400"
            onClick={() => (!section.entries.length || confirm(`Delete ${section.name}?`)) && removeSection(section.id)}
          >
            ×
          </button>
        )}
      </header>
      {shown.map((entry) => (
        <Row
          key={entry.id}
          entry={entry}
          editing={editing}
          draggable={order === 'sheet'}
          over={over === entry.id}
          setOver={setOver}
          onDrop={(e) => onDrop(e, entry.id)}
        />
      ))}
    </section>
  )
}

function Row({
  entry,
  editing,
  draggable,
  over,
  setOver,
  onDrop,
}: {
  entry: TierEntry
  editing: boolean
  draggable: boolean
  over: boolean
  setOver: (id: string | null) => void
  onDrop: (e: DragEvent) => void
}) {
  const { byId, allPlayers, draft, availAtTarget, teams, slots, topFit } = useModel()
  const { mySlot, teamAbbrevs, selectedId, set, draft: draftPlayer, removeEntry, espn } = useDraft()

  const dragProps: DragProps = {
    draggable,
    onDragStart: (e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: 'entry', id: entry.id })),
    onDragOver: (e) => {
      e.preventDefault()
      e.stopPropagation()
      setOver(entry.id)
    },
    onDrop,
  }
  const rowClass = `flex h-6 items-center gap-1.5 border-t ${over ? 'border-amber-300' : 'border-transparent'}`
  const remove = editing && (
    <button className="w-4 text-right text-zinc-600 hover:text-rose-400" onClick={(e) => (e.stopPropagation(), removeEntry(entry.id))}>
      ×
    </button>
  )

  if (entry.playerId === null) return <Unmatched entry={entry} className={rowClass} dragProps={dragProps} remove={remove} />

  const id = entry.playerId
  const player = allPlayers.get(id)
  const v = byId.get(id)
  const taken = draft.drafted.get(id)
  const mine = taken?.slot === mySlot
  const fit = teams.fit.get(id)

  return (
    <div
      {...dragProps}
      className={`${rowClass} -mx-1 cursor-default px-1 ${selectedId === id ? 'bg-zinc-900' : 'hover:bg-zinc-950'}`}
      onClick={() => set({ selectedId: id })}
      onDoubleClick={() => !espn.sync && !taken && draftPlayer(id)}
    >
      <span className={`truncate ${mine ? 'text-emerald-400' : taken ? 'text-zinc-600 line-through' : 'text-zinc-100'}`}>
        {player?.name ?? entry.name}
      </span>
      {entry.tag && <span className="shrink-0 text-[11px] text-sky-400">{entry.tag}</span>}
      {!taken && <Injury status={player?.injury ?? null} />}
      {!taken && player && slots.tight && !slots.fills(player.pos) && (
        <span className="shrink-0 text-[11px] text-rose-400" title={`You still need ${slots.open.join(', ')} and are running out of picks`}>
          no slot
        </span>
      )}
      <span className="ml-auto flex shrink-0 text-right">
        {taken ? (
          <span className={`w-[124px] ${mine ? 'text-emerald-400' : 'text-zinc-600'}`}>
            {mine ? 'Mine' : teamAbbrevs[taken.slot]} {taken.keeper ? 'K' : `#${taken.pick}`}
          </span>
        ) : (
          <>
            <span className="w-10 text-zinc-300">{v ? v.value.toFixed(1) : '-'}</span>
            <span
              className={`w-11 ${topFit.has(id) ? 'font-semibold text-amber-300' : fit !== undefined && fit > 0 ? 'text-zinc-400' : 'text-zinc-600'}`}
              title={topFit.has(id) ? 'Top 3 fit for your team' : undefined}
            >
              {fit === undefined ? '' : signed(fit, 2)}
            </span>
            <span className="w-10">
              <Avail p={availAtTarget(id)} />
            </span>
          </>
        )}
        {remove}
      </span>
    </div>
  )
}

function Unmatched({
  entry,
  className,
  dragProps,
  remove,
}: {
  entry: TierEntry
  className: string
  dragProps: DragProps
  remove: ReactNode
}) {
  const { players } = useModel()
  const updateEntry = useDraft((s) => s.updateEntry)
  const listId = `players-${entry.id}`
  return (
    <div {...dragProps} className={className} title="No ESPN match. Pick the right player.">
      <span className="text-rose-400">?</span>
      <input
        list={listId}
        defaultValue={entry.name}
        className="min-w-0 flex-1 bg-transparent text-rose-300 outline-none"
        onChange={(e) => {
          const hit = players.data?.find((p) => p.name === e.target.value)
          if (hit) updateEntry(entry.id, { playerId: hit.id, name: hit.name })
        }}
      />
      <datalist id={listId}>
        {players.data?.map((p) => <option key={p.id} value={p.name} />)}
      </datalist>
      {remove}
    </div>
  )
}
