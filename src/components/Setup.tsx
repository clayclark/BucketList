import { useState, type ReactNode } from 'react'
import { input, textBtn } from '../format'
import { importSheet } from '../lib/importSheet'
import { useModel } from '../model'
import { useDraft } from '../store'

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex min-h-6 items-center gap-3">
    <span className="w-24 shrink-0 text-zinc-500">{label}</span>
    {children}
  </label>
)

const Toggle = ({ on, onClick, labels }: { on: boolean; onClick: (v: boolean) => void; labels: [string, string] }) => (
  <span className="flex gap-3">
    <button className={on ? 'text-zinc-100' : textBtn} onClick={() => onClick(true)}>
      {labels[0]}
    </button>
    <button className={!on ? 'text-zinc-100' : textBtn} onClick={() => onClick(false)}>
      {labels[1]}
    </button>
  </span>
)

export function Setup() {
  const s = useDraft()
  const { players } = useModel()
  const [sheetStatus, setSheetStatus] = useState('')
  const unmatched = s.sections.flatMap((x) => x.entries).filter((e) => e.playerId === null).length
  const synced = s.espn.sync

  const reimport = async () => {
    if (!players.data) return
    if (s.sections.length && !confirm('Replace your tiers (and any edits) with the sheet?')) return
    setSheetStatus('Importing…')
    try {
      s.setSections(await importSheet(s.sheetUrl, players.data))
      setSheetStatus('Imported')
    } catch (e) {
      setSheetStatus(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="max-w-xl space-y-5 p-3">
      <section className="space-y-1">
        <h2 className="font-semibold text-zinc-100">ESPN</h2>
        <Row label="League ID">
          <input value={s.espn.leagueId} className={`${input} w-28`} onChange={(e) => s.set({ espn: { ...s.espn, leagueId: e.target.value.trim() } })} />
        </Row>
        <Row label="Picks">
          <Toggle on={synced} onClick={(sync) => s.set({ espn: { ...s.espn, sync } })} labels={['Sync from ESPN', 'Enter manually']} />
        </Row>
        <Row label="My team">
          <select value={s.mySlot} className={input} onChange={(e) => s.set({ mySlot: Number(e.target.value) })}>
            {s.teamNames.map((name, i) => (
              <option key={i} value={i}>
                {i + 1}. {name}
              </option>
            ))}
          </select>
        </Row>
        {!synced && (
          <>
            <Row label="Teams">
              <input type="number" min={2} max={20} value={s.teamCount} className={`${input} w-16`}
                onChange={(e) => s.setTeamCount(Math.max(2, Number(e.target.value)))} />
            </Row>
            <Row label="Roster size">
              <input type="number" min={1} max={20} value={s.rosterSize} className={`${input} w-16`}
                onChange={(e) => s.set({ rosterSize: Math.max(1, Number(e.target.value)) })} />
            </Row>
          </>
        )}
      </section>

      <section className="space-y-1">
        <h2 className="font-semibold text-zinc-100">Values</h2>
        <Row label="Stats">
          <Toggle on={s.basis === 'proj'} onClick={(proj) => s.set({ basis: proj ? 'proj' : 'last' })} labels={['ESPN projections', 'Last season']} />
        </Row>
        <Row label="Scale">
          <Toggle on={!s.totals} onClick={(perGame) => s.set({ totals: !perGame })} labels={['Per game', 'Season totals']} />
        </Row>
      </section>

      <section className="space-y-1">
        <h2 className="font-semibold text-zinc-100">Tier sheet</h2>
        <Row label="Google Sheet">
          <input value={s.sheetUrl} className={`${input} min-w-0 flex-1`} onChange={(e) => s.set({ sheetUrl: e.target.value })} />
        </Row>
        <Row label="">
          <button className="text-amber-300 hover:text-amber-200" onClick={reimport}>
            Re-import
          </button>
          <span className="text-zinc-500">{sheetStatus}</span>
          {unmatched > 0 && <span className="text-rose-400">{unmatched} unmatched</span>}
        </Row>
      </section>

      {!synced && (
        <section className="space-y-1">
          <h2 className="font-semibold text-zinc-100">Draft</h2>
          <button
            className="text-rose-400 hover:text-rose-300 disabled:text-zinc-700"
            disabled={!s.picks.some((p) => !p.keeper)}
            onClick={() => confirm('Clear all picks?') && s.set({ picks: s.picks.filter((p) => p.keeper) })}
          >
            Reset picks
          </button>
        </section>
      )}
    </div>
  )
}
