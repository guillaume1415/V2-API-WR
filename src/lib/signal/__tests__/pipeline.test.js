import { describe, it, expect } from 'vitest'
import {
  estimateSignalQuality,
  adaptiveSignalParams,
  processLaneSignal,
} from '../pipeline.js'

function lcg(seed = 1) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296 - 0.5
  }
}

function buildLanePts({ n = 200, vel = 5, cad = 32, distNoise = 1, spikeAt = -1 } = {}) {
  const rng = lcg(42)
  const pts = []
  let d = 0
  for (let i = 0; i < n; i++) {
    d += vel + rng() * distNoise * 2 * 0
    pts.push({ t: i, d: i * vel + rng() * distNoise * 2, speed: vel, cadence: cad })
  }
  if (spikeAt >= 0 && spikeAt < n) {
    pts[spikeAt].d += 500
    pts[spikeAt].speed = vel * 4
  }
  return pts
}

describe('estimateSignalQuality', () => {
  it('returns 0 sigma on too-small input', () => {
    expect(estimateSignalQuality([]).sigmaGps).toBe(0)
    expect(estimateSignalQuality([1, 2, 3]).sigmaGps).toBe(0)
  })

  it('returns a positive sigma on noisy distances', () => {
    const rng = lcg(7)
    const dists = []
    let d = 0
    for (let i = 0; i < 200; i++) {
      d += 5 + rng() * 4 // ±2 m noise on top of a 5 m/s baseline
      dists.push(d)
    }
    const q = estimateSignalQuality(dists)
    expect(q.sigmaGps).toBeGreaterThan(0)
  })
})

describe('adaptiveSignalParams', () => {
  it('returns reasonable defaults for zero quality', () => {
    const p = adaptiveSignalParams({ sigmaGps: 0 })
    expect(p.rtsSigmaA).toBeGreaterThan(0)
    expect(p.rtsRgps).toBeGreaterThanOrEqual(4)
    expect(p.rtsRgate).toBeCloseTo(0.25, 5)
  })

  it('scales R_gps with sigma', () => {
    const a = adaptiveSignalParams({ sigmaGps: 1 })
    const b = adaptiveSignalParams({ sigmaGps: 5 })
    expect(b.rtsRgps).toBeGreaterThan(a.rtsRgps)
  })

  it('clamps R_gps to a sane upper bound', () => {
    const p = adaptiveSignalParams({ sigmaGps: 50 })
    expect(p.rtsRgps).toBeLessThanOrEqual(100)
  })
})

describe('processLaneSignal', () => {
  it('returns empty arrays on empty input', () => {
    const r = processLaneSignal([], [])
    expect(r.distances).toEqual([])
    expect(r.speeds).toEqual([])
  })

  it('produces speeds close to the true velocity on a clean track', () => {
    const pts = buildLanePts({ n: 200, vel: 5, cad: 32, distNoise: 0 })
    const gates = [{ d: 500 }, { d: 1000 }]
    const r = processLaneSignal(pts, gates, {
      smoothing: 2,
      rtsSigmaA: 0.1,
      rtsRgps: 4,
    })
    const tail = r.speeds.slice(50, 150).filter((v) => v != null && isFinite(v))
    const mean = tail.reduce((a, b) => a + b, 0) / tail.length
    expect(mean).toBeCloseTo(5, 0)
  })

  it('despike absorbs an upward distance spike', () => {
    const pts = buildLanePts({ n: 200, vel: 5, cad: 32, spikeAt: 100 })
    const r1 = processLaneSignal(pts, [], { despike: true, rtsEnabled: false, smoothing: 0 })
    const r2 = processLaneSignal(pts, [], { despike: false, rtsEnabled: false, smoothing: 0 })
    expect(r1.distances[100]).toBeLessThan(r2.distances[100])
  })

  it('exposes a coherent dps when cadence is constant and speed steady', () => {
    const pts = buildLanePts({ n: 200, vel: 5, cad: 30, distNoise: 0 })
    const r = processLaneSignal(pts, [], { rtsEnabled: false, smoothing: 0 })
    const dpsTail = r.dps.slice(50, 150).filter((v) => v != null)
    const expected = (5 * 60) / 30
    for (const v of dpsTail) expect(v).toBeCloseTo(expected, 0)
  })
})
