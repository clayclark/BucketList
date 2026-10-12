import { describe, expect, it } from 'vitest'
import { bucketCode, entryRange, nameMatcher, pickRange, parseTierSheet, sectionsToRows, sheetCsvUrl, shortBucket } from './tiers'

const players = [
  { id: 1, name: 'Stephen Curry' },
  { id: 2, name: 'Jaren Jackson Jr.' },
  { id: 3, name: "Kel'el Ware" },
  { id: 4, name: 'Cade Cunningham' },
  { id: 5, name: 'Seth Curry' },
  { id: 6, name: 'Nikola Jokić' },
]
const match = nameMatcher(players)

describe('nameMatcher', () => {
  it('matches across punctuation, suffixes, accents and nicknames', () => {
    expect(match('Jaren Jackson Jr')).toBe(2)
    expect(match('Kelel Ware')).toBe(3)
    expect(match('Nikola Jokic')).toBe(6)
    expect(match('Steph Curry')).toBe(1)
  })

  it('refuses ambiguous or unknown names', () => {
    expect(match('S Curry')).toBeNull()
    expect(match('Nobody Atall')).toBeNull()
  })
})

describe('parseTierSheet', () => {
  const csv = [
    'My Draft Buckets,,',
    'Bucket 1,Bucket 2,Upside Fliers',
    'Cade Cunningham (TO),Steph Curry (FG or TO) (34+),IN ORDER OF PREFERENCE!',
    ',Nobody Atall,Kel\'el Ware',
    ',,12',
    'Bucket 3,,',
    'Jaren Jackson Jr,,',
  ].join('\n')

  it('reads header blocks into ordered sections with tags, notes and unmatched names', () => {
    const sections = parseTierSheet(csv, match)
    expect(sections.map((s) => s.name)).toEqual(['Bucket 1', 'Bucket 2', 'Upside Fliers', 'Bucket 3'])
    expect(sections[0].entries).toMatchObject([{ playerId: 4, name: 'Cade Cunningham', tag: 'TO' }])
    expect(sections[1].entries).toMatchObject([{ playerId: 1, name: 'Steph Curry', tag: 'FG or TO, 34+' }, { playerId: null }])
    expect(sections[2]).toMatchObject({ note: 'IN ORDER OF PREFERENCE!', entries: [{ playerId: 3 }] })
    expect(sections[3].entries).toHaveLength(1)
  })
})

it('builds the CSV export url from a share link', () => {
  expect(sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc-1_x/edit?usp=sharing')).toBe(
    'https://docs.google.com/spreadsheets/d/abc-1_x/export?format=csv',
  )
  expect(sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=42')).toContain('&gid=42')
})

describe('pick ranges', () => {
  it('reads ranges and thresholds from tags', () => {
    expect(pickRange('40-55')).toEqual({ from: 40, to: 55 })
    expect(pickRange('FG or TO, 34+')).toEqual({ from: 34, to: null })
    expect(pickRange('TO')).toBeNull()
  })

  it('falls back to the bucket header range', () => {
    const [fliers] = parseTierSheet(['Upside Fliers (~100+)', 'Cade Cunningham', 'Steph Curry (85-100)'].join('\n'), match)
    expect(fliers.entries.map((e) => entryRange(fliers, e))).toEqual([{ from: 100, to: null }, { from: 85, to: 100 }])
  })
})

it('writes buckets back in the sheet layout so they re-import unchanged', () => {
  const sections = parseTierSheet(
    ['Bucket 1,Upside Fliers', 'Cade Cunningham (TO),IN ORDER OF PREFERENCE!', 'Steph Curry,Kelel Ware'].join('\n'),
    match,
  )
  const csv = sectionsToRows(sections).map((r) => r.join(',')).join('\n')
  const strip = (s: typeof sections) => s.map(({ name, note, entries }) => ({ name, note, entries: entries.map(({ name, tag, playerId }) => ({ name, tag, playerId })) }))
  expect(strip(parseTierSheet(csv, match))).toEqual(strip(sections))
})

it('shortens bucket names for the draft room badges', () => {
  expect(['Bucket 7', 'Health Bucket', 'Upside Fliers', 'Flier Tier 2', 'Spillage'].map(shortBucket)).toEqual(['B7', 'Health', 'Fliers', 'Flier 2', 'Spillage'])
  expect(shortBucket('Upside Fliers (~100+)')).toBe('Fliers')
})

it('codes bucket names tightly enough to fit ESPN rows', () => {
  expect(['Bucket 12', 'Health Bucket', 'Upside Fliers', 'Flier Tier 2', 'Spillage'].map(bucketCode)).toEqual(['B12', 'H', 'UF', 'F2', 'S'])
  expect(bucketCode('Upside Fliers (~100+)')).toBe('UF')
})
