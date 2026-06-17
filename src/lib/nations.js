export const OLYMPIC_CLASSES = new Set([
  'M1x', 'W1x', 'M2x', 'W2x', 'M2-', 'W2-', 'M4x', 'W4x', 'M4-', 'W4-', 'M8+', 'W8+',
  "Men's Single Sculls", "Women's Single Sculls",
  "Men's Double Sculls", "Women's Double Sculls",
  "Men's Pair", "Women's Pair",
  "Men's Quadruple Sculls", "Women's Quadruple Sculls",
  "Men's Four", "Women's Four",
  "Men's Eight", "Women's Eight",
])

export const NATIONS_CATEGORIES = [
  'World Rowing Cup',
  'World Rowing Championships',
  'Olympic Games',
  'Paralympic Games',
  'World Rowing Under 23 Championships',
  'World Rowing Junior Championships',
]

export function racePhaseName(race) {
  const p = race?.racePhase
  return (typeof p === 'object' ? p?.DisplayName : p) || race?.DisplayName || ''
}

export function raceStatusName(race) {
  const s = race?.raceStatus
  return (typeof s === 'object' ? s?.DisplayName : s) || ''
}

export function isMedalFinalRace(race) {
  const name = String(race?.DisplayName || '').trim()
  const phase = racePhaseName(race)
  if (/semi\s*final|quarter\s*final|prelimin|heat|repechage/i.test(name)) return false
  if (/\bfinal\s+[b-e]\b/i.test(name)) return false
  if (/\bfinal\s+a\b/i.test(name)) return true
  if (/\bfinal\s*$/i.test(name)) return true
  if (/^final$/i.test(phase) && name && !/\bfinal\s+[b-e]\b/i.test(name)) return true
  return false
}

export function classMatchesFilter(boatClass, filters) {
  const code = String(boatClass || '').trim()

  const { gender } = filters
  if (gender !== 'all') {
    const isMen = /^(M|LM|PR\d?M)/i.test(code) || /^men/i.test(code)
    const isWomen = /^(W|LW|PR\d?W)/i.test(code) || /^women/i.test(code)
    if (gender === 'M' && !isMen) return false
    if (gender === 'W' && !isWomen) return false
  }

  if (!filters.includeLW) {
    if (/^(LM|LW)/i.test(code) || /lightweight/i.test(code)) return false
  }
  if (!filters.includeMix) {
    if (/^mix/i.test(code) || /mix/i.test(code)) return false
  }
  if (!filters.includePara) {
    if (/^PR/i.test(code) || /para/i.test(code)) return false
  }
  if (filters.olympicOnly) {
    if (!OLYMPIC_CLASSES.has(code)) return false
  }

  return true
}

export function nationKeyFromBoat(boat) {
  const code = boat?.country?.CountryCode
  if (code) return String(code).trim().toUpperCase()
  const name = String(boat?.DisplayName || '').trim()
  const m = name.match(/^([A-Z]{3})\s*\d*$/i)
  return m ? m[1].toUpperCase() : name
}

export { getFlagEmoji } from '@/lib/flags'

export function computeMedals(races, filters) {
  const medals = {}
  let counted = 0

  for (const race of races) {
    const cls = race.event?.boatClass?.DisplayName || ''
    const status = raceStatusName(race)
    const isFinalA = isMedalFinalRace(race)
    const isOfficial = /official|finished|live/i.test(status)
    if (!isFinalA || !isOfficial) continue
    if (!classMatchesFilter(cls, filters)) continue

    const boats = race.raceBoats || []
    for (const boat of boats) {
      const rank = Number(boat.Rank)
      if (!Number.isFinite(rank) || rank < 1 || rank > 3) continue
      const nation = nationKeyFromBoat(boat)
      if (!nation) continue
      if (!medals[nation]) {
        medals[nation] = { nation, gold: 0, silver: 0, bronze: 0, total: 0, events: [] }
      }
      if (rank === 1) medals[nation].gold++
      else if (rank === 2) medals[nation].silver++
      else if (rank === 3) medals[nation].bronze++
      medals[nation].total++
      medals[nation].events.push({ cls, rank, raceName: race.DisplayName })
      counted++
    }
  }

  const sorted = Object.values(medals).sort(
    (a, b) =>
      b.gold - a.gold
      || b.silver - a.silver
      || b.bronze - a.bronze
      || a.nation.localeCompare(b.nation),
  )

  return { sorted, counted: Math.round(counted / 3) }
}

export function getSortKey(row, col) {
  if (col === 'nation') return String(row.nation || '').toLowerCase()
  if (col === 'events') return row.events.length
  return row[col] ?? 0
}

export function sortMedalRows(rows, col, dir) {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const ka = getSortKey(a, col)
    const kb = getSortKey(b, col)
    if (col === 'nation') return mul * ka.localeCompare(kb)
    if (ka !== kb) return mul * (ka - kb)
    return (
      b.gold - a.gold
      || b.silver - a.silver
      || b.bronze - a.bronze
      || String(a.nation).localeCompare(String(b.nation))
    )
  })
}

export function assignRanks(rows, sortCol) {
  let rank = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const prev = rows[i - 1]
    const same = prev && (
      sortCol === 'gold'
        ? prev.gold === row.gold && prev.silver === row.silver && prev.bronze === row.bronze
        : getSortKey(prev, sortCol) === getSortKey(row, sortCol)
    )
    if (!same) rank = i + 1
    row._rankTxt = same ? '=' : String(rank)
  }
  return rows
}

export function formatEventsList(events) {
  const medals = ['🥇', '🥈', '🥉']
  const cls = ['ev-gold', 'ev-silver', 'ev-bronze']
  return [...events]
    .sort((a, b) => a.rank - b.rank || String(a.cls).localeCompare(String(b.cls)))
    .map((e) => ({ cls: e.cls, medal: medals[e.rank - 1] || '', className: cls[e.rank - 1] || '' }))
}

export function hasLiveRaces(races) {
  return races.some((r) => /live/i.test(raceStatusName(r)))
}
