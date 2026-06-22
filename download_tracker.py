#!/usr/bin/env python3
"""
World Rowing — Téléchargement des données livetracker par course.

Filtre par CompetitionCode prefix — seuls les grandes compétitions officielles
(Championships, World Cups, Olympics, qualifications olympiques, U19/U23, etc.)

Structure de sortie :
  Race_data_tracker/
    {année}/
      {slug_compétition}/
        {phase}_{classe}_{nom_race}_{race_id[:8]}.json
        {phase}_{classe}_{nom_race}_{race_id[:8]}_no_data.json  ← pas de tracker GPS
"""

import asyncio
import json
import re
import time
from pathlib import Path
from urllib.parse import urlencode

import aiohttp

# ── Config ───────────────────────────────────────────────────────────────────
API_BASE    = "https://world-rowing-api.soticcloud.net/stats/api"
OUT_DIR     = Path("/home/groot/Dev/API-WR/Race_data_tracker")
YEARS       = list(range(2019, 2027))   # 2019 → 2026 inclus
CONCURRENCY = 8
RETRY_MAX   = 3
DELAY_ERR   = 4.0   # pause entre retries réseau (secondes)

# ── Filtre CompetitionCode ────────────────────────────────────────────────────
# Correspondance : code utilisateur → préfixe(s) API réels
# Format API : {PREFIX}_{ANNÉE}_{N}  ou  {PREFIX}{ANNÉE}  (OG/PG sans underscore)
ALLOWED_PREFIXES = [
    # Senior / elite
    "WCH",          # World Rowing Championships  (WCH_YYYY_N, anciennement WRCH_YYYY)
    "WRCH",         # ancien format pré-2019
    "WCH_IE",       # World Championships Indoor Ergometer
    "WCIC",         # World Championships Indoor Combined
    "WRJC",         # World Rowing Juniors Combined (ancien)
    "ECH",          # European Rowing Championships  (ECH_YYYY_N, ECM2022)
    "ECM",          # format 2022 sans underscore
    # Olympic games & qualification
    "OG",           # Olympic Games  (OG2020, OG2024)
    "PG",           # Paralympic Games  (PG2020, PG2024)
    "YOG",          # Youth Olympic Games
    "FOQR",         # Final / various Olympic & Paralympic Qualification Regattas
    # Codes OPQR : présents dans AMOPQR_, AOOPQR_, EOPQR_, AOPQR_ …
    # → traités par la règle "OPQR" in code ci-dessous
    # World Cups (WCp1_ … WCp6F_)
    "WCp1", "WCp2", "WCp3",
    "WCp4", "WCp4F",
    "WCp5", "WCp5F",
    "WCp6F",
    # U19 / junior
    "JWCH",         # World Rowing U19 Championships
    "EJCH",         # European U19 Championships
    # U23 et formats combinés
    "U23WCH",       # World Rowing U23 Championships
    "ERU23CH",      # European U23 Championships
    "WRU19U23CH",   # World Rowing U19+U23 Championships combiné
    "WRSU23U19CH",  # World Rowing Senior+U23+U19 combiné
]

def is_allowed(comp: dict) -> bool:
    """True si le CompetitionCode correspond à un événement ciblé."""
    code = comp.get("CompetitionCode", "") or ""
    # Règle spéciale : tout code contenant "OPQR" = qualification olympique
    if "OPQR" in code:
        return True
    for prefix in ALLOWED_PREFIXES:
        if code.startswith(prefix):
            return True
    return False


# ── Helpers ──────────────────────────────────────────────────────────────────

def slugify(s: str) -> str:
    s = str(s).strip()
    s = re.sub(r"[/\\:*?\"<>|]", "_", s)
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"_+", "_", s)
    return s[:120]


async def fetch_json(
    session: aiohttp.ClientSession, url: str, sem: asyncio.Semaphore
) -> dict:
    """GET JSON avec retry sur erreur réseau uniquement.
    4xx/5xx → {} immédiatement (pas de données, pas de retry).
    """
    for attempt in range(RETRY_MAX):
        async with sem:
            try:
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=30)
                ) as r:
                    if r.status != 200:
                        return {}          # 4xx/5xx = no data, ne pas réessayer
                    return await r.json(content_type=None)
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt == RETRY_MAX - 1:
                    print(f"  ✗ Échec réseau ({e}) : {url}", flush=True)
                    return {}
        # Sleep hors du sémaphore pour ne pas bloquer les autres workers
        await asyncio.sleep(DELAY_ERR * (attempt + 1))
    return {}


# ── Appels API ────────────────────────────────────────────────────────────────

async def api_all_competitions(
    session, sem, year: int
) -> list:
    """Récupère TOUTES les compétitions d'une année, sans filtre de catégorie."""
    params = {
        "filter[StartDate]":        f"{year}-12-31T23:59:59.000Z",
        "filterOptions[StartDate]": "lessThanEqualTo",
        "include": "competitionType,competitionType.competitionCategory,venue,venue.country",
        "sort[StartDate]":          "desc",
        "PageSize":                 500,
    }
    url = f"{API_BASE}/competition?{urlencode(params)}"
    payload = await fetch_json(session, url, sem)
    data = payload.get("data", [])
    if not isinstance(data, list):
        return []
    # Filtrer sur l'année exacte + CompetitionCode autorisé
    return [
        c for c in data
        if str(c.get("StartDate", "")).startswith(str(year))
        and is_allowed(c)
    ]


async def api_races(session, sem, competition_id: str) -> list:
    params = {
        "include":                      "raceStatus,racePhase,event.boatClass",
        "filter[event.competitionId]":  competition_id,
        "sort[date]":                   "asc",
        "PageSize":                     500,
    }
    url = f"{API_BASE}/race/?{urlencode(params)}"
    payload = await fetch_json(session, url, sem)
    data = payload.get("data", [])
    return data if isinstance(data, list) else []


async def api_tracker(session, sem, race_id: str) -> dict:
    url = f"{API_BASE}/livetracker/{race_id}"
    payload = await fetch_json(session, url, sem)
    return payload.get("data", {})


# ── Logique course ────────────────────────────────────────────────────────────

def race_has_tracker(tracker_data: dict) -> bool:
    lanes = tracker_data.get("config", {}).get("lanes", [])
    return any(len(lane.get("live", [])) > 0 for lane in lanes)


def build_race_filename(race: dict, suffix: str = "") -> str:
    phase      = (race.get("racePhase") or {}).get("DisplayName", "Unknown")
    boat_class = ((race.get("event") or {}).get("boatClass") or {}).get("DisplayName", "Unknown")
    event_name = (race.get("event") or {}).get("DisplayName", "")
    race_nr    = race.get("RaceNr") or race.get("DisplayName", "race")
    full_name  = f"{event_name}_{race_nr}" if event_name else race_nr
    rid        = race.get("id", "")[:8]
    name = f"{slugify(phase)}_{slugify(boat_class)}_{slugify(full_name)}_{rid}"
    return name + suffix + ".json"


async def process_race(
    session, sem,
    race: dict, comp_dir: Path,
    competition: dict, comp_code: str, year: int,
    stats: dict,
):
    race_id   = race.get("id", "")
    out_file  = comp_dir / build_race_filename(race)
    skip_file = comp_dir / build_race_filename(race, "_no_data")

    if out_file.exists() or skip_file.exists():
        stats["skipped"] += 1
        return

    tracker = await api_tracker(session, sem, race_id)

    if not tracker or not race_has_tracker(tracker):
        payload = {
            "meta": {
                "race_id":              race_id,
                "race_name":            race.get("DisplayName"),
                "race_date":            race.get("DateString") or race.get("Date"),
                "race_phase":           (race.get("racePhase") or {}).get("DisplayName"),
                "race_nr":              race.get("RaceNr"),
                "boat_class":           ((race.get("event") or {}).get("boatClass") or {}).get("DisplayName"),
                "event_name":           (race.get("event") or {}).get("DisplayName"),
                "competition_name":     competition.get("DisplayName"),
                "competition_id":       competition.get("id"),
                "competition_code":     comp_code,
                "year":                 year,
            },
            "tracker": None,
            "no_data_reason": "livetracker returned no lane or live-GPS data",
        }
        skip_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        stats["no_data"] += 1
        return

    output = {
        "meta": {
            "race_id":              race_id,
            "race_name":            race.get("DisplayName"),
            "race_date":            race.get("DateString") or race.get("Date"),
            "race_phase":           (race.get("racePhase") or {}).get("DisplayName"),
            "race_nr":              race.get("RaceNr"),
            "rsc_code":             race.get("RscCode"),
            "progression":          race.get("Progression"),
            "boat_class":           ((race.get("event") or {}).get("boatClass") or {}).get("DisplayName"),
            "event_name":           (race.get("event") or {}).get("DisplayName"),
            "competition_name":     competition.get("DisplayName"),
            "competition_id":       competition.get("id"),
            "competition_code":     comp_code,
            "competition_category": (
                (competition.get("competitionType") or {})
                .get("competitionCategory", {})
                .get("DisplayName")
            ),
            "year":                 year,
            "venue":                (competition.get("venue") or {}).get("DisplayName"),
            "venue_country":        (
                ((competition.get("venue") or {}).get("country") or {})
                .get("DisplayName")
            ),
        },
        "tracker": tracker,
    }

    out_file.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    stats["downloaded"] += 1


async def process_competition(
    session, sem, competition: dict, year: int, stats: dict,
):
    comp_id   = competition.get("id", "")
    comp_code = competition.get("CompetitionCode", "?")
    comp_name = competition.get("DisplayName", comp_id)
    comp_slug = slugify(comp_name)

    comp_dir = OUT_DIR / str(year) / comp_slug
    comp_dir.mkdir(parents=True, exist_ok=True)

    races = await api_races(session, sem, comp_id)
    if not races:
        return

    print(
        f"  [{year}] {comp_code:25} {comp_name[:55]:55}  →  {len(races)} courses",
        flush=True,
    )
    stats["comps_done"] += 1
    stats["races_total"] += len(races)

    tasks = [
        process_race(session, sem, race, comp_dir, competition, comp_code, year, stats)
        for race in races
    ]
    await asyncio.gather(*tasks)


async def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stats = {
        "downloaded": 0, "no_data": 0, "skipped": 0,
        "comps_done": 0, "races_total": 0,
    }

    sem       = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY + 4)
    headers   = {"User-Agent": "WR-Tracker-Downloader/1.0", "Accept": "application/json"}

    t0 = time.time()
    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        for year in YEARS:
            print(f"\n{'='*70}", flush=True)
            print(f" Année {year}", flush=True)
            print(f"{'='*70}", flush=True)

            comps = await api_all_competitions(session, sem, year)
            if not comps:
                print(f"  (aucune compétition correspondante)", flush=True)
                continue

            print(f"  {len(comps)} compétition(s) sélectionnée(s)", flush=True)

            for comp in comps:
                await process_competition(session, sem, comp, year, stats)

    elapsed = time.time() - t0
    m, s = divmod(int(elapsed), 60)
    print(f"\n{'='*70}")
    print(f" Terminé en {m}m{s:02d}s")
    print(f"  Fichiers avec données GPS : {stats['downloaded']}")
    print(f"  Fichiers sans tracker     : {stats['no_data']}")
    print(f"  Déjà présents (skip)      : {stats['skipped']}")
    print(f"  Compétitions traitées     : {stats['comps_done']}")
    print(f"  Courses totales           : {stats['races_total']}")
    print(f"{'='*70}")


if __name__ == "__main__":
    asyncio.run(main())
