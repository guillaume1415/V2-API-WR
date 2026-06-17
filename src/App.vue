<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const { t } = useI18n()
const app = useAppStore()

app.init()

watch(
  () => route.meta.titleKey,
  (key) => {
    if (key) document.title = t(key)
  },
  { immediate: true },
)
</script>

<template>
  <AppLayout>
    <RouterView v-slot="{ Component }">
      <component
        :is="Component"
        v-if="Component"
      />
      <LoadingSpinner
        v-else
        :message="t('loading')"
      />
    </RouterView>
  </AppLayout>
</template>
