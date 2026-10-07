import { useEffect, useState } from 'react'
import type { LiveDraft } from '../lib/live'

const DRAFT_ROOM = 'https://fantasy.espn.com/basketball/draft*'

/**
 * Safety net: a draft room tab is open but its picks aren't reaching us (the room loaded before the
 * extension could listen). One reload fixes it, so offer that instead of silently showing stale picks.
 */
export function DraftRoomCheck({ live }: { live: LiveDraft | null }) {
  const [stuck, setStuck] = useState<{ tabId: number; misses: number } | null>(null)

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return
    const check = async () => {
      const [room] = await chrome.tabs.query({ url: DRAFT_ROOM })
      const roomLeague = room?.url ? new URL(room.url).searchParams.get('leagueId') : null
      const connected = !roomLeague || live?.leagueId === roomLeague
      // Require two misses in a row so a room that's still loading doesn't flash the warning.
      setStuck((prev) => (connected || !room?.id ? null : { tabId: room.id, misses: (prev?.misses ?? 0) + 1 }))
    }
    check()
    const timer = setInterval(check, 5000)
    return () => clearInterval(timer)
  }, [live])

  if (!stuck || stuck.misses < 2) return null
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-amber-300 px-3 py-1.5 text-amber-300">
      <span>Draft room isn't sending picks yet.</span>
      <button className="ml-auto shrink-0 bg-amber-300 px-2 font-semibold text-black" onClick={() => chrome.tabs.reload(stuck.tabId)}>
        Reload draft room
      </button>
    </div>
  )
}
