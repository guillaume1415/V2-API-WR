<script setup>
import { onMounted } from 'vue'
import { useAnalyseStore } from '@/stores/analyse'
import AnalyseSidebar from '@/components/analyse/AnalyseSidebar.vue'
import AnalyseMain from '@/components/analyse/AnalyseMain.vue'
import '@/assets/styles/analyse.css'

const store = useAnalyseStore()

store.initFromSavedComp()

onMounted(() => {
  store.search()
})
</script>

<template>
  <div class="analyse-page">
    <aside class="analyse-sidebar">
      <AnalyseSidebar />
    </aside>
    <section class="analyse-main">
      <AnalyseMain />
    </section>
  </div>
</template>
