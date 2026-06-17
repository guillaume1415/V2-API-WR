import { parseSec } from '@/lib/pace'

export function parseRaceTime(t) {
  if (!t) return null
  const m = String(t).match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/)
  if (!m) return parseSec(t)
  return +m[1] * 3600 + +m[2] * 60 + +m[3]
}

export function formatSec(s) {
  if (s == null || !isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}

export function formatSecAxis(s) {
  if (s == null || !isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s - m * 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function buildTimeYTicks(yLo, yHi) {
  const span = yHi - yLo
  const step = span > 90 ? 15 : span > 45 ? 10 : span > 20 ? 5 : 2
  const start = Math.ceil(yLo / step) * step
  const tickvals = []
  for (let v = start; v <= yHi + step * 0.01; v += step) tickvals.push(v)
  return { tickvals, ticktext: tickvals.map(formatSecAxis) }
}

export function buildOfficialSplitSeries(lane, totalLength) {
  const cumGates = []
  for (const it of lane.intermediates || []) {
    const d = parseInt((it.distance?.DisplayName || '').replace(/\D/g, ''), 10)
    const t = parseRaceTime(it.ResultTime)
    if (isFinite(d) && t != null) cumGates.push({ d, t, rank: it.Rank ?? null })
  }
  cumGates.sort((a, b) => a.d - b.d)

  const finishD = totalLength > 0 ? totalLength : null
  if (finishD != null) {
    const finalT = parseRaceTime(lane.ResultTime)
    if (finalT != null) {
      const idx = cumGates.findIndex((g) => g.d >= finishD - 1)
      const finish = { d: finishD, t: finalT, rank: lane.Rank ?? null }
      if (idx >= 0) cumGates[idx] = finish
      else cumGates.push(finish)
      cumGates.sort((a, b) => a.d - b.d)
    }
  }
  if (!cumGates.length) return null

  const splits = []
  let prevD = 0
  let prevT = 0
  for (const g of cumGates) {
    const segT = g.t - prevT
    if (segT > 0) splits.push({ startD: prevD, endD: g.d, segT })
    prevD = g.d
    prevT = g.t
  }
  if (!splits.length) return null

  const PTS = 24
  const xs = []
  const times = []
  const hovers = []
  const markerSizes = []
  for (let i = 0; i < splits.length; i++) {
    const s = splits[i]
    const hover = `${s.endD} m : ${formatSec(s.segT)}`
    const yStart = i === 0 ? s.segT : splits[i - 1].segT
    const xStart = s.startD
    for (let j = 0; j <= PTS; j++) {
      const f = j / PTS
      xs.push(xStart + f * (s.endD - xStart))
      times.push(yStart + f * (s.segT - yStart))
      hovers.push(hover)
      markerSizes.push(j === PTS ? 5 : 0)
    }
  }
  return { xs, times, hovers, markerSizes }
}
