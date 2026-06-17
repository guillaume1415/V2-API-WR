<script setup>
import { computed } from 'vue'
import { buildAnalysePaceTable } from '@/lib/analyse/paceTable'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  lanes: { type: Array, default: () => [] },
  wbt: { type: Object, default: null },
  wbtCode: { type: String, default: '' },
  title: { type: String, default: '' },
})

const { t } = useI18n()

const table = computed(() => buildAnalysePaceTable(props.lanes, props.wbt))
</script>

<template>
  <div class="compare-pace-block">
    <div
      v-if="title"
      class="section-title"
      style="margin-bottom: 8px"
    >
      {{ title }}
    </div>
    <div
      v-if="wbt"
      class="wbt-banner"
    >
      {{ t('wbt_label', { cls: wbtCode, time: wbt.time }) }}
    </div>
    <div
      v-else-if="wbtCode"
      class="wbt-banner muted"
    >
      {{ t('wbt_unknown') }}
    </div>

    <div
      v-if="!table"
      class="empty"
      style="padding: 16px"
    >
      {{ lanes.length ? t('tbl_no_inters') : t('tbl_no_boats') }}
    </div>

    <div
      v-else
      class="splits-table-wrap"
    >
      <table class="splits-table">
        <thead>
          <tr>
            <th
              rowspan="2"
              class="rank"
            >
              #
            </th>
            <th
              rowspan="2"
              class="nation"
            >
              {{ t('tbl_team') }}
            </th>
            <th
              v-for="d in table.dists"
              :key="d"
              class="dist"
            >
              {{ table.distMap.get(d) }}
            </th>
            <th
              v-if="table.hasWbt"
              rowspan="2"
              class="pct-wbt"
            >
              {{ t('tbl_pct_wbt') }}
            </th>
          </tr>
          <tr>
            <th
              v-for="d in table.dists"
              :key="`leg-${d}`"
              class="pace-legend"
            >
              {{ t('tbl_legend') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.rows"
            :key="row.name"
            :class="{ 'wr-row': row.isWR }"
          >
            <td class="rank">
              {{ row.rank ?? '—' }}
            </td>
            <td class="nation">
              <span
                class="swatch-mini"
                :style="{ background: row.color }"
              />
              <strong>{{ row.name }}</strong>
            </td>
            <td
              v-for="(cell, ci) in row.cells"
              :key="ci"
              class="pace-cell"
              :class="{ 'wr-cell': cell?.isWR }"
            >
              <template v-if="cell">
                <div class="pace-cum">
                  {{ cell.cumTime }}
                  <small
                    v-if="cell.cumRank"
                    style="color: var(--text-muted); margin-left: 2px"
                  >({{ cell.cumRank }})</small>
                  <span
                    v-if="cell.isWR"
                    class="wr-badge"
                  >{{ t('tbl_wr_badge') }}</span>
                </div>
                <div class="pace-split">
                  {{ cell.split }}
                  <small
                    v-if="cell.splitRank"
                    style="color: var(--text-muted); margin-left: 2px"
                  >({{ cell.splitRank }})</small>
                  <small
                    v-if="cell.isLeader"
                    style="color: var(--green); margin-left: 4px"
                  >—</small>
                  <small
                    v-else-if="cell.cumGap != null"
                    style="color: var(--red); margin-left: 4px"
                  >+{{ cell.cumGap.toFixed(1) }}</small>
                </div>
              </template>
              <template v-else>
                —
              </template>
            </td>
            <td
              v-if="table.hasWbt"
              class="pct-wbt-cell"
              :style="{
                color: row.isWR ? 'var(--gold)' : row.pctWbt && parseFloat(row.pctWbt) >= 99 ? 'var(--green)' : 'var(--text-muted)',
                fontWeight: 600,
              }"
            >
              <template v-if="row.pctWbt">
                {{ row.pctWbt }}%{{ row.isWR ? ' ★' : '' }}
              </template>
              <template v-else>
                —
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
