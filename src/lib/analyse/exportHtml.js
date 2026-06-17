import { buildAnalysePlots } from './plots'
import { buildAnalysePaceTable } from './paceTable'
import {
  getBoatClassDisplayName,
  getLanes,
  getWbt,
  getWbtCode,
} from './constants'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function reportSlugPart(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'rapport'
  )
}

function reportFilename({
  selectedComp,
  selectedRace,
  compareMode,
  cmpSelectedRace,
}) {
  const parts = [
    reportSlugPart(selectedComp?.DisplayName || selectedComp?.CompetitionCode),
    reportSlugPart(selectedRace?.DisplayName),
  ]
  if (compareMode && cmpSelectedRace) {
    parts.push(reportSlugPart(cmpSelectedRace.DisplayName))
    return `${parts.filter(Boolean).join('_') || 'world-rowing-compare'}_comparaison.html`
  }
  return `${parts.filter(Boolean).join('_') || 'world-rowing-analyse'}_rapport.html`
}

function cleanPlotlyObject(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => (k.startsWith('_') ? undefined : v)))
}

function buildRaceExportMeta({ comp, race, cls, date, boats, isFr }) {
  return `<div class="meta" style="margin-bottom:12px">
    <p><strong>${isFr ? 'Compétition :' : 'Competition:'}</strong> ${esc(comp)}</p>
    <p><strong>${isFr ? 'Course :' : 'Race:'}</strong> ${esc(race)}</p>
    ${cls ? `<p><strong>${isFr ? 'Classe :' : 'Class:'}</strong> ${esc(cls)}</p>` : ''}
    ${date ? `<p><strong>${isFr ? 'Date :' : 'Date:'}</strong> ${esc(date)}</p>` : ''}
    <p><strong>${isFr ? 'Bateaux analysés :' : 'Boats analysed:'}</strong> ${esc(boats)}</p>
  </div>`
}

function renderPaceTableHtml(lanes, wbt, t) {
  const table = buildAnalysePaceTable(lanes, wbt)
  if (!table) {
    return `<div class="empty">${esc(lanes.length ? t('tbl_no_inters') : t('tbl_no_boats'))}</div>`
  }

  let html = `<table class="splits-table"><thead><tr>
    <th rowspan="2" class="rank">#</th>
    <th rowspan="2" class="nation">${esc(t('tbl_team'))}</th>`
  for (const d of table.dists) html += `<th class="dist">${esc(table.distMap.get(d))}</th>`
  if (table.hasWbt) html += `<th rowspan="2" class="pct-wbt">${esc(t('tbl_pct_wbt'))}</th>`
  html += `</tr><tr>`
  for (const d of table.dists) html += `<th class="pace-legend">${esc(t('tbl_legend'))}</th>`
  html += `</tr></thead><tbody>`

  for (const row of table.rows) {
    html += `<tr${row.isWR ? ' class="wr-row"' : ''}>
      <td class="rank">${row.rank ?? '—'}</td>
      <td class="nation"><span class="swatch-mini" style="background:${esc(row.color)}"></span><strong>${esc(row.name)}</strong></td>`
    for (const cell of row.cells) {
      if (!cell) {
        html += `<td class="pace-cell">—</td>`
        continue
      }
      const cumRankStr = cell.cumRank
        ? `<small style="color:#64748b;margin-left:2px">(${cell.cumRank})</small>`
        : ''
      const sRankStr = cell.splitRank
        ? `<small style="color:#64748b;margin-left:2px">(${cell.splitRank})</small>`
        : ''
      const wrBadge = cell.isWR ? ` <span class="wr-badge">${esc(t('tbl_wr_badge'))}</span>` : ''
      const gapStr = cell.isLeader
        ? `<small style="color:#059669;margin-left:4px">—</small>`
        : cell.cumGap != null
          ? `<small style="color:#ef4444;margin-left:4px">+${cell.cumGap.toFixed(1)}</small>`
          : ''
      html += `<td class="pace-cell${cell.isWR ? ' wr-cell' : ''}">
        <div class="pace-cum">${esc(cell.cumTime)}${cumRankStr}${wrBadge}</div>
        <div class="pace-split">${esc(cell.split)}${sRankStr}${gapStr}</div>
      </td>`
    }
    if (table.hasWbt) {
      if (row.pctWbt != null) {
        const pctVal = parseFloat(row.pctWbt)
        const pctColor = row.isWR
          ? '#b45309'
          : pctVal >= 99
            ? '#059669'
            : pctVal >= 97
              ? '#2563eb'
              : '#64748b'
        html += `<td class="pct-wbt-cell" style="color:${pctColor};font-weight:600">${row.pctWbt}%${row.isWR ? ' ★' : ''}</td>`
      } else {
        html += `<td class="pct-wbt-cell" style="color:#64748b">—</td>`
      }
    }
    html += `</tr>`
  }
  return `${html}</tbody></table>`
}

function renderPaceTableExportHtml(lanes, wbt, wbtCode, t) {
  let html = ''
  if (wbt) {
    html += `<p style="margin:0 0 10px;color:#b45309;font-weight:600">${esc(t('wbt_label', { cls: wbtCode, time: wbt.time }))}</p>`
  }
  html += renderPaceTableHtml(lanes, wbt, t)
  return html
}

function buildExportPaceSection({
  data,
  selectedRace,
  selectedComp,
  selectedLaneIds,
  title,
  t,
  isFr,
}) {
  const race = data?.config?.race || selectedRace || {}
  const lanes = getLanes(data)
  const selected = selectedLaneIds
    .map((id) => lanes.find((l) => l.id === id))
    .filter(Boolean)
  const cls = getBoatClassDisplayName(data, selectedRace)
  const wbt = getWbt(cls)
  const wbtCode = getWbtCode(cls) || cls
  return {
    title,
    raceMeta: buildRaceExportMeta({
      comp: selectedComp?.DisplayName || '—',
      race: race.DisplayName || selectedRace?.DisplayName || '—',
      cls,
      date: (race.DateString || selectedRace?.DateString || '').slice(0, 16).replace('T', ' '),
      boats: selected.map((l) => l.DisplayName || '?').join(', ') || '—',
      isFr,
    }),
    paceTableHtml: renderPaceTableExportHtml(lanes, wbt, wbtCode, t),
  }
}

const REPORT_CHART_KEYS = {
  speed: 'report_chart_speed',
  cadence: 'report_chart_cadence',
  time: 'report_chart_time',
  gap: 'report_chart_gap',
  dps: 'report_chart_dps',
}

const REPORT_CHART_HEIGHTS = {
  speed: 520,
  cadence: 520,
  time: 520,
  gap: 520,
  dps: 640,
}

function buildReportHtml({ meta, paceSections, charts, lang }) {
  const chartBlocks = charts
    .map(
      (c, idx) => `
    <section class="report-chart">
      <h2>${esc(c.title)}</h2>
      <div id="chart-${idx}" style="width:100%;height:${c.height}px"></div>
    </section>`,
    )
    .join('')

  const chartScripts = charts
    .map((c, idx) => {
      const tracesJson = JSON.stringify(c.traces || [])
      const layoutJson = JSON.stringify(c.layout || {})
      const configJson = JSON.stringify({
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      })
      return `Plotly.newPlot('chart-${idx}', ${tracesJson}, ${layoutJson}, ${configJson});`
    })
    .join('\n')

  const isComparePace = (paceSections || []).length > 1
  const paceBlocks = isComparePace
    ? `<section class="compare-pace-export">
        <div class="compare-pace-grid">
          ${(paceSections || [])
            .map(
              (sec) => `
          <div class="compare-pace-col">
            <h2>${esc(sec.title)}</h2>
            ${sec.raceMeta || ''}
            <div class="table-wrap">${sec.paceTableHtml}</div>
          </div>`,
            )
            .join('')}
        </div>
      </section>`
    : (paceSections || [])
        .map(
          (sec) => `
  <section>
    <h2>${esc(sec.title)}</h2>
    ${sec.raceMeta || ''}
    <div class="table-wrap">${sec.paceTableHtml}</div>
  </section>`,
        )
        .join('')

  const wrapClass = isComparePace ? 'wrap compare-report' : 'wrap'

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"><\/script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#f1f5f9;color:#1e293b;line-height:1.45;padding:24px}
  .wrap{max-width:1200px;margin:0 auto}
  .wrap.compare-report{max-width:1680px}
  h1{font-size:1.35rem;margin-bottom:6px}
  .meta{color:#64748b;font-size:0.88rem;margin-bottom:18px}
  .meta p{margin:3px 0}
  .meta strong{color:#334155}
  section{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px}
  .compare-pace-export{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px}
  .compare-pace-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
  .compare-pace-col{min-width:0}
  .compare-pace-col h2{font-size:0.92rem;margin-bottom:8px;color:#334155}
  .compare-pace-col .meta{margin-bottom:10px}
  .compare-pace-col .table-wrap{overflow-x:auto}
  .compare-pace-grid .splits-table{font-size:0.76rem}
  h2{font-size:0.95rem;margin-bottom:10px;color:#334155}
  .splits-table{width:auto;max-width:100%;border-collapse:collapse;margin:0 auto;font-size:0.82rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;overflow:visible}
  .splits-table th,.splits-table td{padding:5px 9px;text-align:center;font-variant-numeric:tabular-nums;border-bottom:1px solid #e2e8f0;white-space:nowrap}
  .splits-table th{background:#f1f5f9;color:#64748b;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:.03em}
  .splits-table td.nation,.splits-table th.nation{text-align:left}
  .splits-table tr:last-child td{border-bottom:none}
  .splits-table td.rank,.splits-table th.rank{color:#64748b;width:32px}
  .splits-table .swatch-mini{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .splits-table td.best{color:#059669;font-weight:600}
  .splits-table td.total{color:#1e293b;font-weight:600}
  .splits-table td.pace-cell .pace-cum{font-weight:600;color:#1e293b}
  .splits-table td.pace-cell .pace-split{font-size:0.72rem;color:#64748b}
  .splits-table .wr-badge{display:inline-block;background:#f59e0b;color:#fff;border-radius:3px;padding:0 4px;font-size:0.68rem;font-weight:700;margin-left:4px;vertical-align:middle}
  .splits-table tr.wr-row td{background:rgba(245,158,11,0.08)}
  .splits-table td.wr-cell .pace-cum{color:#b45309;font-weight:700}
  .splits-table td.pct-wbt-cell,.splits-table th.pct-wbt{white-space:nowrap;font-weight:600}
  .table-wrap{overflow:visible;width:100%}
  @media(max-width:1100px){.compare-pace-grid{grid-template-columns:1fr}}
  @media print{
    body{padding:0;background:#fff}
    section{break-inside:avoid;box-shadow:none}
    .compare-pace-export{break-inside:avoid}
    .compare-pace-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .report-chart .js-plotly-plot{max-height:95vh}
  }
</style>
</head>
<body>
<div class="${wrapClass}">
  <h1>${esc(meta.title)}</h1>
  <div class="meta">
    <p><strong>${esc(meta.exportedLabel)}</strong> ${esc(meta.exported)}</p>
  </div>
  ${paceBlocks}
  ${chartBlocks}
</div>
<script>
window.addEventListener('DOMContentLoaded', function(){
  ${chartScripts}
});
<\/script>
</body>
</html>`
}

export function exportAnalyseHtmlReport(ctx) {
  const {
    t,
    locale,
    lastData,
    selectedRace,
    selectedComp,
    selectedLaneIds,
    compareMode,
    cmp,
    series,
    totalLength,
    boatClass,
    yScales,
    cScales,
    globalScales,
    colorBy,
    sizeByDps,
  } = ctx

  if (!lastData?.config) return { ok: false, reason: 'no_data' }
  if (compareMode && !cmp?.lastData) return { ok: false, reason: 'no_compare_b' }

  const isFr = locale === 'fr'
  const paceSections = [
    buildExportPaceSection({
      data: lastData,
      selectedRace,
      selectedComp,
      selectedLaneIds,
      title: compareMode ? t('compare_table_a') : t('report_intermediates'),
      t,
      isFr,
    }),
  ]
  if (compareMode && cmp.lastData) {
    paceSections.push(
      buildExportPaceSection({
        data: cmp.lastData,
        selectedRace: cmp.selectedRace,
        selectedComp: cmp.selectedComp,
        selectedLaneIds: cmp.selectedLaneIds,
        title: t('compare_table_b'),
        t,
        isFr,
      }),
    )
  }

  const plotDefs = buildAnalysePlots({
    series,
    totalLength,
    theme: 'light',
    boatClass,
    yScales,
    cScales,
    globalScales,
    colorBy,
    sizeByDps,
    t,
  })

  const charts = plotDefs
    .filter((p) => p.traces?.length)
    .map((p) => ({
      title: t(REPORT_CHART_KEYS[p.id] || p.titleKey),
      traces: cleanPlotlyObject(p.traces),
      layout: cleanPlotlyObject(p.layout),
      height: REPORT_CHART_HEIGHTS[p.id] || (p.tall ? 640 : 520),
    }))

  if (!charts.length) return { ok: false, reason: 'no_charts' }

  const isCompare = compareMode && cmp?.lastData
  const html = buildReportHtml({
    lang: locale,
    meta: {
      title: isCompare ? t('report_title_compare') : t('report_title'),
      exportedLabel: `${t('report_exported')} :`,
      exported: new Date().toLocaleString(isFr ? 'fr-FR' : 'en-GB'),
    },
    paceSections,
    charts,
  })

  downloadBlob(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    reportFilename({
      selectedComp,
      selectedRace,
      compareMode,
      cmpSelectedRace: cmp?.selectedRace,
    }),
  )
  return { ok: true }
}
