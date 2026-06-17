<script setup>
import { storeToRefs } from 'pinia'
import { useAnalyseStore } from '@/stores/analyse'
import { COMPETITION_CATEGORIES, yearOptions } from '@/lib/competitions'
import { getUseProxy, setUseProxy } from '@/services/storage'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const store = useAnalyseStore()
const { year, category, loadingComps } = storeToRefs(store)
const { t } = useI18n()
const years = yearOptions()
const useProxy = ref(getUseProxy())

watch(useProxy, (v) => setUseProxy(v))
</script>

<template>
  <div class="filter-group">
    <label>{{ t('lbl_year') }}</label>
    <select v-model.number="year">
      <option
        v-for="y in years"
        :key="y"
        :value="y"
      >
        {{ y }}
      </option>
    </select>
  </div>
  <div class="filter-group">
    <label>{{ t('lbl_category') }}</label>
    <select v-model="category">
      <option
        v-for="cat in COMPETITION_CATEGORIES"
        :key="cat"
        :value="cat"
      >
        {{ cat }}
      </option>
    </select>
  </div>
  <button
    class="btn"
    type="button"
    :disabled="loadingComps"
    @click="store.search()"
  >
    {{ t('btn_search') }}
  </button>
  <hr>
  <div class="sidebar-help">
    <p>{{ t('sidebar_help') }}</p>
    <label class="proxy-label">
      <input
        v-model="useProxy"
        type="checkbox"
      >
      <span>{{ t('proxy_label') }}</span>
    </label>
  </div>
</template>
