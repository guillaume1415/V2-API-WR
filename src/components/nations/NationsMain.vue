<script setup>
import { storeToRefs } from 'pinia'
import { useNationsStore } from '@/stores/nations'
import { getFlagEmoji, formatEventsList } from '@/lib/nations'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import { useI18n } from 'vue-i18n'

const store = useNationsStore()
const {
  searched,
  loading,
  error,
  competitions,
  selectedComp,
  medalResult,
  hasLive,
  lastUpdate,
  sortCol,
  sortDir,
} = storeToRefs(store)
const { t } = useI18n()

function compName(c) {
  return c.DisplayName || c.CompetitionCode || c.id
}

function sortArrow(col) {
  if (sortCol.value !== col) return ''
  return sortDir.value === 'desc' ? ' ▾' : ' ▴'
}

function sortClass(col, extra = '') {
  const parts = ['th-sort']
  if (sortCol.value === col) parts.push('sort-active')
  if (extra) parts.push(extra)
  return parts.join(' ')
}
</script>

<template>
  <div
    v-if="error"
    class="nations-error-box"
  >
    {{ t('err_generic') }}<br>{{ error }}
  </div>

  <LoadingSpinner
    v-else-if="loading"
    :message="t('loading_races')"
  />

  <div
    v-else-if="!searched"
    class="empty"
  >
    {{ t('welcome_nations') }}
  </div>

  <div
    v-else-if="!competitions.length"
    class="empty"
  >
    {{ t('empty_no_comps') }}
  </div>

  <template v-else-if="!selectedComp">
    <div class="nations-section-title">
      {{ t('count_comps', { n: competitions.length }) }}
    </div>
    <div class="nations-comp-list">
      <div
        v-for="c in competitions"
        :key="c.id"
        class="nations-comp-card"
        @click="store.selectComp(c.id)"
      >
        <div class="nations-comp-card-name">
          {{ compName(c) }}
        </div>
        <div class="nations-comp-card-meta">
          <template v-if="c.venue?.DisplayName">{{ c.venue.DisplayName }}</template>
          <template v-if="c.venue?.country?.DisplayName">
            <template v-if="c.venue?.DisplayName">, </template>{{ c.venue.country.DisplayName }}
          </template>
          <template v-if="c.StartDate">
            · {{ (c.StartDate || '').slice(0, 10) }}
            <template v-if="c.EndDate && (c.EndDate || '').slice(0, 10) !== (c.StartDate || '').slice(0, 10)">
              → {{ (c.EndDate || '').slice(0, 10) }}
            </template>
          </template>
        </div>
      </div>
    </div>
  </template>

  <template v-else>
    <div>
      <div class="nations-comp-title">
        {{ selectedComp.DisplayName }}
      </div>
      <div class="nations-comp-sub">
        {{ selectedComp.venue?.DisplayName || '' }}
        <template v-if="selectedComp.venue?.country?.DisplayName">
          {{ selectedComp.venue?.DisplayName ? ' ' : '' }}{{ selectedComp.venue.country.DisplayName }}
        </template>
      </div>
    </div>

    <div class="nations-stats-bar">
      <span>{{ t('comp_label') }} <strong>{{ selectedComp.DisplayName }}</strong></span>
      <span>{{ t('races_counted', { n: medalResult.counted }) }}</span>
      <span
        v-if="hasLive"
        class="nations-live-badge"
      >
        <span class="nations-live-dot" />
        {{ t('status_live') }}
      </span>
      <span
        v-if="lastUpdate"
        style="margin-left: auto"
      >
        {{ t('status_last_update') }} {{ lastUpdate }}
      </span>
    </div>

    <div
      v-if="!medalResult.sorted.length"
      class="empty"
    >
      {{ t('empty_no_finals') }}
    </div>

    <table
      v-else
      class="nations-medal-table"
    >
      <thead>
        <tr>
          <th class="nations-rank-col">
            {{ t('tbl_rank') }}
          </th>
          <th
            :class="sortClass('nation', 'nation-col')"
            @click="store.setSort('nation')"
          >
            {{ t('tbl_nation') }}{{ sortArrow('nation') }}
          </th>
          <th
            :class="sortClass('gold', 'gold-col')"
            @click="store.setSort('gold')"
          >
            🥇 {{ t('tbl_gold') }}{{ sortArrow('gold') }}
          </th>
          <th
            :class="sortClass('silver', 'silver-col')"
            @click="store.setSort('silver')"
          >
            🥈 {{ t('tbl_silver') }}{{ sortArrow('silver') }}
          </th>
          <th
            :class="sortClass('bronze', 'bronze-col')"
            @click="store.setSort('bronze')"
          >
            🥉 {{ t('tbl_bronze') }}{{ sortArrow('bronze') }}
          </th>
          <th
            :class="sortClass('total')"
            @click="store.setSort('total')"
          >
            {{ t('tbl_total') }}{{ sortArrow('total') }}
          </th>
          <th
            :class="sortClass('events', 'nation-col')"
            @click="store.setSort('events')"
          >
            {{ t('tbl_events') }}{{ sortArrow('events') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in medalResult.sorted"
          :key="row.nation"
        >
          <td class="nations-rank-col">
            {{ row._rankTxt }}
          </td>
          <td class="nation-col">
            <span class="nations-flag-code">{{ getFlagEmoji(row.nation) }}</span>{{ row.nation }}
          </td>
          <td>
            <span class="nations-medal-count gold">{{ row.gold }}</span>
          </td>
          <td>
            <span class="nations-medal-count silver">{{ row.silver }}</span>
          </td>
          <td>
            <span class="nations-medal-count bronze">{{ row.bronze }}</span>
          </td>
          <td>
            <span class="nations-total-count">{{ row.total }}</span>
          </td>
          <td class="nations-events-col">
            <template
              v-for="(ev, idx) in formatEventsList(row.events)"
              :key="`${ev.cls}-${ev.medal}-${idx}`"
            >
              <span :class="ev.className">{{ ev.cls }} {{ ev.medal }}</span><template v-if="idx < row.events.length - 1">, </template>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </template>
</template>
