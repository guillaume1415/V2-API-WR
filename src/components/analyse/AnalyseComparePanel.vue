<script setup>
import { storeToRefs } from 'pinia'
import { useAnalyseStore } from '@/stores/analyse'
import { COMPARE_CATEGORIES, getCompareCategoryLabel } from '@/lib/analyse/compare'
import { getLanes } from '@/lib/analyse/constants'
import { laneColor } from '@/lib/lanes'
import { raceListLabel } from '@/lib/liveFormat'
import { yearOptions } from '@/lib/competitions'
import { useI18n } from 'vue-i18n'

const store = useAnalyseStore()
const {
  selectedRace,
  lastData,
  selectedLaneIds,
  compareClassFilter,
  cmp,
  exportBusy,
} = storeToRefs(store)
const { t } = useI18n()
const years = yearOptions()
</script>

<template>
  <div class="compare-panel">
    <div class="compare-panel-header">
      <button
        type="button"
        class="compare-toggle-btn active"
        @click="store.toggleCompareMode()"
      >
        {{ t('btn_compare_close') }}
      </button>
      <button
        type="button"
        class="toolbar-btn btn-export-report"
        :title="t('tt_export_html')"
        :disabled="exportBusy"
        @click="store.exportHtmlReport()"
      >
        {{ exportBusy ? t('export_html_busy') : t('btn_export_html') }}
      </button>
    </div>

    <div class="compare-slot">
      <h4>{{ t('compare_race1') }} <span>A</span></h4>
      <div style="font-size: 0.82rem; padding: 4px 0">
        {{ selectedRace?.DisplayName || '—' }}
      </div>
      <div class="compare-slot-actions">
        <button
          type="button"
          class="toolbar-btn-sm"
          @click="store.selectAllLanes()"
        >
          {{ t('lbl_select_all') }}
        </button>
        <button
          type="button"
          class="toolbar-btn-sm"
          @click="store.deselectAllLanes()"
        >
          {{ t('lbl_deselect_all') }}
        </button>
      </div>
      <div class="cmp-lane-pills">
        <label
          v-for="(l, idx) in getLanes(lastData)"
          :key="l.id"
          class="nation-pill"
          :class="{ active: selectedLaneIds.includes(l.id) }"
        >
          <input
            type="checkbox"
            :checked="selectedLaneIds.includes(l.id)"
            @change="store.toggleLane(l.id)"
          >
          <span
            class="swatch"
            :style="{ background: laneColor(l, idx) }"
          />
          {{ l.DisplayName || '?' }}
        </label>
      </div>
    </div>

    <div class="compare-slot">
      <h4>{{ t('compare_race2') }} <span>B</span></h4>
      <div
        v-if="compareClassFilter"
        class="compare-class-hint"
      >
        {{ t('compare_class_filter', { cls: compareClassFilter }) }}
      </div>
      <div
        v-if="cmp.selectedComp"
        class="compare-class-hint"
      >
        {{ t('compare_from_a') }} · {{ cmp.year }} · {{ getCompareCategoryLabel(cmp.category) }}
      </div>

      <div class="slot-row">
        <select v-model.number="cmp.year">
          <option
            v-for="y in years"
            :key="y"
            :value="y"
          >
            {{ y }}
          </option>
        </select>
        <select v-model="cmp.category">
          <option
            v-for="c in COMPARE_CATEGORIES"
            :key="c.value"
            :value="c.value"
          >
            {{ c.value }}
          </option>
        </select>
        <button
          type="button"
          class="cmp-search-btn"
          @click="store.cmpSearch()"
        >
          {{ t('compare_search') }}
        </button>
      </div>

      <div
        v-if="cmp.loadingComps"
        class="compare-class-hint"
      >
        {{ t('compare_loading') }}
      </div>

      <div
        v-else-if="cmp.competitions.length && !cmp.selectedComp"
        class="cmp-race-list"
      >
        <div
          v-for="c in cmp.competitions"
          :key="c.id"
          class="cmp-comp-item"
          @click="store.cmpSelectComp(c.id)"
        >
          {{ c.DisplayName || c.CompetitionCode || c.id }}
        </div>
      </div>

      <template v-else-if="cmp.selectedComp && !cmp.selectedRace">
        <div class="compare-class-hint">
          {{ cmp.selectedComp.DisplayName || '' }}
        </div>
        <div
          v-if="cmp.loadingRaces"
          class="compare-class-hint"
        >
          {{ t('compare_loading') }}
        </div>
        <div
          v-else-if="!cmp.races.length"
          class="compare-class-hint"
        >
          {{ t('empty_no_races') }}
        </div>
        <div
          v-else
          class="cmp-race-list"
        >
          <div
            v-for="r in cmp.races"
            :key="r.id"
            class="cmp-race-item"
            @click="store.cmpSelectRace(r.id)"
          >
            <span>{{ raceListLabel(r) }}</span>
            <span
              v-if="r.DateString"
              style="color: var(--text-muted); margin-left: 6px"
            >{{ r.DateString.slice(11, 16) }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="cmp.selectedRace">
        <div style="font-size: 0.78rem; margin-bottom: 6px">
          <strong>{{ cmp.selectedRace.DisplayName || '' }}</strong>
          <button
            type="button"
            class="cmp-search-btn"
            style="margin-left: 8px; padding: 2px 8px; font-size: 0.72rem"
            @click="store.cmpReset()"
          >
            ←
          </button>
        </div>
        <div class="compare-slot-actions">
          <button
            type="button"
            class="toolbar-btn-sm"
            @click="store.cmpSelectAllLanes()"
          >
            {{ t('lbl_select_all') }}
          </button>
          <button
            type="button"
            class="toolbar-btn-sm"
            @click="store.cmpDeselectAllLanes()"
          >
            {{ t('lbl_deselect_all') }}
          </button>
        </div>
        <div
          v-if="cmp.loadingRaces"
          class="compare-class-hint"
        >
          {{ t('compare_loading') }}
        </div>
        <div
          v-else-if="cmp.lastData"
          class="cmp-lane-pills"
        >
          <label
            v-for="(l, idx) in getLanes(cmp.lastData)"
            :key="l.id"
            class="nation-pill"
            :class="{ active: cmp.selectedLaneIds.includes(l.id) }"
          >
            <input
              type="checkbox"
              :checked="cmp.selectedLaneIds.includes(l.id)"
              @change="store.cmpToggleLane(l.id)"
            >
            <span
              class="swatch"
              :style="{ background: laneColor(l, idx) }"
            />
            {{ l.DisplayName || '?' }}
          </label>
        </div>
      </template>

      <div
        v-else
        class="compare-class-hint"
      >
        {{ t('compare_select_hint') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.slot-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.slot-row select {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.8rem;
}
</style>
