<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { useAnalyseStore } from '@/stores/analyse'
import { getBoatClassDisplayName, getLanes, getWbt, getWbtCode } from '@/lib/analyse/constants'
import { fmtDate } from '@/lib/format'
import { raceListLabel, raceStatusClass } from '@/lib/liveFormat'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import SignalControls from './SignalControls.vue'
import AnalyseComparePanel from './AnalyseComparePanel.vue'
import AnalysePaceTable from './AnalysePaceTable.vue'

const AnalysePlots = defineAsyncComponent(() => import('./AnalysePlots.vue'))

const store = useAnalyseStore()
const {
  error,
  loadingComps,
  searched,
  competitions,
  selectedComp,
  selectedRace,
  loadingRaces,
  raceClasses,
  classFilter,
  racesByDate,
  loadingTracker,
  lastData,
  year,
  category,
  compareMode,
  cmp,
  lanes,
  wbt,
  wbtCode,
  filteredRaces,
} = storeToRefs(store)

const { t, locale } = useI18n()

const race = computed(() => lastData.value?.config?.race || selectedRace.value || {})
const statusName = computed(() => race.value.raceStatus?.DisplayName || '—')
const statusClass = computed(() => raceStatusClass(statusName.value))

const cmpWbt = computed(() => {
  if (!cmp.value.lastData) return null
  const cls = getBoatClassDisplayName(cmp.value.lastData, cmp.value.selectedRace)
  return getWbt(cls)
})
const cmpWbtCode = computed(() => {
  if (!cmp.value.lastData) return ''
  const cls = getBoatClassDisplayName(cmp.value.lastData, cmp.value.selectedRace)
  return getWbtCode(cls) || cls
})
</script>

<template>
  <div
    v-if="error"
    class="error-box"
  >
    <strong>{{ t('breadcrumb_comps') }}</strong> — {{ error }}
    <br><br>
    <span v-html="t('err_proxy')" />
  </div>

  <LoadingSpinner
    v-else-if="loadingComps"
    :message="t('loading_comps')"
  />

  <div
    v-else-if="!searched"
    class="empty"
  >
    {{ t('welcome_analyse') }}
  </div>

  <div
    v-else-if="!competitions.length"
    class="empty"
  >
    {{ t('empty_no_comps') }}
  </div>

  <template v-else-if="!selectedComp">
    <div>
      <div class="section-title">
        {{ t('section_comps') }} · {{ year }} · {{ category }}
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px">
        {{ t('count_comps', { n: competitions.length }) }}
      </div>
    </div>
    <div class="cards-grid">
      <div
        v-for="c in competitions"
        :key="c.id"
        class="card"
        @click="store.selectComp(c.id)"
      >
        <div class="card-title">
          {{ c.DisplayName || c.CompetitionCode || c.id }}
        </div>
        <div class="card-meta">
          <span>📍 {{ c.venue?.DisplayName || '—' }}<template v-if="c.venue?.country?.DisplayName">, {{ c.venue.country.DisplayName }}</template></span>
          <span>📅 {{ fmtDate(c.StartDate, locale) }}<template v-if="fmtDate(c.EndDate, locale) !== fmtDate(c.StartDate, locale)"> → {{ fmtDate(c.EndDate, locale) }}</template></span>
        </div>
      </div>
    </div>
  </template>

  <template v-else-if="!selectedRace">
    <div class="breadcrumb">
      <button
        type="button"
        @click="store.backToComps()"
      >
        {{ t('breadcrumb_comps') }}
      </button>
      <span class="sep">›</span>
      <span>{{ selectedComp.DisplayName || '' }}</span>
    </div>

    <LoadingSpinner
      v-if="loadingRaces"
      :message="t('loading_races')"
    />

    <div
      v-else-if="!filteredRaces.length"
      class="empty"
    >
      {{ t('empty_no_races') }}
    </div>

    <template v-else>
      <div>
        <div class="section-title">
          {{ t('count_races', { n: filteredRaces.length }) }}
        </div>
      </div>

      <div
        v-if="raceClasses.length > 1"
        class="class-filters"
      >
        <div
          class="pill"
          :class="{ active: !classFilter }"
          @click="store.setClassFilter(null)"
        >
          {{ t('all') }}
        </div>
        <div
          v-for="c in raceClasses"
          :key="c"
          class="pill"
          :class="{ active: classFilter === c }"
          @click="store.setClassFilter(c)"
        >
          {{ c }}
        </div>
      </div>

      <div class="race-list">
        <template
          v-for="(dateRaces, date) in racesByDate"
          :key="date"
        >
          <div class="group-label">
            {{ fmtDate(date, locale) }}
          </div>
          <div
            v-for="r in dateRaces"
            :key="r.id"
            class="race-item"
            @click="store.selectRace(r.id)"
          >
            <span class="race-item-name">{{ raceListLabel(r) }}</span>
            <span class="race-item-meta">{{ (r.DateString || '').slice(11, 16) }}</span>
            <span
              class="badge"
              :class="raceStatusClass(r.raceStatus?.DisplayName || '')"
            >{{ r.raceStatus?.DisplayName || '—' }}</span>
          </div>
        </template>
      </div>
    </template>
  </template>

  <template v-else>
    <div class="breadcrumb">
      <button
        type="button"
        @click="store.backToComps()"
      >
        {{ t('breadcrumb_comps') }}
      </button>
      <span class="sep">›</span>
      <button
        type="button"
        @click="store.backToRaces()"
      >
        {{ selectedComp.DisplayName || '' }}
      </button>
      <span class="sep">›</span>
      <span>{{ selectedRace.DisplayName || '' }}</span>
    </div>

    <LoadingSpinner
      v-if="loadingTracker || !lastData"
      :message="t('loading_race')"
    />

    <template v-else>
      <div class="race-head">
        <h2>{{ race.DisplayName || '' }}</h2>
        <span class="meta">{{ store.boatClass }}</span>
        <span
          class="badge"
          :class="statusClass"
        >{{ statusName }}</span>
        <span class="meta">{{ (race.DateString || '').slice(0, 16).replace('T', ' ') }}</span>
      </div>

      <AnalyseComparePanel v-if="compareMode" />
      <SignalControls v-else />

      <section class="pace-table-section">
        <div
          v-if="compareMode && cmp.lastData"
          class="compare-pace-grid"
        >
          <AnalysePaceTable
            :title="t('compare_table_a')"
            :lanes="lanes"
            :wbt="wbt"
            :wbt-code="wbtCode"
          />
          <AnalysePaceTable
            :title="t('compare_table_b')"
            :lanes="getLanes(cmp.lastData)"
            :wbt="cmpWbt"
            :wbt-code="cmpWbtCode"
          />
        </div>
        <AnalysePaceTable
          v-else
          :title="t('lbl_intermediates')"
          :lanes="lanes"
          :wbt="wbt"
          :wbt-code="wbtCode"
        />
      </section>

      <AnalysePlots v-if="store.series.length" />
      <div
        v-else
        class="empty"
      >
        {{ t('err_no_data') }}
      </div>
    </template>
  </template>
</template>
