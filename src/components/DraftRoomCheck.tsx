import { useEffect, useState } from 'react'
import { Banner } from '../ui'

const DRAFT_ROOM = 'https://fantasy.espn.com/basketball/draft*'

/**
 * Safety net: a draft room tab is open but its picks aren't reaching us (the room loaded before the
 * extension could listen). One reload fixes it, so offer that instead of silently showing stale picks.
 * `feedLeague` is the league the feed last heard from, finished drafts included, so a room left open
 * after its draft ends doesn't trigger this.
 */
export function DraftRoomCheck({ feedLeague }: { feedLeague: string | null }) {
  const [stuck, setStuck] = useState<{ tabId: number; misses: number } | null>(null)

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return
    const check = async () => {
      const [room] = await chrome.tabs.query({ url: DRAFT_ROOM })
      const roomLeague = room?.url ? new URL(room.url).searchParams.get('leagueId') : null
      const connected = !roomLeague || feedLeague === roomLeague
      // Require two misses in a row so a room that's still loading doesn't flash the warning.
      setStuck((prev) => (connected || !room?.id ? null : { tabId: room.id, misses: (prev?.misses ?? 0) + 1 }))
    }
    check()
    const timer = setInterval(check, 5000)
    return () => clearInterval(timer)
  }, [feedLeague])

  if (!stuck || stuck.misses < 2) return null
  return (
    <Banner action="Reload draft room" onAction={() => chrome.tabs.reload(stuck.tabId)}>
      Draft room isn't sending picks yet.
    </Banner>
  )
}
