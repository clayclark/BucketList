import { useEffect } from 'react'
import { CATS } from './lib/cats'
import { bucketCode, shortBucket } from './lib/tiers'
import { useModel } from './model'
import { useDraft } from './store'

/**
 * One player's badge in ESPN's draft room (public/draft-badges.js renders it).
 * `state` drives the edge bar: take now, can wait, in your buckets, or listed only for a punt you aren't running.
 */
export type Badge = {
  /** Tight code for the row ("F2"); `bucket` is the readable name for the hover card. */
  code: string
  bucket: string
  tag: string | null
  value: number | null
  fit: number | null
  top: boolean
  avail: number | null
  state: 'take' | 'wait' | 'tier' | 'off'
  /** Category z-scores in strip order; null for punted categories. */
  z: (number | null)[]
}

export type BadgeFeed = { target: number | null; savedAt: number; players: Record<number, Badge> }

const HEARTBEAT_MS = 30_000

/**
 * Keeps the draft room badges in step with the panel. The room only shows badges while this keeps
 * saving (with a heartbeat), so a closed panel never leaves stale numbers on ESPN's page.
 */
export function useBadgeSync() {
  const { tiersByPlayer, draft, byId, teams, topFit, availAtTarget, entryApplies, outlook } = useModel()
  const punts = useDraft((s) => s.punts)

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return
    const players: Record<number, Badge> = {}
    for (const [id, refs] of tiersByPlayer) {
      if (draft.drafted.has(id)) continue
      const ref = refs.find((r) => entryApplies(r.entry)) ?? refs[0]
      const applies = entryApplies(ref.entry)
      const v = byId.get(id)
      players[id] = {
        code: bucketCode(ref.section.name),
        bucket: shortBucket(ref.section.name),
        tag: ref.entry.tag,
        value: v ? Math.round(v.value * 10) / 10 : null,
        fit: teams.fit.get(id) ?? null,
        top: topFit.has(id),
        avail: availAtTarget(id),
        state: !applies ? 'off' : ref.section.id === outlook.lastChance ? 'take' : outlook.canWait(ref.section.id, id) ? 'wait' : 'tier',
        z: v ? CATS.map((c) => (punts.includes(c) ? null : Math.round(v.z[c] * 10) / 10)) : [],
      }
    }
    const save = () => chrome.storage.local.set({ badges: { target: draft.target, savedAt: Date.now(), players } satisfies BadgeFeed })
    save()
    const beat = setInterval(save, HEARTBEAT_MS)
    return () => clearInterval(beat)
  }, [tiersByPlayer, draft, byId, teams, topFit, availAtTarget, entryApplies, outlook, punts])
}
