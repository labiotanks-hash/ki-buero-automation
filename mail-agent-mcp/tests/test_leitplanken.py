"""Was der Agent NICHT kann, ist hier wichtiger als das, was er kann."""
import inspect

from mail_agent.backends import Backend
from mail_agent.backends.demo import DemoBackend

VERBOTEN = ("send", "senden", "versend", "delete", "loesch", "lösch", "remove", "gelesen", "read_flag", "forward", "weiterleit")


def _oeffentliche_methoden(klasse):
    return {n for n, _ in inspect.getmembers(klasse, inspect.isfunction) if not n.startswith("_")}


def test_backend_schnittstelle_ist_genau_diese():
    assert _oeffentliche_methoden(Backend) == {
        "heute", "postfaecher", "ordner", "mails", "verschieben", "entwurf_anlegen",
    }


def test_keine_methode_zum_senden_loeschen_oder_weiterleiten():
    for klasse in (Backend, DemoBackend):
        for name in _oeffentliche_methoden(klasse):
            assert not any(v in name.lower() for v in VERBOTEN), name


def test_graph_backend_fordert_kein_senderecht_an():
    from mail_agent.backends import graph

    assert graph.SCOPES == ["Mail.ReadWrite", "Mail.ReadWrite.Shared"]
    assert not any("Send" in s for s in graph.SCOPES)
    quelltext = inspect.getsource(graph)
    assert "/send" not in quelltext and "sendMail" not in quelltext
    assert '"DELETE"' not in quelltext


def test_entwurf_landet_im_entwurfsordner(backend):
    vorher = backend.ordner("chef")["Entwürfe"]
    e = backend.entwurf_anlegen("chef", ["b.muster@privat.example"], "Re: Feuchter Fleck", "Wir kommen morgen.", "m04")
    assert e.ordner == "Entwürfe"
    assert backend.ordner("chef")["Entwürfe"] == vorher + 1
    assert backend.entwuerfe == [e]
