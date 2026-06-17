import { buildUrl, apiFetch } from './client'

function raceStatusName(race) {
  const s = race.raceStatus
  return typeof s === 'object' ? s?.DisplayName : s
}

/** Courses officielles uniquement (index.html) */
export async function apiOfficialRaces(competitionId) {
  const url = buildUrl('/race/', {
    include:
      'raceStatus,racePhase,event.competition.competitionType,event.competition.competitionType.competitionCategory,event.boatClass,raceBoats',
    'filter[event.competitionId]': competitionId,
    'sort[date]': 'asc',
  })
  const payload = await apiFetch(url)
  const data = Array.isArray(payload.data) ? payload.data : []
  return data.filter((r) => raceStatusName(r) === 'Official')
}

/** Courses avec pays des équipages (classement nations) */
export async function apiNationsRaces(competitionId) {
  const url = buildUrl('/race/', {
    include: 'raceStatus,racePhase,event.boatClass,raceBoats,raceBoats.country',
    'filter[event.competitionId]': competitionId,
    'sort[date]': 'asc',
    PageSize: 500,
  })
  const payload = await apiFetch(url)
  return Array.isArray(payload.data) ? payload.data : []
}

/** Toutes les courses d'une compétition (live, analyse) */
export async function apiRaces(competitionId) {
  const url = buildUrl('/race/', {
    include: 'raceStatus,racePhase,event.boatClass,raceBoats',
    'filter[event.competitionId]': competitionId,
    'sort[date]': 'asc',
    PageSize: 500,
  })
  const payload = await apiFetch(url)
  return Array.isArray(payload.data) ? payload.data : []
}

/** Programme complet avec pagination (schedule.html) */
export async function apiSchedule(competitionId) {
  const url = buildUrl('/race/', {
    'filter[event.competitionId]': competitionId,
    include: 'event.competition,event.boatClass,raceStatus,racePhase,raceBoats',
    'sort[DateString]': 'asc',
    paginate: '200',
  })
  const payload = await apiFetch(url)
  return Array.isArray(payload.data) ? payload.data : []
}

/** Toutes les courses triées par DateString — notifications */
export async function apiAllRaces(competitionId) {
  const url = buildUrl('/race/', {
    'filter[event.competitionId]': competitionId,
    include: 'raceStatus,racePhase,event.boatClass,raceBoats',
    'sort[DateString]': 'asc',
    paginate: '200',
  })
  const payload = await apiFetch(url)
  return Array.isArray(payload.data) ? payload.data : []
}

export async function apiEntries(competitionId) {
  const url = buildUrl(`/competition/${competitionId}`, {
    include: 'events.boats.boatAthletes.person,events.boatClass,events.boats.country',
  })
  const payload = await apiFetch(url)
  return Array.isArray(payload.data?.events) ? payload.data.events : []
}

export async function apiRaceDetail(raceId) {
  const url = buildUrl(`/race/${raceId}`, {
    include:
      'raceStatus,racePhase,raceBoats.raceBoatAthletes.person,raceBoats.invalidMarkResultCode,raceBoats.raceBoatIntermediates.distance',
    'sortInclude[raceBoats.raceBoatIntermediates.ResultTime]': 'asc',
  })
  return apiFetch(url)
}

export async function apiStartList(raceId) {
  const url = buildUrl(`/race/${raceId}`, {
    include:
      'raceStatus,racePhase,raceBoats.raceBoatAthletes.person,raceBoats.invalidMarkResultCode',
  })
  return apiFetch(url)
}
