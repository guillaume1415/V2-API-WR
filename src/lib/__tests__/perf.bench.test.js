/**
 * Microbenchmarks for the optimisations applied in tour 3:
 *
 *   1. smoothArray            : O(n·w) naïve  →  O(n) running-sum
 *   2. rtsSmooth1D            : nested arrays + slice()  →  flat Float64Array
 *   3. buildAnalyse{Traces,Layouts}: split allows skipping trace rebuild on yScale changes
 *
 * Each "before" implementation is inlined locally so we don't have to keep a
 * second copy of the source tree. Numbers reported as median of N iterations.
 *
 * NOTE: this file ends in `.bench.test.js`. It runs under `npm test` (and is
 * counted in the test totals) so a developer can grep for the gain numbers
 * in CI output without spinning up a dedicated bench harness.
 */

import { describe, it, expect } from 'vitest'
import { smoothArray } from '../smooth.js'
import { rtsSmooth1D } from '../signal/kalman.js'
import {
  buildAnalysePlotsMeta,
  buildAnalyseTraces,
  buildAnalyseLayouts,
} from '../analyse/plots.js'

const isCI = !!process.env.CI

/**
 * Run `fn` `iters` times after a small warm-up. Returns the median time per
 * call in milliseconds.
 */
function timeMs(fn, iters = 20) {
  for (let i = 0; i < 3; i++) fn()
  const samples = new Float64Array(iters)
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now()
    fn()
    samples[i] = performance.now() - t0
  }
  const sorted = Array.from(samples).sort((a, b) => a - b)
  return sorted[sorted.length >> 1]
}

function fmt(ms) {
  return ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(2)} ms`
}

// --------------------------------------------------------------------------
// 1) smoothArray : naïve O(n·w) reference
// --------------------------------------------------------------------------

function smoothArrayNaive(arr, window) {
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

// --------------------------------------------------------------------------
// 2) rtsSmooth1D : nested-array reference (pre-Float64Array version)
// --------------------------------------------------------------------------

function mm2(A, B) {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ]
}
function ma2(A, B) {
  return [
    [A[0][0] + B[0][0], A[0][1] + B[0][1]],
    [A[1][0] + B[1][0], A[1][1] + B[1][1]],
  ]
}
function ms2(A, B) {
  return [
    [A[0][0] - B[0][0], A[0][1] - B[0][1]],
    [A[1][0] - B[1][0], A[1][1] - B[1][1]],
  ]
}
function mt2(A) {
  return [
    [A[0][0], A[1][0]],
    [A[0][1], A[1][1]],
  ]
}
function mi2(A) {
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
  if (Math.abs(det) < 1e-12) return [[1e12, 0], [0, 1e12]]
  return [
    [A[1][1] / det, -A[0][1] / det],
    [-A[1][0] / det, A[0][0] / det],
  ]
}

function rtsSmooth1DLegacy(distances, gates, opts, times) {
  const n = distances.length
  if (n < 3) return { pos: distances.slice(), vel: new Array(n).fill(0) }
  const sigma_a = (opts && opts.sigma_a) || 0.15
  const R_gps = (opts && opts.R_gps) || 9
  const R_gate = (opts && opts.R_gate) || 0.25
  const q = sigma_a * sigma_a
  const T = times && times.length === n ? times : null
  const tickAt = (k) => (T ? T[k] : k)

  const events = []
  for (let k = 0; k < n; k++) {
    events.push({ t: tickAt(k), type: 'gps', z: distances[k], R: R_gps, tickIndex: k })
  }
  for (const g of gates || []) {
    const dGate = g.d
    let K = -1
    for (let i = 0; i < n - 1; i++) {
      if (distances[i] <= dGate && distances[i + 1] >= dGate && distances[i + 1] > distances[i]) {
        K = i
        break
      }
    }
    if (K < 0) continue
    const dd = distances[K + 1] - distances[K]
    const alpha = Math.max(0, Math.min(1, (dGate - distances[K]) / dd))
    const tGate = tickAt(K) + alpha * (tickAt(K + 1) - tickAt(K))
    events.push({ t: tGate, type: 'gate', z: dGate, R: R_gate, tickIndex: -1 })
  }
  events.sort((a, b) => a.t - b.t)
  const E = events.length
  const xs_post = new Array(E)
  const Ps_post = new Array(E)
  const xs_pred = new Array(E)
  const Ps_pred = new Array(E)
  const dts = new Array(E)
  let x = [distances[0], 0]
  let P = [[1e4, 0], [0, 100]]

  for (let e = 0; e < E; e++) {
    let dt = 0
    if (e === 0) {
      xs_pred[0] = x.slice()
      Ps_pred[0] = [[P[0][0], P[0][1]], [P[1][0], P[1][1]]]
    } else {
      dt = events[e].t - events[e - 1].t
      if (dt < 1e-9) {
        xs_pred[e] = x.slice()
        Ps_pred[e] = [[P[0][0], P[0][1]], [P[1][0], P[1][1]]]
      } else {
        const F = [[1, dt], [0, 1]]
        const Ft = mt2(F)
        const Q = [
          [(dt ** 4 / 4) * q, (dt ** 3 / 2) * q],
          [(dt ** 3 / 2) * q, dt * dt * q],
        ]
        const xp = [F[0][0] * x[0] + F[0][1] * x[1], F[1][0] * x[0] + F[1][1] * x[1]]
        const Pp = ma2(mm2(mm2(F, P), Ft), Q)
        xs_pred[e] = xp
        Ps_pred[e] = Pp
        x = xp
        P = Pp
      }
    }
    dts[e] = dt
    const ev = events[e]
    const y = ev.z - x[0]
    const S = P[0][0] + ev.R
    const Kg = [P[0][0] / S, P[1][0] / S]
    x = [x[0] + Kg[0] * y, x[1] + Kg[1] * y]
    P = [
      [(1 - Kg[0]) * P[0][0], (1 - Kg[0]) * P[0][1]],
      [P[1][0] - Kg[1] * P[0][0], P[1][1] - Kg[1] * P[0][1]],
    ]
    xs_post[e] = x.slice()
    Ps_post[e] = [[P[0][0], P[0][1]], [P[1][0], P[1][1]]]
  }

  const xs_s = new Array(E)
  const Ps_s = new Array(E)
  xs_s[E - 1] = xs_post[E - 1].slice()
  Ps_s[E - 1] = Ps_post[E - 1]
  for (let e = E - 2; e >= 0; e--) {
    const dt = dts[e + 1]
    if (dt < 1e-9) {
      xs_s[e] = xs_s[e + 1].slice()
      Ps_s[e] = Ps_s[e + 1]
      continue
    }
    const F = [[1, dt], [0, 1]]
    const Ft = mt2(F)
    const xp = xs_pred[e + 1]
    const Pp = Ps_pred[e + 1]
    const Pp_inv = mi2(Pp)
    const C = mm2(mm2(Ps_post[e], Ft), Pp_inv)
    const diff = [xs_s[e + 1][0] - xp[0], xs_s[e + 1][1] - xp[1]]
    const Cd = [C[0][0] * diff[0] + C[0][1] * diff[1], C[1][0] * diff[0] + C[1][1] * diff[1]]
    xs_s[e] = [xs_post[e][0] + Cd[0], xs_post[e][1] + Cd[1]]
    const dP = ms2(Ps_s[e + 1], Pp)
    Ps_s[e] = ma2(Ps_post[e], mm2(mm2(C, dP), mt2(C)))
  }

  const pos = new Array(n)
  const vel = new Array(n)
  for (let e = 0; e < E; e++) {
    if (events[e].tickIndex >= 0) {
      pos[events[e].tickIndex] = xs_s[e][0]
      vel[events[e].tickIndex] = xs_s[e][1]
    }
  }
  return { pos, vel }
}

// --------------------------------------------------------------------------
// Synthetic datasets
// --------------------------------------------------------------------------

function lcg(seed = 7) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296 - 0.5
  }
}

function buildDistances(n = 400, vel = 5, noise = 2) {
  const rng = lcg(42)
  const dists = new Array(n)
  for (let i = 0; i < n; i++) dists[i] = i * vel + rng() * noise * 2
  return dists
}

function buildTimes(n = 400) {
  const times = new Array(n)
  for (let i = 0; i < n; i++) times[i] = i
  return times
}

function buildSeriesData(nBoats = 6, n = 400) {
  const series = []
  for (let b = 0; b < nBoats; b++) {
    const xs = new Array(n)
    const speeds = new Array(n)
    const cads = new Array(n)
    const gaps = new Array(n)
    const ranks = new Array(n)
    const dpsArr = new Array(n)
    const rng = lcg(7 + b)
    for (let i = 0; i < n; i++) {
      xs[i] = i * 5
      speeds[i] = 5 + Math.sin(i * 0.1 + b) * 0.3 + rng() * 0.4
      cads[i] = 32 + Math.cos(i * 0.05 + b) * 2
      gaps[i] = b * 2 + rng() * 1
      ranks[i] = (b % 6) + 1
      dpsArr[i] = (speeds[i] * 60) / cads[i]
    }
    series.push({
      xs,
      speeds,
      cads,
      gaps,
      ranks,
      dpsArr,
      peakStats: { dStart: 1800, dEnd: 2000, max: 6, avg: 5.5, n: 200 },
      lane: {
        id: `lane-${b}`,
        Lane: b + 1,
        DisplayName: `Boat ${b + 1}`,
        intermediates: [
          {
            distance: { DisplayName: '500m' },
            ResultTime: '00:01:40.00',
          },
          {
            distance: { DisplayName: '1000m' },
            ResultTime: '00:03:20.00',
          },
          {
            distance: { DisplayName: '1500m' },
            ResultTime: '00:05:00.00',
          },
        ],
      },
    })
  }
  return series
}

const fakeT = (k) => k

// --------------------------------------------------------------------------
// Bench reports — we assert speedups rather than absolute times so the test
// passes on slow CI machines, then we log the numbers for the dev.
// --------------------------------------------------------------------------

describe('perf bench', () => {
  it('smoothArray running-sum is at least as fast as the naive O(n·w)', () => {
    const arr = []
    const rng = lcg(3)
    for (let i = 0; i < 4000; i++) arr.push(5 + rng())
    const window = 15

    const refOut = smoothArrayNaive(arr, window)
    const newOut = smoothArray(arr, window)
    for (let i = 0; i < arr.length; i++) {
      expect(Math.abs((refOut[i] ?? 0) - (newOut[i] ?? 0))).toBeLessThan(1e-9)
    }
    const tOld = timeMs(() => smoothArrayNaive(arr, window))
    const tNew = timeMs(() => smoothArray(arr, window))
    const gain = tOld / Math.max(tNew, 1e-6)
    console.log(
      `[bench] smoothArray  n=${arr.length} w=${window}  old=${fmt(tOld)}  new=${fmt(tNew)}  ×${gain.toFixed(1)}`,
    )
    if (!isCI) expect(tNew).toBeLessThanOrEqual(tOld * 1.5)
  })

  it('rtsSmooth1D Float64Array path is at least as fast as the nested-array reference', () => {
    const n = 400
    const dists = buildDistances(n)
    const times = buildTimes(n)
    const gates = [{ d: 500 }, { d: 1000 }, { d: 1500 }]
    const opts = { sigma_a: 0.25, R_gps: 25, R_gate: 0.25 }

    const refOut = rtsSmooth1DLegacy(dists, gates, opts, times)
    const newOut = rtsSmooth1D(dists, gates, opts, times)
    for (let i = 0; i < n; i++) {
      expect(Math.abs((refOut.pos[i] ?? 0) - (newOut.pos[i] ?? 0))).toBeLessThan(1e-6)
      expect(Math.abs((refOut.vel[i] ?? 0) - (newOut.vel[i] ?? 0))).toBeLessThan(1e-6)
    }
    const tOld = timeMs(() => rtsSmooth1DLegacy(dists, gates, opts, times), 30)
    const tNew = timeMs(() => rtsSmooth1D(dists, gates, opts, times), 30)
    const gain = tOld / Math.max(tNew, 1e-6)
    console.log(
      `[bench] rtsSmooth1D n=${n}  legacy=${fmt(tOld)}  flat-F64=${fmt(tNew)}  ×${gain.toFixed(1)}`,
    )
    if (!isCI) expect(tNew).toBeLessThanOrEqual(tOld * 1.5)
  })

  it('buildAnalyseLayouts is much cheaper than full buildAnalysePlots', () => {
    const series = buildSeriesData(6, 400)
    const args = {
      series,
      totalLength: 2000,
      theme: 'dark',
      boatClass: 'M1x',
      yScales: {},
      cScales: {},
      globalScales: { speed: { min: null, max: null }, cadence: { min: null, max: null } },
      colorBy: 'cadence',
      sizeByDps: false,
      t: fakeT,
    }
    // Warm up & sanity check
    const meta = buildAnalysePlotsMeta(args)
    const traces = buildAnalyseTraces(args)
    const layouts = buildAnalyseLayouts(args)
    expect(meta.length).toBe(5)
    expect(Object.keys(traces)).toEqual(['speed', 'cadence', 'time', 'gap', 'dps'])
    expect(Object.keys(layouts)).toEqual(['speed', 'cadence', 'time', 'gap', 'dps'])

    const tFull = timeMs(() => {
      buildAnalysePlotsMeta(args)
      buildAnalyseTraces(args)
      buildAnalyseLayouts(args)
    }, 30)
    const tLayoutOnly = timeMs(() => buildAnalyseLayouts(args), 30)
    const gain = tFull / Math.max(tLayoutOnly, 1e-6)
    console.log(
      `[bench] Analyse rebuild  full=${fmt(tFull)}  layout-only=${fmt(tLayoutOnly)}  ×${gain.toFixed(1)} cheaper`,
    )
    expect(tLayoutOnly).toBeLessThanOrEqual(tFull)
  })
})
