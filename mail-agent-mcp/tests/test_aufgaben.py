from datetime import date, timedelta

from mail_agent import aufgaben

HEUTE = date(2026, 10, 1)


def _lauf(backend, regeln, **ueberschreiben):
    konf = {**regeln["_standard"]["vorauswahl"], **ueberschreiben}
    mails = backend.mails("chef", "Posteingang", seit=HEUTE - timedelta(days=konf["tage"]))
    return aufgaben.vorauswahl(mails, konf, "chef@demo-betrieb.example", HEUTE)


def test_vorauswahl_filtert_mechanisch(backend, aufgaben_regeln):
    erg = _lauf(backend, aufgaben_regeln)
    assert erg.angesehen == 11  # m11 liegt außerhalb von 3 Tagen
    assert sorted(k.mail.id for k in erg.kandidaten) == ["m01", "m04", "m07", "m08", "m09", "m10"]
    assert (erg.weg_absender, erg.weg_betreff, erg.weg_nicht_an_mich) == (3, 1, 1)


def test_dringlichkeit_vorschlag(backend, aufgaben_regeln):
    stufe = {k.mail.id: k.dringlichkeit_vorschlag for k in _lauf(backend, aufgaben_regeln).kandidaten}
    assert stufe == {
        "m04": "HEUTE",        # "dringend"
        "m08": "HEUTE",        # Frist 30.09. ist vorbei
        "m01": "DIESE WOCHE",  # Frist 06.10.
        "m07": "OHNE FRIST",   # Frist 15.10. liegt mehr als 7 Tage weg
        "m09": "OHNE FRIST",
        "m10": "OHNE FRIST",   # kein Datum
    }


def test_nur_cc_zaehlt_nicht__gegenfall_mit_filter_aus(backend, aufgaben_regeln):
    mit = {k.mail.id for k in _lauf(backend, aufgaben_regeln).kandidaten}
    ohne = {k.mail.id: k.rolle for k in _lauf(backend, aufgaben_regeln, nur_direkt_an_mich=False).kandidaten}
    assert "m05" not in mit
    assert ohne["m05"] == "nur CC"


def test_anweisung_an_ki_wird_markiert_nicht_befolgt(backend, aufgaben_regeln):
    kand = {k.mail.id: k for k in _lauf(backend, aufgaben_regeln).kandidaten}
    assert kand["m09"].verdacht_anweisung is True
    assert [i for i, k in kand.items() if k.verdacht_anweisung] == ["m09"]


def test_fristen_finden():
    assert aufgaben.fristen_finden("bis 06.10.2026 bitte", HEUTE) == [date(2026, 10, 6)]
    assert aufgaben.fristen_finden("bis 7.10. erledigen", HEUTE) == [date(2026, 10, 7)]
    assert aufgaben.fristen_finden("Version 31.02.2026", HEUTE) == []  # ungültig, kein Absturz


def test_auftrag_kommt_aus_der_kundendatei(aufgaben_regeln):
    text = aufgaben.auftrag_als_text(aufgaben_regeln["_standard"]["aufgabe_erkennen"])
    assert text.startswith("AUFTRAG (aus aufgaben-regeln.json")
    assert "Nichts erfinden" in text
