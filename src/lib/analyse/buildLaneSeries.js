import { rtsSmooth1D, buildGateAnchors } from '@/lib/signal/kalman'
import { smoothArray } from '@/lib/smooth'
import { extractLaneSeries } from './laneSeries'

export function buildLaneSeries(lane, totalLength, options) {
  const {
    rtsEnabled = true,
    rtsSigmaA = 0.25,
    rtsRgps = 25,
    rtsRgate = 0.25,
    smoothing = 2,
    peakWindow = 100,
  } = options || {}

  const pts = extractLaneSeries(lane, totalLength)
  if (!pts.length) return null

  const xs = pts.map((p) => p.x)
  let rawSpeeds = pts.map((p) => p.speed)
  const rawCads = pts.map((p) => p.cadence)
  const rawGaps = pts.map((p) => p.gap)
  const ranks = pts.map((p) => p.rank)

  if (rtsEnabled) {
    const gates = buildGateAnchors(lane, pts, totalLength)
    if (gates.length >= 1) {
      const dists = pts.map((p) => p.d)
      const tsec = pts.map((p) => p.t)
      const out = rtsSmooth1D(
        dists,
        gates,
        { sigma_a: rtsSigmaA, R_gps: rtsRgps, R_gate: rtsRgate },
        tsec,
      )
      rawSpeeds = out.vel
    }
  }

  const rawDps = rawSpeeds.map((s, i) => {
    const c = rawCads[i]
    return s && c ? (s * 60) / c : null
  })

  const w = smoothing | 0
  const speeds = smoothArray(rawSpeeds, w)
  const cads = smoothArray(rawCads, w)
  const gaps = smoothArray(rawGaps, w)
  const dpsArr = smoothArray(rawDps, w)

  let peakStats = null
  if (totalLength > 0 && speeds.length > 2) {
    const lastD = xs[xs.length - 1]
    const dMin = Math.max(0, lastD - peakWindow)
    const inWin = []
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] >= dMin && speeds[i] != null && isFinite(speeds[i])) inWin.push(speeds[i])
    }
    if (inWin.length) {
      const max = Math.max(...inWin)
      const avg = inWin.reduce((a, b) => a + b, 0) / inWin.length
      peakStats = { dStart: dMin, dEnd: lastD, max, avg, n: inWin.length }
    }
  }

  return { lane, pts, xs, speeds, cads, gaps, ranks, dpsArr, peakStats }
}
