import type { ReactNode } from 'react'
import { rankStyle } from '../format'
import { CAT_LABEL, CATS, type CatLine } from '../lib/cats'
import { Avail, Fingerprint } from '../ui'

const SAMPLE: CatLine = { fg: -0.7, ft: 0.3, tpm: 0.3, reb: -0.2, ast: 2.8, stl: 1.0, blk: 0.1, to: -2.4, pts: 1.3 }

const Line = ({ sample, children }: { sample: ReactNode; children: ReactNode }) => (
  <div className="flex items-baseline gap-3 py-1">
    <span className="flex w-28 shrink-0 items-center justify-end gap-1.5 text-right">{sample}</span>
    <span className="text-zinc-400">{children}</span>
  </div>
)

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2 className="border-b border-zinc-800 pb-0.5 font-semibold text-zinc-100">{title}</h2>
    {children}
  </section>
)

const Bar = ({ color }: { color: string }) => <span className="inline-block h-4 w-1 rounded-sm" style={{ backgroundColor: color }} />

/** What every color and number means, with the real samples. */
export function Key() {
  return (
    <div className="max-w-xl space-y-4 p-3">
      <Group title="Category strip">
        <Line
          sample={
            <span className="flex gap-px">
              {[2, 5, 9].map((r) => (
                <span key={r} className="w-6 text-center text-xs font-semibold text-zinc-100" style={rankStyle(r, 10)}>
                  {r}
                </span>
              ))}
            </span>
          }
        >
          Your rank in each category, 1 is best. Open roster spots count as average late picks.
        </Line>
        <Line sample={<span className="text-xs font-semibold text-zinc-100">3<span className="text-[10px] text-emerald-300">↑2</span></span>}>
          What the hovered or selected player would do to that rank.
        </Line>
      </Group>

      <Group title="Player rows">
        <Line sample={<Fingerprint z={SAMPLE} punts={[]} />}>
          His 9 categories in strip order ({CATS.map((c) => CAT_LABEL[c]).join(' ')}). Green helps, red hurts, faded is punted.
        </Line>
        <Line sample={<span className="text-zinc-300">4.1</span>}>Val: his total across your non-punted categories. Same for every team.</Line>
        <Line sample={<span className="font-semibold text-amber-300">+0.43</span>}>
          Fit: about 0.4 more categories won per week if you add him to your roster. Amber is your top 3.
        </Line>
        <Line
          sample={
            <>
              <Avail p={0.2} /> <Avail p={0.55} /> <Avail p={0.9} />
            </>
          }
        >
          Chance he's still there at your next pick.
        </Line>
        <Line sample={<span className="text-[11px] text-emerald-500">can wait</span>}>Likely back at your next pick, in a bucket you're choosing from.</Line>
        <Line sample={<span className="text-[11px] text-rose-400">no slot</span>}>Fills none of the starting slots you still need, with few picks left.</Line>
      </Group>

      <Group title="Buckets">
        <Line sample={<span className="text-amber-300">≈2 left at #15</span>}>How many should still be there at your next pick.</Line>
        <Line sample={<span className="font-semibold text-rose-400">take one now</span>}>The highest bucket that won't last to your pick. Only near your turn.</Line>
        <Line sample={<span className="text-[11px] text-amber-300">TO</span>}>Sheet tag that matches your punt. Blue tags are other sheet notes.</Line>
        <Line sample={<span className="text-zinc-100 opacity-40">Cade Cunningham</span>}>Listed for a punt you aren't running. Not counted in "left".</Line>
        <Line
          sample={
            <>
              <span className="text-[11px] text-zinc-600">30+</span> <span className="text-[11px] text-emerald-400">30+</span>
            </>
          }
        >
          Not before that pick; turns green once the draft gets there.
        </Line>
      </Group>

      <Group title="In ESPN's draft room">
        <Line
          sample={
            <>
              <Bar color="#f43f5e" /> <Bar color="#10b981" /> <Bar color="#38bdf8" /> <Bar color="#d4d4d8" />
            </>
          }
        >
          Take now, can wait, in your buckets, not for your punts.
        </Line>
        <Line sample={<span className="text-zinc-300">B6</span>}>Bucket code under ESPN's rank.</Line>
        <Line sample={<span className="text-zinc-300">4.0 +.55 49%</span>}>Value, fit, and chance he's back (shown under 95%). Hover a row for his categories.</Line>
      </Group>
    </div>
  )
}
