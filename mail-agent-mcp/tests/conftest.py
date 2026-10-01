import json
from pathlib import Path

import pytest

from mail_agent.backends.demo import DemoBackend

BASIS = Path(__file__).resolve().parents[1]


@pytest.fixture
def backend():
    """Frisches Demo-Postfach je Test. Änderungen bleiben im Speicher."""
    return DemoBackend()


@pytest.fixture
def sortier_regeln():
    return json.loads((BASIS / "sortier-regeln.beispiel.json").read_text(encoding="utf-8"))


@pytest.fixture
def aufgaben_regeln():
    return json.loads((BASIS / "aufgaben-regeln.beispiel.json").read_text(encoding="utf-8"))
