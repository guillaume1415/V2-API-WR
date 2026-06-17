<script setup>
import { storeToRefs } from 'pinia'
import { useNationsStore } from '@/stores/nations'
import { NATIONS_CATEGORIES } from '@/lib/nations'
import { yearOptions } from '@/lib/competitions'
import { useI18n } from 'vue-i18n'

const store = useNationsStore()
const {
  year,
  category,
  gender,
  includeLW,
  includeMix,
  includePara,
  olympicOnly,
  loading,
  lastUpdate,
  selectedComp,
} = storeToRefs(store)
const { t } = useI18n()

const years = yearOptions()
</script>

<template>
  <div class="nations-sidebar-section">
    <div class="nations-sidebar-label">{{ t('lbl_year') }}</div>
    <select v-model.number="year">
      <option
        v-for="y in years"
        :key="y"
        :value="y"
      >
        {{ y }}
      </option>
    </select>

    <div class="nations-sidebar-label">{{ t('lbl_category') }}</div>
    <select v-model="category">
      <option
        v-for="cat in NATIONS_CATEGORIES"
        :key="cat"
        :value="cat"
      >
        {{ cat }}
      </option>
    </select>

    <button
      class="nations-btn-primary"
      type="button"
      :disabled="loading"
      @click="store.search()"
    >
      {{ t('btn_search') }}
    </button>
  </div>

  <div class="nations-filter-section">
    <div class="nations-sidebar-label">{{ t('filter_gender') }}</div>
    <div class="nations-radio-group">
      <label>
        <input
          v-model="gender"
          type="radio"
          value="all"
        >
        <span>{{ t('filter_all') }}</span>
      </label>
      <label>
        <input
          v-model="gender"
          type="radio"
          value="M"
        >
        <span>{{ t('filter_m') }}</span>
      </label>
      <label>
        <input
          v-model="gender"
          type="radio"
          value="W"
        >
        <span>{{ t('filter_w') }}</span>
      </label>
    </div>

    <div class="nations-filter-group">
      <label>
        <input
          v-model="includeLW"
          type="checkbox"
        >
        <span>{{ t('filter_lw') }}</span>
      </label>
      <label>
        <input
          v-model="includeMix"
          type="checkbox"
        >
        <span>{{ t('filter_mix') }}</span>
      </label>
      <label>
        <input
          v-model="includePara"
          type="checkbox"
        >
        <span>{{ t('filter_para') }}</span>
      </label>
      <label>
        <input
          v-model="olympicOnly"
          type="checkbox"
        >
        <span>{{ t('filter_olympic') }}</span>
      </label>
    </div>
  </div>

  <div
    v-if="selectedComp && lastUpdate"
    class="nations-refresh-info"
  >
    {{ t('status_last_update') }} {{ lastUpdate }}
  </div>
</template>
