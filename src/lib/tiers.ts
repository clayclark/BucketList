import type { Cat } from './cats'

export type TierEntry = { id: string; playerId: number | null; name: string; tag: string | null }
export type Section = { id: string; name: string; note: string | null; entries: TierEntry[] }

export const DEFAULT_SHEET =
  'https://docs.google.com/spreadsheets/d/12sHhQrIJdpkuC4nhnA3wyLUKuXD3ZmqUld_S03ddItM/edit?usp=sharing'

export const sheetCsvUrl = (url: string) => {
  const id = url.match(/\/d\/([\w-]+)/)?.[1]
  if (!id) throw new Error('Not a Google Sheets URL')
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1]
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`
}

export const parseCsv = (text: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) rows.push([...row, cell])
  return rows
}

const SUFFIX = /\b(jr|sr|ii|iii|iv)\b/g
const normalize = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(SUFFIX, '')
    .replace(/[^a-z ]/g, ' ')
    .trim()
    .split(/\s+/)

/** Matches sheet names to ESPN players: exact first, then same last name with a nickname-style first name (Steph/Stephen). */
export const nameMatcher = (players: { id: number; name: string }[]) => {
  const exact = new Map<string, number>()
  const byLast = new Map<string, { first: string; id: number }[]>()
  for (const p of players) {
    const parts = normalize(p.name)
    exact.set(parts.join(''), p.id)
    const last = parts.slice(1).join('')
    byLast.set(last, [...(byLast.get(last) ?? []), { first: parts[0], id: p.id }])
  }
  return (name: string): number | null => {
    const parts = normalize(name)
    const hit = exact.get(parts.join(''))
    if (hit !== undefined) return hit
    const first = parts[0]
    const candidates = (byLast.get(parts.slice(1).join('')) ?? []).filter(
      (c) => c.first.startsWith(first) || first.startsWith(c.first),
    )
    return candidates.length === 1 ? candidates[0].id : null
  }
}

const isHeader = (cell: string) => /^(bucket|tier|flier|upside|health|spillage)\b/i.test(cell.trim())
const isNote = (cell: string) => /^[^a-z]+$/.test(cell) && /[A-Z]/.test(cell)

const splitTag = (cell: string) => {
  const m = cell.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
  return m ? { name: m[1], tag: m[2] } : { name: cell, tag: null }
}

/**
 * Reads a tier sheet laid out as blocks: a header row of section names, then players listed down each column.
 * Rows before the first header row (titles), number-only cells (running counts) and all-caps cells (notes) aren't players.
 */
export function parseTierSheet(csv: string, match: (name: string) => number | null): Section[] {
  const sections: Section[] = []
  let columns: (Section | null)[] = []
  for (const row of parseCsv(csv)) {
    if (row.some(isHeader)) {
      columns = row.map((cell) => {
        if (!cell.trim()) return null
        const section: Section = { id: crypto.randomUUID(), name: cell.trim(), note: null, entries: [] }
        sections.push(section)
        return section
      })
      continue
    }
    row.forEach((raw, col) => {
      const cell = raw.trim()
      const section = columns[col]
      if (!section || !cell || /^\d+$/.test(cell)) return
      if (isNote(cell)) {
        section.note = cell
        return
      }
      const { name, tag } = splitTag(cell)
      section.entries.push({ id: crypto.randomUUID(), playerId: match(name), name, tag })
    })
  }
  return sections
}

const TAG_CATS: Record<string, Cat> = { TO: 'to', FT: 'ft', FG: 'fg' }

/**
 * Sheet tags that make an entry conditional: "TO" or "FG or TO" mean "in this bucket if you punt that",
 * "No Punt" means "in this bucket if you don't". Returns whether the entry applies to your punts.
 * `twins` are the tags on the same player's other entries, which say what "No Punt" refers to.
 */
export function tagApplies(tag: string | null, punts: readonly Cat[], twins: (string | null)[]): boolean {
  if (!tag) return true
  if (/^no punt$/i.test(tag.trim())) return !twins.flatMap(tagCats).some((c) => punts.includes(c))
  const cats = tagCats(tag)
  return cats.length === 0 || cats.some((c) => punts.includes(c))
}

export const tagCats = (tag: string | null): Cat[] =>
  tag ? tag.split(/\s+or\s+/i).flatMap((part) => (TAG_CATS[part.trim().toUpperCase()] ? [TAG_CATS[part.trim().toUpperCase()]] : [])) : []

/** "35+" in the sheet: don't take before pick 35. */
export const minPick = (tag: string | null) => Number(tag?.match(/^(\d+)\+$/)?.[1]) || null

/**
 * Buckets back in the sheet's layout (header row of up to 8 bucket names, players down each column,
 * a blank row between blocks), so edits made here can be pasted back into the Google Sheet.
 */
export function sectionsToRows(sections: Section[], perRow = 8): string[][] {
  const rows: string[][] = []
  for (let i = 0; i < sections.length; i += perRow) {
    const block = sections.slice(i, i + perRow)
    const columns = block.map((s) => [...(s.note ? [s.note] : []), ...s.entries.map((e) => (e.tag ? `${e.name} (${e.tag})` : e.name))])
    rows.push(block.map((s) => s.name))
    const depth = Math.max(0, ...columns.map((c) => c.length))
    for (let r = 0; r < depth; r++) rows.push(columns.map((c) => c[r] ?? ''))
    rows.push([])
  }
  return rows
}

/** Short bucket names for tight spots: "Bucket 7" → "B7", "Health Bucket" → "Health", "Flier Tier 2" → "Flier 2". */
export const shortBucket = (name: string) =>
  name.replace(/^Bucket\s+/i, 'B').replace(/\s+Bucket$/i, '').replace(/^Upside\s+/i, '').replace(/\s+Tier\s+/i, ' ')
