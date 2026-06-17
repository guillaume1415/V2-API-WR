/** Codes IOC/FISA (3 lettres) → ISO 3166-1 alpha-2 pour les drapeaux emoji */
const IOC_TO_ISO = {
  AFG: 'AF', ALB: 'AL', ALG: 'DZ', AND: 'AD', ANG: 'AO', ANT: 'AG', ARG: 'AR', ARM: 'AM',
  ARU: 'AW', ASA: 'AS', AUS: 'AU', AUT: 'AT', AZE: 'AZ',
  BAH: 'BS', BAN: 'BD', BAR: 'BB', BDI: 'BI', BEL: 'BE', BEN: 'BJ', BER: 'BM', BHU: 'BT',
  BIH: 'BA', BIZ: 'BZ', BLR: 'BY', BOL: 'BO', BOT: 'BW', BRA: 'BR', BRN: 'BH', BRU: 'BN',
  BUL: 'BG', BUR: 'BF',
  CAF: 'CF', CAM: 'KH', CAN: 'CA', CAY: 'KY', CGO: 'CG', CHA: 'TD', CHI: 'CL', CHN: 'CN',
  CIV: 'CI', CMR: 'CM', COD: 'CD', COK: 'CK', COL: 'CO', COM: 'KM', CPV: 'CV', CRC: 'CR',
  CRO: 'HR', CUB: 'CU', CYP: 'CY', CZE: 'CZ',
  DEN: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO',
  ECU: 'EC', EGY: 'EG', ERI: 'ER', ESA: 'SV', ESP: 'ES', EST: 'EE', ETH: 'ET',
  FIJ: 'FJ', FIN: 'FI', FRA: 'FR', FSM: 'FM',
  GAB: 'GA', GAM: 'GM', GBR: 'GB', GBS: 'GW', GEO: 'GE', GEQ: 'GQ', GER: 'DE', GHA: 'GH',
  GRE: 'GR', GRN: 'GD', GUA: 'GT', GUM: 'GU', GUY: 'GY',
  HAI: 'HT', HKG: 'HK', HON: 'HN', HUN: 'HU',
  INA: 'ID', IND: 'IN', IRI: 'IR', IRL: 'IE', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ISV: 'VI',
  ITA: 'IT', IVB: 'VG',
  JAM: 'JM', JOR: 'JO', JPN: 'JP',
  KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KIR: 'KI', KOR: 'KR', KOS: 'XK', KSA: 'SA', KUW: 'KW',
  LAO: 'LA', LAT: 'LV', LBA: 'LY', LBN: 'LB', LBR: 'LR', LCA: 'LC', LES: 'LS', LIE: 'LI',
  LTU: 'LT', LUX: 'LU',
  MAD: 'MG', MAR: 'MA', MAS: 'MY', MDA: 'MD', MDV: 'MV', MEX: 'MX', MGL: 'MN', MHL: 'MH',
  MKD: 'MK', MLI: 'ML', MLT: 'MT', MNE: 'ME', MON: 'MC', MOZ: 'MZ', MRI: 'MU', MTN: 'MR',
  MYA: 'MM',
  NAM: 'NA', NCA: 'NI', NED: 'NL', NEP: 'NP', NGR: 'NG', NIG: 'NE', NIU: 'NU', NOR: 'NO',
  NRU: 'NR', NZL: 'NZ',
  OMA: 'OM',
  PAK: 'PK', PAN: 'PA', PAR: 'PY', PER: 'PE', PHI: 'PH', PLE: 'PS', PLW: 'PW', PNG: 'PG',
  POL: 'PL', POR: 'PT', PRK: 'KP', PUR: 'PR',
  QAT: 'QA',
  ROU: 'RO', RSA: 'ZA', RUS: 'RU', RWA: 'RW',
  SAM: 'WS', SEN: 'SN', SEY: 'SC', SGP: 'SG', SKN: 'KN', SLE: 'SL', SLO: 'SI', SMR: 'SM',
  SOL: 'SB', SOM: 'SO', SRB: 'RS', SRI: 'LK', SSD: 'SS', STP: 'ST', SUD: 'SD', SUI: 'CH',
  SUR: 'SR', SVK: 'SK', SWE: 'SE', SWZ: 'SZ', SYR: 'SY',
  TAN: 'TZ', TGA: 'TO', THA: 'TH', TJK: 'TJ', TKM: 'TM', TOG: 'TG', TPE: 'TW', TRI: 'TT',
  TTO: 'TT', TUN: 'TN', TUR: 'TR', TUV: 'TV',
  UAE: 'AE', UGA: 'UG', UKR: 'UA', URU: 'UY', URY: 'UY', USA: 'US', UZB: 'UZ',
  VAN: 'VU', VEN: 'VE', VIE: 'VN', VIN: 'VC',
  YEM: 'YE',
  ZAM: 'ZM', ZIM: 'ZW',
  // Nations britanniques (aviron)
  ENG: 'GB', SCO: 'GB', WAL: 'GB', NIR: 'GB',
}

/** Codes sans pays ISO (équipes neutres, etc.) */
const SPECIAL_FLAGS = {
  AIN: '🏳️',
  ROC: '🏳️',
  IOP: '🏳️',
  EOR: '🏳️',
  XXB: '🏳️',
}

const REGIONAL_BASE = 0x1F1E6

export function isoToFlagEmoji(iso2) {
  const code = String(iso2 || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(
    REGIONAL_BASE + code.charCodeAt(0) - 65,
    REGIONAL_BASE + code.charCodeAt(1) - 65,
  )
}

function iocToIso(ioc3) {
  if (IOC_TO_ISO[ioc3]) return IOC_TO_ISO[ioc3]
  if (ioc3 === 'IRN') return 'IR'
  return null
}

export function getFlagEmoji(nationCode) {
  const raw = String(nationCode || '').trim().toUpperCase()
  if (!raw) return ''

  if (SPECIAL_FLAGS[raw]) return SPECIAL_FLAGS[raw]

  if (raw.length === 2) return isoToFlagEmoji(raw)

  if (raw.length === 3) {
    const iso = iocToIso(raw)
    if (iso) return isoToFlagEmoji(iso)
  }

  return ''
}
