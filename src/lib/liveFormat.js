import { parseSec } from '@/lib/pace'
import { rankedLanes } from '@/lib/lanes'

export function fmtMS(t) {
  if (t == null) return '—'
  return `${t.toFixed(1)} m/s`
}

export function fmtSplit(metrePerSecond) {
  if (!metrePerSecond || metrePerSecond <= 0) return '—'
  const sec500 = 500 / metrePerSecond
  const m = Math.floor(sec500 / 60)
  const s = sec500 - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}/500`
}

export function raceListLabel(r) {
  const cls = r?.event?.boatClass?.DisplayName || ''
  const phaseLabel = racePhaseLabel(r)
  return cls ? `${cls} · ${phaseLabel}` : phaseLabel
}

export function racePhaseLabel(race) {
  const phase = race.racePhase?.DisplayName || ''
  const cls = race.event?.boatClass?.DisplayName || ''
  const full = race.DisplayName || ''
  if (phase) {
    const escaped = phase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = full.match(new RegExp(`${escaped}\\s+([A-Z0-9]+)\\b`, 'i'))
    if (m) return `${phase} ${m[1]}`
  }
  if (full) {
    return cls && full.startsWith(cls) ? full.slice(cls.length).trim() : full
  }
  return phase
}

export function raceStatusClass(statusName) {
  if (/live/i.test(statusName)) return 'live'
  if (/finished|official/i.test(statusName)) return 'replay'
  return 'scheduled'
}

export function isRaceFinished(statusName) {
  return /finished|official/i.test(statusName || '')
}

/** Ordre des lignes : position live, ou classement final (temps) si course terminée */
export function tableLanes(lanes, statusName) {
  if (!isRaceFinished(statusName)) return rankedLanes(lanes)
  return [...lanes].sort((a, b) => {
    const ta = parseSec(a.ResultTime)
    const tb = parseSec(b.ResultTime)
    if (ta == null && tb == null) return (a.Lane || 99) - (b.Lane || 99)
    if (ta == null) return 1
    if (tb == null) return -1
    if (ta !== tb) return ta - tb
    return (a.Lane || 99) - (b.Lane || 99)
  })
}
