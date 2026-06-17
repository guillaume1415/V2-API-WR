/**
 * @file Distance-Per-Stroke (DPS) coherence filter.
 *
 * DPS = speed * 60 / cadence is a physically smooth quantity (it depends on
 * boat dynamics, not on tracker noise). We can therefore use a local DPS
 * estimate to detect and correct outliers in the speed series.
 *
 * For each sample i we compute:
 *   - dps[i]            = speed[i] * 60 / cadence[i]
 *   - dpsLocal          = median of dps[i±localWindow]
 *   - predictedSpeed    = dpsLocal * cadence[i] / 60
 *
 * If the observed speed deviates from the predicted speed by more than
 * `tolerancePct * predictedSpeed` (or `k_mad * MAD` of the local DPS when
 * `useMad` is set), we replace it with the prediction.
 */

function med(sorted) {
  const m = sorted.length
  if (!m) return null
  return m % 2 ? sorted[(m - 1) >> 1] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2
}

/**
 * Coherence-correct a speed series using cadence and local DPS.
 *
 * @param {Array<number|null>} speeds
 * @param {Array<number|null>} cads
 * @param {number} tolerancePct - Relative tolerance (e.g. 0.15 = 15%). Only
 *   used when `useMad` is false.
 * @param {number} [localWindow=60] - Half-window radius for the local DPS estimate.
 * @param {Object} [opts]
 * @param {boolean} [opts.symmetric=false] - When false (default, legacy
 *   behavior), only corrects positive outliers (speed too high vs cadence).
 *   When true, corrects both signs.
 * @param {boolean} [opts.useMad=false] - When true, the threshold is
 *   `k_mad * MAD(localDPS)` instead of `tolerancePct * predictedDPS`.
 *   This adapts to the local roughness of DPS.
 * @param {number} [opts.kMad=3] - MAD multiplier when `useMad` is true.
 * @param {number} [opts.minLocal=10] - Minimum number of valid neighbours
 *   required to estimate localDPS.
 * @returns {Array<number|null>} New speed array of the same length.
 */
export function dpsCorrect(speeds, cads, tolerancePct, localWindow, opts) {
  const n = speeds.length
  if (n !== cads.length) return speeds.slice()
  const symmetric = !!(opts && opts.symmetric)
  const useMad = !!(opts && opts.useMad)
  const kMad = (opts && opts.kMad) || 3
  const minLocal = (opts && opts.minLocal) || 10

  const dps = new Array(n)
  for (let i = 0; i < n; i++) {
    const s = speeds[i]
    const c = cads[i]
    dps[i] = s != null && c != null && c > 0 && isFinite(s) && isFinite(c) ? (s * 60) / c : null
  }
  const validCount = dps.filter((v) => v != null).length
  if (validCount < minLocal) return speeds.slice()
  const w = localWindow || 60
  const out = speeds.slice()
  for (let i = 0; i < n; i++) {
    const s = speeds[i]
    const c = cads[i]
    if (s == null || c == null || c <= 0) continue
    const win = []
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      if (j === i) continue
      const v = dps[j]
      if (v != null) win.push(v)
    }
    if (win.length < minLocal) continue
    win.sort((a, b) => a - b)
    const dpsLocal = med(win)
    const pred = (dpsLocal * c) / 60
    const diff = s - pred
    let thr
    if (useMad) {
      const devs = win.map((v) => Math.abs(v - dpsLocal)).sort((a, b) => a - b)
      const madVal = med(devs)
      thr = ((kMad * 1.4826 * madVal) * c) / 60
    } else {
      thr = tolerancePct * pred
    }
    if (symmetric) {
      if (Math.abs(diff) > thr) out[i] = pred
    } else if (diff > thr) {
      out[i] = pred
    }
  }
  return out
}
