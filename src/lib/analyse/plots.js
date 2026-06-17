import { laneColor } from '@/lib/lanes'
import { baseLayout } from '@/components/charts/chartTheme'
import { Y_DEFAULTS, C_DEFAULTS, SPECTRAL, getSpeedDefaults } from './constants'
import { buildOfficialSplitSeries, buildTimeYTicks, formatSec, parseRaceTime } from './time'

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
  const v = validVals.filter((x) => x != null && isFinite(x))
  const autoMin = v.length ? Math.min(...v) : 0
  const autoMax = v.length ? Math.max(...v) : 1
  return { cmin: mn != null ? mn : autoMin, cmax: mx != null ? mx : autoMax }
}

function markerSizes(dpsArr, sizeByDps) {
  if (!sizeByDps) return 7
  const valid = dpsArr.filter((v) => v != null && isFinite(v))
  if (!valid.length) return 7
  const mn = Math.min(...valid)
  const mx = Math.max(...valid)
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
}) {
  if (multi) {
    return series.map((s, idx) => ({
      x: s.xs,
      y: s[yKey],
      mode: 'markers+lines',
      type: 'scattergl',
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
      type: 'scattergl',
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

export function buildAnalysePlots({
  series,
  totalLength,
  theme,
  boatClass,
  yScales,
  cScales,
  globalScales,
  colorBy,
  sizeByDps,
  t,
}) {
  if (!series.length) return []

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

  const plots = []

  plots.push({
    id: 'speed',
    cardId: 'card-speed',
    titleKey: 'chart_speed_title',
    subKey: 'chart_speed_sub',
    unit: 'm/s',
    colorOpts: { labelKey: 'lbl_color_cadence', unit: 'spm', def: C_DEFAULTS.speed },
    traces: buildTraces({
      plotId: 'speed',
      yKey: 'speeds',
      series,
      multi,
      colorBy,
      sizeByDps,
      cScales,
      globalScales,
      colorMode: 'auto',
      hovY: '%{y:.2f}',
      yUnit: 'm/s',
      t,
    }),
    layout: {
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
    tall: false,
  })

  plots.push({
    id: 'cadence',
    cardId: 'card-cadence',
    titleKey: 'chart_cadence_title',
    subKey: 'chart_cadence_sub',
    unit: 'spm',
    traces: buildTraces({
      plotId: 'cadence',
      yKey: 'cads',
      series,
      multi,
      colorBy,
      sizeByDps,
      cScales,
      globalScales,
      colorMode: 'speed',
      hovY: '%{y:.0f}',
      yUnit: 'spm',
      t,
    }),
    layout: {
      ...layoutCommon,
      yaxis: yAxisSpec('cadence', { title: t('axis_cadence') }, yScales, globalScales, boatClass),
    },
    tall: false,
  })

  const timeTraces = series
    .map((s, idx) => {
      const split = buildOfficialSplitSeries(s.lane, totalLength)
      if (!split) return null
      const col = laneColor(s.lane, idx)
      return {
        x: split.xs,
        y: split.times,
        customdata: split.hovers,
        mode: 'lines+markers',
        type: 'scattergl',
        name: s.lane.DisplayName || `Lane ${s.lane.Lane}`,
        marker: { size: split.markerSizes, color: col },
        line: { width: 1.5, color: col },
        hovertemplate: '<b>%{fullData.name}</b><br>%{customdata}<extra></extra>',
      }
    })
    .filter(Boolean)

  const allTimes = timeTraces.flatMap((tr) => tr.y).filter((v) => v != null && isFinite(v))
  const tMin = allTimes.length ? Math.min(...allTimes) : 0
  const tMax = allTimes.length ? Math.max(...allTimes) : 1
  const pad = Math.max(2, (tMax - tMin) * 0.08)
  const yLo = Math.max(0, tMin - pad)
  const yHi = tMax + pad
  const yTicks = buildTimeYTicks(yLo, yHi)

  plots.push({
    id: 'time',
    cardId: 'card-rank',
    titleKey: 'chart_time_title',
    subKey: 'chart_time_sub',
    unit: 'min:s',
    traces: timeTraces,
    layout: {
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
    tall: false,
  })

  plots.push({
    id: 'gap',
    cardId: 'card-gap',
    titleKey: 'chart_gap_title',
    subKey: 'chart_gap_sub',
    unit: 'm',
    traces: buildTraces({
      plotId: 'gap',
      yKey: 'gaps',
      series,
      multi,
      colorBy,
      sizeByDps,
      cScales,
      globalScales,
      colorMode: 'speed',
      hovY: '%{y:.1f}',
      yUnit: 'm',
      t,
    }),
    layout: {
      ...layoutCommon,
      yaxis: yAxisSpec(
        'gap',
        { title: t('axis_gap'), autorange: 'reversed', rangemode: 'tozero' },
        yScales,
        globalScales,
        boatClass,
      ),
    },
    tall: false,
  })

  plots.push({
    id: 'dps',
    cardId: 'card-dps',
    titleKey: 'chart_dps_title',
    subKey: 'chart_dps_sub',
    unit: 'm/stroke',
    traces: buildTraces({
      plotId: 'dps',
      yKey: 'dpsArr',
      series,
      multi,
      colorBy,
      sizeByDps,
      cScales,
      globalScales,
      colorMode: 'auto',
      hovY: '%{y:.2f}',
      yUnit: 'm/stroke',
      t,
    }),
    layout: {
      ...layoutCommon,
      margin: { l: 48, r: 75, t: 18, b: 50 },
      yaxis: yAxisSpec('dps', { title: t('axis_dps') }, yScales, globalScales, boatClass),
    },
    tall: true,
    fullWidth: true,
  })

  return plots
}

export function getYScaleDefaults(plotId, boatClass) {
  return plotId === 'speed' ? getSpeedDefaults(boatClass) : Y_DEFAULTS[plotId] || {}
}

export { C_DEFAULTS, Y_DEFAULTS }
