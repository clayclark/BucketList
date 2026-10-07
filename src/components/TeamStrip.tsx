import { rankStyle } from '../format'
import { CAT_LABEL, CATS } from '../lib/cats'
import { useModel } from '../model'
import { useDraft } from '../store'

/** My rank in each category, always in view. Hovering or selecting an available player previews his effect. */
export function TeamStrip() {
  const { ranks, draft, cats } = useModel()
  const { previewId, selectedId, set } = useDraft()
  const current = ranks.now
  if (!current) return null
  const focus = previewId ?? selectedId
  const after = focus !== null && !draft.drafted.has(focus) ? ranks.withPlayer(focus) : null
  const n = ranks.teams

  return (
    <button className="grid w-full shrink-0 grid-cols-9 gap-px border-b border-zinc-900 px-3 py-1 lg:max-w-[760px] lg:border-b-0" title="Your category ranks. Open Team." onClick={() => set({ tab: 'Team' })}>
      {CATS.map((c) => {
        const now = current[c]
        const next = after?.[c] ?? now
        const delta = now - next
        const punted = !cats.includes(c)
        return (
          <span key={c} className={`flex flex-col items-center leading-tight ${punted ? 'opacity-30' : ''}`} style={rankStyle(next, n)}>
            <span className={`text-[9px] text-zinc-400 ${punted ? 'line-through' : ''}`}>{CAT_LABEL[c]}</span>
            <span className="text-xs font-semibold text-zinc-100">
              {next}
              {delta !== 0 && (
                <span className={`ml-0.5 text-[10px] ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {delta > 0 ? '↑' : '↓'}
                  {Math.abs(delta)}
                </span>
              )}
            </span>
          </span>
        )
      })}
    </button>
  )
}
