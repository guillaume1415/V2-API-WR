import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw } from 'vue'
import { apiCompetitions, apiRaces, fetchTracker } from '@/services/api'
import { getSelectedComp, setSelectedComp } from '@/services/storage'
import { useAppStore } from '@/stores/app'
import { sortClasses } from '@/lib/boatClass'
import { isOngoingComp } from '@/lib/schedule'
import { exportLiveCsv } from '@/lib/liveExport'
import {
  buildSimTimeline,
  canSimulate,
  sliceTrackerSnapshot,
} from '@/lib/liveSimulate'
import { rankedLanes, sortedLanes } from '@/lib/lanes'
import i18n from '@/i18n'

const SIM_BASE_MS = 500
const SIM_SPEEDS = [1, 2, 5]

let simTimer = null

export const useLiveStore = defineStore('live', () => {
  const app = useAppStore()

  const year = ref(new Date().getFullYear())
  const category = ref('World Rowing Cup')
  const competitions = ref([])
  const loadingComps = ref(false)
  const searched = ref(false)
  const error = ref(null)

  const selectedComp = ref(null)
  const races = ref([])
  const loadingRaces = ref(false)
  const classFilter = ref(null)

  const selectedRace = ref(null)
  const trackerData = ref(null)
  const loadingTracker = ref(false)
  const currentTrackerType = ref('Replay')
  const lastUpdate = ref(null)
  const lastError = ref(null)

  const hiddenLanes = reactive(new Set())
  const expandedChart = ref(null)
  const xZoom = ref(null)
  const yScales = reactive({})

  const replaySnapshot = ref(null)
  const simActive = ref(false)
  const simPlaying = ref(false)
  const simStep = ref(0)
  const simTimeline = ref([])
  const simSpeed = ref(1)

  const displayTrackerData = computed(() => {
    if (!simActive.value || !replaySnapshot.value) return trackerData.value
    const tc = simTimeline.value[simStep.value]
    if (tc == null) return trackerData.value
    return sliceTrackerSnapshot(replaySnapshot.value, tc)
  })

  const trackerConfig = computed(() => displayTrackerData.value?.config || null)
  const lanes = computed(() => sortedLanes(trackerConfig.value?.lanes || []))
  const ranked = computed(() => rankedLanes(lanes.value))
  const totalLength = computed(() => trackerConfig.value?.plot?.totalLength || 2000)

  const raceClasses = computed(() =>
    sortClasses([...new Set(races.value.map((r) => r.event?.boatClass?.DisplayName || '—'))]),
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

  const isLiveTracker = computed(() => currentTrackerType.value === 'Live')

  function isRaceLiveFromList() {
    return /live/i.test(selectedRace.value?.raceStatus?.DisplayName || '')
  }

  const showCharts = computed(() => {
    if (!trackerConfig.value) return false
    if (simActive.value) return true
    if (isLiveTracker.value) return false
    return (trackerConfig.value.lanes || []).some((l) => (l.live || []).length > 0)
  })

  const canStartSim = computed(
    () =>
      !isLiveTracker.value &&
      !isRaceLiveFromList() &&
      !simActive.value &&
      canSimulate(trackerData.value),
  )

  const simMaxStep = computed(() => Math.max(0, simTimeline.value.length - 1))

  const statusLabel = computed(() => {
    if (!selectedRace.value) return 'status_ready'
    if (lastError.value) return 'status_error'
    if (simActive.value) return 'status_sim'
    return isLiveTracker.value ? 'status_live' : 'status_replay'
  })

  function clearSimTimer() {
    if (simTimer) {
      clearInterval(simTimer)
      simTimer = null
    }
  }

  function stopSim() {
    simPlaying.value = false
    clearSimTimer()
    simActive.value = false
    simStep.value = 0
    simTimeline.value = []
    replaySnapshot.value = null
  }

  function initFromSavedComp() {
    const saved = getSelectedComp()
    if (!saved) return
    const y = parseInt(saved.year, 10)
    if (!isNaN(y)) year.value = y
    if (saved.category) category.value = saved.category
  }

  function resetChartState() {
    hiddenLanes.clear()
    expandedChart.value = null
    xZoom.value = null
    for (const k of Object.keys(yScales)) delete yScales[k]
  }

  function resetRaceState() {
    stopSim()
    selectedRace.value = null
    trackerData.value = null
    loadingTracker.value = false
    lastUpdate.value = null
    lastError.value = null
    resetChartState()
  }

  async function search() {
    loadingComps.value = true
    searched.value = true
    error.value = null
    selectedComp.value = null
    races.value = []
    resetRaceState()
    currentTrackerType.value = 'Replay'

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
      if (!target) {
        target = competitions.value.find(isOngoingComp) || competitions.value[0]
      }
      if (target) await selectComp(target.id)
    }
  }

  async function selectComp(id) {
    const comp = competitions.value.find((c) => c.id === id)
    if (!comp) return

    selectedComp.value = comp
    races.value = []
    loadingRaces.value = true
    classFilter.value = null
    resetRaceState()
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

  async function selectRace(id) {
    const race = races.value.find((r) => r.id === id)
    if (!race) return

    stopSim()
    selectedRace.value = race
    trackerData.value = null
    lastUpdate.value = null
    lastError.value = null
    resetChartState()
    currentTrackerType.value = /live/i.test(race.raceStatus?.DisplayName || '') ? 'Live' : 'Replay'
    await refreshTracker()
  }

  function backToComps() {
    selectedComp.value = null
    races.value = []
    resetRaceState()
    setSelectedComp(null)
  }

  function backToRaces() {
    resetRaceState()
  }

  async function refreshTracker() {
    if (!selectedRace.value || simActive.value) return

    if (!trackerData.value) loadingTracker.value = true
    try {
      const data = await fetchTracker(selectedRace.value.id, currentTrackerType.value)
      trackerData.value = data
      const st = data.config?.race?.raceStatus?.DisplayName || ''
      currentTrackerType.value = /live/i.test(st) ? 'Live' : 'Replay'
      lastUpdate.value = Date.now()
      lastError.value = null
      app.lastRefreshAt = lastUpdate.value
    } catch (e) {
      console.error(e)
      lastError.value = e.message || String(e)
    } finally {
      loadingTracker.value = false
    }
  }

  function startSim() {
    if (!canStartSim.value || !trackerData.value) return
    try {
      replaySnapshot.value = structuredClone(toRaw(trackerData.value))
    } catch (e) {
      console.error('startSim: clone failed', e)
      return
    }
    simTimeline.value = buildSimTimeline(replaySnapshot.value)
    if (simTimeline.value.length < 2) return
    simStep.value = 0
    simActive.value = true
    simPlaying.value = false
    simSpeed.value = 1
  }

  function pauseSim() {
    simPlaying.value = false
    clearSimTimer()
  }

  function tickSim() {
    if (simStep.value >= simMaxStep.value) {
      pauseSim()
      return
    }
    simStep.value += 1
  }

  function playSim() {
    if (!simActive.value) return
    if (simStep.value >= simMaxStep.value) simStep.value = 0
    simPlaying.value = true
    clearSimTimer()
    const interval = SIM_BASE_MS / simSpeed.value
    simTimer = setInterval(tickSim, interval)
  }

  function resetSim() {
    if (!simActive.value) return
    pauseSim()
    simStep.value = 0
  }

  function stopSimulation() {
    stopSim()
  }

  function setSimStep(step) {
    if (!simActive.value) return
    pauseSim()
    simStep.value = Math.max(0, Math.min(simMaxStep.value, step))
  }

  function cycleSimSpeed() {
    const idx = SIM_SPEEDS.indexOf(simSpeed.value)
    simSpeed.value = SIM_SPEEDS[(idx + 1) % SIM_SPEEDS.length]
    if (simPlaying.value) {
      pauseSim()
      playSim()
    }
  }

  function toggleLane(laneId) {
    if (hiddenLanes.has(laneId)) hiddenLanes.delete(laneId)
    else hiddenLanes.add(laneId)
  }

  function toggleExpanded(chartId) {
    expandedChart.value = expandedChart.value === chartId ? null : chartId
  }

  function setXZoom(range) {
    xZoom.value = range
  }

  function resetXZoom() {
    xZoom.value = null
  }

  function setYScale(chartId, field, value) {
    if (!yScales[chartId]) yScales[chartId] = {}
    yScales[chartId][field] = value
  }

  function resetYScale(chartId) {
    delete yScales[chartId]
  }

  function exportCsv() {
    const ok = exportLiveCsv(
      displayTrackerData.value,
      selectedComp.value,
      selectedRace.value,
      i18n.global.t,
    )
    if (!ok) alert(i18n.global.t('export_no_data'))
  }

  return {
    year,
    category,
    competitions,
    loadingComps,
    searched,
    error,
    selectedComp,
    races,
    loadingRaces,
    classFilter,
    selectedRace,
    trackerData,
    displayTrackerData,
    loadingTracker,
    currentTrackerType,
    lastUpdate,
    lastError,
    hiddenLanes,
    expandedChart,
    xZoom,
    yScales,
    replaySnapshot,
    simActive,
    simPlaying,
    simStep,
    simTimeline,
    simSpeed,
    simMaxStep,
    trackerConfig,
    lanes,
    ranked,
    totalLength,
    raceClasses,
    filteredRaces,
    racesByDate,
    isLiveTracker,
    showCharts,
    canStartSim,
    statusLabel,
    initFromSavedComp,
    search,
    selectComp,
    setClassFilter,
    selectRace,
    backToComps,
    backToRaces,
    refreshTracker,
    startSim,
    playSim,
    pauseSim,
    resetSim,
    stopSimulation,
    setSimStep,
    cycleSimSpeed,
    toggleLane,
    toggleExpanded,
    setXZoom,
    resetXZoom,
    setYScale,
    resetYScale,
    exportCsv,
  }
})
