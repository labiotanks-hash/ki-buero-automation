# Projekttool-MCP (Demo)

MCP-Server für das Projekt-Controlling eines Architekturbüros.
Claude beantwortet damit Fragen wie „Wie steht das Projekt?“, „Was können wir abrechnen?“ oder „Wo stimmen die Zahlen nicht?“ – und korrigiert Daten nur nach Vorschau und Freigabe.

Im Produktivbetrieb hängt der Server an einer Supabase-Datenbank. Diese Demo nutzt eine lokale JSON-Datei mit drei frei erfundenen Projekten. Werkzeuge und Regeln sind dieselben.

## Was der Server zeigt

**Zwei Geldkreise, nie vermischt.**
`HONORAR` ist das Geld des Büros: Leistungen, Stunden, Abrechnung.
`BAUKOSTEN` ist das Geld des Bauherrn: Vergabeeinheiten, Nachträge, Rechnungen der Firmen.
Beide liegen in getrennten Bereichen der Daten und werden in getrennten Funktionen gerechnet (`src/geldkreise.ts`). Es gibt keine Funktion, die beide addiert. Ein Test prüft, dass eine Änderung an den Baukosten das Honorar nicht bewegt.

**Projekte per Namensteil.** „linden“ reicht. Bei mehreren Treffern rät der Server nicht, sondern nennt die Auswahl.

**Vorschau vor Schreiben.** Schreibende Werkzeuge haben `vorschau=true` als Voreinstellung. Sie zeigen Vorher/Nachher und speichern nichts. Erst ein zweiter Aufruf mit `vorschau=false` schreibt – nach Zustimmung des Menschen.

**Datenprüfung vor Korrektur.** `projekttool_datenpruefung` meldet Widersprüche mit Schwere und nächstem Schritt. Sie ändert nichts.

**Fachregeln statt freiem SQL.** „bezahlt“ ohne Zahldatum wird abgelehnt, auch mit `vorschau=false`. Eine Korrektur, die eine Vergabeeinheit über ihren Auftrag hebt, erzeugt eine Warnung.

**Nur-Lesen-Betrieb.** Mit `PROJEKTTOOL_READONLY=1` werden die schreibenden Werkzeuge gar nicht registriert. Was nicht existiert, kann nicht versehentlich aufgerufen werden.

## Werkzeuge

| Werkzeug | Art | Wofür |
|---|---|---|
| `projekttool_projekte_liste` | lesen | Alle Projekte mit Honorarstand und Ampel |
| `projekttool_projekt_uebersicht` | lesen | Ein Projekt: Honorar und Baukosten in zwei Blöcken |
| `projekttool_leistungen_honorar` | lesen | Honorar je Leistungsphase, mit Abrechnungslücke |
| `projekttool_vergabeeinheiten` | lesen | Budget → Auftrag → Prognose → Rechnungen je Gewerk |
| `projekttool_eingangsrechnungen_suchen` | lesen | Rechnungen der Firmen, mit IDs |
| `projekttool_datenpruefung` | lesen | 11 Regeln gegen Widersprüche |
| `projekttool_eingangsrechnung_aktualisieren` | schreiben | Rechnung korrigieren (Vorschau-Pflicht) |
| `projekttool_nachtrag_anlegen` | schreiben | Nachtrag zu einer Vergabeeinheit (Vorschau-Pflicht) |

## Starten

```bash
npm install
npm run build
npm test
```

Beim ersten Start legt der Server `daten/arbeitskopie.json` aus `daten/demo.json` an. Geschrieben wird nur in die Arbeitskopie. Zum Zurücksetzen die Arbeitskopie löschen.

Interaktiv ausprobieren: `npm run inspect` (öffnet den MCP Inspector).

## In Claude eintragen

**Claude Code:**

```bash
claude mcp add projekttool-demo -- node /ABSOLUTER/PFAD/projekttool-mcp/dist/index.js
```

**Claude Desktop:** Inhalt von `claude_desktop_config.beispiel.json` in
`~/Library/Application Support/Claude/claude_desktop_config.json` übernehmen, Pfad anpassen, Claude Desktop ganz beenden und neu starten.

Gute erste Fragen an Claude:
- „Welche Projekte laufen gerade?“
- „Prüf die Daten vom Lindenweg.“
- „Bei Rechnung R-2026-17 fehlt das Zahldatum, es war der 28.07.2026. Korrigier das.“

## Tests

`npm test` baut und startet 23 Tests mit `node:test`:
- `test/ampel.test.mjs` – Ampel-Schwellen
- `test/fachlogik.test.mjs` – Namenssuche, Geldkreise, Datenprüfung inklusive Gegenfälle
- `test/mcp.test.mjs` – Ende-zu-Ende über das MCP-Protokoll (Client ↔ Server im Speicher): Vorschau speichert nicht, `vorschau=false` speichert, Fachregeln greifen, Nur-Lesen-Betrieb blendet Schreibwerkzeuge aus

## Aufbau

```
src/
  index.ts        Start über stdio
  server.ts       Server + Anleitung an das Modell (instructions)
  geldkreise.ts   Honorar und Baukosten, getrennt gerechnet
  pruefung.ts     Datenprüfung
  ampel.ts        Bewertung einer Leistung
  projekt.ts      Projekt per Namensteil finden
  store.ts        JSON-Datenbank (im Original: Supabase)
  tools/          lesende und schreibende Werkzeuge
daten/demo.json   erfundene Demodaten mit absichtlichen Fehlern
```
