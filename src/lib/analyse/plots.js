import { laneColor } from '@/lib/lanes'
import { baseLayout, plotTraceType } from '@/components/charts/chartTheme'
import { Y_DEFAULTS, C_DEFAULTS, SPECTRAL, getSpeedDefaults } from './constants'
import { buildOfficialSplitSeries, buildTimeYTicks, formatSec, parseRaceTime } from './time'

/**
 * Plots are built in three independent steps so that consumers (and Vue
 * `computed()`s) can memoise each one on its own reactive dependency set:
 *
 *   - `buildAnalysePlotsMeta(...)`   : id/titles/units/layout flags. Stable
 *                                      for the lifetime of a race.
 *   - `buildAnalyseTraces(...)`      : `traces[]` per plot. Recomputes only
 *                                      when `series` / `colorBy` /
 *                                      `sizeByDps` / `cScales` / `globalScales`
 *                                      / `totalLength` change.
 *   - `buildAnalyseLayouts(...)`     : `layout` per plot. Recomputes when
 *                                      `yScales` / `theme` / `boatClass`
 *                                      change.
 *
 * The legacy `buildAnalysePlots(...)` is kept as a backward-compatible
 * wrapper that combines the three (used by the HTML report exporter).
 *
 * Splitting traces and layout matters because Y-axis scale sliders only need
 * a `Plotly.relayout` — not a full `Plotly.react`. `PlotlyChart.vue` detects
 * the unchanged `data` reference and skips the trace re-bind.
 */

function globalFor(globalScales, plotId, axis) {
  const map = {
    'speed:y': 'speed',
    'dps:y': 'speed',
    'gap:c': 'speed',
    'cadence:y': 'cadence',
    'speed:c': 'cadence',
  }
  const key = map[`${plotId}:${axis}`]
  return key ? globalScales[key] : null
}

function yAxisSpec(plotId, baseSpec, yScales, globalScales, boatClass) {
  const cur = yScales[plotId] || {}
  const def = plotId === 'speed' ? getSpeedDefaults(boatClass) : Y_DEFAULTS[plotId] || {}
  const glob = globalFor(globalScales, plotId, 'y') || {}
  const mn = cur.min != null ? cur.min : glob.min != null ? glob.min : def.min
  const mx = cur.max != null ? cur.max : glob.max != null ? glob.max : def.max
  const spec = { ...baseSpec }
  if (mn != null && mx != null) {
    spec.range = baseSpec.autorange === 'reversed' ? [mx, mn] : [mn, mx]
    delete spec.autorange
  } else if (mn != null || mx != null) {
    spec.autorange = baseSpec.autorange || true
  }
  return spec
}

function cRange(plotId, validVals, cScales, globalScales, defObj) {
  const cCur = cScales[plotId] || {}
  const cDef = defObj || {}
  const glob = globalFor(globalScales, plotId, 'c') || {}
  const mn = cCur.min != null ? cCur.min : glob.min != null ? glob.min : cDef.min
  const mx = cCur.max != null ? cCur.max : glob.max != null ? glob.max : cDef.max
  let autoMin = Infinity
  let autoMax = -Infinity
  for (let i = 0; i < validVals.length; i++) {
    const v = validVals[i]
    if (v == null || !isFinite(v)) continue
    if (v < autoMin) autoMin = v
    if (v > autoMax) autoMax = v
  }
  if (autoMin === Infinity) {
    autoMin = 0
    autoMax = 1
  }
  return { cmin: mn != null ? mn : autoMin, cmax: mx != null ? mx : autoMax }
}

function markerSizes(dpsArr, sizeByDps) {
  if (!sizeByDps) return 7
  let mn = Infinity
  let mx = -Infinity
  for (let i = 0; i < dpsArr.length; i++) {
    const v = dpsArr[i]
    if (v == null || !isFinite(v)) continue
    if (v < mn) mn = v
    if (v > mx) mx = v
  }
  if (mn === Infinity) return 7
  if (mx === mn) return 8
  return dpsArr.map((v) => (v == null ? 4 : 4 + (12 * (v - mn)) / (mx - mn)))
}

function buildSplitAnnotations(inters) {
  let prevD = 0
  let prevT = 0
  const splitAnnotations = []
  for (const i of inters) {
    const segDist = i.d - prevD
    const segTime = i.t - prevT
    if (segDist > 0 && segTime > 0) {
      splitAnnotations.push({
        x: (prevD + i.d) / 2,
        text: `<b>${formatSec(segTime)}</b>`,
        segEnd: i.d,
      })
    }
    prevD = i.d
    prevT = i.t
  }
  return splitAnnotations
}

function buildSplitAnnots(splitAnnotations) {
  return splitAnnotations.map((s) => ({
    x: s.x,
    y: 0.98,
    xref: 'x',
    yref: 'paper',
    text: s.text,
    showarrow: false,
    font: { size: 11, color: '#e2e8f0' },
    bgcolor: 'rgba(35,39,58,0.65)',
    bordercolor: '#2e3347',
    borderwidth: 1,
    borderpad: 3,
    yanchor: 'bottom',
  }))
}

function buildSplitShapes(splitAnnotations) {
  return splitAnnotations.map((s) => ({
    type: 'line',
    xref: 'x',
    yref: 'paper',
    x0: s.segEnd,
    x1: s.segEnd,
    y0: 0,
    y1: 1,
    line: { color: '#3b82f6', width: 1, dash: 'dot' },
    opacity: 0.35,
  }))
}

function buildTraces({
  plotId,
  yKey,
  series,
  multi,
  colorBy,
  sizeByDps,
  cScales,
  globalScales,
  colorMode = 'auto',
  hovY = '%{y:.2f}',
  yUnit = '',
  t,
  traceType: traceTypeOverride,
}) {
  const traceType = traceTypeOverride || plotTraceType()
  if (multi) {
    return series.map((s, idx) => ({
      x: s.xs,
      y: s[yKey],
      mode: 'markers+lines',
      type: traceType,
      name: s.lane.DisplayName || `Lane ${s.lane.Lane}`,
      marker: { size: 5, color: laneColor(s.lane, idx) },
      line: { width: 1.5, color: laneColor(s.lane, idx) },
      hovertemplate: `<b>%{fullData.name}</b> : ${hovY}${yUnit ? ` ${yUnit}` : ''}<extra></extra>`,
    }))
  }

  const s = series[0]
  const useSpeed = colorMode === 'speed' || (colorMode === 'auto' && colorBy === 'speed')
  const colorArr = useSpeed ? s.speeds : s.cads
  const colorTitle = useSpeed ? t('color_speed') : t('color_cadence')
  let hoverColorLabel = colorTitle
  if (plotId === 'speed' && !useSpeed) hoverColorLabel = t('hover_spm')
  else if ((plotId === 'cadence' || plotId === 'gap') && useSpeed) hoverColorLabel = t('hover_ms')
  const cDefKey = useSpeed ? 'cadence' : 'speed'
  const cr = cRange(plotId, colorArr, cScales, globalScales, C_DEFAULTS[cDefKey] || {})
  const safeColor = colorArr.map((v) => (v != null && isFinite(v) ? v : cr.cmin))
  return [
    {
      x: s.xs,
      y: s[yKey],
      mode: 'markers',
      type: traceType,
      marker: {
        size: markerSizes(s.dpsArr, sizeByDps),
        color: safeColor,
        cmin: cr.cmin,
        cmax: cr.cmax,
        colorscale: SPECTRAL,
        colorbar: { title: { text: colorTitle, font: { size: 10 } }, thickness: 10, len: 0.85 },
        line: { width: 0.4, color: 'rgba(0,0,0,0.4)' },
      },
      name: s.lane.DisplayName || `Lane ${s.lane.Lane}`,
      hovertemplate: `<b>%{fullData.name}</b> : ${hovY}${yUnit ? ` ${yUnit}` : ''} · ${hoverColorLabel}: %{marker.color:.2f}<extra></extra>`,
    },
  ]
}

function buildTimeTraces(series, totalLength, traceTypeOverride) {
  const traceType = traceTypeOverride || plotTraceType()
  return series
    .map((s, idx) => {
      const split = buildOfficialSplitSeries(s.lane, totalLength)
      if (!split) return null
      const col = laneColor(s.lane, idx)
      return {
        x: split.xs,
        y: split.times,
        customdata: split.hovers,
        mode: 'lines+markers',
        type: traceType,
        name: s.lane.DisplayName || `Lane ${s.lane.Lane}`,
        marker: { size: split.markerSizes, color: col },
        line: { width: 1.5, color: col },
        hovertemplate: '<b>%{fullData.name}</b><br>%{customdata}<extra></extra>',
      }
    })
    .filter(Boolean)
}

function timeRangeFromTraces(traces) {
  let tMin = Infinity
  let tMax = -Infinity
  for (const tr of traces) {
    for (const v of tr.y) {
      if (v == null || !isFinite(v)) continue
      if (v < tMin) tMin = v
      if (v > tMax) tMax = v
    }
  }
  if (tMin === Infinity) {
    tMin = 0
    tMax = 1
  }
  const pad = Math.max(2, (tMax - tMin) * 0.08)
  const yLo = Math.max(0, tMin - pad)
  const yHi = tMax + pad
  const yTicks = buildTimeYTicks(yLo, yHi)
  return { yLo, yHi, yTicks }
}

/**
 * Stable per-plot metadata: ids, card ids, i18n keys, units, layout flags.
 * Depends only on whether the series array is non-empty.
 */
export function buildAnalysePlotsMeta({ series }) {
  if (!series.length) return []
  return [
    {
      id: 'speed',
      cardId: 'card-speed',
      titleKey: 'chart_speed_title',
      subKey: 'chart_speed_sub',
      unit: 'm/s',
      tall: false,
      fullWidth: false,
      colorOpts: { labelKey: 'lbl_color_cadence', unit: 'spm', def: C_DEFAULTS.speed },
    },
    {
      id: 'cadence',
      cardId: 'card-cadence',
      titleKey: 'chart_cadence_title',
      subKey: 'chart_cadence_sub',
      unit: 'spm',
      tall: false,
      fullWidth: false,
    },
    {
      id: 'time',
      cardId: 'card-rank',
      titleKey: 'chart_time_title',
      subKey: 'chart_time_sub',
      unit: 'min:s',
      tall: false,
      fullWidth: false,
    },
    {
      id: 'gap',
      cardId: 'card-gap',
      titleKey: 'chart_gap_title',
      subKey: 'chart_gap_sub',
      unit: 'm',
      tall: false,
      fullWidth: false,
    },
    {
      id: 'dps',
      cardId: 'card-dps',
      titleKey: 'chart_dps_title',
      subKey: 'chart_dps_sub',
      unit: 'm/stroke',
      tall: true,
      fullWidth: true,
    },
  ]
}

/**
 * Per-plot traces. Returns a map keyed by plot id so callers can read
 * `traces[id]` with a stable reference suitable for Plotly.relayout-only
 * updates downstream.
 */
export function buildAnalyseTraces({
  series,
  totalLength,
  colorBy,
  sizeByDps,
  cScales,
  globalScales,
  t,
  traceType,
}) {
  if (!series.length) return {}
  const multi = series.length > 1
  const sharedArgs = {
    series,
    multi,
    colorBy,
    sizeByDps,
    cScales,
    globalScales,
    t,
    traceType,
  }
  return {
    speed: buildTraces({
      ...sharedArgs,
      plotId: 'speed',
      yKey: 'speeds',
      colorMode: 'auto',
      hovY: '%{y:.2f}',
      yUnit: 'm/s',
    }),
    cadence: buildTraces({
      ...sharedArgs,
      plotId: 'cadence',
      yKey: 'cads',
      colorMode: 'speed',
      hovY: '%{y:.0f}',
      yUnit: 'spm',
    }),
    time: buildTimeTraces(series, totalLength, traceType),
    gap: buildTraces({
      ...sharedArgs,
      plotId: 'gap',
      yKey: 'gaps',
      colorMode: 'speed',
      hovY: '%{y:.1f}',
      yUnit: 'm',
    }),
    dps: buildTraces({
      ...sharedArgs,
      plotId: 'dps',
      yKey: 'dpsArr',
      colorMode: 'auto',
      hovY: '%{y:.2f}',
      yUnit: 'm/stroke',
    }),
  }
}

/**
 * Per-plot layouts. Cheap to recompute when only a Y-axis slider moves; the
 * caller can then issue `Plotly.relayout` instead of a full `Plotly.react`.
 */
export function buildAnalyseLayouts({
  series,
  theme,
  totalLength,
  yScales,
  globalScales,
  boatClass,
  t,
}) {
  if (!series.length) return {}
  const multi = series.length > 1
  const ref = series[0]
  const lane = ref.lane
  const peakStats = ref.peakStats

  const inters = (!multi ? lane.intermediates || [] : [])
    .map((i) => ({
      d: parseInt((i.distance?.DisplayName || '').replace(/\D/g, ''), 10),
      t: parseRaceTime(i.ResultTime),
    }))
    .filter((i) => isFinite(i.d) && i.t != null)
    .sort((a, b) => a.d - b.d)

  const splitAnnotations = buildSplitAnnotations(inters)
  const splitAnnots = buildSplitAnnots(splitAnnotations)
  const splitShapes = buildSplitShapes(splitAnnotations)

  const layoutCommon = {
    ...baseLayout(theme, {
      xaxis: { title: t('axis_distance'), range: [0, totalLength || 2000] },
    }),
    showlegend: multi,
    annotations: splitAnnots,
    shapes: splitShapes,
  }

  const timeTraces = buildTimeTraces(series, totalLength)
  const { yLo, yHi, yTicks } = timeRangeFromTraces(timeTraces)

  return {
    speed: {
      ...layoutCommon,
      yaxis: yAxisSpec('speed', { title: t('axis_speed') }, yScales, globalScales, boatClass),
      annotations: [
        ...splitAnnots,
        ...(!multi && peakStats
          ? [
              {
                x: (peakStats.dStart + peakStats.dEnd) / 2,
                y: 0.97,
                xref: 'x',
                yref: 'paper',
                text: `<b>${t('annot_vmax')}</b> (${peakStats.dStart | 0}-${peakStats.dEnd | 0}m) : <b>${peakStats.max.toFixed(2)}</b> m/s · moy ${peakStats.avg.toFixed(2)}`,
                showarrow: false,
                font: { size: 11, color: '#9e0142' },
                bgcolor: 'rgba(254,235,235,0.92)',
                bordercolor: '#9e0142',
                borderwidth: 1,
                borderpad: 4,
                yanchor: 'top',
              },
            ]
          : []),
      ],
    },
    cadence: {
      ...layoutCommon,
      yaxis: yAxisSpec('cadence', { title: t('axis_cadence') }, yScales, globalScales, boatClass),
    },
    time: {
      ...layoutCommon,
      yaxis: yAxisSpec(
        'time',
        {
          title: t('axis_time'),
          autorange: 'reversed',
          range: [yHi, yLo],
          tickvals: yTicks.tickvals,
          ticktext: yTicks.ticktext,
        },
        yScales,
        globalScales,
        boatClass,
      ),
    },
    gap: {
      ...layoutCommon,
      yaxis: yAxisSpec(
        'gap',
        { title: t('axis_gap'), autorange: 'reversed', rangemode: 'tozero' },
        yScales,
        globalScales,
        boatClass,
      ),
    },
    dps: {
      ...layoutCommon,
      margin: { l: 48, r: 75, t: 18, b: 50 },
      yaxis: yAxisSpec('dps', { title: t('axis_dps') }, yScales, globalScales, boatClass),
    },
  }
}

/**
 * Backward-compatible wrapper: combines meta + traces + layouts into the
 * legacy `[{ id, cardId, ..., traces, layout, tall, fullWidth, colorOpts }]`
 * shape. Used by the HTML report exporter and as a convenience in tests.
 */
export function buildAnalysePlots(args) {
  const meta = buildAnalysePlotsMeta(args)
  const traces = buildAnalyseTraces(args)
  const layouts = buildAnalyseLayouts(args)
  return meta.map((m) => ({
    ...m,
    traces: traces[m.id] || [],
    layout: layouts[m.id] || {},
  }))
}

export function getYScaleDefaults(plotId, boatClass) {
  return plotId === 'speed' ? getSpeedDefaults(boatClass) : Y_DEFAULTS[plotId] || {}
}

export { C_DEFAULTS, Y_DEFAULTS }
