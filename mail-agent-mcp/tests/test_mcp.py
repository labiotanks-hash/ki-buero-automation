"""Ende-zu-Ende über das echte MCP-Protokoll (Client <-> Server im Speicher)."""
import re

import pytest
from mcp.shared.memory import create_connected_server_and_client_session

from mail_agent.backends.demo import DemoBackend
from mail_agent.server import erstelle_server

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def server(sortier_regeln, aufgaben_regeln):
    backend = DemoBackend()
    return erstelle_server(backend, sortier_regeln, aufgaben_regeln), backend


def _text(ergebnis):
    return "\n".join(c.text for c in ergebnis.content)


async def test_werkzeugliste_ohne_senden_und_loeschen(server):
    mcp, _ = server
    async with create_connected_server_and_client_session(mcp._mcp_server) as client:
        init = await client.initialize()
        namen = sorted(t.name for t in (await client.list_tools()).tools)
    assert namen == sorted([
        "postfaecher_anzeigen", "ordner_anzeigen", "mails_suchen", "aufgaben_kandidaten",
        "sortier_vorschau", "sortier_anwenden", "entwurf_anlegen",
    ])
    assert "NIE eine Mail gesendet" in init.instructions


async def test_vorschau_dann_ja_dann_verschoben(server):
    mcp, backend = server
    async with create_connected_server_and_client_session(mcp._mcp_server) as client:
        vorschau = _text(await client.call_tool("sortier_vorschau", {"postfach": "chef"}))
        code = re.search(r"Freigabe-Code: (\w+)", vorschau).group(1)
        assert backend.ordner("chef")["Posteingang"] == 12

        ohne_ja = _text(await client.call_tool("sortier_anwenden", {"postfach": "chef", "freigabe_code": code}))
        assert ohne_ja.startswith("Nicht verschoben")
        assert backend.ordner("chef")["Posteingang"] == 12

        mit_ja = _text(await client.call_tool(
            "sortier_anwenden", {"postfach": "chef", "freigabe_code": code, "bestaetigung": True}))
        assert mit_ja.startswith("Verschoben")
        assert backend.ordner("chef")["Posteingang"] == 9


async def test_aufgaben_kandidaten_markiert_fremde_anweisung(server):
    mcp, _ = server
    async with create_connected_server_and_client_session(mcp._mcp_server) as client:
        text = _text(await client.call_tool("aufgaben_kandidaten", {"postfach": "chef"}))
    assert "6 Kandidaten." in text
    assert text.count("ACHTUNG: Text enthält eine Anweisung") == 1
    assert "AUFTRAG (aus aufgaben-regeln.json" in text
    assert "Es wurde nichts verändert." in text


async def test_entwurf_wird_nicht_gesendet(server):
    mcp, backend = server
    async with create_connected_server_and_client_session(mcp._mcp_server) as client:
        text = _text(await client.call_tool("entwurf_anlegen", {
            "postfach": "chef", "an": ["b.muster@privat.example"], "betreff": "Re: Feuchter Fleck",
            "text": "Wir schauen morgen vorbei.", "antwort_auf": "m04"}))
    assert "Nicht gesendet" in text
    assert len(backend.entwuerfe) == 1
