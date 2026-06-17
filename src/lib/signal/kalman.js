/**
 * @file Constant-acceleration Kalman filter + Rauch-Tung-Striebel (RTS)
 * smoother for 1-D GPS distance series, with optional gate anchors.
 *
 * State vector: [position (m), velocity (m/s)].
 * Transition (CA discretized over `dt`):
 *   F = [[1, dt], [0, 1]]
 *   Q = sigma_a² · [[dt⁴/4, dt³/2], [dt³/2, dt²]]
 *
 * Two measurement types share the same observation matrix H = [1, 0]:
 *   - 'gps'  : noisy distance measurement with variance R_gps,
 *   - 'gate' : official intermediate-gate distance with variance R_gate
 *              (R_gate is typically much smaller than R_gps).
 *
 * The RTS pass runs backward to produce a global MAP estimate, which is
 * smoother than the forward-only Kalman output.
 *
 * Implementation note: the inner loops use flat `Float64Array` buffers (no
 * nested arrays, no per-step `slice()`) so each event costs zero heap
 * allocations. Matrix maths are inlined for the same reason.
 */

/**
 * Estimate the initial velocity from the first valid samples by a robust
 * (median) slope. Falls back to 0 if not enough data.
 *
 * @param {Array<number>} distances
 * @param {Array<number>|null} times
 * @param {number} maxSamples
 * @returns {number}
 */
function estimateInitialVelocity(distances, times, maxSamples = 5) {
  const n = Math.min(maxSamples, distances.length - 1)
  if (n < 2) return 0
  const slopes = []
  for (let i = 1; i <= n; i++) {
    const dd = distances[i] - distances[0]
    const dt = times ? times[i] - times[0] : i
    if (dt > 0 && isFinite(dd)) slopes.push(dd / dt)
  }
  if (!slopes.length) return 0
  slopes.sort((a, b) => a - b)
  return slopes[slopes.length >> 1]
}

/**
 * Run a constant-acceleration Kalman filter + RTS smoother over GPS
 * distances, optionally anchored on intermediate gate distances.
 *
 * @param {Array<number>} distances - Cumulative distance per tick (m).
 *   Must be monotonic for gate matching to work.
 * @param {Array<{d:number}>} gates - Official gate distances (m). May be empty.
 * @param {Object} [opts]
 * @param {number} [opts.sigma_a=0.15] - Process noise: 1-σ acceleration (m/s²).
 *   Larger → more responsive but noisier.
 * @param {number} [opts.R_gps=9] - GPS measurement variance (m²). Larger → trust GPS less.
 * @param {number} [opts.R_gate=0.25] - Gate measurement variance (m²). Smaller → strong anchor.
 * @param {number|null} [opts.innovationGate=null] - When set, GPS updates
 *   with Mahalanobis innovation |y|/√S > innovationGate are dropped
 *   (typical: 3.0). Gate updates are never gated. `null` disables.
 * @param {'estimate'|'zero'} [opts.initialVelocity='zero'] - Initial velocity
 *   strategy. `'estimate'` uses a robust median slope over the first samples
 *   and dramatically reduces the initial settling lag; `'zero'` (the default)
 *   preserves legacy behavior.
 * @param {number} [opts.initialPosVar=1e4] - Initial position variance.
 * @param {number} [opts.initialVelVar=100] - Initial velocity variance.
 * @param {Array<number>} [times] - Per-tick time (s). Length must match
 *   `distances`. If omitted, dt = 1 between consecutive ticks.
 * @returns {{pos: Array<number|undefined>, vel: Array<number|undefined>}}
 */
export function rtsSmooth1D(distances, gates, opts, times) {
  const n = distances.length
  if (n < 3) return { pos: distances.slice(), vel: new Array(n).fill(0) }
  const sigma_a = (opts && opts.sigma_a) || 0.15
  const R_gps = (opts && opts.R_gps) || 9
  const R_gate = (opts && opts.R_gate) || 0.25
  const innovationGate = opts && opts.innovationGate != null ? opts.innovationGate : null
  const innovationGate2 = innovationGate != null ? innovationGate * innovationGate : 0
  const initialVelocityMode = (opts && opts.initialVelocity) || 'zero'
  const initialPosVar = (opts && opts.initialPosVar) || 1e4
  const initialVelVar = (opts && opts.initialVelVar) || 100
  const q = sigma_a * sigma_a

  const T = times && times.length === n ? times : null
  const tickAt = (k) => (T ? T[k] : k)

  // Build the merged event stream (GPS + gate observations) sorted by time.
  // We use 4 parallel typed arrays instead of an array of objects to keep
  // the hot loop allocation-free.
  const gateCount = gates ? gates.length : 0
  const maxE = n + gateCount
  const evT = new Float64Array(maxE)
  const evZ = new Float64Array(maxE)
  const evR = new Float64Array(maxE)
  const evType = new Uint8Array(maxE) // 0 = gps, 1 = gate
  const evTick = new Int32Array(maxE) // -1 if gate

  let E = 0
  for (let k = 0; k < n; k++) {
    evT[E] = tickAt(k)
    evZ[E] = distances[k]
    evR[E] = R_gps
    evType[E] = 0
    evTick[E] = k
    E++
  }
  if (gates) {
    for (let gi = 0; gi < gates.length; gi++) {
      const dGate = gates[gi].d
      let K = -1
      for (let i = 0; i < n - 1; i++) {
        if (distances[i] <= dGate && distances[i + 1] >= dGate && distances[i + 1] > distances[i]) {
          K = i
          break
        }
      }
      if (K < 0) continue
      const dd = distances[K + 1] - distances[K]
      const alpha = Math.max(0, Math.min(1, (dGate - distances[K]) / dd))
      const tGate = tickAt(K) + alpha * (tickAt(K + 1) - tickAt(K))
      evT[E] = tGate
      evZ[E] = dGate
      evR[E] = R_gate
      evType[E] = 1
      evTick[E] = -1
      E++
    }
  }

  // Sort the events (carry the parallel arrays). Build an index array, sort
  // the index, then materialise sorted typed arrays.
  const idx = new Int32Array(E)
  for (let i = 0; i < E; i++) idx[i] = i
  const idxArr = Array.from(idx)
  idxArr.sort((a, b) => evT[a] - evT[b])
  const sT = new Float64Array(E)
  const sZ = new Float64Array(E)
  const sR = new Float64Array(E)
  const sType = new Uint8Array(E)
  const sTick = new Int32Array(E)
  for (let i = 0; i < E; i++) {
    const j = idxArr[i]
    sT[i] = evT[j]
    sZ[i] = evZ[j]
    sR[i] = evR[j]
    sType[i] = evType[j]
    sTick[i] = evTick[j]
  }

  // Flat storage for the forward pass. Vectors are length-2 (stride 2),
  // 2×2 matrices are stored row-major in stride-4 buffers.
  const xs_pred = new Float64Array(E * 2)
  const xs_post = new Float64Array(E * 2)
  const Ps_pred = new Float64Array(E * 4)
  const Ps_post = new Float64Array(E * 4)
  const dts = new Float64Array(E)

  const v0 =
    initialVelocityMode === 'estimate' ? estimateInitialVelocity(distances, T) : 0
  let x0 = distances[0]
  let x1 = v0
  let P00 = initialPosVar
  let P01 = 0
  let P10 = 0
  let P11 = initialVelVar

  // Forward Kalman pass.
  for (let e = 0; e < E; e++) {
    let dt = 0
    if (e > 0) {
      dt = sT[e] - sT[e - 1]
      if (dt >= 1e-9) {
        // x ← F x : pos += dt·vel ; vel unchanged.
        const newX0 = x0 + dt * x1
        const newX1 = x1
        // P ← F P Fᵀ + Q (with F=[[1,dt],[0,1]], H constant).
        const dt2 = dt * dt
        const dt3 = dt2 * dt
        const dt4 = dt2 * dt2
        // (F P) row 0 = [P00 + dt·P10, P01 + dt·P11]
        // (F P) row 1 = [P10, P11]
        // (F P) Fᵀ = (F P) · [[1,0],[dt,1]]
        const FP00 = P00 + dt * P10
        const FP01 = P01 + dt * P11
        const FP10 = P10
        const FP11 = P11
        const newP00 = FP00 + FP01 * dt + (q * dt4) / 4
        const newP01 = FP01 + (q * dt3) / 2
        const newP10 = FP10 + FP11 * dt + (q * dt3) / 2
        const newP11 = FP11 + q * dt2
        x0 = newX0
        x1 = newX1
        P00 = newP00
        P01 = newP01
        P10 = newP10
        P11 = newP11
      }
    }
    xs_pred[2 * e] = x0
    xs_pred[2 * e + 1] = x1
    Ps_pred[4 * e] = P00
    Ps_pred[4 * e + 1] = P01
    Ps_pred[4 * e + 2] = P10
    Ps_pred[4 * e + 3] = P11
    dts[e] = dt

    const y = sZ[e] - x0
    const S = P00 + sR[e]
    const reject =
      innovationGate != null && sType[e] === 0 && S > 0 && y * y > innovationGate2 * S
    if (!reject) {
      const K0 = P00 / S
      const K1 = P10 / S
      const newP00 = (1 - K0) * P00
      const newP01 = (1 - K0) * P01
      const newP10 = P10 - K1 * P00
      const newP11 = P11 - K1 * P01
      x0 = x0 + K0 * y
      x1 = x1 + K1 * y
      P00 = newP00
      P01 = newP01
      P10 = newP10
      P11 = newP11
    }
    xs_post[2 * e] = x0
    xs_post[2 * e + 1] = x1
    Ps_post[4 * e] = P00
    Ps_post[4 * e + 1] = P01
    Ps_post[4 * e + 2] = P10
    Ps_post[4 * e + 3] = P11
  }

  // Backward RTS smoothing pass.
  const xs_s = new Float64Array(E * 2)
  const Ps_s = new Float64Array(E * 4)
  xs_s[2 * (E - 1)] = xs_post[2 * (E - 1)]
  xs_s[2 * (E - 1) + 1] = xs_post[2 * (E - 1) + 1]
  Ps_s[4 * (E - 1)] = Ps_post[4 * (E - 1)]
  Ps_s[4 * (E - 1) + 1] = Ps_post[4 * (E - 1) + 1]
  Ps_s[4 * (E - 1) + 2] = Ps_post[4 * (E - 1) + 2]
  Ps_s[4 * (E - 1) + 3] = Ps_post[4 * (E - 1) + 3]

  for (let e = E - 2; e >= 0; e--) {
    const dt = dts[e + 1]
    const o = e * 2
    const om = (e + 1) * 2
    const oP = e * 4
    const oPm = (e + 1) * 4
    if (dt < 1e-9) {
      xs_s[o] = xs_s[om]
      xs_s[o + 1] = xs_s[om + 1]
      Ps_s[oP] = Ps_s[oPm]
      Ps_s[oP + 1] = Ps_s[oPm + 1]
      Ps_s[oP + 2] = Ps_s[oPm + 2]
      Ps_s[oP + 3] = Ps_s[oPm + 3]
      continue
    }
    // Pp ← Ps_pred[e+1], Pp_inv = mi2(Pp).
    const Pp00 = Ps_pred[oPm]
    const Pp01 = Ps_pred[oPm + 1]
    const Pp10 = Ps_pred[oPm + 2]
    const Pp11 = Ps_pred[oPm + 3]
    const det = Pp00 * Pp11 - Pp01 * Pp10
    const safeDet = Math.abs(det) < 1e-12 ? (det >= 0 ? 1e-12 : -1e-12) : det
    const Pi00 = Pp11 / safeDet
    const Pi01 = -Pp01 / safeDet
    const Pi10 = -Pp10 / safeDet
    const Pi11 = Pp00 / safeDet

    // C = Ps_post[e] · Fᵀ · Pp_inv, with Fᵀ=[[1,0],[dt,1]].
    const Posp00 = Ps_post[oP]
    const Posp01 = Ps_post[oP + 1]
    const Posp10 = Ps_post[oP + 2]
    const Posp11 = Ps_post[oP + 3]
    const PFt00 = Posp00 + Posp01 * dt
    const PFt01 = Posp01
    const PFt10 = Posp10 + Posp11 * dt
    const PFt11 = Posp11
    const C00 = PFt00 * Pi00 + PFt01 * Pi10
    const C01 = PFt00 * Pi01 + PFt01 * Pi11
    const C10 = PFt10 * Pi00 + PFt11 * Pi10
    const C11 = PFt10 * Pi01 + PFt11 * Pi11

    const xp0 = xs_pred[om]
    const xp1 = xs_pred[om + 1]
    const diff0 = xs_s[om] - xp0
    const diff1 = xs_s[om + 1] - xp1
    const Cd0 = C00 * diff0 + C01 * diff1
    const Cd1 = C10 * diff0 + C11 * diff1
    xs_s[o] = xs_post[o] + Cd0
    xs_s[o + 1] = xs_post[o + 1] + Cd1

    const dP00 = Ps_s[oPm] - Pp00
    const dP01 = Ps_s[oPm + 1] - Pp01
    const dP10 = Ps_s[oPm + 2] - Pp10
    const dP11 = Ps_s[oPm + 3] - Pp11
    const CdP00 = C00 * dP00 + C01 * dP10
    const CdP01 = C00 * dP01 + C01 * dP11
    const CdP10 = C10 * dP00 + C11 * dP10
    const CdP11 = C10 * dP01 + C11 * dP11
    // Multiply by Cᵀ = [[C00, C10], [C01, C11]].
    Ps_s[oP] = Posp00 + CdP00 * C00 + CdP01 * C01
    Ps_s[oP + 1] = Posp01 + CdP00 * C10 + CdP01 * C11
    Ps_s[oP + 2] = Posp10 + CdP10 * C00 + CdP11 * C01
    Ps_s[oP + 3] = Posp11 + CdP10 * C10 + CdP11 * C11
  }

  // Scatter the smoothed state back to per-tick arrays (gate events are
  // dropped because their tick index is -1).
  const pos = new Array(n)
  const vel = new Array(n)
  for (let e = 0; e < E; e++) {
    const ti = sTick[e]
    if (ti >= 0) {
      pos[ti] = xs_s[2 * e]
      vel[ti] = xs_s[2 * e + 1]
    }
  }
  return { pos, vel }
}

/**
 * Build a list of gate anchors (`{tick, d}`) from a lane object by parsing
 * its `intermediates[].distance.DisplayName` and matching the closest GPS
 * tick.
 *
 * @param {{intermediates?: Array<{distance?: {DisplayName?: string}}>}} lane
 * @param {Array<{d:number}>} pts - GPS-derived points (must expose `.d`).
 * @param {number} [totalLength] - Race length (m). Gates ≥ totalLength are dropped.
 * @param {Object} [opts]
 * @param {number} [opts.maxDistErr=50] - Maximum |GPS-d − gate-d| (m) to
 *   accept a gate as matched. Larger values tolerate sparser GPS sampling.
 * @returns {Array<{tick:number, d:number}>}
 */
export function buildGateAnchors(lane, pts, totalLength, opts) {
  const maxDistErr = (opts && opts.maxDistErr) || 50
  const inters = lane.intermediates || []
  const gates = []
  for (const it of inters) {
    const dStr = (it.distance?.DisplayName || '').replace(/\D/g, '')
    const dGate = parseInt(dStr, 10)
    if (!isFinite(dGate)) continue
    if (totalLength && dGate >= totalLength) continue
    let bestI = -1
    let bestErr = Infinity
    for (let i = 0; i < pts.length; i++) {
      const e = Math.abs(pts[i].d - dGate)
      if (e < bestErr) {
        bestErr = e
        bestI = i
      }
    }
    if (bestI >= 0 && bestErr < maxDistErr) gates.push({ tick: bestI, d: dGate })
  }
  return gates
}
