import { describe, expect, it } from 'vitest'
import { minPick, nameMatcher, parseTierSheet, sectionsToRows, sheetCsvUrl, shortBucket, tagApplies } from './tiers'

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
    'Cade Cunningham (TO),Steph Curry,IN ORDER OF PREFERENCE!',
    ',Nobody Atall,Kel\'el Ware',
    ',,12',
    'Bucket 3,,',
    'Jaren Jackson Jr,,',
  ].join('\n')

  it('reads header blocks into ordered sections with tags, notes and unmatched names', () => {
    const sections = parseTierSheet(csv, match)
    expect(sections.map((s) => s.name)).toEqual(['Bucket 1', 'Bucket 2', 'Upside Fliers', 'Bucket 3'])
    expect(sections[0].entries).toMatchObject([{ playerId: 4, name: 'Cade Cunningham', tag: 'TO' }])
    expect(sections[1].entries.map((e) => e.playerId)).toEqual([1, null])
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

describe('sheet tags', () => {
  it('applies punt entries only when you punt that category', () => {
    expect(tagApplies('TO', ['to'], ['No Punt'])).toBe(true)
    expect(tagApplies('TO', [], ['No Punt'])).toBe(false)
    expect(tagApplies('FG or TO', ['fg'], [])).toBe(true)
  })

  it('applies No Punt entries only when you skip the punt their twin needs', () => {
    expect(tagApplies('No Punt', [], ['TO'])).toBe(true)
    expect(tagApplies('No Punt', ['to'], ['TO'])).toBe(false)
    expect(tagApplies('No Punt', ['ft'], ['TO'])).toBe(true)
  })

  it('ignores tags that are not about punts', () => {
    expect(tagApplies('35+', ['to'], [])).toBe(true)
    expect(tagApplies('IL', [], [])).toBe(true)
    expect(minPick('35+')).toBe(35)
    expect(minPick('IL')).toBeNull()
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
})
