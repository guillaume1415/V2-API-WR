/** Centered moving average. window = neighbours on each side (total = 2*w+1). */
export function smoothArray(arr, window) {
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

/** Δd/Δt on a centered window (pts: { t, d }). */
export function recomputeSpeeds(pts, w) {
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
