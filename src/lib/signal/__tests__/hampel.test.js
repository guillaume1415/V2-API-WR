import { describe, it, expect } from 'vitest'
import { hampelArray, despikeArray, estimateNoiseMad } from '../hampel.js'

describe('hampelArray', () => {
  it('removes an isolated upward spike', () => {
    const arr = [1, 1, 1, 1, 1, 50, 1, 1, 1, 1, 1]
    const out = hampelArray(arr, 3, 3, 0.5)
    expect(out[5]).toBeCloseTo(1, 5)
    expect(out[0]).toBe(1)
    expect(out[10]).toBe(1)
  })

  it('leaves a clean signal mostly unchanged', () => {
    const arr = [10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8]
    const out = hampelArray(arr, 3, 3, 0.5)
    for (let i = 0; i < arr.length; i++) {
      expect(out[i]).toBeCloseTo(arr[i], 5)
    }
  })

  it('respects side="positive" and ignores negative outliers', () => {
    const arr = [10, 10, 10, 10, 10, -20, 10, 10, 10, 10, 10]
    const out = hampelArray(arr, 3, 3, 0.5, { side: 'positive' })
    expect(out[5]).toBe(-20)
  })

  it('respects side="negative" and ignores positive outliers', () => {
    const arr = [10, 10, 10, 10, 10, 99, 10, 10, 10, 10, 10]
    const out = hampelArray(arr, 3, 3, 0.5, { side: 'negative' })
    expect(out[5]).toBe(99)
  })

  it('handles null and non-finite values gracefully', () => {
    const arr = [1, null, 1, NaN, 1, 50, 1, 1]
    const out = hampelArray(arr, 3, 3, 0.5)
    expect(out.length).toBe(arr.length)
    expect(out[1]).toBeNull()
    expect(Number.isNaN(out[3])).toBe(true)
  })

  it('returns slice for n < 3', () => {
    const arr = [1, 2]
    const out = hampelArray(arr, 3, 3, 0.5)
    expect(out).toEqual([1, 2])
    expect(out).not.toBe(arr)
  })
})

describe('despikeArray', () => {
  it('removes clustered spikes that survive a single pass', () => {
    const arr = [1, 1, 1, 50, 51, 1, 1, 1, 1, 1]
    const out = despikeArray(arr, 0.5, 5, 3, 2)
    expect(out[3]).toBeLessThan(10)
    expect(out[4]).toBeLessThan(10)
  })
})

describe('estimateNoiseMad', () => {
  it('returns 0 on short input', () => {
    expect(estimateNoiseMad([])).toBe(0)
    expect(estimateNoiseMad([1, 2])).toBe(0)
  })

  it('estimates a non-zero stddev on noisy input', () => {
    const arr = []
    let v = 0
    for (let i = 0; i < 200; i++) {
      v += 1 + (Math.sin(i * 0.7) + Math.cos(i * 1.3)) * 0.5
      arr.push(v)
    }
    const s = estimateNoiseMad(arr)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(5)
  })
})
