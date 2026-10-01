"""Austauschbare Backends.

Die Schnittstelle ist absichtlich klein. Was hier nicht steht, kann der Server
nicht tun -- egal, was ein Modell oder eine Mail verlangt:

  - es gibt KEINE Methode zum Senden
  - es gibt KEINE Methode zum Löschen
  - es gibt KEINE Methode zum Als-gelesen-Markieren

Die einzigen verändernden Methoden sind verschieben() (nur über die Freigabe in
sortieren.py erreichbar) und entwurf_anlegen() (landet im Entwürfe-Ordner, ein
Mensch schickt ab).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date

from ..modelle import Entwurf, Mail


class Backend(ABC):
    @abstractmethod
    def heute(self) -> date:
        """Bezugstag für Zeiträume und Fristen."""

    @abstractmethod
    def postfaecher(self) -> dict[str, str]:
        """Kurzname -> Adresse."""

    @abstractmethod
    def ordner(self, postfach: str) -> dict[str, int]:
        """Ordnername -> Anzahl Mails."""

    @abstractmethod
    def mails(self, postfach: str, ordner: str | None = None, seit: date | None = None) -> list[Mail]:
        """Mails eines Ordners (oder aller Ordner), neueste zuerst."""

    @abstractmethod
    def verschieben(self, postfach: str, mail_ids: list[str], zielordner: str) -> int:
        """Verschiebt Mails, legt den Zielordner bei Bedarf an. Gibt die Anzahl zurück."""

    @abstractmethod
    def entwurf_anlegen(self, postfach: str, an: list[str], betreff: str, text: str,
                        antwort_auf: str | None = None) -> Entwurf:
        """Legt einen Entwurf an. Sendet nie."""


def lade_backend(name: str, **optionen) -> Backend:
    if name == "demo":
        from .demo import DemoBackend
        return DemoBackend(**optionen)
    if name == "graph":
        from .graph import GraphBackend
        return GraphBackend(**optionen)
    raise ValueError(f"Unbekanntes Backend '{name}'. Erlaubt: demo, graph.")
