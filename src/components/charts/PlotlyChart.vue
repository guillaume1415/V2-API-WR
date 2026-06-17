<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Plotly from 'plotly.js-dist-min'
import { useAppStore } from '@/stores/app'
import { plotConfig } from './chartTheme'

const props = defineProps({
  data: { type: Array, default: () => [] },
  layout: { type: Object, default: () => ({}) },
  height: { type: String, default: '200px' },
  cursorHover: { type: Boolean, default: false },
})

const app = useAppStore()
const el = ref(null)
let ro = null
let hoverObs = null

async function render() {
  if (!el.value || !props.data.length) return
  const layout = { ...props.layout, autosize: true }
  await Plotly.react(el.value, props.data, layout, plotConfig)
  if (props.cursorHover) attachCursorHover()
}

function resize() {
  if (el.value) Plotly.Plots.resize(el.value)
}

function attachCursorHover() {
  const node = el.value
  if (!node || node._cursorHoverAttached) return
  node._cursorHoverAttached = true

  let curX = 0
  let curY = 0
  let hasCursor = false

  node.addEventListener(
    'mousemove',
    (e) => {
      const svg = node.querySelector('.main-svg')
      if (!svg) return
      const r = svg.getBoundingClientRect()
      curX = e.clientX - r.left
      curY = e.clientY - r.top
      hasCursor = true
      applyTransform()
    },
    { passive: true },
  )

  node.addEventListener('mouseleave', () => {
    hasCursor = false
  }, { passive: true })

  function applyTransform() {
    if (!hasCursor) return
    const layer = node.querySelector('.hoverlayer')
    if (!layer) return
    const bubble = layer.querySelector('g.legend')
    if (!bubble) return
    const target = `translate(${curX},${curY})`
    if (bubble.getAttribute('transform') !== target) bubble.setAttribute('transform', target)
  }

  hoverObs = new MutationObserver(applyTransform)
  const wireObserver = () => {
    const layer = node.querySelector('.hoverlayer')
    if (layer) {
      hoverObs.observe(layer, {
        subtree: true,
        attributes: true,
        attributeFilter: ['transform'],
        childList: true,
      })
    } else {
      requestAnimationFrame(wireObserver)
    }
  }
  wireObserver()
}

onMounted(() => {
  render()
  ro = new ResizeObserver(() => requestAnimationFrame(resize))
  if (el.value) ro.observe(el.value)
})

onUnmounted(() => {
  ro?.disconnect()
  hoverObs?.disconnect()
  if (el.value) {
    delete el.value._cursorHoverAttached
    Plotly.purge(el.value)
  }
})

watch(
  () => [props.data, props.layout, app.theme, props.cursorHover],
  () => render(),
  { deep: true },
)
</script>

<template>
  <div
    ref="el"
    class="plotly-chart"
    :style="{ height }"
  />
</template>

<style scoped>
.plotly-chart {
  width: 100%;
}

.plotly-chart :deep(.modebar) {
  top: 2px;
  right: 2px;
}
</style>
