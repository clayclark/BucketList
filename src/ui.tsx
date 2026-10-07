export function Avail({ p }: { p: number | null }) {
  if (p === null) return <span className="text-zinc-700">-</span>
  const color = p < 0.3 ? 'text-rose-400' : p < 0.7 ? 'text-amber-300' : 'text-zinc-500'
  return <span className={color}>{Math.round(p * 100)}%</span>
}

const INJURY: Record<string, string> = { OUT: 'O', DAY_TO_DAY: 'DTD', INJURY_RESERVE: 'IR', SUSPENSION: 'SUS' }

export function Injury({ status }: { status: string | null }) {
  if (!status) return null
  return <span className="ml-1 text-[10px] font-semibold text-rose-400">{INJURY[status] ?? status}</span>
}
