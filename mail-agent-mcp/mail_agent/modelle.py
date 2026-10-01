"""Datenmodell einer Mail, unabhängig vom Backend."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Mail:
    id: str
    postfach: str
    ordner: str
    von_name: str
    von: str
    an: tuple[str, ...]
    cc: tuple[str, ...]
    betreff: str
    empfangen: str  # ISO 8601, UTC
    gelesen: bool
    anhang: bool
    text: str

    @property
    def datum(self) -> str:
        return self.empfangen[:10]


@dataclass
class Entwurf:
    id: str
    postfach: str
    an: list[str]
    betreff: str
    text: str
    antwort_auf: str | None = None
    ordner: str = "Entwürfe"
    extra: dict = field(default_factory=dict)
