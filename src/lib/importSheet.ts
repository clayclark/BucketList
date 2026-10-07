import type { Player } from './espn'
import { nameMatcher, parseTierSheet, sheetCsvUrl } from './tiers'

export async function importSheet(url: string, players: Player[]) {
  const res = await fetch(sheetCsvUrl(url))
  if (!res.ok) throw new Error(`Sheet ${res.status}: is it shared as "anyone with the link"?`)
  return parseTierSheet(await res.text(), nameMatcher(players))
}
