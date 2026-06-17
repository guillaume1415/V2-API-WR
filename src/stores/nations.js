import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiCompetitions, apiNationsRaces } from '@/services/api'
import { useAppStore } from '@/stores/app'
import i18n from '@/i18n'
import {
  assignRanks,
  computeMedals,
  hasLiveRaces,
  sortMedalRows,
} from '@/lib/nations'

const POLL_MS = 60_000

export const useNationsStore = defineStore('nations', () => {
  const app = useAppStore()

  const year = ref(new Date().getFullYear())
  const category = ref('World Rowing Championships')
  const searched = ref(false)
  const loading = ref(false)
  const error = ref(null)

  const competitions = ref([])
  const selectedComp = ref(null)
  const races = ref([])
  const lastUpdate = ref(null)

  const gender = ref('all')
  const includeLW = ref(true)
  const includeMix = ref(true)
  const includePara = ref(true)
  const olympicOnly = ref(false)

  const sortCol = ref('gold')
  const sortDir = ref('desc')

  let pollingTimer = null

  const filters = computed(() => ({
    gender: gender.value,
    includeLW: includeLW.value,
    includeMix: includeMix.value,
    includePara: includePara.value,
    olympicOnly: olympicOnly.value,
  }))

  const medalResult = computed(() => {
    if (!selectedComp.value || !races.value.length) {
      return { sorted: [], counted: 0 }
    }
    const { sorted, counted } = computeMedals(races.value, filters.value)
    const rows = sortMedalRows(sorted, sortCol.value, sortDir.value)
    assignRanks(rows, sortCol.value)
    return { sorted: rows, counted }
  })

  const hasLive = computed(() => hasLiveRaces(races.value))

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  function touchLastUpdate() {
    const locale = i18n.global.locale.value === 'fr' ? 'fr-FR' : 'en-GB'
    lastUpdate.value = new Date().toLocaleTimeString(locale)
    app.lastRefreshAt = Date.now()
  }

  async function loadRaces(compId) {
    races.value = await apiNationsRaces(compId)
    touchLastUpdate()
  }

  function startPolling(compId) {
    stopPolling()
    pollingTimer = setInterval(async () => {
      try {
        await loadRaces(compId)
      } catch {
        /* silencieux */
      }
    }, POLL_MS)
  }

  async function search() {
    searched.value = true
    loading.value = true
    error.value = null
    competitions.value = []
    selectedComp.value = null
    races.value = []
    stopPolling()

    try {
      competitions.value = await apiCompetitions(year.value, category.value)
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function selectComp(id) {
    const comp = competitions.value.find((c) => c.id === id)
    if (!comp) return

    selectedComp.value = comp
    races.value = []
    loading.value = true
    error.value = null
    stopPolling()

    try {
      await loadRaces(id)
      startPolling(id)
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function setSort(col) {
    if (sortCol.value === col) {
      sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortCol.value = col
      sortDir.value = col === 'nation' ? 'asc' : 'desc'
    }
  }

  function resetOnLeave() {
    stopPolling()
  }

  return {
    year,
    category,
    searched,
    loading,
    error,
    competitions,
    selectedComp,
    races,
    lastUpdate,
    gender,
    includeLW,
    includeMix,
    includePara,
    olympicOnly,
    sortCol,
    sortDir,
    filters,
    medalResult,
    hasLive,
    search,
    selectComp,
    setSort,
    resetOnLeave,
  }
})
