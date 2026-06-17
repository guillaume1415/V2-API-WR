<script setup>
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAnalyseStore } from '@/stores/analyse'
import { useAppStore } from '@/stores/app'
import { buildAnalysePlots, getYScaleDefaults, C_DEFAULTS } from '@/lib/analyse/plots'
import PlotlyChart from '@/components/charts/PlotlyChart.vue'
import { useI18n } from 'vue-i18n'

const store = useAnalyseStore()
const app = useAppStore()
const { t } = useI18n()

const {
  series,
  totalLength,
  boatClass,
  yScales,
  cScales,
  globalScales,
  colorBy,
  sizeByDps,
  fullscreenCardId,
} = storeToRefs(store)

const plots = computed(() =>
  buildAnalysePlots({
    series: series.value,
    totalLength: totalLength.value,
    theme: app.theme,
    boatClass: boatClass.value,
    yScales: yScales.value,
    cScales: cScales.value,
    globalScales: globalScales.value,
    colorBy: colorBy.value,
    sizeByDps: sizeByDps.value,
    t,
  }),
)

watch(fullscreenCardId, (id) => {
  document.body.classList.toggle('has-analyse-fullscreen', !!id)
})

function yInputValue(plotId, which) {
  const cur = yScales.value[plotId] || {}
  const def = getYScaleDefaults(plotId, boatClass.value)
  return cur[which] != null ? cur[which] : def[which] != null ? def[which] : ''
}

function cInputValue(plotId, which) {
  const cur = cScales.value[plotId] || {}
  const def = C_DEFAULTS[plotId === 'speed' ? 'speed' : 'cadence'] || {}
  return cur[which] != null ? cur[which] : def[which] != null ? def[which] : ''
}

function onYInput(plotId, which, ev) {
  const raw = ev.target.value
  store.setYScale(plotId, which, raw === '' ? null : parseFloat(raw))
}

function onCInput(plotId, which, ev) {
  const raw = ev.target.value
  store.setCScale(plotId, which, raw === '' ? null : parseFloat(raw))
}

function hasYOverride(plotId) {
  const cur = yScales.value[plotId] || {}
  const def = getYScaleDefaults(plotId, boatClass.value)
  return (cur.min != null && cur.min !== def.min) || (cur.max != null && cur.max !== def.max)
}

function hasCOverride(plotId) {
  const cur = cScales.value[plotId] || {}
  const def = C_DEFAULTS.speed || {}
  return (cur.min != null && cur.min !== def.min) || (cur.max != null && cur.max !== def.max)
}

function stepFor(plotId) {
  return plotId === 'cadence' ? '1' : '0.1'
}
</script>

<template>
  <div
    v-if="plots.length"
    class="plot-grid"
  >
    <div
      v-for="plot in plots"
      :key="plot.id"
      :id="plot.cardId"
      class="plot-card"
      :class="{
        fullscreen: fullscreenCardId === plot.cardId,
        'full-width': plot.fullWidth,
      }"
    >
      <button
        type="button"
        class="btn-expand"
        :title="fullscreenCardId === plot.cardId ? t('tt_exit_fullscreen') : t('tt_fullscreen')"
        @click="store.toggleFullscreen(plot.cardId)"
      >
        {{ fullscreenCardId === plot.cardId ? '✕' : '⛶' }}
      </button>
      <div class="plot-title">
        {{ t(plot.titleKey) }}
      </div>
      <div class="plot-sub">
        {{ t(plot.subKey) }}
      </div>

      <div class="plot-tools">
        <span class="scale-edit">
          {{ t('scale_y') }} ({{ plot.unit }}) :
          <input
            type="number"
            :step="stepFor(plot.id)"
            :value="yInputValue(plot.id, 'min')"
            @input="onYInput(plot.id, 'min', $event)"
          >
          →
          <input
            type="number"
            :step="stepFor(plot.id)"
            :value="yInputValue(plot.id, 'max')"
            @input="onYInput(plot.id, 'max', $event)"
          >
          <button
            v-if="hasYOverride(plot.id)"
            type="button"
            class="reset"
            @click="store.resetYScale(plot.id)"
          >
            ↺
          </button>
        </span>
        <span
          v-if="plot.colorOpts"
          class="scale-edit"
        >
          {{ t('scale_color') }} {{ t(plot.colorOpts.labelKey) }} ({{ plot.colorOpts.unit }}) :
          <input
            type="number"
            step="1"
            :value="cInputValue(plot.id, 'min')"
            @input="onCInput(plot.id, 'min', $event)"
          >
          →
          <input
            type="number"
            step="1"
            :value="cInputValue(plot.id, 'max')"
            @input="onCInput(plot.id, 'max', $event)"
          >
          <button
            v-if="hasCOverride(plot.id)"
            type="button"
            class="reset"
            @click="store.resetCScale(plot.id)"
          >
            ↺
          </button>
        </span>
      </div>

      <div
        class="plot-area"
        :class="{ tall: plot.tall }"
      >
        <PlotlyChart
          v-if="plot.traces.length"
          :data="plot.traces"
          :layout="plot.layout"
          :height="plot.tall ? '380px' : '340px'"
          cursor-hover
        />
      </div>
    </div>
  </div>
</template>
