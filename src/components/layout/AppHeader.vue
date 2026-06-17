<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useLiveStore } from '@/stores/live'
import { useNationsStore } from '@/stores/nations'
import { fmtRelative, fmtTime } from '@/lib/format'
import MoreMenu from './MoreMenu.vue'

const route = useRoute()
const { t, locale } = useI18n()
const app = useAppStore()
const live = useLiveStore()
const nations = useNationsStore()

const moreOpen = ref(false)

const navItems = [
  { name: 'results', to: '/', icon: '🏆', labelKey: 'nav_results' },
  { name: 'schedule', to: '/schedule', icon: '📅', labelKey: 'nav_schedule' },
  { name: 'live', to: '/live', icon: '📡', labelKey: 'nav_live' },
  { name: 'analyse', to: '/analyse', icon: '📊', labelKey: 'nav_analyse' },
  { name: 'nations', to: '/nations', icon: '🏅', labelKey: 'nav_nations' },
]

const pageTitleKey = computed(() => route.meta.titleKey || 'title_results')
const subtitleKey = computed(() => route.meta.subtitleKey || 'subtitle')
const refreshTitleKey = computed(() => route.meta.refreshTitleKey || 'tt_refresh')
const brandIcon = computed(() => route.meta.brandIcon || '🚣')
const brandTo = computed(() => route.meta.brandTo || '/')

const themeIcon = computed(() => (app.theme === 'light' ? '☀️' : '🌙'))
const langIcon = computed(() => locale.value.toUpperCase())

const refreshLabel = computed(() => {
  if (route.meta.nav === 'nations') {
    return nations.lastUpdate
      ? `${t('status_last_update')} ${nations.lastUpdate}`
      : t('refresh_label_nations')
  }
  if (route.meta.nav === 'live') {
    if (!live.selectedRace) return t('status_ready')
    if (live.lastError) return t('status_error')
    const time = live.lastUpdate
      ? fmtTime(new Date(live.lastUpdate), locale.value)
      : '—'
    return `${live.isLiveTracker ? t('status_live') : t('status_replay')} · ${time}`
  }
  if (app.lastRefreshAt) return fmtRelative(app.lastRefreshAt, t)
  return t(route.meta.refreshKey || 'refresh_label')
})

const refreshDotClass = computed(() => {
  if (route.meta.nav === 'nations') {
    return { on: !!nations.lastUpdate }
  }
  if (route.meta.nav !== 'live') {
    return { on: !!app.lastRefreshAt || route.meta.nav !== 'analyse' }
  }
  if (!live.selectedRace) return {}
  if (live.lastError) return {}
  return { on: true, replay: !live.isLiveTracker }
})

const showCompare = computed(() => route.meta.nav === 'results')

function toggleMoreMenu(e) {
  e.stopPropagation()
  moreOpen.value = !moreOpen.value
}

function closeMoreMenu() {
  moreOpen.value = false
}

function isActive(name) {
  return route.meta.nav === name
}
</script>

<template>
  <header>
    <RouterLink
      class="brand"
      :to="brandTo"
      :title="t(route.meta.nav === 'nations' ? 'nav_nations' : 'tt_home')"
    >
      <div class="logo">{{ brandIcon }}</div>
      <div class="brand-text">
        <h1>{{ t(pageTitleKey) }}</h1>
        <p>{{ t(subtitleKey) }}</p>
      </div>
    </RouterLink>

    <nav class="header-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        class="nav-link"
        :class="{ active: isActive(item.name) }"
        :title="t(item.labelKey)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ t(item.labelKey) }}</span>
      </RouterLink>
    </nav>

    <div class="header-tools">
      <span
        class="refresh-status"
        :title="t(refreshTitleKey)"
      >
        <span
          class="refresh-dot"
          :class="refreshDotClass"
        />
        <span class="lbl-text">{{ refreshLabel }}</span>
      </span>
      <button
        type="button"
        class="hdr-btn hdr-btn--desktop-only"
        :class="{ on: app.notificationsOn }"
        :title="t('tt_notifs')"
        @click="app.toggleNotifications()"
      >
        <span class="hdr-icon">🔔</span>
        <span class="hdr-lbl">{{ t('hdr_notifs') }}</span>
      </button>
      <button
        v-if="showCompare"
        type="button"
        class="hdr-btn hdr-btn--desktop-only"
        :class="{ active: app.compareMode }"
        :title="t('tt_compare')"
        @click="app.toggleCompare()"
      >
        <span class="hdr-icon">🔀</span>
        <span class="hdr-lbl">{{ t('hdr_compare') }}</span>
      </button>
      <button
        type="button"
        class="hdr-btn"
        :title="t('tt_theme')"
        @click="app.toggleTheme()"
      >
        <span class="hdr-icon">{{ themeIcon }}</span>
      </button>
      <button
        type="button"
        class="hdr-btn"
        :title="t('tt_lang')"
        @click="app.toggleLang()"
      >
        <span class="hdr-icon">{{ langIcon }}</span>
      </button>
      <button
        type="button"
        class="hdr-more"
        :title="t('tt_more')"
        @click="toggleMoreMenu"
      >
        ⋯
      </button>
    </div>

    <MoreMenu
      :open="moreOpen"
      @close="closeMoreMenu"
    />
  </header>
</template>
