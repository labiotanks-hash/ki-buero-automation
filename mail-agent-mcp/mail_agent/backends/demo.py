"""Demo-Backend: erfundenes Postfach aus einer JSON-Datei, Änderungen nur im Speicher."""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from pathlib import Path

from ..modelle import Entwurf, Mail
from . import Backend

STANDARD_DATEI = Path(__file__).resolve().parents[2] / "demo_daten" / "postfach.json"


class DemoBackend(Backend):
    def __init__(self, datei: str | Path | None = None):
        roh = json.loads(Path(datei or STANDARD_DATEI).read_text(encoding="utf-8"))
        self._heute = date.fromisoformat(roh["heute"])
        self._postfaecher: dict[str, str] = roh["postfaecher"]
        self._ordner: dict[str, list[str]] = {k: list(v) for k, v in roh["ordner"].items()}
        self._mails: dict[str, Mail] = {}
        for m in roh["mails"]:
            m = dict(m, an=tuple(m["an"]), cc=tuple(m["cc"]))
            self._mails[m["id"]] = Mail(**m)
        self.entwuerfe: list[Entwurf] = []

    def _pruefe(self, postfach: str) -> None:
        if postfach not in self._postfaecher:
            raise ValueError(f"Postfach '{postfach}' unbekannt. Vorhanden: {', '.join(self._postfaecher)}.")

    def heute(self) -> date:
        return self._heute

    def postfaecher(self) -> dict[str, str]:
        return dict(self._postfaecher)

    def ordner(self, postfach: str) -> dict[str, int]:
        self._pruefe(postfach)
        zaehler = Counter(m.ordner for m in self._mails.values() if m.postfach == postfach)
        zaehler.update({e.ordner: 1 for e in self.entwuerfe if e.postfach == postfach})
        return {name: zaehler.get(name, 0) for name in self._ordner[postfach]}

    def mails(self, postfach: str, ordner: str | None = None, seit: date | None = None) -> list[Mail]:
        self._pruefe(postfach)
        treffer = [
            m for m in self._mails.values()
            if m.postfach == postfach
            and (ordner is None or m.ordner.lower() == ordner.lower())
            and (seit is None or m.datum >= seit.isoformat())
        ]
        return sorted(treffer, key=lambda m: m.empfangen, reverse=True)

    def verschieben(self, postfach: str, mail_ids: list[str], zielordner: str) -> int:
        self._pruefe(postfach)
        if zielordner not in self._ordner[postfach]:
            self._ordner[postfach].append(zielordner)
        n = 0
        for mid in mail_ids:
            m = self._mails.get(mid)
            if m and m.postfach == postfach and m.ordner != zielordner:
                self._mails[mid] = Mail(**{**m.__dict__, "ordner": zielordner})
                n += 1
        return n

    def entwurf_anlegen(self, postfach: str, an: list[str], betreff: str, text: str,
                        antwort_auf: str | None = None) -> Entwurf:
        self._pruefe(postfach)
        e = Entwurf(id=f"entwurf-{len(self.entwuerfe) + 1}", postfach=postfach, an=list(an),
                    betreff=betreff, text=text, antwort_auf=antwort_auf)
        self.entwuerfe.append(e)
        return e
