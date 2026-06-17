import { describe, it, expect } from 'vitest'
import { rtsSmooth1D, buildGateAnchors } from '../kalman.js'

function buildLinearTrajectory(n, vel, noise = 0) {
  let seed = 1
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296 - 0.5
  }
  const dists = []
  const times = []
  for (let i = 0; i < n; i++) {
    times.push(i)
    dists.push(i * vel + (noise ? rng() * noise * 2 : 0))
  }
  return { dists, times }
}

describe('rtsSmooth1D', () => {
  it('recovers a clean linear trajectory', () => {
    const { dists, times } = buildLinearTrajectory(50, 5)
    const out = rtsSmooth1D(dists, [], { sigma_a: 0.1, R_gps: 1 }, times)
    expect(out.pos.length).toBe(50)
    expect(out.vel.length).toBe(50)
    const tailVel = out.vel.slice(10).filter((v) => v != null && isFinite(v))
    const meanVel = tailVel.reduce((a, b) => a + b, 0) / tailVel.length
    expect(meanVel).toBeCloseTo(5, 1)
  })

  it('smooths a noisy linear trajectory closer to the truth', () => {
    const { dists, times } = buildLinearTrajectory(100, 5, 3)
    const out = rtsSmooth1D(dists, [], { sigma_a: 0.1, R_gps: 9 }, times)
    // The smoother should reduce position error vs the raw input on average.
    let rawErr = 0
    let smoothErr = 0
    for (let i = 5; i < 95; i++) {
      const truth = i * 5
      rawErr += Math.abs(dists[i] - truth)
      smoothErr += Math.abs(out.pos[i] - truth)
    }
    expect(smoothErr).toBeLessThan(rawErr)
  })

  it('respects gate anchors (small R_gate)', () => {
    const { dists, times } = buildLinearTrajectory(60, 5, 2)
    // Insert a strong anchor at midpoint truth.
    const gates = [{ d: 150 }]
    const out = rtsSmooth1D(
      dists,
      gates,
      { sigma_a: 0.1, R_gps: 9, R_gate: 0.01 },
      times,
    )
    expect(out.pos.length).toBe(60)
    // The smoothed pos around the gate distance must be close to the gate.
    let bestI = 0
    let bestE = Infinity
    for (let i = 0; i < out.pos.length; i++) {
      const e = Math.abs(out.pos[i] - 150)
      if (e < bestE) {
        bestE = e
        bestI = i
      }
    }
    expect(bestE).toBeLessThan(5)
    expect(bestI).toBeGreaterThan(20)
    expect(bestI).toBeLessThan(40)
  })

  it('innovationGate rejects extreme outliers', () => {
    const { dists, times } = buildLinearTrajectory(60, 5)
    dists[30] = 1000 // huge outlier
    const without = rtsSmooth1D(dists, [], { sigma_a: 0.1, R_gps: 1 }, times)
    const withGate = rtsSmooth1D(
      dists,
      [],
      { sigma_a: 0.1, R_gps: 1, innovationGate: 3 },
      times,
    )
    // Without gating, the spike contaminates the smoothed signal.
    expect(Math.abs(without.pos[30] - 30 * 5)).toBeGreaterThan(
      Math.abs(withGate.pos[30] - 30 * 5),
    )
  })

  it('initialVelocity=estimate reduces initial lag', () => {
    const { dists, times } = buildLinearTrajectory(20, 5)
    const zeroInit = rtsSmooth1D(dists, [], { sigma_a: 0.1, R_gps: 1 }, times)
    const estInit = rtsSmooth1D(
      dists,
      [],
      { sigma_a: 0.1, R_gps: 1, initialVelocity: 'estimate' },
      times,
    )
    // Both should be close after smoothing; this is mainly an API check.
    expect(zeroInit.vel[0]).toBeDefined()
    expect(estInit.vel[0]).toBeDefined()
    expect(estInit.vel[0]).toBeCloseTo(5, 0)
  })

  it('returns slice for n < 3', () => {
    const out = rtsSmooth1D([1, 2], [], {})
    expect(out.pos).toEqual([1, 2])
    expect(out.vel).toEqual([0, 0])
  })
})

describe('buildGateAnchors', () => {
  it('matches each intermediate to the closest tick within tolerance', () => {
    const lane = {
      intermediates: [
        { distance: { DisplayName: '500m' } },
        { distance: { DisplayName: '1000m' } },
        { distance: { DisplayName: '1500m' } },
      ],
    }
    const pts = []
    for (let i = 0; i <= 200; i++) pts.push({ d: i * 10 })
    const gates = buildGateAnchors(lane, pts, 2000)
    expect(gates).toEqual([
      { tick: 50, d: 500 },
      { tick: 100, d: 1000 },
      { tick: 150, d: 1500 },
    ])
  })

  it('drops gates whose nearest tick is too far away', () => {
    const lane = { intermediates: [{ distance: { DisplayName: '500m' } }] }
    const pts = [{ d: 0 }, { d: 2000 }]
    const gates = buildGateAnchors(lane, pts, 2000)
    expect(gates).toEqual([])
  })

  it('drops gates beyond the total race length', () => {
    const lane = { intermediates: [{ distance: { DisplayName: '2000m' } }] }
    const pts = [{ d: 0 }, { d: 2000 }]
    const gates = buildGateAnchors(lane, pts, 2000)
    expect(gates).toEqual([])
  })
})
