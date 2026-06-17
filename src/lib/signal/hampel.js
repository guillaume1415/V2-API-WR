function med(sorted) {
  const m = sorted.length
  if (!m) return null
  return m % 2 ? sorted[(m - 1) >> 1] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2
}

export function hampelArray(arr, window, k, minThreshold) {
  const n = arr.length
  if (n < 3) return arr.slice()
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
    if (Math.abs(v - localMed) > thr) out[i] = localMed
  }
  return out
}

export function despikeArray(arr, minThreshold, window = 5, k = 3, passes = 2) {
  let cur = arr
  for (let p = 0; p < passes; p++) {
    cur = hampelArray(cur, window, k, minThreshold)
  }
  return cur
}
