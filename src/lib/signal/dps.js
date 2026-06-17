function med(sorted) {
  const m = sorted.length
  if (!m) return null
  return m % 2 ? sorted[(m - 1) >> 1] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2
}

export function dpsCorrect(speeds, cads, tolerancePct, localWindow) {
  const n = speeds.length
  if (n !== cads.length) return speeds.slice()
  const dps = new Array(n)
  for (let i = 0; i < n; i++) {
    const s = speeds[i]
    const c = cads[i]
    dps[i] = s != null && c != null && c > 0 && isFinite(s) && isFinite(c) ? (s * 60) / c : null
  }
  const validCount = dps.filter((v) => v != null).length
  if (validCount < 10) return speeds.slice()
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
    if (win.length < 10) continue
    win.sort((a, b) => a - b)
    const dpsLocal = med(win)
    const pred = (dpsLocal * c) / 60
    if (s - pred > tolerancePct * pred) out[i] = pred
  }
  return out
}
