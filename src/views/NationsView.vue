<script setup>
import { onUnmounted } from 'vue'
import { useNationsStore } from '@/stores/nations'
import NationsSidebar from '@/components/nations/NationsSidebar.vue'
import NationsMain from '@/components/nations/NationsMain.vue'
import '@/assets/styles/nations.css'

const store = useNationsStore()

onUnmounted(() => {
  store.resetOnLeave()
})
</script>

<template>
  <div class="nations-page">
    <aside class="nations-sidebar">
      <NationsSidebar />
    </aside>
    <section class="nations-main">
      <NationsMain />
    </section>
  </div>
</template>
