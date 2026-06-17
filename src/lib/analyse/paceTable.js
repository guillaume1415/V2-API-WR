import { parseSec, secToSplit } from '@/lib/pace'
import { fmtResultTime } from '@/lib/format'
import { laneColor } from '@/lib/lanes'

function laneInters(lane) {
  return lane?.intermediates || lane?.raceBoatIntermediates || []
}

function fmtDist(raw) {
  if (!raw) return raw
  const m = String(raw).match(/^d?(\d+)m?$/i)
  return m ? `${m[1]} M` : raw
}

function interDistKey(inter) {
  if (inter?.distance?.DisplayName) return inter.distance.DisplayName
  const v = inter?.raceConfig?.value
  if (v != null && String(v).trim() !== '') return `d${v}m`
  return null
}

export function buildAnalysePaceTable(lanes, wbt) {
  if (!lanes.length) return null

  const sorted = [...lanes].sort((a, b) => (a.Rank || 99) - (b.Rank || 99))
  const distMap = new Map()

  for (const l of sorted) {
    for (const i of laneInters(l)) {
      let key = interDistKey(i)
      if (!key) {
        const n = parseInt(String(i.distance?.DisplayName || i.raceConfig?.value || '').replace(/\D/g, ''), 10)
        if (Number.isFinite(n) && n > 0) key = `d${n}m`
      }
      if (key && !distMap.has(key)) distMap.set(key, fmtDist(key))
    }
  }
  if (!distMap.size) return null

  const dists = [...distMap.keys()].sort(
    (a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10),
  )

  const laneIdx = new Map()
  for (const l of sorted) {
    const key = l.id || l.boatId || l.DisplayName
    const dm = new Map()
    for (const i of laneInters(l)) {
      let dkey = interDistKey(i)
      if (!dkey) {
        const n = parseInt(String(i.distance?.DisplayName || i.raceConfig?.value || '').replace(/\D/g, ''), 10)
        if (Number.isFinite(n) && n > 0) dkey = `d${n}m`
      }
      if (dkey) dm.set(dkey, i)
    }
    laneIdx.set(key, dm)
  }

  const stats = {}
  for (let di = 0; di < dists.length; di++) {
    const d = dists[di]
    const prev = di > 0 ? dists[di - 1] : null
    const cumBySeat = new Map()
    const splitBySeat = new Map()

    for (const l of sorted) {
      const key = l.id || l.boatId || l.DisplayName
      const inter = laneIdx.get(key)?.get(d)
      const cum = parseSec(inter?.ResultTime)
      cumBySeat.set(key, cum)
      if (prev == null) splitBySeat.set(key, cum)
      else {
        const prevInter = laneIdx.get(key)?.get(prev)
        const prevCum = parseSec(prevInter?.ResultTime)
        splitBySeat.set(key, cum != null && prevCum != null ? cum - prevCum : null)
      }
    }

    const validCums = [...cumBySeat.values()].filter((v) => v != null)
    const leaderCum = validCums.length ? Math.min(...validCums) : null
    const splitEntries = [...splitBySeat.entries()]
      .filter(([, v]) => v != null)
      .sort(([, a], [, b]) => a - b)
    const splitRank = new Map(splitEntries.map(([k], idx) => [k, idx + 1]))
    stats[d] = { cumBySeat, splitBySeat, splitRank, leaderCum }
  }

  const lastDist = dists[dists.length - 1]
  const rows = sorted.map((l, li) => {
    const key = l.id || l.boatId || l.DisplayName
    const col = laneColor(l, li)
    const finalResultSec = parseSec(l.ResultTime)
    const isWR = wbt && finalResultSec != null && finalResultSec < wbt.sec
    const pctWbt =
      wbt && finalResultSec != null ? ((wbt.sec / finalResultSec) * 100).toFixed(1) : null

    const cells = dists.map((d) => {
      const st = stats[d]
      const inter = laneIdx.get(key)?.get(d)
      if (!inter) return null
      const cum = st.cumBySeat.get(key)
      const split = st.splitBySeat.get(key)
      const sRank = st.splitRank.get(key)
      const cumGap = cum != null && st.leaderCum != null ? cum - st.leaderCum : null
      const isLeader = cumGap != null && cumGap < 0.005
      const isFinalDist = d === lastDist
      return {
        cumTime: fmtResultTime(inter.ResultTime),
        cumRank: inter.Rank,
        split: secToSplit(split),
        splitRank: sRank,
        isLeader,
        cumGap,
        isWR: isWR && isFinalDist,
      }
    })

    return {
      rank: l.Rank,
      name: l.DisplayName || '?',
      color: col,
      isWR,
      pctWbt,
      cells,
    }
  })

  return { dists, distMap, rows, hasWbt: wbt != null, lastDist }
}
