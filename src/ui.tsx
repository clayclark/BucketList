import type { ReactNode } from 'react'
import { CAT_LABEL, CATS, type Cat, type CatLine } from './lib/cats'

export function Avail({ p }: { p: number | null }) {
  if (p === null) return <span className="text-zinc-700">-</span>
  const color = p < 0.3 ? 'text-rose-400' : p < 0.7 ? 'text-amber-300' : 'text-zinc-500'
  return <span className={color}>{Math.round(p * 100)}%</span>
}

const INJURY: Record<string, string> = { OUT: 'O', DAY_TO_DAY: 'DTD', INJURY_RESERVE: 'IR', SUSPENSION: 'SUS' }

export function Injury({ status }: { status: string | null }) {
  if (!status) return null
  return <span className="shrink-0 text-[10px] font-semibold text-rose-400">{INJURY[status] ?? status}</span>
}

const cellColor = (z: number) => {
  const a = Math.min(Math.abs(z) / 2, 1) * 0.9
  return z >= 0 ? `rgba(52, 211, 153, ${a})` : `rgba(251, 113, 133, ${a})`
}

/**
 * A player's 9 categories as tiny heat cells, in the same order as the category strip.
 * `detailed` shows the numbers on wide screens.
 */
export function Fingerprint({ z, punts, detailed = false }: { z: CatLine; punts: readonly Cat[]; detailed?: boolean }) {
  return (
    <span
      className="flex shrink-0 gap-px"
      title={CATS.map((c) => `${CAT_LABEL[c]} ${z[c] >= 0 ? '+' : ''}${z[c].toFixed(1)}`).join('  ')}
    >
      {CATS.map((c) => (
        <span
          key={c}
          className={`flex h-3 w-[7px] items-center justify-center rounded-[1px] text-[10px] ${detailed ? 'lg:h-5 lg:w-9' : ''} ${punts.includes(c) ? 'opacity-25' : ''}`}
          style={{ backgroundColor: cellColor(z[c]) }}
        >
          {detailed && <span className="hidden text-zinc-100 lg:inline">{z[c].toFixed(1)}</span>}
        </span>
      ))}
    </span>
  )
}

/** A full-width amber notice above the clock with one action. */
export function Banner({ children, action, onAction }: { children: ReactNode; action: string; onAction: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-amber-300 px-3 py-1.5 text-amber-300">
      <span>{children}</span>
      <button className="ml-auto shrink-0 bg-amber-300 px-2 font-semibold text-black" onClick={onAction}>
        {action}
      </button>
    </div>
  )
}
