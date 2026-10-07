import { useState, type DragEvent, type ReactNode } from 'react'
import { input, textBtn } from '../format'
import { minPick, tagCats, type Section, type TierEntry } from '../lib/tiers'
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
  const { sections, showTaken, set, addSection, mySlot } = useDraft()
  const { draft, players, availAtTarget, allPlayers, entryApplies: applies } = useModel()
  const [editing, setEditing] = useState(false)
  const [over, setOver] = useState<string | null>(null)
  const [order, setOrder] = useState<Order>('sheet')

  // Entries that don't fit your punts stay visible but dimmed, and don't count toward what's left.
  const available = (e: TierEntry) => e.playerId === null || !draft.drafted.has(e.playerId)
  const isOpen = (e: TierEntry) => available(e) && applies(e)
  const live = sections.filter((s) => s.entries.some(isOpen))
  // Show any bucket with someone available, even if they're all dimmed (e.g. Giannis listed only as "punt FT").
  const shownSections = showTaken || editing ? sections : sections.filter((s) => s.entries.some(available))
  const current = live[0]?.id
  // How many of each bucket should still be on the board at your next pick.
  const expected = new Map(
    sections.map((s) => {
      const ids = new Set(s.entries.flatMap((e) => (e.playerId !== null && isOpen(e) ? [e.playerId] : [])))
      return [s.id, draft.target ? [...ids].reduce((n, id) => n + (availAtTarget(id) ?? 0), 0) : null] as const
    }),
  )
  // Near your pick: the highest bucket that won't last, who in your top buckets can wait, and who's
  // likely still there next time. Together that's the take-now-or-wait decision.
  const soon = draft.onClock === mySlot || (draft.mine[0] ?? Infinity) - draft.current <= 2
  const lastChance = soon ? live.find((s) => (expected.get(s.id) ?? Infinity) < 1)?.id : undefined
  const waitHints = new Set(soon ? live.slice(0, 2).map((s) => s.id) : [])
  const likelyLater = soon && draft.target ? likelyAtNextPick(live, isOpen, availAtTarget) : []

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
          {col('avail', draft.target ? `#${draft.target}` : 'Left', 'w-9', "Chance he's still there at your next pick")}
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
            waitHints={waitHints.has(s.id)}
            editing={editing}
            order={order}
            isOpen={isOpen}
            applies={applies}
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
function likelyAtNextPick(live: Section[], isOpen: (e: TierEntry) => boolean, avail: (id: number) => number | null) {
  const out: number[] = []
  for (const s of live)
    for (const e of s.entries)
      if (e.playerId !== null && isOpen(e) && !out.includes(e.playerId) && (avail(e.playerId) ?? 0) >= 0.6) out.push(e.playerId)
  return out.slice(0, 3)
}

function Bucket({
  section,
  current,
  expected,
  lastChance,
  waitHints,
  editing,
  order,
  isOpen,
  applies,
  over,
  setOver,
}: {
  section: Section
  current: boolean
  expected: number | null
  lastChance: boolean
  waitHints: boolean
  editing: boolean
  order: Order
  isOpen: (e: TierEntry) => boolean
  applies: (e: TierEntry) => boolean
  over: string | null
  setOver: (id: string | null) => void
}) {
  const { moveEntry, moveSection, renameSection, removeSection, removeEntry, showTaken } = useDraft()
  const { draft, availAtTarget, byId, teams } = useModel()
  const [renaming, setRenaming] = useState(false)

  const open = section.entries.filter(isOpen)
  const visible = showTaken || editing ? section.entries : section.entries.filter((e) => e.playerId === null || !draft.drafted.has(e.playerId))
  const score = (e: TierEntry) => {
    if (e.playerId === null || !isOpen(e)) return -Infinity
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
            tag={entry.tag && <Tag tag={entry.tag} applies={applies(entry)} current={draft.current} />}
            dimmed={!applies(entry)}
            hint={
              waitHints &&
              (availAtTarget(entry.playerId) ?? 0) >= 0.7 && (
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

/** A sheet tag, colored by what it means right now: a punt you're running, a pick threshold reached. */
function Tag({ tag, applies, current }: { tag: string; applies: boolean; current: number }) {
  const n = minPick(tag)
  if (n !== null) {
    const ready = current >= n
    return (
      <span className={`shrink-0 text-[11px] ${ready ? 'text-emerald-400' : 'text-zinc-600'}`} title={ready ? `Pick ${n} reached` : `Your sheet says not before pick ${n}`}>
        {tag}
      </span>
    )
  }
  const puntTag = tagCats(tag).length > 0
  const noPunt = /^no punt$/i.test(tag.trim())
  if (!puntTag && !noPunt) return <span className="shrink-0 text-[11px] text-sky-400">{tag}</span>
  return (
    <span
      className={`shrink-0 text-[11px] ${!applies ? 'text-zinc-600' : puntTag ? 'text-amber-300' : 'text-sky-400'}`}
      title={applies ? (puntTag ? 'Matches your punt' : "You're not punting what his other listing needs") : puntTag ? `Only if you punt ${tag}` : "Only if you're not punting"}
    >
      {tag}
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
