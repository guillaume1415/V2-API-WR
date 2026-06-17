<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLiveStore } from '@/stores/live'
import { useI18n } from 'vue-i18n'

const store = useLiveStore()
const {
  simActive,
  simPlaying,
  simStep,
  simMaxStep,
  simTimeline,
  simSpeed,
  canStartSim,
} = storeToRefs(store)

const { t } = useI18n()

const progressLabel = computed(() => {
  if (!simTimeline.value.length) return ''
  const tc = simTimeline.value[simStep.value]
  return t('sim_step', { step: simStep.value + 1, total: simTimeline.value.length, tc })
})
</script>

<template>
  <div
    v-if="simActive"
    class="live-sim-bar"
  >
    <span class="sim-badge">{{ t('sim_badge') }}</span>
    <button
      type="button"
      class="hdr-btn"
      :title="simPlaying ? t('sim_pause') : t('sim_play')"
      @click="simPlaying ? store.pauseSim() : store.playSim()"
    >
      {{ simPlaying ? '⏸' : '▶' }}
    </button>
    <button
      type="button"
      class="hdr-btn"
      :title="t('sim_reset')"
      @click="store.resetSim()"
    >
      ↺
    </button>
    <button
      type="button"
      class="hdr-btn"
      :title="t('sim_speed')"
      @click="store.cycleSimSpeed()"
    >
      ×{{ simSpeed }}
    </button>
    <input
      type="range"
      class="sim-slider"
      min="0"
      :max="simMaxStep"
      :value="simStep"
      @input="store.setSimStep(Number($event.target.value))"
    >
    <span class="sim-progress">{{ progressLabel }}</span>
    <button
      type="button"
      class="hdr-btn sim-stop"
      @click="store.stopSimulation()"
    >
      {{ t('sim_stop') }}
    </button>
  </div>
  <div
    v-else-if="canStartSim"
    class="live-sim-bar live-sim-start"
  >
    <button
      type="button"
      class="hdr-btn"
      @click="store.startSim()"
    >
      {{ t('sim_start') }}
    </button>
    <span class="sim-hint">{{ t('sim_start_hint') }}</span>
  </div>
</template>

<style scoped>
.live-sim-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.live-sim-start {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}
.sim-badge {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gold);
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
}
.sim-slider {
  flex: 1;
  min-width: 120px;
  max-width: 280px;
}
.sim-progress {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
}
.sim-hint {
  font-size: 0.78rem;
  color: var(--text-muted);
}
.sim-stop {
  margin-left: auto;
}
</style>
