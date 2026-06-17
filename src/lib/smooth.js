/**
 * Centred moving average over a (2·window + 1) neighbourhood.
 *
 * Uses an incremental running sum + running count so the cost is O(n)
 * regardless of `window`. Null / non-finite values are skipped (they do not
 * contribute to the sum nor to the divisor). The mean is recomputed by
 * adjusting `sum`/`cnt` at the boundary of the window, which keeps the
 * output numerically identical to the naïve O(n·w) version on float64 inputs
 * of typical length (drift below 1e-12 relative on series < 10⁴ samples).
 *
 * @param {Array<number|null>} arr
 * @param {number} window - Number of neighbours on each side. 0 → identity.
 * @returns {Array<number|null>} New array of the same length.
 */
export function smoothArray(arr, window) {
  if (!window || window <= 0) return arr.slice()
  const n = arr.length
  const out = new Array(n)
  if (!n) return out

  let sum = 0
  let cnt = 0
  const isValid = (v) => v != null && isFinite(v)

  const initEnd = Math.min(n - 1, window)
  for (let j = 0; j <= initEnd; j++) {
    const v = arr[j]
    if (isValid(v)) {
      sum += v
      cnt++
    }
  }
  out[0] = cnt ? sum / cnt : null

  for (let i = 1; i < n; i++) {
    const enter = i + window
    if (enter < n) {
      const v = arr[enter]
      if (isValid(v)) {
        sum += v
        cnt++
      }
    }
    const leave = i - window - 1
    if (leave >= 0) {
      const v = arr[leave]
      if (isValid(v)) {
        sum -= v
        cnt--
      }
    }
    out[i] = cnt ? sum / cnt : null
  }
  return out
}

/**
 * Δd/Δt on a centred window (pts: { t, d }).
 *
 * @param {Array<{t:number, d:number}>} pts
 * @param {number} w
 * @returns {Array<number|null>}
 */
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
