"""Aufgaben-Kandidaten: der mechanische Teil der Aufgabenliste.

Arbeitsteilung, bewusst so geschnitten:
  - Code filtert, was eine Regel sicher entscheiden kann: Zeitraum, Maschinenabsender,
    Betreff-Muster, "nur im CC". Code erkennt Datumsangaben und schlägt eine
    Dringlichkeit vor.
  - Ob in einer Mail wirklich eine Aufgabe steht, beurteilt das Modell am Text --
    nach der Definition in aufgaben-regeln.json, die bei jedem Lauf mitgegeben wird.
    Ändert der Kunde die Datei, ändert sich der Auftrag. Ohne Programmierung.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta

from .modelle import Mail

HEUTE, DIESE_WOCHE, OHNE_FRIST = "HEUTE", "DIESE WOCHE", "OHNE FRIST"

STANDARD = {
    "tage": 3,
    "quelle": "Posteingang",
    "nur_direkt_an_mich": True,
    "meine_adressen": [],
    "ignorieren_von": ["noreply", "no-reply", "donotreply", "newsletter", "mailer-daemon", "notification"],
    "ignorieren_betreff": ["Newsletter", "Abwesenheit", "Out of Office", "Automatische Antwort", "Unzustellbar"],
    "hoechstzahl": 60,
}

DATUM = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?")
DRINGEND = re.compile(r"\b(dringend|sofort|umgehend|heute noch|eilt)\b", re.IGNORECASE)

# Sätze, die sich an einen Assistenten richten statt an den Menschen. Das ist kein
# Schutz für sich -- der Schutz ist, dass es kein Werkzeug zum Senden gibt. Die
# Markierung sorgt dafür, dass der Mensch die Mail sieht, statt dass sie still
# als "Aufgabe" weiterläuft.
ANWEISUNG_AN_KI = re.compile(
    r"(KI-Assistent|AI assistant|ignoriere (deine|alle|die) |ignore (all|your|previous)|"
    r"leite .{0,40}weiter|antworte mit (ja|yes))",
    re.IGNORECASE,
)


@dataclass
class Kandidat:
    mail: Mail
    rolle: str
    fristen: list[str]
    dringlichkeit_vorschlag: str
    verdacht_anweisung: bool


@dataclass
class Vorauswahl:
    kandidaten: list[Kandidat] = field(default_factory=list)
    angesehen: int = 0
    weg_absender: int = 0
    weg_betreff: int = 0
    weg_nicht_an_mich: int = 0


def fristen_finden(text: str, heute: date) -> list[date]:
    """Datumsangaben wie 06.10.2026 oder 06.10. -- ohne Jahr gilt das laufende Jahr."""
    gefunden = []
    for tag, monat, jahr in DATUM.findall(text):
        j = int(jahr) if jahr else heute.year
        if j < 100:
            j += 2000
        try:
            gefunden.append(date(j, int(monat), int(tag)))
        except ValueError:
            continue
    return gefunden


def dringlichkeit(text: str, heute: date) -> tuple[str, list[date]]:
    """Vorschlag, keine Entscheidung. Das Modell darf am Text abweichen und sagt dann, warum."""
    fristen = fristen_finden(text, heute)
    if DRINGEND.search(text) or any(f <= heute for f in fristen):
        return HEUTE, fristen
    if any(f <= heute + timedelta(days=7) for f in fristen):
        return DIESE_WOCHE, fristen
    return OHNE_FRIST, fristen


def rolle(mail: Mail, meine: set[str]) -> str:
    if any(a in meine for a in mail.an):
        return "An"
    if any(a in meine for a in mail.cc):
        return "nur CC"
    return "weder An noch CC (Verteiler oder Weiterleitung)"


def vorauswahl(mails: list[Mail], konf: dict, adresse: str, heute: date) -> Vorauswahl:
    konf = {**STANDARD, **{k: v for k, v in konf.items() if k in STANDARD}}
    meine = {adresse.lower(), *(a.lower() for a in konf["meine_adressen"] if a)}
    ign_von = [s.lower() for s in konf["ignorieren_von"]]
    ign_betreff = [s.lower() for s in konf["ignorieren_betreff"]]

    erg = Vorauswahl(angesehen=len(mails))
    for m in mails:
        if any(s in m.von.lower() for s in ign_von):
            erg.weg_absender += 1
            continue
        if any(s in m.betreff.lower() for s in ign_betreff):
            erg.weg_betreff += 1
            continue
        r = rolle(m, meine)
        if konf["nur_direkt_an_mich"] and r != "An":
            erg.weg_nicht_an_mich += 1
            continue
        stufe, fristen = dringlichkeit(f"{m.betreff} {m.text}", heute)
        erg.kandidaten.append(Kandidat(
            mail=m, rolle=r, fristen=[f.isoformat() for f in fristen], dringlichkeit_vorschlag=stufe,
            verdacht_anweisung=bool(ANWEISUNG_AN_KI.search(m.text)),
        ))
        if len(erg.kandidaten) >= konf["hoechstzahl"]:
            break
    return erg


def auftrag_als_text(auftrag: dict) -> str:
    """Die Aufgaben-Definition des Kunden wörtlich voranstellen."""
    if not auftrag:
        return ""
    zeilen = ["AUFTRAG (aus aufgaben-regeln.json -- dort änderbar)", auftrag.get("auftrag", "")]
    abschnitte = [
        ("Als Aufgabe zählt:", [f"{e['art']}: {e['erkennbar_an']}" for e in auftrag.get("zaehlt_als_aufgabe", [])]),
        ("Zählt NICHT:", auftrag.get("zaehlt_nicht", [])),
        ("Dringlichkeit:", [f"{e['stufe']} - {e['wenn']}" for e in auftrag.get("dringlichkeit", [])]),
        ("Je Aufgabe nennen:", auftrag.get("je_aufgabe_nennen", [])),
        ("Feste Regeln:", auftrag.get("feste_regeln", [])),
        ("Für diesen Betrieb vereinbart:", auftrag.get("kundenspezifisch", [])),
    ]
    for titel, punkte in abschnitte:
        if punkte:
            zeilen += ["", titel, *(f"  - {p}" for p in punkte)]
    return "\n".join(zeilen)
