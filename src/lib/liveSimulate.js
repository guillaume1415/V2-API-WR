import { toRaw } from 'vue'

/** Build sorted unique trackCount timeline from all lanes. */
export function buildSimTimeline(snapshot) {
  const counts = new Set()
  for (const lane of snapshot?.config?.lanes || []) {
    for (const p of lane.live || []) {
      if (p.trackCount != null && isFinite(p.trackCount)) counts.add(p.trackCount)
    }
  }
  return [...counts].sort((a, b) => a - b)
}

/** True when snapshot has enough steps to simulate. */
export function canSimulate(snapshot) {
  return buildSimTimeline(snapshot).length > 1
}

/**
 * Deep-cloned snapshot with each lane truncated to trackCount <= maxTrackCount.
 */
export function sliceTrackerSnapshot(snapshot, maxTrackCount) {
  if (!snapshot?.config) return snapshot
  const data = structuredClone(toRaw(snapshot))
  for (const lane of data.config.lanes || []) {
    const live = (lane.live || []).filter((p) => p.trackCount <= maxTrackCount)
    lane.live = live
    if (live.length) lane.currentPoint = live[live.length - 1]
  }
  return data
}
