import { parseRaceTime } from './time'

export function extractLaneSeries(lane, totalLength) {
  const raw = []
  for (const p of lane.live || []) {
    const t = p.raceBoatTracker || {}
    if (t.distanceTravelled == null) continue
    const speed = t.metrePerSecond
    const cad = t.strokeRate
    raw.push({
      x: t.distanceTravelled,
      t: p.trackCount,
      d: t.distanceTravelled,
      speed,
      cadence: cad,
      rank: t.currentPosition,
      gap: t.distanceFromLeader,
      dps: speed && cad ? (speed * 60) / cad : null,
      _raceBoatId: t.raceBoatId || null,
      _trackCount: p.trackCount,
    })
  }
  if (!raw.length) return []

  const segments = []
  let current = [raw[0]]
  for (let i = 1; i < raw.length; i++) {
    const dx = raw[i].x - raw[i - 1].x
    if (
      dx < -100 ||
      (raw[i]._raceBoatId &&
        raw[i - 1]._raceBoatId &&
        raw[i]._raceBoatId !== raw[i - 1]._raceBoatId)
    ) {
      segments.push(current)
      current = [raw[i]]
    } else {
      current.push(raw[i])
    }
  }
  segments.push(current)

  const maxX = (seg) => {
    let m = -Infinity
    for (let i = 0; i < seg.length; i++) {
      if (seg[i].x > m) m = seg[i].x
    }
    return m
  }
  let best = segments[0]
  let bestMax = maxX(best)
  for (let s = 1; s < segments.length; s++) {
    const seg = segments[s]
    const mx = maxX(seg)
    if (mx > bestMax || (mx === bestMax && seg.length > best.length)) {
      best = seg
      bestMax = mx
    }
  }
  best.sort((a, b) => a.x - b.x)

  if (totalLength && totalLength > 0) {
    const firstReach = best.findIndex((p) => p.x >= totalLength)
    if (firstReach >= 0 && firstReach < best.length - 1) {
      best = best.slice(0, firstReach + 1)
    }
  }

  const lastClipped =
    best.length >= 2 &&
    best[best.length - 1].x >= totalLength &&
    best[best.length - 2].x < totalLength

  let secondsPerTick = 1
  const resultSec = typeof lane.ResultTime === 'string' ? parseRaceTime(lane.ResultTime) : null
  if (resultSec && best.length >= 2) {
    const tickSpan = best[best.length - 1].t - best[0].t
    if (tickSpan > 0) {
      const spt = resultSec / tickSpan
      if (spt >= 0.3 && spt <= 10) secondsPerTick = spt
    }
  }
  if (secondsPerTick !== 1) {
    for (const p of best) p.t = p.t * secondsPerTick
  }
  if (lastClipped) best = best.slice(0, best.length - 1)
  return best
}
