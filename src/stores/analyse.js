import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { apiCompetitions, apiRaces } from '@/services/api'
import { fetchTrackerReplay } from '@/services/api/tracker'
import { getSelectedComp, setSelectedComp } from '@/services/storage'
import { sortClasses } from '@/lib/boatClass'
import { isOngoingComp } from '@/lib/schedule'
import {
  getBoatClassDisplayName,
  getLanes,
  getWbt,
  getWbtCode,
} from '@/lib/analyse/constants'
import { buildLaneSeries } from '@/lib/analyse/buildLaneSeries'
import {
  emptyCompareSlot,
  fetchCompareCompetitions,
  filterCompareRaces,
} from '@/lib/analyse/compare'
import { COMPETITION_CATEGORIES } from '@/lib/competitions'
import { exportAnalyseHtmlReport } from '@/lib/analyse/exportHtml'
import i18n from '@/i18n'

export const useAnalyseStore = defineStore('analyse', () => {
  const year = ref(new Date().getFullYear())
  const category = ref('World Rowing Cup')
  const searched = ref(false)
  const loadingComps = ref(false)
  const error = ref(null)
  const competitions = ref([])
  const selectedComp = ref(null)
  const races = ref([])
  const loadingRaces = ref(false)
  const classFilter = ref(null)
  const selectedRace = ref(null)
  const lastData = ref(null)
  const loadingTracker = ref(false)
  const apiStatus = ref('status_ready_analyse')

  const selectedLaneIds = ref([])
  const sizeByDps = ref(false)
  const smoothing = ref(2)
  const colorBy = ref('cadence')
  const rtsEnabled = ref(true)
  const rtsSigmaA = ref(0.25)
  const rtsRgps = ref(25)
  const rtsRgate = ref(0.25)
  const peakWindow = ref(100)

  const yScales = reactive({})
  const xScales = reactive({})
  const cScales = reactive({})
  const globalScales = reactive({
    speed: { min: null, max: null },
    cadence: { min: null, max: null },
  })

  const fullscreenCardId = ref(null)
  const compareMode = ref(false)
  const cmp = ref(emptyCompareSlot())
  const exportBusy = ref(false)

  const lanes = computed(() => getLanes(lastData.value))
  const totalLength = computed(() => lastData.value?.config?.plot?.totalLength || 2000)
  const boatClass = computed(() => getBoatClassDisplayName(lastData.value, selectedRace.value))
  const wbt = computed(() => getWbt(boatClass.value))
  const wbtCode = computed(() => getWbtCode(boatClass.value) || boatClass.value)

  const raceClasses = computed(() =>
    sortClasses([...new Set(races.value.map((r) => r.event?.boatClass?.DisplayName || 'Autre'))]),
  )

  const filteredRaces = computed(() => {
    if (!classFilter.value) return races.value
    return races.value.filter(
      (r) => (r.event?.boatClass?.DisplayName || 'Autre') === classFilter.value,
    )
  })

  const racesByDate = computed(() => {
    const byDate = {}
    for (const r of filteredRaces.value) {
      const d = (r.DateString || '').slice(0, 10) || '—'
      ;(byDate[d] = byDate[d] || []).push(r)
    }
    return byDate
  })

  const compareClassFilter = computed(() => {
    if (!compareMode.value || !lastData.value) return null
    return (
      selectedRace.value?.event?.boatClass?.DisplayName ||
      getBoatClassDisplayName(lastData.value) ||
      null
    )
  })

  const signalOptions = computed(() => ({
    rtsEnabled: rtsEnabled.value,
    rtsSigmaA: rtsSigmaA.value,
    rtsRgps: rtsRgps.value,
    rtsRgate: rtsRgate.value,
    smoothing: smoothing.value,
    peakWindow: peakWindow.value,
  }))

  function buildSeriesForData(data, laneIds, totalLen) {
    const laneList = getLanes(data)
    const selected = laneIds
      .map((id) => laneList.find((l) => l.id === id))
      .filter(Boolean)
    return selected
      .map((l) => buildLaneSeries(l, totalLen, signalOptions.value))
      .filter(Boolean)
  }

  const series = computed(() => {
    if (!lastData.value) return []
    let result = buildSeriesForData(lastData.value, selectedLaneIds.value, totalLength.value)
    if (compareMode.value && cmp.value.lastData) {
      const totalLen2 = cmp.value.lastData?.config?.plot?.totalLength || 2000
      const slot2 = buildSeriesForData(
        cmp.value.lastData,
        cmp.value.selectedLaneIds,
        totalLen2,
      ).map((s) => ({
        ...s,
        slot: 'B',
        lane: { ...s.lane, DisplayName: `${s.lane.DisplayName || '?'} (B)` },
      }))
      if (slot2.length) result = [...result, ...slot2]
    }
    return result
  })

  function initFromSavedComp() {
    const saved = getSelectedComp()
    if (!saved) return
    const y = parseInt(saved.year, 10)
    if (!isNaN(y)) year.value = y
    if (saved.category) category.value = saved.category
  }

  function sanitizeLaneSelection(data, laneIds) {
    const laneList = getLanes(data)
    const validIds = new Set(laneList.map((l) => l.id))
    let ids = (laneIds || []).filter((id) => validIds.has(id))
    if (!ids.length && laneList.length) {
      const leader =
        laneList.find((l) => l.currentPoint?.raceBoatTracker?.currentPosition === 1) ||
        laneList.find((l) => l.Rank === 1) ||
        laneList[0]
      if (leader) ids = [leader.id]
    }
    return ids
  }

  function resetScales() {
    for (const k of Object.keys(yScales)) delete yScales[k]
    for (const k of Object.keys(xScales)) delete xScales[k]
    for (const k of Object.keys(cScales)) delete cScales[k]
  }

  async function search() {
    loadingComps.value = true
    searched.value = true
    error.value = null
    competitions.value = []
    selectedComp.value = null
    selectedRace.value = null
    lastData.value = null
    selectedLaneIds.value = []
    resetScales()

    try {
      competitions.value = await apiCompetitions(year.value, category.value)
    } catch (e) {
      console.error(e)
      error.value = e.message || String(e)
      competitions.value = []
    } finally {
      loadingComps.value = false
    }

    if (competitions.value.length) {
      const saved = getSelectedComp()
      let target = null
      if (saved && saved.year === String(year.value) && saved.category === category.value) {
        target = competitions.value.find((c) => c.id === saved.id) || null
      }
      if (!target) target = competitions.value.find(isOngoingComp) || competitions.value[0]
      if (target) await selectComp(target.id)
    }
  }

  async function selectComp(id) {
    const comp = competitions.value.find((c) => c.id === id)
    if (!comp) return

    selectedComp.value = comp
    selectedRace.value = null
    lastData.value = null
    selectedLaneIds.value = []
    races.value = []
    loadingRaces.value = true
    classFilter.value = null
    resetScales()
    setSelectedComp({ id: comp.id, year: String(year.value), category: category.value })

    try {
      races.value = await apiRaces(id)
    } catch (e) {
      console.error(e)
      error.value = e.message || String(e)
      races.value = []
    } finally {
      loadingRaces.value = false
    }
  }

  function setClassFilter(c) {
    classFilter.value = c
  }

  function backToComps() {
    selectedComp.value = null
    selectedRace.value = null
    lastData.value = null
    selectedLaneIds.value = []
    races.value = []
    resetScales()
  }

  function backToRaces() {
    selectedRace.value = null
    lastData.value = null
    selectedLaneIds.value = []
    resetScales()
  }

  async function selectRace(id) {
    const race = races.value.find((r) => r.id === id)
    if (!race) return

    selectedRace.value = race
    lastData.value = null
    selectedLaneIds.value = []
    loadingTracker.value = true
    delete yScales.speed

    try {
      lastData.value = await fetchTrackerReplay(id)
      selectedLaneIds.value = sanitizeLaneSelection(lastData.value, [])
      apiStatus.value = 'ok'
    } catch (e) {
      console.error(e)
      error.value = e.message || String(e)
      apiStatus.value = `erreur: ${e.message}`
    } finally {
      loadingTracker.value = false
    }
  }

  function toggleLane(laneId) {
    const ids = selectedLaneIds.value.slice()
    const idx = ids.indexOf(laneId)
    if (idx >= 0) ids.splice(idx, 1)
    else ids.push(laneId)
    if (!ids.length) return
    selectedLaneIds.value = ids
  }

  function selectAllLanes() {
    if (!lastData.value) return
    selectedLaneIds.value = getLanes(lastData.value)
      .map((l) => l.id)
      .filter(Boolean)
  }

  function deselectAllLanes() {
    if (!lastData.value) return
    selectedLaneIds.value = sanitizeLaneSelection(lastData.value, [])
  }

  function setYScale(plotId, which, val) {
    const cur = yScales[plotId] || {}
    yScales[plotId] = { ...cur, [which]: val }
  }

  function resetYScale(plotId) {
    delete yScales[plotId]
  }

  function setCScale(plotId, which, val) {
    const cur = cScales[plotId] || {}
    cScales[plotId] = { ...cur, [which]: val }
  }

  function resetCScale(plotId) {
    delete cScales[plotId]
  }

  function toggleFullscreen(cardId) {
    fullscreenCardId.value = fullscreenCardId.value === cardId ? null : cardId
  }

  function syncCmpFromRaceA() {
    cmp.value = emptyCompareSlot({
      year: year.value,
      category: category.value,
      searched: !!selectedComp.value,
      competitions: competitions.value.length ? [...competitions.value] : [],
      selectedComp: selectedComp.value,
      races: filterCompareRaces(races.value, compareClassFilter.value, selectedRace.value?.id),
    })
  }

  function toggleCompareMode() {
    compareMode.value = !compareMode.value
    if (compareMode.value) syncCmpFromRaceA()
    else cmp.value = emptyCompareSlot()
  }

  async function cmpSearch() {
    const slot = cmp.value
    slot.loadingComps = true
    slot.competitions = []
    slot.selectedComp = null
    slot.selectedRace = null
    slot.lastData = null
    slot.selectedLaneIds = []
    try {
      slot.competitions = await fetchCompareCompetitions(slot.year, slot.category)
    } catch (e) {
      console.error(e)
    } finally {
      slot.loadingComps = false
    }
  }

  async function cmpSelectComp(id) {
    const slot = cmp.value
    const comp = slot.competitions.find((c) => c.id === id)
    if (!comp) return
    slot.selectedComp = comp
    slot.races = []
    slot.loadingRaces = true
    slot.selectedRace = null
    slot.lastData = null
    slot.selectedLaneIds = []
    try {
      const allRaces = await apiRaces(id)
      slot.races = filterCompareRaces(allRaces, compareClassFilter.value, selectedRace.value?.id)
    } catch (e) {
      console.error(e)
    } finally {
      slot.loadingRaces = false
    }
  }

  async function cmpSelectRace(id) {
    const slot = cmp.value
    const race = slot.races.find((r) => r.id === id)
    if (!race) return
    slot.selectedRace = race
    slot.lastData = null
    slot.selectedLaneIds = []
    slot.loadingRaces = true
    try {
      slot.lastData = await fetchTrackerReplay(id)
      slot.selectedLaneIds = getLanes(slot.lastData)
        .map((l) => l.id)
        .filter(Boolean)
    } catch (e) {
      console.error(e)
    } finally {
      slot.loadingRaces = false
    }
  }

  function cmpReset() {
    cmp.value = emptyCompareSlot({
      year: year.value,
      category: category.value,
      searched: !!selectedComp.value,
      competitions: competitions.value.length ? [...competitions.value] : [],
      selectedComp: selectedComp.value,
      races: filterCompareRaces(races.value, compareClassFilter.value, selectedRace.value?.id),
    })
  }

  function cmpToggleLane(laneId) {
    const ids = cmp.value.selectedLaneIds.slice()
    const idx = ids.indexOf(laneId)
    if (idx >= 0) ids.splice(idx, 1)
    else ids.push(laneId)
    if (!ids.length) return
    cmp.value.selectedLaneIds = ids
  }

  function cmpSelectAllLanes() {
    if (!cmp.value.lastData) return
    cmp.value.selectedLaneIds = getLanes(cmp.value.lastData)
      .map((l) => l.id)
      .filter(Boolean)
  }

  function cmpDeselectAllLanes() {
    if (!cmp.value.lastData) return
    cmp.value.selectedLaneIds = sanitizeLaneSelection(cmp.value.lastData, [])
  }

  async function exportHtmlReport() {
    const t = i18n.global.t
    if (!lastData.value?.config) {
      alert(t('export_analyse_no_data'))
      return
    }
    if (compareMode.value && !cmp.value.lastData) {
      alert(t('export_compare_need_b'))
      return
    }
    exportBusy.value = true
    if (fullscreenCardId.value) fullscreenCardId.value = null
    try {
      const result = exportAnalyseHtmlReport({
        t,
        locale: i18n.global.locale.value,
        lastData: lastData.value,
        selectedRace: selectedRace.value,
        selectedComp: selectedComp.value,
        selectedLaneIds: selectedLaneIds.value,
        compareMode: compareMode.value,
        cmp: cmp.value,
        series: series.value,
        totalLength: totalLength.value,
        boatClass: boatClass.value,
        yScales,
        cScales,
        globalScales,
        colorBy: colorBy.value,
        sizeByDps: sizeByDps.value,
      })
      if (!result.ok) alert(t('export_analyse_no_data'))
    } catch (e) {
      console.error(e)
      alert(t('export_analyse_no_data'))
    } finally {
      exportBusy.value = false
    }
  }

  return {
    categories: COMPETITION_CATEGORIES,
    year,
    category,
    searched,
    loadingComps,
    error,
    competitions,
    selectedComp,
    races,
    loadingRaces,
    classFilter,
    selectedRace,
    lastData,
    loadingTracker,
    apiStatus,
    selectedLaneIds,
    sizeByDps,
    smoothing,
    colorBy,
    rtsEnabled,
    rtsSigmaA,
    rtsRgps,
    rtsRgate,
    peakWindow,
    yScales,
    xScales,
    cScales,
    globalScales,
    fullscreenCardId,
    compareMode,
    cmp,
    exportBusy,
    lanes,
    totalLength,
    boatClass,
    wbt,
    wbtCode,
    raceClasses,
    filteredRaces,
    racesByDate,
    compareClassFilter,
    series,
    initFromSavedComp,
    search,
    selectComp,
    setClassFilter,
    backToComps,
    backToRaces,
    selectRace,
    toggleLane,
    selectAllLanes,
    deselectAllLanes,
    setYScale,
    resetYScale,
    setCScale,
    resetCScale,
    toggleFullscreen,
    toggleCompareMode,
    cmpSearch,
    cmpSelectComp,
    cmpSelectRace,
    cmpReset,
    cmpToggleLane,
    cmpSelectAllLanes,
    cmpDeselectAllLanes,
    exportHtmlReport,
  }
})
