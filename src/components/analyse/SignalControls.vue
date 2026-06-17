<script setup>
import { storeToRefs } from 'pinia'
import { useAnalyseStore } from '@/stores/analyse'
import { laneColor } from '@/lib/lanes'
import { useI18n } from 'vue-i18n'

const store = useAnalyseStore()
const {
  sizeByDps,
  smoothing,
  colorBy,
  rtsEnabled,
  rtsSigmaA,
  rtsRgps,
  rtsRgate,
  compareMode,
  lanes,
  selectedLaneIds,
  exportBusy,
} = storeToRefs(store)
const { t } = useI18n()
</script>

<template>
  <div
    v-if="!compareMode"
    class="analyse-toolbar"
  >
    <div class="toolbar-group">
      <span class="lbl">{{ t('lbl_boat') }}</span>
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
      <div class="nation-pills">
        <label
          v-for="(l, idx) in lanes"
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

    <div class="toolbar-group">
      <label class="switch">
        <input
          v-model="sizeByDps"
          type="checkbox"
        >
        {{ t('lbl_size_dps') }}
      </label>
    </div>

    <div class="toolbar-group">
      <span class="lbl">{{ t('lbl_smoothing') }}</span>
      <div class="smooth-ctrl">
        <input
          v-model.number="smoothing"
          type="range"
          min="0"
          max="15"
          step="1"
        >
        <span class="smooth-val">{{ smoothing }}</span>
      </div>
    </div>

    <div class="toolbar-group">
      <label
        class="switch"
        :title="t('tt_kalman')"
      >
        <input
          v-model="rtsEnabled"
          type="checkbox"
        >
        {{ t('lbl_kalman') }}
      </label>
      <span
        class="muted-xs"
        :title="t('tt_sigma_a')"
      >{{ t('lbl_sigma_a') }}</span>
      <input
        v-model.number="rtsSigmaA"
        class="kalman-input"
        type="number"
        min="0.05"
        max="0.5"
        step="0.01"
      >
      <span class="muted-xs">m/s²</span>
      <span
        class="muted-xs"
        :title="t('tt_r_gps')"
      >{{ t('lbl_r_gps') }}</span>
      <input
        v-model.number="rtsRgps"
        class="kalman-input narrow"
        type="number"
        min="1"
        max="100"
        step="1"
      >
      <span
        class="muted-xs"
        :title="t('tt_r_gate')"
      >{{ t('lbl_r_gate') }}</span>
      <input
        v-model.number="rtsRgate"
        class="kalman-input"
        type="number"
        min="0.01"
        max="10"
        step="0.05"
      >
    </div>

    <div class="toolbar-group">
      <span class="muted-xs">{{ t('lbl_color_curves') }}</span>
      <label class="switch">
        <input
          v-model="colorBy"
          type="radio"
          value="cadence"
        >
        {{ t('lbl_color_cadence') }}
      </label>
      <label class="switch">
        <input
          v-model="colorBy"
          type="radio"
          value="speed"
        >
        {{ t('lbl_color_speed') }}
      </label>
    </div>

    <div
      class="toolbar-group"
      style="margin-left: auto"
    >
      <button
        type="button"
        class="toolbar-btn btn-export-report"
        :title="t('tt_export_html')"
        :disabled="exportBusy"
        @click="store.exportHtmlReport()"
      >
        {{ exportBusy ? t('export_html_busy') : t('btn_export_html') }}
      </button>
      <button
        type="button"
        class="compare-toggle-btn"
        @click="store.toggleCompareMode()"
      >
        {{ t('btn_compare') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.muted-xs {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
