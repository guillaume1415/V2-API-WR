function mm2(A, B) {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ]
}
function ma2(A, B) {
  return [
    [A[0][0] + B[0][0], A[0][1] + B[0][1]],
    [A[1][0] + B[1][0], A[1][1] + B[1][1]],
  ]
}
function ms2(A, B) {
  return [
    [A[0][0] - B[0][0], A[0][1] - B[0][1]],
    [A[1][0] - B[1][0], A[1][1] - B[1][1]],
  ]
}
function mt2(A) {
  return [
    [A[0][0], A[1][0]],
    [A[0][1], A[1][1]],
  ]
}
function mi2(A) {
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
  if (Math.abs(det) < 1e-12) return [[1e12, 0], [0, 1e12]]
  return [
    [A[1][1] / det, -A[0][1] / det],
    [-A[1][0] / det, A[0][0] / det],
  ]
}

export function rtsSmooth1D(distances, gates, opts, times) {
  const n = distances.length
  if (n < 3) return { pos: distances.slice(), vel: new Array(n).fill(0) }
  const sigma_a = (opts && opts.sigma_a) || 0.15
  const R_gps = (opts && opts.R_gps) || 9
  const R_gate = (opts && opts.R_gate) || 0.25
  const q = sigma_a * sigma_a

  const T = times && times.length === n ? times : null
  const tickAt = (k) => (T ? T[k] : k)

  const events = []
  for (let k = 0; k < n; k++) {
    events.push({ t: tickAt(k), type: 'gps', z: distances[k], R: R_gps, tickIndex: k })
  }
  for (const g of gates || []) {
    const dGate = g.d
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
    events.push({ t: tGate, type: 'gate', z: dGate, R: R_gate, tickIndex: -1 })
  }
  events.sort((a, b) => a.t - b.t)
  const E = events.length

  const xs_post = new Array(E)
  const Ps_post = new Array(E)
  const xs_pred = new Array(E)
  const Ps_pred = new Array(E)
  const dts = new Array(E)

  let x = [distances[0], 0]
  let P = [
    [1e4, 0],
    [0, 100],
  ]

  for (let e = 0; e < E; e++) {
    let dt = 0
    if (e === 0) {
      xs_pred[0] = x.slice()
      Ps_pred[0] = [
        [P[0][0], P[0][1]],
        [P[1][0], P[1][1]],
      ]
    } else {
      dt = events[e].t - events[e - 1].t
      if (dt < 1e-9) {
        xs_pred[e] = x.slice()
        Ps_pred[e] = [
          [P[0][0], P[0][1]],
          [P[1][0], P[1][1]],
        ]
      } else {
        const F = [
          [1, dt],
          [0, 1],
        ]
        const Ft = mt2(F)
        const Q = [
          [(dt ** 4 / 4) * q, (dt ** 3 / 2) * q],
          [(dt ** 3 / 2) * q, dt * dt * q],
        ]
        const xp = [F[0][0] * x[0] + F[0][1] * x[1], F[1][0] * x[0] + F[1][1] * x[1]]
        const Pp = ma2(mm2(mm2(F, P), Ft), Q)
        xs_pred[e] = xp
        Ps_pred[e] = Pp
        x = xp
        P = Pp
      }
    }
    dts[e] = dt
    const ev = events[e]
    const y = ev.z - x[0]
    const S = P[0][0] + ev.R
    const Kg = [P[0][0] / S, P[1][0] / S]
    x = [x[0] + Kg[0] * y, x[1] + Kg[1] * y]
    P = [
      [(1 - Kg[0]) * P[0][0], (1 - Kg[0]) * P[0][1]],
      [P[1][0] - Kg[1] * P[0][0], P[1][1] - Kg[1] * P[0][1]],
    ]
    xs_post[e] = x.slice()
    Ps_post[e] = [
      [P[0][0], P[0][1]],
      [P[1][0], P[1][1]],
    ]
  }

  const xs_s = new Array(E)
  const Ps_s = new Array(E)
  xs_s[E - 1] = xs_post[E - 1].slice()
  Ps_s[E - 1] = Ps_post[E - 1]
  for (let e = E - 2; e >= 0; e--) {
    const dt = dts[e + 1]
    if (dt < 1e-9) {
      xs_s[e] = xs_s[e + 1].slice()
      Ps_s[e] = Ps_s[e + 1]
      continue
    }
    const F = [
      [1, dt],
      [0, 1],
    ]
    const Ft = mt2(F)
    const xp = xs_pred[e + 1]
    const Pp = Ps_pred[e + 1]
    const Pp_inv = mi2(Pp)
    const C = mm2(mm2(Ps_post[e], Ft), Pp_inv)
    const diff = [xs_s[e + 1][0] - xp[0], xs_s[e + 1][1] - xp[1]]
    const Cd = [C[0][0] * diff[0] + C[0][1] * diff[1], C[1][0] * diff[0] + C[1][1] * diff[1]]
    xs_s[e] = [xs_post[e][0] + Cd[0], xs_post[e][1] + Cd[1]]
    const dP = ms2(Ps_s[e + 1], Pp)
    Ps_s[e] = ma2(Ps_post[e], mm2(mm2(C, dP), mt2(C)))
  }

  const pos = new Array(n)
  const vel = new Array(n)
  for (let e = 0; e < E; e++) {
    if (events[e].tickIndex >= 0) {
      pos[events[e].tickIndex] = xs_s[e][0]
      vel[events[e].tickIndex] = xs_s[e][1]
    }
  }
  return { pos, vel }
}

export function buildGateAnchors(lane, pts, totalLength) {
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
    if (bestI >= 0 && bestErr < 50) gates.push({ tick: bestI, d: dGate })
  }
  return gates
}
