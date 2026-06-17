/**
 * @file High-level composable signal-processing pipeline.
 *
 * The functions in this file orchestrate the lower-level primitives in the
 * `signal/` folder. They are framework-agnostic (no DOM, no Plotly) so they
 * can be unit-tested with Vitest and reused outside of the Vue store.
 *
 * Pipeline steps:
 *   1. Despike distances (Hampel, positive-only by default — GPS distance
 *      spikes are typically upward jumps from EGNOS/SBAS glitches).
 *   2. RTS-smoothed Kalman over distances, anchored on official gates.
 *   3. Recompute speeds from smoothed positions (Kalman velocity), or fall
 *      back to centred Δd/Δt on the raw points.
 *   4. Optional DPS coherence correction using cadence.
 *   5. Centred moving-average on the final speed/cadence/dps series.
 */

import { despikeArray, estimateNoiseMad } from './hampel.js'
import { rtsSmooth1D } from './kalman.js'
import { dpsCorrect } from './dps.js'

/**
 * Centred moving average. `window` = neighbours on each side (total = 2w+1).
 * Local helper to avoid importing from `lib/smooth.js` and creating a cycle.
 *
 * @param {Array<number|null>} arr
 * @param {number} window
 * @returns {Array<number|null>}
 */
function movingAverage(arr, window) {
  if (!window || window <= 0) return arr.slice()
  const n = arr.length
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    let cnt = 0
    for (let j = Math.max(0, i - window); j <= Math.min(n - 1, i + window); j++) {
      const v = arr[j]
      if (v != null && isFinite(v)) {
        sum += v
        cnt++
      }
    }
    out[i] = cnt ? sum / cnt : null
  }
  return out
}

/**
 * Estimate GPS noise level from a distance series using the MAD of the
 * second-difference (acceleration proxy). For a constant-velocity boat,
 * the second-difference noise variance is ≈ 6σ² for white GPS noise of
 * stddev σ, so σ ≈ MAD2 * 1.4826 / √6.
 *
 * @param {Array<number>} distances
 * @returns {{ sigmaGps: number, mad1: number }}
 *   sigmaGps  GPS distance stddev estimate (m).
 *   mad1      MAD of first differences (m), useful for diagnostics.
 */
export function estimateSignalQuality(distances) {
  if (!distances || distances.length < 4) return { sigmaGps: 0, mad1: 0 }
  const diffs1 = []
  const diffs2 = []
  for (let i = 1; i < distances.length; i++) {
    const a = distances[i]
    const b = distances[i - 1]
    if (a != null && b != null && isFinite(a) && isFinite(b)) {
      diffs1.push(a - b)
    }
  }
  for (let i = 2; i < distances.length; i++) {
    const a = distances[i]
    const b = distances[i - 1]
    const c = distances[i - 2]
    if (
      a != null &&
      b != null &&
      c != null &&
      isFinite(a) &&
      isFinite(b) &&
      isFinite(c)
    ) {
      diffs2.push(a - 2 * b + c)
    }
  }
  const mad = (xs) => {
    if (xs.length < 3) return 0
    const sorted = xs.slice().sort((a, b) => a - b)
    const m = sorted[sorted.length >> 1]
    const devs = xs.map((v) => Math.abs(v - m)).sort((a, b) => a - b)
    return devs[devs.length >> 1]
  }
  const mad1 = mad(diffs1) * 1.4826
  const mad2 = mad(diffs2) * 1.4826
  // Var(Δ²) = 6 Var(Δ) → σ_gps ≈ mad2 / √6
  const sigmaGps = mad2 / Math.sqrt(6)
  return { sigmaGps, mad1: estimateNoiseMad(distances) || mad1 }
}

/**
 * Suggest Kalman / Hampel parameters from an estimated GPS noise level.
 * Returns sane defaults if no estimate is available.
 *
 * @param {{sigmaGps:number}} quality - Output of `estimateSignalQuality`.
 * @returns {{rtsSigmaA:number, rtsRgps:number, rtsRgate:number, hampelMinThreshold:number}}
 */
export function adaptiveSignalParams(quality) {
  const sigma = (quality && quality.sigmaGps) || 0
  // R_gps is the variance of GPS-distance noise. Bound to a reasonable range
  // so that pathological inputs do not push the filter into degenerate
  // regimes.
  const R_gps_est = sigma * sigma
  const R_gps = Math.min(Math.max(R_gps_est, 4), 100)
  // sigma_a (1-σ acceleration). Rowing boats accelerate slowly (~0.1–0.3 m/s²)
  // so we keep a tight prior unless GPS is very noisy.
  const rtsSigmaA = sigma > 5 ? 0.35 : sigma > 2 ? 0.25 : 0.15
  // Hampel floor: at least ~2σ on first-differences, plus a small constant
  // to absorb quantisation.
  const hampelMinThreshold = Math.max(2 * sigma, 1.5)
  return {
    rtsSigmaA,
    rtsRgps: R_gps,
    rtsRgate: 0.25,
    hampelMinThreshold,
  }
}

/**
 * Recompute centred Δd/Δt speeds from raw points.
 *
 * @param {Array<{t:number, d:number}>} pts
 * @param {number} w
 * @returns {Array<number|null>}
 */
function centredSpeeds(pts, w) {
  const n = pts.length
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - w)
    const hi = Math.min(n - 1, i + w)
    const dt = pts[hi].t - pts[lo].t
    const dd = pts[hi].d - pts[lo].d
    out[i] = dt > 0 ? dd / dt : null
  }
  return out
}

/**
 * Full signal-processing pipeline on a single lane's GPS series.
 *
 * @param {Array<{t:number, d:number, speed:number|null, cadence:number|null}>} pts
 * @param {Array<{d:number}>} gates - Official gate anchors (use `buildGateAnchors`).
 * @param {Object} [opts]
 * @param {boolean} [opts.despike=true] - Run a Hampel despike on raw distances first.
 * @param {number} [opts.despikeWindow=5]
 * @param {number} [opts.despikeK=3]
 * @param {number} [opts.despikePasses=2]
 * @param {number} [opts.despikeMinThreshold=2]
 * @param {boolean} [opts.rtsEnabled=true]
 * @param {number} [opts.rtsSigmaA=0.25]
 * @param {number} [opts.rtsRgps=25]
 * @param {number} [opts.rtsRgate=0.25]
 * @param {number|null} [opts.rtsInnovationGate=null]
 * @param {boolean} [opts.dpsEnabled=false]
 * @param {number} [opts.dpsTolerance=0.15]
 * @param {number} [opts.dpsLocalWindow=60]
 * @param {boolean} [opts.dpsSymmetric=false]
 * @param {number} [opts.smoothing=2]
 * @returns {{distances: Array<number>, speeds: Array<number|null>, cads: Array<number|null>, dps: Array<number|null>}}
 */
export function processLaneSignal(pts, gates, opts) {
  const {
    despike = true,
    despikeWindow = 5,
    despikeK = 3,
    despikePasses = 2,
    despikeMinThreshold = 2,
    rtsEnabled = true,
    rtsSigmaA = 0.25,
    rtsRgps = 25,
    rtsRgate = 0.25,
    rtsInnovationGate = null,
    dpsEnabled = false,
    dpsTolerance = 0.15,
    dpsLocalWindow = 60,
    dpsSymmetric = false,
    smoothing = 2,
  } = opts || {}

  const n = pts.length
  if (!n) {
    return { distances: [], speeds: [], cads: [], dps: [] }
  }

  const rawDistances = pts.map((p) => p.d)
  const rawCads = pts.map((p) => p.cadence)
  const rawTimes = pts.map((p) => p.t)

  const distances = despike
    ? despikeArray(rawDistances, despikeMinThreshold, despikeWindow, despikeK, despikePasses, {
        side: 'positive',
      })
    : rawDistances.slice()

  let rawSpeeds
  if (rtsEnabled && (gates?.length || 0) >= 1) {
    const out = rtsSmooth1D(
      distances,
      gates,
      {
        sigma_a: rtsSigmaA,
        R_gps: rtsRgps,
        R_gate: rtsRgate,
        innovationGate: rtsInnovationGate,
      },
      rawTimes,
    )
    rawSpeeds = out.vel
  } else {
    rawSpeeds = centredSpeeds(
      pts.map((p, i) => ({ t: rawTimes[i], d: distances[i] })),
      Math.max(1, smoothing),
    )
  }

  let speeds = rawSpeeds
  if (dpsEnabled) {
    speeds = dpsCorrect(speeds, rawCads, dpsTolerance, dpsLocalWindow, {
      symmetric: dpsSymmetric,
    })
  }

  const dps = speeds.map((s, i) => {
    const c = rawCads[i]
    return s != null && c != null && c > 0 && isFinite(s) ? (s * 60) / c : null
  })

  return {
    distances,
    speeds: movingAverage(speeds, smoothing),
    cads: movingAverage(rawCads, smoothing),
    dps: movingAverage(dps, smoothing),
  }
}
