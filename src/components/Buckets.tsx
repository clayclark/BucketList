import { useState, type DragEvent, type ReactNode } from 'react'
import { input, textBtn } from '../format'
import { pickRange, type Section, type TierEntry } from '../lib/tiers'
import { useModel } from '../model'
import { useDraft } from '../store'
import { PlayerRow, type DragProps } from './PlayerRow'

type Drag = { kind: 'entry' | 'section'; id: string }
type Order = 'sheet' | 'value' | 'fit' | 'avail'
const DRAG_TYPE = 'application/x-bucket-list'

const readDrag = (e: DragEvent): Drag | null => {
  const raw = e.dataTransfer.getData(DRAG_TYPE)
  return raw ? (JSON.parse(raw) as Drag) : null
}

export function Buckets() {
  const { sections, showTaken, set, addSection } = useDraft()
  const { draft, players, availAtTarget, allPlayers, outlook } = useModel()
  const [editing, setEditing] = useState(false)
  const [over, setOver] = useState<string | null>(null)
  const [order, setOrder] = useState<Order>('sheet')

  const { isOpen, inPlay, live, current, expected, soon, lastChance, canWait } = outlook
  const available = (e: TierEntry) => e.playerId === null || !draft.drafted.has(e.playerId)
  const shownSections = showTaken || editing ? sections : sections.filter((s) => s.entries.some(available))
  // Who's likely still there next time: with take-now and can-wait, that's the whole decision.
  const likelyLater = soon && draft.target ? likelyAtNextPick(live, inPlay, availAtTarget) : []

  // Column headers sort within each bucket; clicking the active one goes back to your sheet order.
  const col = (o: Order, label: string, className: string, title: string) => (
    <button
      className={`${className} text-right ${order === o ? 'text-amber-300' : 'hover:text-zinc-300'}`}
      title={title}
      onClick={() => setOrder(order === o ? 'sheet' : o)}
    >
      {label}
    </button>
  )

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
        <span className="ml-auto flex gap-2">
          {col('value', 'Val', 'w-8', 'Value: total of your non-punted categories')}
          {col('fit', 'Fit', 'w-10', 'Fit: extra categories won per matchup')}
          {col('avail', draft.target ? `#${draft.target}` : 'Left', 'w-9', "Chance he's still there at your next pick. Click to sort by ADP")}
          {editing && <span className="w-3" />}
        </span>
      </div>

      {likelyLater.length > 0 && (
        <div className="border-b border-zinc-900 px-3 py-1 text-zinc-500">
          Likely still there at #{draft.target}:{' '}
          {likelyLater.map((id, i) => (
            <span key={id}>
              {i > 0 && ' · '}
              <button className="text-emerald-400 hover:text-emerald-300" onClick={() => set({ selectedId: id })}>
                {allPlayers.get(id)?.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Wide: buckets fill row by row, so the ones you're choosing from stay at the top. */}
      <div className="grid items-start gap-x-6 px-3 lg:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]" onDragLeave={() => setOver(null)}>
        {shownSections.map((s) => (
          <Bucket
            key={s.id}
            section={s}
            current={s.id === current}
            expected={expected.get(s.id) ?? null}
            lastChance={s.id === lastChance}
            canWait={canWait}
            editing={editing}
            order={order}
            isOpen={isOpen}
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

/** First few tiered players, in your order, who probably last until your next pick. */
function likelyAtNextPick(live: Section[], inPlay: (s: Section, e: TierEntry) => boolean, avail: (id: number) => number | null) {
  const out: number[] = []
  for (const s of live)
    for (const e of s.entries)
      if (e.playerId !== null && inPlay(s, e) && !out.includes(e.playerId) && (avail(e.playerId) ?? 0) >= 0.6) out.push(e.playerId)
  return out.slice(0, 3)
}

function Bucket({
  section,
  current,
  expected,
  lastChance,
  canWait,
  editing,
  order,
  isOpen,
  over,
  setOver,
}: {
  section: Section
  current: boolean
  expected: number | null
  lastChance: boolean
  canWait: (sectionId: string, playerId: number) => boolean
  editing: boolean
  order: Order
  isOpen: (e: TierEntry) => boolean
  over: string | null
  setOver: (id: string | null) => void
}) {
  const { moveEntry, moveSection, renameSection, removeSection, removeEntry, showTaken } = useDraft()
  const { draft, byId, teams, outlook, allPlayers } = useModel()
  const [renaming, setRenaming] = useState(false)

  const open = section.entries.filter(isOpen)
  const visible = showTaken || editing ? section.entries : section.entries.filter((e) => e.playerId === null || !draft.drafted.has(e.playerId))
  const score = (e: TierEntry) => {
    if (e.playerId === null || !isOpen(e)) return -Infinity
    if (order === 'value') return byId.get(e.playerId)?.value ?? -99
    if (order === 'fit') return teams.fit.get(e.playerId) ?? -99
    // By ADP, earliest first: the order the room takes them, without the ties at 0% and 100%.
    return -(allPlayers.get(e.playerId)?.adp ?? 999)
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

  const dragProps = (entry: TierEntry): DragProps => ({
    draggable: order === 'sheet',
    onDragStart: (e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: 'entry', id: entry.id })),
    onDragOver: (e) => {
      e.preventDefault()
      e.stopPropagation()
      setOver(entry.id)
    },
    onDrop: (e) => onDrop(e, entry.id),
  })

  const remove = (entry: TierEntry): ReactNode =>
    editing && (
      <button className="w-3 text-zinc-600 hover:text-rose-400" onClick={(e) => (e.stopPropagation(), removeEntry(entry.id))}>
        ×
      </button>
    )

  return (
    <section
      className="pb-3 pt-2"
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
          <span
            className={`shrink-0 whitespace-nowrap ${lastChance ? 'font-semibold text-rose-400' : expected < 1 ? 'text-rose-400' : expected < 2 ? 'text-amber-300' : 'text-zinc-600'}`}
            title={`Expected ${expected.toFixed(1)} of these still available at your pick #${draft.target}`}
          >
            {expected < 0.5 ? `gone by #${draft.target}` : `≈${Math.round(expected)} left at #${draft.target}`}
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
      {shown.map((entry) =>
        entry.playerId === null ? (
          <Unmatched key={entry.id} entry={entry} dragProps={dragProps(entry)} remove={remove(entry)} />
        ) : (
          <PlayerRow
            key={entry.id}
            id={entry.playerId}
            tag={
              <>
                {entry.tag && <Tag tag={entry.tag} pick={outlook.pick} />}
                <Adp adp={allPlayers.get(entry.playerId)?.adp ?? null} />
              </>
            }
            hint={
              canWait(section.id, entry.playerId) && (
                <span className="shrink-0 text-[11px] text-emerald-500" title="Likely still there at your next pick">
                  can wait
                </span>
              )
            }
            dragProps={dragProps(entry)}
            over={over === entry.id}
            trailing={remove(entry)}
          />
        ),
      )}
    </section>
  )
}

/** A sheet tag, colored by where your pick sits in its range: early, in range, or past it (he's sliding). */
function Tag({ tag, pick }: { tag: string; pick: number }) {
  const range = pickRange(tag)
  if (!range) return <span className="shrink-0 text-[11px] text-sky-400">{tag}</span>
  const [color, title] =
    pick < range.from
      ? ['text-zinc-600', `Your range starts at pick ${range.from}`]
      : range.to !== null && pick > range.to
        ? ['text-amber-300', `Past your range (${range.to}): he's sliding`]
        : ['text-emerald-400', `In your range at pick ${pick}`]
  return (
    <span className={`shrink-0 text-[11px] ${color}`} title={title}>
      {tag}
    </span>
  )
}

/** Market ADP beside your range, so "40-55" vs "36" reads at a glance. */
function Adp({ adp }: { adp: number | null }) {
  if (adp === null) return null
  return (
    <span className="shrink-0 text-[11px] text-zinc-500" title={`ADP ${adp.toFixed(1)}`}>
      {Math.round(adp)}
    </span>
  )
}

function Unmatched({ entry, dragProps, remove }: { entry: TierEntry; dragProps: DragProps; remove: ReactNode }) {
  const { players } = useModel()
  const updateEntry = useDraft((s) => s.updateEntry)
  const listId = `players-${entry.id}`
  return (
    <div {...dragProps} className="flex h-7 items-center gap-1.5" title="No ESPN match. Pick the right player.">
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
