export const Y_DEFAULTS = {
  speed: { min: 4.5, max: 6.5 },
  cadence: { min: 37, max: 49 },
  time: { min: null, max: null },
  gap: { min: 0, max: null },
  dps: { min: 6, max: 10 },
}

export const C_DEFAULTS = {
  speed: { min: 37, max: 49 },
  cadence: { min: 4.5, max: null },
}

export const SPECTRAL = [
  [0.0, '#5e4fa2'],
  [0.111, '#3288bd'],
  [0.222, '#66c2a5'],
  [0.333, '#abdda4'],
  [0.444, '#e6f598'],
  [0.555, '#fee08b'],
  [0.666, '#fdae61'],
  [0.777, '#f46d43'],
  [0.888, '#d53e4f'],
  [1.0, '#9e0142'],
]

export const SPEED_DEFAULTS_BY_CLASS = {
  'M8+': { min: 5.0, max: 6.8 },
  'W8+': { min: 4.4, max: 5.8 },
  'M4-': { min: 4.5, max: 6.2 },
  'W4-': { min: 4.0, max: 5.6 },
  'M4x': { min: 4.5, max: 6.2 },
  'W4x': { min: 4.2, max: 5.6 },
  'LM4-': { min: 4.3, max: 5.9 },
  'M2x': { min: 4.4, max: 6.0 },
  'W2x': { min: 4.0, max: 5.4 },
  'LM2x': { min: 4.3, max: 5.8 },
  'LW2x': { min: 3.8, max: 5.1 },
  'M2-': { min: 4.4, max: 6.0 },
  'W2-': { min: 4.0, max: 5.5 },
  'LM2-': { min: 4.3, max: 5.8 },
  'LW2-': { min: 3.8, max: 5.1 },
  'M1x': { min: 4.2, max: 5.8 },
  'W1x': { min: 3.8, max: 5.2 },
  'LM1x': { min: 4.0, max: 5.5 },
  'LW1x': { min: 3.6, max: 5.0 },
  'PR3M4+': { min: 3.5, max: 5.0 },
  'PR3W4+': { min: 3.2, max: 4.6 },
  'PR1M1x': { min: 2.8, max: 4.2 },
  'PR1W1x': { min: 2.6, max: 4.0 },
  'PR2M1x': { min: 3.0, max: 4.5 },
  'PR2W1x': { min: 2.8, max: 4.3 },
  _default: { min: 4.5, max: 6.5 },
}

export const BOAT_CLASS_NAME_MAP = {
  "men's single sculls": 'M1x',
  'men single sculls': 'M1x',
  "women's single sculls": 'W1x',
  'women single sculls': 'W1x',
  "lightweight men's single sculls": 'LM1x',
  "lightweight women's single sculls": 'LW1x',
  "men's double sculls": 'M2x',
  'men double sculls': 'M2x',
  "women's double sculls": 'W2x',
  'women double sculls': 'W2x',
  "lightweight men's double sculls": 'LM2x',
  "lightweight women's double sculls": 'LW2x',
  "men's pair": 'M2-',
  'men pair': 'M2-',
  "women's pair": 'W2-',
  'women pair': 'W2-',
  "lightweight men's pair": 'LM2-',
  "lightweight women's pair": 'LW2-',
  "men's quadruple sculls": 'M4x',
  'men quadruple sculls': 'M4x',
  "women's quadruple sculls": 'W4x',
  'women quadruple sculls': 'W4x',
  "men's four": 'M4-',
  'men four': 'M4-',
  "women's four": 'W4-',
  'women four': 'W4-',
  "lightweight men's four": 'LM4-',
  "men's eight": 'M8+',
  'men eight': 'M8+',
  "women's eight": 'W8+',
  'women eight': 'W8+',
}

export const WBT_TABLE = {
  M1x: { time: '6:30.74', sec: 390.74 },
  LM1x: { time: '6:39.56', sec: 399.56 },
  W1x: { time: '7:07.71', sec: 427.71 },
  LW1x: { time: '7:23.36', sec: 443.36 },
  M2x: { time: '5:59.72', sec: 359.72 },
  LM2x: { time: '6:05.33', sec: 365.33 },
  W2x: { time: '6:37.31', sec: 397.31 },
  LW2x: { time: '6:40.47', sec: 400.47 },
  'M2-': { time: '6:08.50', sec: 368.5 },
  'LM2-': { time: '6:22.91', sec: 382.91 },
  'W2-': { time: '6:47.41', sec: 407.41 },
  'LW2-': { time: '7:18.32', sec: 438.32 },
  M4x: { time: '5:32.03', sec: 332.03 },
  W4x: { time: '6:05.13', sec: 365.13 },
  'M4-': { time: '5:37.86', sec: 337.86 },
  'W4-': { time: '6:14.36', sec: 374.36 },
  'LM4-': { time: '5:43.16', sec: 343.16 },
  'M8+': { time: '5:18.68', sec: 318.68 },
  'W8+': { time: '5:52.99', sec: 352.99 },
  PR1M1x: { time: '8:50.38', sec: 530.38 },
  PR2M1x: { time: '8:20.61', sec: 500.61 },
  'PR3M2-': { time: '6:52.08', sec: 412.08 },
  PR1W1x: { time: '9:47.83', sec: 587.83 },
  PR2W1x: { time: '9:14.65', sec: 554.65 },
  'PR3W2-': { time: '7:39.30', sec: 459.3 },
}

export function normalizeBoatClass(displayName) {
  if (!displayName) return null
  if (SPEED_DEFAULTS_BY_CLASS[displayName]) return displayName
  const key = String(displayName).toLowerCase().trim()
  return BOAT_CLASS_NAME_MAP[key] || null
}

export function getSpeedDefaults(boatClassDisplayName) {
  const code = normalizeBoatClass(boatClassDisplayName)
  return (code && SPEED_DEFAULTS_BY_CLASS[code]) || SPEED_DEFAULTS_BY_CLASS._default
}

export function getWbt(boatClassDisplayName) {
  const code = normalizeBoatClass(boatClassDisplayName)
  return code ? WBT_TABLE[code] || null : null
}

export function getWbtCode(boatClassDisplayName) {
  return normalizeBoatClass(boatClassDisplayName)
}

export function getBoatClassDisplayName(data, selectedRace) {
  const race = data?.config?.race || selectedRace || {}
  return (
    race.event?.boatClass?.DisplayName ||
    selectedRace?.event?.boatClass?.DisplayName ||
    race.event?.DisplayName ||
    selectedRace?.event?.DisplayName ||
    ''
  )
}

export function getLanes(data) {
  const cfg = data?.config || {}
  return (cfg.lanes || []).slice().sort((a, b) => (a.Lane || 99) - (b.Lane || 99))
}
