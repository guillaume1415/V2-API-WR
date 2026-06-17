<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLiveStore } from '@/stores/live'
import { usePolling } from '@/composables/usePolling'
import LiveSidebar from '@/components/live/LiveSidebar.vue'
import LiveMain from '@/components/live/LiveMain.vue'
import '@/assets/styles/live.css'

const store = useLiveStore()
const { selectedRace, simActive } = storeToRefs(store)

const POLL_MS = 3000

store.initFromSavedComp()

const { start, stop } = usePolling(() => store.refreshTracker(), POLL_MS, {
  immediate: false,
  autoStart: false,
})

watch(
  selectedRace,
  (race) => {
    if (race && !simActive.value) start()
    else stop()
  },
  { immediate: true },
)

watch(simActive, (active) => {
  if (active) stop()
  else if (selectedRace.value) start()
})

onMounted(() => {
  store.search()
})

onUnmounted(stop)
</script>

<template>
  <div class="live-page">
    <aside class="live-sidebar">
      <LiveSidebar />
    </aside>
    <section class="live-main">
      <LiveMain />
    </section>
  </div>
</template>
