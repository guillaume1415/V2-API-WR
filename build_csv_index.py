#!/usr/bin/env python3
"""
Génère un index.json mappant race.id → chemin relatif du fichier JSON,
pour permettre à analyse.html de retrouver le CSV correspondant à une race
sans avoir à lister les dossiers (file:// ne supporte pas le listing).

Le script repose sur son propre emplacement : Race_data_csv/ doit être
un sous-dossier du même dossier que ce script (= la racine du projet
API-WR). La commande est portable sur n'importe quel clone, pas de
variable à modifier.

Usage :
    python3 build_csv_index.py

Sortie :
    <dossier-du-script>/Race_data_csv/index.json

Format de sortie :
{
  "generated_at": "...",
  "root": "<chemin absolu détecté>",
  "races": {
    "<race.id uuid>": {
      "path": "race_data_by_race_2026/2026-wcp-2-.../00153-...-f5fec097.json",
      "year": "2026",
      "competition_id": "a1bc1218-5d6c-4bc9-80c5-aa969117b48a",
      "competition_name": "2026 World Rowing Cup II",
      "race_name": "Men's Double Sculls Heat 4",
      "boat_class": "M2x",
      "countries": ["ITA2", "MDA", "AUT", "ROU"]
    },
    ...
  }
}

Relance le script à chaque ajout de fichier CSV.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "Race_data_csv"
OUT = ROOT / "index.json"


def extract_meta(data: dict) -> dict:
    """Extrait les champs utiles depuis un fichier course (best-effort)."""
    comp = data.get("competition") or {}
    race = data.get("race") or {}
    event = data.get("event") or {}
    countries = []
    for rd in data.get("race_data") or []:
        c = rd.get("country")
        if c and c not in countries:
            countries.append(c)
    return {
        "year": comp.get("year"),
        "competition_id": comp.get("id"),
        "competition_name": (comp.get("name") or "").strip(),
        "race_name": (race.get("name") or "").strip(),
        "boat_class": event.get("boat_class"),
        "countries": countries,
    }


def main() -> int:
    if not ROOT.exists():
        print(f"✗ Dossier introuvable : {ROOT}", file=sys.stderr)
        return 2

    races: dict[str, dict] = {}
    errors: list[str] = []
    seen = 0

    for f in sorted(ROOT.rglob("*.json")):
        if f.name == "index.json":
            continue
        seen += 1
        try:
            with f.open(encoding="utf-8") as fp:
                data = json.load(fp)
        except Exception as e:
            errors.append(f"{f.relative_to(ROOT)} : lecture/parse → {e}")
            continue

        rid = (data.get("race") or {}).get("id")
        if not rid:
            errors.append(f"{f.relative_to(ROOT)} : pas de race.id")
            continue

        rel = f.relative_to(ROOT).as_posix()
        meta = extract_meta(data)

        if rid in races and races[rid]["path"] != rel:
            errors.append(
                f"race.id {rid} en double : {races[rid]['path']} vs {rel} "
                f"(le second écrase le premier)"
            )

        races[rid] = {"path": rel, **meta}

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "root": str(ROOT),
        "races": races,
    }

    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"✓ {len(races)} courses indexées sur {seen} fichiers JSON inspectés")
    print(f"  → {OUT}")

    if errors:
        print(f"\n⚠ {len(errors)} avertissements :", file=sys.stderr)
        for e in errors[:30]:
            print(f"  - {e}", file=sys.stderr)
        if len(errors) > 30:
            print(f"  ... et {len(errors) - 30} autres", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
