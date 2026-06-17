/**
 * @file Hampel filter for outlier detection / replacement.
 *
 * The Hampel identifier flags a sample as an outlier when its absolute
 * deviation from the local median exceeds `k * 1.4826 * MAD`, where MAD is
 * the median absolute deviation of the local window. The factor `1.4826`
 * makes MAD a consistent estimator of the standard deviation for
 * Gaussian-distributed inliers.
 *
 * Reference: Pearson, R.K. (2002) "Outliers in process modeling and
 * identification" - IEEE Trans. on Control Systems Technology, 10(1).
 */

function med(sorted) {
  const m = sorted.length
  if (!m) return null
  return m % 2 ? sorted[(m - 1) >> 1] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2
}

/**
 * Hampel filter: replace outliers by the local median.
 *
 * @param {Array<number|null>} arr - Input series. `null` / non-finite values are skipped.
 * @param {number} window - Half-window radius (window=5 → 11-sample neighborhood).
 * @param {number} k - Threshold multiplier on MAD (typical 2..3).
 * @param {number} minThreshold - Lower bound for the threshold, prevents
 *   over-replacement on near-constant signals.
 * @param {Object} [opts]
 * @param {'both'|'positive'|'negative'} [opts.side='both'] - Restrict
 *   replacement to positive (x > med) or negative (x < med) deviations.
 *   Useful when only one sign of spike is physically plausible (e.g. GPS
 *   speed outliers are typically positive).
 * @returns {Array<number|null>} New array of the same length.
 */
export function hampelArray(arr, window, k, minThreshold, opts) {
  const n = arr.length
  if (n < 3) return arr.slice()
  const side = (opts && opts.side) || 'both'
  const out = arr.slice()
  for (let i = 0; i < n; i++) {
    const v = arr[i]
    if (v == null || !isFinite(v)) continue
    const win = []
    for (let j = Math.max(0, i - window); j <= Math.min(n - 1, i + window); j++) {
      const u = arr[j]
      if (u != null && isFinite(u)) win.push(u)
    }
    if (win.length < 3) continue
    const sortedWin = win.slice().sort((a, b) => a - b)
    const localMed = med(sortedWin)
    const devs = win.map((x) => Math.abs(x - localMed)).sort((a, b) => a - b)
    const mad = med(devs)
    const thr = Math.max(k * 1.4826 * mad, minThreshold)
    const diff = v - localMed
    if (Math.abs(diff) <= thr) continue
    if (side === 'positive' && diff <= 0) continue
    if (side === 'negative' && diff >= 0) continue
    out[i] = localMed
  }
  return out
}

/**
 * Multi-pass Hampel filter for despiking. Each pass uses the previous pass'
 * output as input, which can knock down clustered outliers that survive a
 * single pass.
 *
 * @param {Array<number|null>} arr
 * @param {number} minThreshold
 * @param {number} [window=5]
 * @param {number} [k=3]
 * @param {number} [passes=2]
 * @param {Object} [opts] - Forwarded to `hampelArray`.
 * @returns {Array<number|null>}
 */
export function despikeArray(arr, minThreshold, window = 5, k = 3, passes = 2, opts) {
  let cur = arr
  for (let p = 0; p < passes; p++) {
    cur = hampelArray(cur, window, k, minThreshold, opts)
  }
  return cur
}

/**
 * Robust noise estimator: MAD of first-differences, scaled to a standard
 * deviation. Useful to feed adaptive parameters into Kalman / Hampel.
 *
 * For independent Gaussian noise with variance σ², the first-difference has
 * variance 2σ², so σ ≈ MAD(diff) * 1.4826 / √2.
 *
 * @param {Array<number|null>} arr
 * @returns {number} Estimated noise standard deviation, 0 if not enough data.
 */
export function estimateNoiseMad(arr) {
  if (!arr || arr.length < 4) return 0
  const diffs = []
  for (let i = 1; i < arr.length; i++) {
    const a = arr[i]
    const b = arr[i - 1]
    if (a != null && b != null && isFinite(a) && isFinite(b)) {
      diffs.push(Math.abs(a - b))
    }
  }
  if (diffs.length < 3) return 0
  diffs.sort((a, b) => a - b)
  const m = med(diffs)
  return (m * 1.4826) / Math.SQRT2
}
