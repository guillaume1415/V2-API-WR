import { apiCompetitions } from '@/services/api'

export const COMPARE_CATEGORIES = [
  { value: 'World Rowing Cup' },
  { value: 'World Rowing Championships' },
  { value: 'World Rowing Under 19 Championships' },
  { value: 'World Rowing Under 23 Championships' },
  { value: 'Olympics' },
  { value: 'Paralympics' },
  {
    value: 'European Rowing Championships',
    apiCategory: 'Continental Championships',
    europeanOnly: true,
  },
  { value: 'Continental Championships' },
  { value: 'International Regattas' },
]

export function getCompareCategoryDef(category) {
  return COMPARE_CATEGORIES.find((c) => c.value === category) || { value: category, apiCategory: category }
}

export function getCompareCategoryLabel(category) {
  return getCompareCategoryDef(category).value || category
}

export async function fetchCompareCompetitions(year, category) {
  const def = getCompareCategoryDef(category)
  let comps = await apiCompetitions(year, def.apiCategory || def.value)
  if (def.europeanOnly) {
    comps = comps.filter((c) => {
      const n = c.DisplayName || c.CompetitionCode || ''
      return /European Rowing Championships/i.test(n) && !/Under|Indoor|U19|U23|Junior/i.test(n)
    })
  }
  return comps
}

export function filterCompareRaces(races, classFilter, raceAId) {
  return (races || []).filter((r) => {
    if (classFilter && (r.event?.boatClass?.DisplayName || '') !== classFilter) return false
    if (raceAId && r.id === raceAId) return false
    return true
  })
}

export function emptyCompareSlot(overrides = {}) {
  return {
    year: new Date().getFullYear(),
    category: 'World Rowing Cup',
    searched: false,
    loadingComps: false,
    competitions: [],
    selectedComp: null,
    races: [],
    loadingRaces: false,
    selectedRace: null,
    lastData: null,
    selectedLaneIds: [],
    ...overrides,
  }
}
