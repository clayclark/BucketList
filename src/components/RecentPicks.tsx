import { useModel } from '../model'
import { useDraft } from '../store'

export function RecentPicks() {
  const { allPlayers } = useModel()
  const { picks, teamAbbrevs, mySlot, set } = useDraft()
  const recent = picks
    .filter((p) => !p.keeper)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 15)
  if (!recent.length) return null
  return (
    <div className="border-t border-zinc-900 p-3">
      {recent.map((p) => (
        <button key={p.overall} className="flex h-6 w-full items-center gap-2 text-left hover:bg-zinc-950" onClick={() => set({ selectedId: p.playerId })}>
          <span className="w-7 text-zinc-600">{p.overall}</span>
          <span className={`w-12 truncate ${p.slot === mySlot ? 'text-emerald-400' : 'text-zinc-500'}`}>{teamAbbrevs[p.slot]}</span>
          <span className={p.slot === mySlot ? 'text-emerald-400' : 'text-zinc-200'}>{allPlayers.get(p.playerId)?.name}</span>
        </button>
      ))}
    </div>
  )
}
