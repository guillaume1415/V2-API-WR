const DARK = {
  paper: '#1a1d27',
  plot: '#1a1d27',
  grid: '#2e3347',
  zero: '#2e3347',
  line: '#2e3347',
  text: '#e2e8f0',
  muted: '#64748b',
  spike: '#94a3b8',
  hoverBg: 'rgba(26,29,39,0.96)',
  hoverBorder: '#2e3347',
}

const LIGHT = {
  paper: '#ffffff',
  plot: '#ffffff',
  grid: '#e2e8f0',
  zero: '#cbd5e1',
  line: '#cbd5e1',
  text: '#1e293b',
  muted: '#64748b',
  spike: '#94a3b8',
  hoverBg: 'rgba(255,255,255,0.96)',
  hoverBorder: '#cbd5e1',
}

export function themeColors(theme) {
  return theme === 'light' ? LIGHT : DARK
}

export function baseLayout(theme, overrides = {}) {
  const c = themeColors(theme)
  return {
    paper_bgcolor: c.paper,
    plot_bgcolor: c.plot,
    font: { color: c.text, family: 'Segoe UI, system-ui, sans-serif', size: 11 },
    margin: { l: 48, r: overrides.yaxis2 ? 48 : 16, t: 28, b: 36 },
    xaxis: {
      title: 'm',
      gridcolor: c.grid,
      zerolinecolor: c.zero,
      linecolor: c.line,
      color: c.muted,
      showspikes: true,
      spikemode: 'across',
      spikesnap: 'cursor',
      spikecolor: c.spike,
      spikethickness: 1,
      spikedash: 'dot',
      hoverformat: '.0f',
      ticksuffix: ' m',
      ...overrides.xaxis,
    },
    yaxis: {
      gridcolor: c.grid,
      zerolinecolor: c.zero,
      linecolor: c.line,
      color: c.muted,
      ...overrides.yaxis,
    },
    ...(overrides.yaxis2
      ? {
          yaxis2: {
            overlaying: 'y',
            side: 'right',
            gridcolor: c.grid,
            zerolinecolor: c.zero,
            linecolor: c.line,
            color: c.muted,
            ...overrides.yaxis2,
          },
        }
      : {}),
    showlegend: false,
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor: c.hoverBg,
      bordercolor: c.hoverBorder,
      font: { color: c.text, size: 11, family: 'Segoe UI, system-ui, sans-serif' },
      align: 'left',
    },
    hoverdistance: -1,
    ...overrides.layout,
  }
}

export const plotConfig = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
}

/**
 * Plotly trace renderer. `scattergl` (WebGL) is faster on desktop but fails
 * silently on many mobile browsers and in-app WebViews (blank plot + broken-
 * image icon). Live charts already use SVG `scatter`.
 */
export function plotTraceType() {
  if (typeof window === 'undefined') return 'scatter'
  if (window.innerWidth <= 720) return 'scatter'
  if (navigator.maxTouchPoints > 0) return 'scatter'
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return 'scatter'
  return 'scattergl'
}

export const SPECTRAL = [
  [0.0, '#5e4fa2'],
  [0.111, '#3288bd'],
  [0.222, '#66c2a5'],
  [0.333, '#abdda4'],
  [0.444, '#e6f598'],
  [0.555, '#fee08b'],
  [0.666, '#fdae61'],
  [0.777, '#f46d43'],
  [0.888, '#d53e4f'],
  [1.0, '#9e0142'],
]

/** Bornes en valeurs de données (bas → haut), pour les champs d'échelle */
export function yRangeBounds(spec, userScale, values) {
  const ys = values.filter((v) => v != null && isFinite(v))
  let lo =
    userScale?.yMin != null
      ? userScale.yMin
      : spec.yMin != null
        ? spec.yMin
        : ys.length
          ? Math.min(...ys)
          : 0
  let hi =
    userScale?.yMax != null
      ? userScale.yMax
      : spec.yMax != null
        ? spec.yMax
        : ys.length
          ? Math.max(...ys)
          : 1
  if (lo > hi) [lo, hi] = [hi, lo]
  if (lo === hi) hi = lo + 1
  return [lo, hi]
}

/**
 * Config axe Y Plotly — valeurs toujours positives sur l'axe.
 * Sans invertY : petites valeurs en bas, grandes en haut (ex. 30 en bas, 40 en haut).
 * Avec invertY : petites valeurs en haut (P1, leader 0 m) — rang / écart uniquement.
 */
export function plotlyYAxisConfig(spec, userScale, values) {
  const [lo, hi] = yRangeBounds(spec, userScale, values)
  if (spec.invertY) {
    return { range: [lo, hi], autorange: 'reversed' }
  }
  return { range: [lo, hi], autorange: false }
}

/** @deprecated utiliser plotlyYAxisConfig */
export function plotlyYRange(spec, userScale, values) {
  const cfg = plotlyYAxisConfig(spec, userScale, values)
  return cfg.range
}

export function buildTraces(lanes, spec, { hiddenLanes, xMin, xMax, yaxis = 'y' }) {
  const traces = []
  lanes.forEach((lane, idx) => {
    if (hiddenLanes.has(lane.id)) return
    const pts = spec
      .seriesFn
      ? spec.seriesFn(lane)
      : spec.getY
        ? (lane.live || [])
            .map((p) => {
              const tr = p.raceBoatTracker || {}
              const x = tr.distanceTravelled
              const y = spec.getY(tr, p)
              return x != null && y != null && isFinite(y) ? { x, y } : null
            })
            .filter(Boolean)
            .sort((a, b) => a.x - b.x)
        : []
    const filtered = pts.filter((p) => p.x >= xMin && p.x <= xMax)
    if (filtered.length < 2) return
    const yRaw = filtered.map((p) => p.y)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      name: lane.DisplayName,
      x: filtered.map((p) => p.x),
      y: yRaw,
      customdata: spec.fmt ? yRaw.map((y) => spec.fmt(y)) : undefined,
      line: {
        color: spec.colorFn ? spec.colorFn(lane, idx) : '#5da7f7',
        width: spec.dashed ? 1.4 : 1.8,
        dash: spec.dashed ? 'dash' : 'solid',
      },
      yaxis,
      hovertemplate: spec.fmt
        ? `%{customdata}<extra>${lane.DisplayName}</extra>`
        : `%{y:.2f}<extra>${lane.DisplayName}</extra>`,
    })
  })
  return traces
}
