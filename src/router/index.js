import { createRouter, createWebHistory } from 'vue-router'
import ResultsView from '@/views/ResultsView.vue'
import ScheduleView from '@/views/ScheduleView.vue'
import LiveView from '@/views/LiveView.vue'
import AnalyseView from '@/views/AnalyseView.vue'
import NationsView from '@/views/NationsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/index.html', redirect: '/' },
    { path: '/schedule.html', redirect: '/schedule' },
    { path: '/live.html', redirect: '/live' },
    { path: '/analyse.html', redirect: '/analyse' },
    { path: '/nations.html', redirect: '/nations' },
    {
      path: '/',
      name: 'results',
      component: ResultsView,
      meta: {
        titleKey: 'title_results',
        subtitleKey: 'subtitle',
        welcomeKey: 'welcome_results',
        nav: 'results',
        refreshKey: 'refresh_label',
        refreshTitleKey: 'tt_refresh',
      },
    },
    {
      path: '/schedule',
      name: 'schedule',
      component: ScheduleView,
      meta: {
        titleKey: 'title_schedule',
        subtitleKey: 'subtitle',
        welcomeKey: 'welcome_schedule',
        nav: 'schedule',
        refreshKey: 'refresh_label',
        refreshTitleKey: 'tt_refresh',
      },
    },
    {
      path: '/live',
      name: 'live',
      component: LiveView,
      meta: {
        titleKey: 'title_live',
        subtitleKey: 'subtitle',
        welcomeKey: 'welcome_live',
        nav: 'live',
        refreshKey: 'status_ready',
        refreshTitleKey: 'tt_refresh',
        liveMenu: true,
      },
    },
    {
      path: '/analyse',
      name: 'analyse',
      component: AnalyseView,
      meta: {
        titleKey: 'title_analyse',
        subtitleKey: 'subtitle_analyse',
        welcomeKey: 'welcome_analyse',
        nav: 'analyse',
        refreshKey: 'status_ready',
        refreshTitleKey: 'tt_status',
      },
    },
    {
      path: '/nations',
      name: 'nations',
      component: NationsView,
      meta: {
        titleKey: 'title_nations',
        subtitleKey: 'subtitle_nations',
        welcomeKey: 'welcome_nations',
        nav: 'nations',
        brandIcon: '🏅',
        brandTo: '/nations',
        refreshKey: 'status_last_update',
        refreshTitleKey: 'tt_refresh',
      },
    },
  ],
})

export default router
