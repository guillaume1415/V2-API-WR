import { describe, expect, it } from 'vitest'
import {
  buildSimTimeline,
  canSimulate,
  sliceTrackerSnapshot,
} from '@/lib/liveSimulate'

const sample = {
  config: {
    lanes: [
      {
        id: 'a',
        live: [
          { trackCount: 1, raceBoatTracker: { distanceTravelled: 10 } },
          { trackCount: 2, raceBoatTracker: { distanceTravelled: 20 } },
          { trackCount: 3, raceBoatTracker: { distanceTravelled: 30 } },
        ],
        currentPoint: { trackCount: 3, raceBoatTracker: { distanceTravelled: 30 } },
      },
      {
        id: 'b',
        live: [
          { trackCount: 1, raceBoatTracker: { distanceTravelled: 12 } },
          { trackCount: 2, raceBoatTracker: { distanceTravelled: 22 } },
        ],
        currentPoint: { trackCount: 2, raceBoatTracker: { distanceTravelled: 22 } },
      },
    ],
  },
}

describe('liveSimulate', () => {
  it('buildSimTimeline returns sorted unique trackCounts', () => {
    expect(buildSimTimeline(sample)).toEqual([1, 2, 3])
  })

  it('canSimulate requires at least 2 steps', () => {
    expect(canSimulate(sample)).toBe(true)
    expect(canSimulate({ config: { lanes: [{ live: [{ trackCount: 1 }] }] } })).toBe(false)
  })

  it('sliceTrackerSnapshot truncates live and updates currentPoint', () => {
    const sliced = sliceTrackerSnapshot(sample, 2)
    expect(sliced.config.lanes[0].live).toHaveLength(2)
    expect(sliced.config.lanes[0].currentPoint.trackCount).toBe(2)
    expect(sliced.config.lanes[1].live).toHaveLength(2)
    expect(sliced.config.lanes[0].live[1].raceBoatTracker.distanceTravelled).toBe(20)
  })

  it('does not mutate the original snapshot', () => {
    sliceTrackerSnapshot(sample, 1)
    expect(sample.config.lanes[0].live).toHaveLength(3)
  })
})
