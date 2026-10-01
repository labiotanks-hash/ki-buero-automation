"""Sortieren mit Vorschau und Freigabe.

Ablauf, und nur dieser:
  1. vorschau()  -> Plan (welche Mail in welchen Ordner) + Freigabe-Code
  2. Mensch sieht den Plan und sagt ausdrücklich Ja
  3. anwenden(freigabe_code, bestaetigung=True)

Der Freigabe-Code ist ein Fingerabdruck des Plans. anwenden() rechnet den Plan neu
und verschiebt nur, wenn er noch genau dem gezeigten entspricht. Ist inzwischen
eine Mail dazugekommen, wird nichts verschoben -- das Ja galt dem alten Plan.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

from .backends import Backend


@dataclass(frozen=True)
class Schritt:
    mail_id: str
    von: str
    betreff: str
    zielordner: str
    regel: str


class FreigabeFehler(Exception):
    pass


def plan_erstellen(backend: Backend, postfach: str, regeln: dict, quelle: str = "Posteingang") -> list[Schritt]:
    plan, vergeben = [], set()
    mails = backend.mails(postfach, quelle)
    for regel in regeln.get("regeln", []):
        if not regel.get("aktiv", False):
            continue
        muster = [s.lower() for s in regel.get("von", [])]
        for m in mails:
            if m.id in vergeben or not any(s in m.von.lower() for s in muster):
                continue
            plan.append(Schritt(m.id, m.von, m.betreff, regel["ordner"], regel.get("beschreibung", regel["ordner"])))
            vergeben.add(m.id)
    return plan


def freigabe_code(postfach: str, plan: list[Schritt]) -> str:
    roh = postfach + "|" + "|".join(sorted(f"{s.mail_id}>{s.zielordner}" for s in plan))
    return hashlib.sha256(roh.encode()).hexdigest()[:12]


def anwenden(backend: Backend, postfach: str, regeln: dict, code: str, bestaetigung: bool,
             quelle: str = "Posteingang") -> dict[str, int]:
    if bestaetigung is not True:
        raise FreigabeFehler(
            "Nicht verschoben: bestaetigung fehlt. Erst sortier_vorschau zeigen, ausdrückliches Ja "
            "des Menschen einholen, dann mit bestaetigung=true und dem Freigabe-Code aufrufen.")
    plan = plan_erstellen(backend, postfach, regeln, quelle)
    if not plan:
        return {}
    aktuell = freigabe_code(postfach, plan)
    if code != aktuell:
        raise FreigabeFehler(
            "Nicht verschoben: der Plan hat sich seit der Vorschau geändert (neue oder andere Mails). "
            "sortier_vorschau erneut aufrufen und neu bestätigen lassen.")
    ergebnis: dict[str, int] = {}
    for ziel in dict.fromkeys(s.zielordner for s in plan):
        ids = [s.mail_id for s in plan if s.zielordner == ziel]
        ergebnis[ziel] = backend.verschieben(postfach, ids, ziel)
    return ergebnis
