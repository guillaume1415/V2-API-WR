<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { useLiveStore } from '@/stores/live'
import { fmtResultTime } from '@/lib/format'
import { fmtMS, fmtSplit, isRaceFinished, tableLanes } from '@/lib/liveFormat'
import { useI18n } from 'vue-i18n'
import LiveReplaySimBar from './LiveReplaySimBar.vue'

const LiveCharts = defineAsyncComponent(() => import('./LiveCharts.vue'))

const store = useLiveStore()
const { lanes, totalLength, trackerConfig, showCharts } = storeToRefs(store)
const { t } = useI18n()

const race = computed(() => trackerConfig.value?.race || {})
const statusName = computed(() => race.value.raceStatus?.DisplayName || '—')
const displayLanes = computed(() => tableLanes(lanes.value, statusName.value))
const raceFinished = computed(() => isRaceFinished(statusName.value))
const statusClass = computed(() => {
  if (/live/i.test(statusName.value)) return 'live'
  if (/finished|official/i.test(statusName.value)) return 'replay'
  return 'scheduled'
})
const boatClass = computed(
  () => race.value.event?.boatClass?.DisplayName || race.value.event?.DisplayName || '',
)
const raceDate = computed(() => (race.value.DateString || '').slice(0, 16).replace('T', ' '))

const interDistances = computed(() => {
  const set = new Set()
  for (const lane of displayLanes.value) {
    for (const i of lane.intermediates || []) {
      if (i.distance?.DisplayName) set.add(i.distance.DisplayName)
    }
  }
  return [...set]
    .filter(Boolean)
    .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))
})

function athleteNames(lane) {
  return (lane.raceBoatAthletes || [])
    .map((a) => a.person?._name || a.person?.DisplayName)
    .filter(Boolean)
    .join(' / ')
}

function interForLane(lane, distKey) {
  return (lane.intermediates || []).find((i) => i.distance?.DisplayName === distKey)
}

function formatGap(gap) {
  if (gap == null) return '—'
  if (gap === 0) return t('leader_label')
  return `-${gap}m`
}
</script>

<template>
  <div class="live-tracker">
    <div class="race-head">
      <h2>{{ race.DisplayName || '' }}</h2>
      <span class="meta">{{ boatClass }}</span>
      <span
        class="badge"
        :class="statusClass"
      >{{ statusName }}</span>
      <span class="meta">{{ raceDate }}</span>
    </div>

    <LiveReplaySimBar />

    <div class="tracker-actions">
      <button
        type="button"
        class="hdr-btn"
        :title="t('tt_export_csv')"
        @click="store.exportCsv()"
      >
        {{ t('btn_export_csv') }}
      </button>
    </div>

    <div class="table-wrap">
      <table class="lanes">
        <thead>
          <tr>
            <th>{{ t('hdr_pos') }}</th>
            <th>{{ t('hdr_lane') }}</th>
            <th>{{ t('hdr_country') }}</th>
            <th>{{ t('hdr_progress') }}</th>
            <th class="num">
              {{ t('hdr_distance') }}
            </th>
            <th class="num">
              {{ t('hdr_speed') }}
            </th>
            <th class="num col-split">
              {{ t('hdr_split') }}
            </th>
            <th class="num">
              {{ t('hdr_cadence') }}
            </th>
            <th class="num">
              {{ t('hdr_gap_leader') }}
            </th>
            <th class="num col-final">
              {{ t('hdr_final_time') }}
            </th>
            <th class="col-crew">
              {{ t('hdr_crew') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(lane, rowIdx) in displayLanes"
            :key="lane.id"
            :class="{ p1: (raceFinished ? rowIdx === 0 : lane.currentPoint?.raceBoatTracker?.currentPosition === 1) }"
          >
            <td>
              <span
                class="pos-pill"
                :class="{
                  p1: raceFinished ? rowIdx === 0 : lane.currentPoint?.raceBoatTracker?.currentPosition === 1,
                  p2: raceFinished ? rowIdx === 1 : lane.currentPoint?.raceBoatTracker?.currentPosition === 2,
                  p3: raceFinished ? rowIdx === 2 : lane.currentPoint?.raceBoatTracker?.currentPosition === 3,
                }"
              >
                {{ raceFinished ? rowIdx + 1 : (lane.currentPoint?.raceBoatTracker?.currentPosition || '—') }}
              </span>
            </td>
            <td class="num">
              {{ lane.Lane || '' }}
            </td>
            <td>
              <span class="ctry">{{ lane.DisplayName || '?' }}</span>
              <div class="small">
                {{ lane.country?.DisplayName || '' }}
              </div>
            </td>
            <td>
              <div
                class="progress"
                :title="`${lane.currentPoint?.raceBoatTracker?.distanceTravelled || 0}m / ${totalLength}m`"
              >
                <div
                  :style="{
                    width: `${Math.min(100, ((lane.currentPoint?.raceBoatTracker?.distanceTravelled || 0) / totalLength) * 100)}%`,
                  }"
                />
              </div>
              <div class="small">
                {{ Math.round(((lane.currentPoint?.raceBoatTracker?.distanceTravelled || 0) / totalLength) * 100) }}%
              </div>
            </td>
            <td class="num">
              {{ lane.currentPoint?.raceBoatTracker?.distanceTravelled || 0 }} m
            </td>
            <td class="num">
              {{ fmtMS(lane.currentPoint?.raceBoatTracker?.metrePerSecond) }}
            </td>
            <td class="num col-split">
              {{ fmtSplit(lane.currentPoint?.raceBoatTracker?.metrePerSecond) }}
            </td>
            <td class="num">
              {{
                lane.currentPoint?.raceBoatTracker?.strokeRate
                  ? `${lane.currentPoint.raceBoatTracker.strokeRate} s/m`
                  : '—'
              }}
            </td>
            <td
              class="num gap"
              :class="{ lead: lane.currentPoint?.raceBoatTracker?.distanceFromLeader === 0 }"
            >
              {{ formatGap(lane.currentPoint?.raceBoatTracker?.distanceFromLeader) }}
            </td>
            <td class="num col-final">
              {{ fmtResultTime(lane.ResultTime) }}
            </td>
            <td class="athletes col-crew">
              {{ athleteNames(lane) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <details
      v-if="interDistances.length"
      class="inters"
      open
    >
      <summary>{{ t('inters_title') }}</summary>
      <table class="int">
        <thead>
          <tr>
            <th>{{ t('hdr_country') }}</th>
            <th
              v-for="d in interDistances"
              :key="d"
            >
              {{ d.replace(/^d|m$/g, '') }}m
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(lane, rowIdx) in displayLanes"
            :key="lane.id"
          >
            <td>
              <span
                v-if="raceFinished"
                class="pos-pill small-pill"
                :class="{ p1: rowIdx === 0, p2: rowIdx === 1, p3: rowIdx === 2 }"
              >{{ rowIdx + 1 }}</span>
              {{ lane.DisplayName }}
            </td>
            <td
              v-for="d in interDistances"
              :key="d"
            >
              <template v-if="interForLane(lane, d)">
                {{ fmtResultTime(interForLane(lane, d).ResultTime) }}
                <span class="small">
                  ({{ interForLane(lane, d).Rank }}){{
                    interForLane(lane, d).Difference &&
                    interForLane(lane, d).Difference !== '+0.00'
                      ? ` ${interForLane(lane, d).Difference}`
                      : ''
                  }}
                </span>
              </template>
              <template v-else>—</template>
            </td>
          </tr>
        </tbody>
      </table>
    </details>

    <LiveCharts v-if="showCharts" />
    <p
      v-else-if="store.isLiveTracker"
      class="charts-hidden-hint"
    >
      {{ t('charts_hidden_live') }}
    </p>
  </div>
</template>

<style scoped>
.charts-hidden-hint {
  margin-top: 16px;
  padding: 12px 14px;
  font-size: 0.84rem;
  color: var(--text-muted);
  background: var(--surface2);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}
</style>
