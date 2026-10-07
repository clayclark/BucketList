import { useMemo, useState } from 'react'
import { useModel } from '../model'
import { useDraft } from '../store'

export function Search() {
  const { valued, draft, tiersByPlayer } = useModel()
  const { set, draft: draftPlayer, espn, tab, showTaken } = useDraft()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? valued.filter((v) => v.player.name.toLowerCase().includes(needle)).slice(0, 8) : []
  }, [q, valued])

  // Enter drafts in manual mode (no detail sheet in the way); otherwise it opens the player.
  const pick = (id: number, andDraft: boolean) => {
    if (andDraft && !espn.sync && !draft.drafted.has(id)) draftPlayer(id)
    else {
      // Buckets only shows your tiered, available players; anyone else opens in Players.
      const onBuckets = tiersByPlayer.has(id) && (showTaken || !draft.drafted.has(id))
      set({ selectedId: id, ...(tab === 'Buckets' && !onBuckets ? { tab: 'Players' as const } : {}) })
    }
    setQ('')
  }

  return (
    <div className="relative ml-auto w-40 sm:w-56">
      <input
        id="player-search"
        value={q}
        placeholder={espn.sync ? 'Search  /' : 'Search, Enter drafts  /'}
        className="w-full bg-transparent text-right text-zinc-200 outline-none placeholder:text-zinc-600 focus:text-left"
        onChange={(e) => {
          setQ(e.target.value)
          setCursor(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, results.length - 1))
          if (e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0))
          if (e.key === 'Escape') {
            setQ('')
            e.currentTarget.blur()
          }
          if (e.key === 'Enter' && results[cursor]) pick(results[cursor].player.id, true)
        }}
      />
      {results.length > 0 && (
        <div className="absolute right-0 top-7 z-20 w-72 border border-zinc-800 bg-black py-1">
          {results.map((v, i) => {
            const taken = draft.drafted.has(v.player.id)
            return (
              <button
                key={v.player.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(v.player.id, false)}
                className={`flex w-full gap-2 px-2 text-left ${i === cursor ? 'bg-zinc-900' : ''}`}
              >
                <span className={taken ? 'text-zinc-600 line-through' : 'text-zinc-100'}>{v.player.name}</span>
                <span className="text-zinc-500">{v.player.team}</span>
                <span className="ml-auto text-zinc-400">{v.value.toFixed(1)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
