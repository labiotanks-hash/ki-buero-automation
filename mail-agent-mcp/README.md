# Mail-Agent-MCP (Demo)

MCP-Server, mit dem Claude ein Postfach liest, Lärm wegsortiert, Aufgaben herauszieht und Antworten als Entwurf vorbereitet.
Senden und Löschen kann er nicht. Dafür gibt es kein Werkzeug und keine Methode im Backend.

Im Produktivbetrieb hängt der Agent über Microsoft Graph an Outlook. Diese Demo bringt ein erfundenes Postfach mit, damit alles ohne Microsoft-Konto läuft.

## Was der Agent zeigt

**Austauschbares Backend.** `mail_agent/backends/__init__.py` definiert eine kleine Schnittstelle: lesen, verschieben, Entwurf anlegen. `demo.py` liest ein JSON-Postfach, `graph.py` spricht mit Microsoft 365. Der Server merkt keinen Unterschied.

**Was fehlt, ist Absicht.** Die Schnittstelle hat keine Methode zum Senden, Löschen, Weiterleiten oder Als-gelesen-Markieren. Das Graph-Backend fordert `Mail.ReadWrite`, aber nie `Mail.Send` an. Ein Test prüft beides.

**Sortieren nur mit Vorschau und Ja.** `sortier_vorschau` zeigt den Plan und liefert einen Freigabe-Code (Fingerabdruck des Plans). `sortier_anwenden` verschiebt nur mit `bestaetigung=true` und genau diesem Code. Ist seit der Vorschau eine Mail dazugekommen, wird nichts verschoben – das Ja galt dem alten Plan.

**Aufgaben: Code filtert, Modell urteilt.** `aufgaben_kandidaten` filtert mechanisch (Zeitraum, Maschinenabsender, Auto-Antworten, „nur im CC“), erkennt Datumsangaben und schlägt eine Stufe vor: `HEUTE` / `DIESE WOCHE` / `OHNE FRIST`. Ob wirklich eine Aufgabe drinsteht, beurteilt Claude am Text – nach der Definition in `aufgaben-regeln.json`, die bei jedem Lauf wörtlich mitgeht. Der Kunde ändert die Datei, nicht den Code.

**Anweisungen in Mails sind Daten.** Eine Demo-Mail versucht, den Assistenten zum Weiterleiten von Rechnungen zu bringen. Der Agent markiert sie und verlangt Rückfrage beim Menschen. Ausführen könnte er sie ohnehin nicht.

**Die Regeln reisen mit.** Die Arbeitsanweisung an das Modell steht in `instructions` des Servers, nicht in einer Datei, die man kennen muss.

## Werkzeuge

| Werkzeug | Ändert etwas? | Wofür |
|---|---|---|
| `postfaecher_anzeigen` | nein | Kurznamen der Postfächer |
| `ordner_anzeigen` | nein | Ordner mit Anzahl |
| `mails_suchen` | nein | nach Absender oder Text |
| `aufgaben_kandidaten` | nein | Vorauswahl + Auftrag für die Aufgabenliste |
| `sortier_vorschau` | nein | Plan + Freigabe-Code |
| `sortier_anwenden` | ja, nur mit Ja + Code | Mails in Ordner verschieben |
| `entwurf_anlegen` | ja, nur Entwürfe-Ordner | Antwort vorbereiten, Mensch schickt ab |

## Starten

Mit [uv](https://docs.astral.sh/uv/):

```bash
uv sync
uv run pytest
uv run mail-agent-mcp          # startet den Server (stdio), Demo-Backend
```

Mit pip:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e . pytest anyio
pytest
```

Das Demo-Postfach liegt in `demo_daten/postfach.json`. Änderungen (Verschieben, Entwürfe) bleiben im Speicher und sind nach einem Neustart zurückgesetzt.

## In Claude eintragen

**Claude Code:**

```bash
claude mcp add mail-agent-demo -- uv --directory /ABSOLUTER/PFAD/mail-agent-mcp run mail-agent-mcp
```

**Claude Desktop:** `claude_desktop_config.beispiel.json` übernehmen, Pfad anpassen, Claude Desktop neu starten.

Gute erste Sätze an Claude: „Was liegt im Postfach chef?“ · „Räum den Posteingang auf.“ · „Mach mir die Aufgabenliste.“

## Echtes Outlook (Graph-Backend)

1. In Microsoft Entra eine App registrieren: öffentlicher Client, Device-Code-Flow, delegierte Rechte `Mail.ReadWrite` und `Mail.ReadWrite.Shared`. Kein `Mail.Send`.
2. `config.beispiel.json` als `config.json` kopieren, IDs und Postfach eintragen.
3. `uv sync --extra graph`, dann mit `MAIL_AGENT_BACKEND=graph` starten. Beim ersten Aufruf erscheint ein Anmeldecode auf stderr.

`config.json` und `token_cache.json` stehen in `.gitignore`. Die automatischen Tests laufen gegen das Demo-Backend; das Graph-Backend ist hier nicht gegen ein echtes Postfach getestet.

## Tests

`uv run pytest` – 21 Tests:
- `tests/test_leitplanken.py` – Schnittstelle ohne Senden/Löschen, keine Sende-Rechte, Entwurf landet in „Entwürfe“
- `tests/test_aufgaben.py` – Vorauswahl, Dringlichkeit, CC-Regel mit Gegenfall, Markierung fremder Anweisungen
- `tests/test_sortieren.py` – Vorschau ändert nichts, ohne Ja kein Verschieben, falscher Code, geänderter Plan
- `tests/test_mcp.py` – Ende-zu-Ende über das MCP-Protokoll
