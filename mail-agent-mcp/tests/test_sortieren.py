import pytest

from mail_agent import sortieren
from mail_agent.modelle import Mail


def _regeln(alle):
    return alle["chef"]


def test_vorschau_verschiebt_nichts(backend, sortier_regeln):
    vorher = backend.ordner("chef")
    plan = sortieren.plan_erstellen(backend, "chef", _regeln(sortier_regeln))
    assert {(s.mail_id, s.zielordner) for s in plan} == {
        ("m02", "Automatisch/Newsletter"),
        ("m03", "Automatisch/Systemmeldungen"),
        ("m12", "Automatisch/Systemmeldungen"),
    }
    assert backend.ordner("chef") == vorher


def test_inaktive_regel_greift_nicht(backend, sortier_regeln):
    plan = sortieren.plan_erstellen(backend, "chef", _regeln(sortier_regeln))
    assert all(not s.zielordner.startswith("Projekte/") for s in plan)


def test_ohne_bestaetigung_wird_nichts_verschoben(backend, sortier_regeln):
    r = _regeln(sortier_regeln)
    code = sortieren.freigabe_code("chef", sortieren.plan_erstellen(backend, "chef", r))
    with pytest.raises(sortieren.FreigabeFehler, match="bestaetigung fehlt"):
        sortieren.anwenden(backend, "chef", r, code, bestaetigung=False)
    assert backend.ordner("chef")["Posteingang"] == 12


def test_falscher_code_wird_abgelehnt(backend, sortier_regeln):
    with pytest.raises(sortieren.FreigabeFehler, match="geändert"):
        sortieren.anwenden(backend, "chef", _regeln(sortier_regeln), "000000000000", bestaetigung=True)
    assert backend.ordner("chef")["Posteingang"] == 12


def test_mit_code_und_ja_wird_verschoben(backend, sortier_regeln):
    r = _regeln(sortier_regeln)
    code = sortieren.freigabe_code("chef", sortieren.plan_erstellen(backend, "chef", r))
    erg = sortieren.anwenden(backend, "chef", r, code, bestaetigung=True)
    assert erg == {"Automatisch/Newsletter": 1, "Automatisch/Systemmeldungen": 2}
    ordner = backend.ordner("chef")
    assert ordner["Posteingang"] == 9
    assert ordner["Automatisch/Systemmeldungen"] == 2
    assert sortieren.plan_erstellen(backend, "chef", r) == []  # zweiter Lauf: nichts mehr zu tun


def test_neue_mail_nach_vorschau_macht_das_ja_ungueltig(backend, sortier_regeln):
    r = _regeln(sortier_regeln)
    code = sortieren.freigabe_code("chef", sortieren.plan_erstellen(backend, "chef", r))
    neu = Mail(id="m99", postfach="chef", ordner="Posteingang", von_name="Shop", von="noreply@shop2.example",
               an=("chef@demo-betrieb.example",), cc=(), betreff="Neu", empfangen="2026-10-01T09:00:00Z",
               gelesen=False, anhang=False, text="")
    backend._mails["m99"] = neu
    with pytest.raises(sortieren.FreigabeFehler, match="seit der Vorschau geändert"):
        sortieren.anwenden(backend, "chef", r, code, bestaetigung=True)
    assert backend.ordner("chef")["Posteingang"] == 13


def test_postfaecher_bleiben_getrennt(backend, sortier_regeln):
    plan_info = sortieren.plan_erstellen(backend, "info", sortier_regeln["info"])
    assert [s.mail_id for s in plan_info] == ["m13"]
