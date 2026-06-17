import { describe, it, expect } from 'vitest'
import { dpsCorrect } from '../dps.js'

describe('dpsCorrect', () => {
  it('corrects a positive speed outlier given a clean cadence', () => {
    const n = 120
    const speeds = new Array(n).fill(5)
    const cads = new Array(n).fill(30)
    speeds[60] = 9
    const out = dpsCorrect(speeds, cads, 0.15, 30)
    expect(out[60]).toBeLessThan(7)
    expect(out[60]).toBeGreaterThan(4)
    expect(out[0]).toBeCloseTo(5, 5)
    expect(out[119]).toBeCloseTo(5, 5)
  })

  it('keeps negative outliers untouched in the default (legacy) mode', () => {
    const n = 120
    const speeds = new Array(n).fill(5)
    const cads = new Array(n).fill(30)
    speeds[60] = 1
    const out = dpsCorrect(speeds, cads, 0.15, 30)
    expect(out[60]).toBe(1)
  })

  it('corrects both signs when symmetric=true', () => {
    const n = 120
    const speeds = new Array(n).fill(5)
    const cads = new Array(n).fill(30)
    speeds[60] = 1
    const out = dpsCorrect(speeds, cads, 0.15, 30, { symmetric: true })
    expect(out[60]).toBeGreaterThan(4)
    expect(out[60]).toBeLessThan(6)
  })

  it('returns slice when too few valid samples', () => {
    const speeds = [5, null, null, 5]
    const cads = [30, null, null, 30]
    const out = dpsCorrect(speeds, cads, 0.15, 30)
    expect(out).toEqual(speeds)
    expect(out).not.toBe(speeds)
  })

  it('useMad keeps tame deviations untouched', () => {
    const n = 120
    const speeds = new Array(n).fill(5)
    const cads = new Array(n).fill(30)
    for (let i = 0; i < n; i++) speeds[i] += Math.sin(i / 5) * 0.05
    const out = dpsCorrect(speeds, cads, 0.15, 30, { useMad: true, kMad: 5 })
    for (let i = 10; i < n - 10; i++) {
      expect(Math.abs(out[i] - speeds[i])).toBeLessThan(0.5)
    }
  })

  it('returns slice when lengths mismatch', () => {
    const speeds = [1, 2, 3]
    const cads = [10, 20]
    const out = dpsCorrect(speeds, cads, 0.15, 30)
    expect(out).toEqual(speeds)
    expect(out).not.toBe(speeds)
  })
})
