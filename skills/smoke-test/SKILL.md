---
name: smoke-test
description: Startet ein frisch gebautes oder geändertes Ding tatsächlich (Python-Skript, Node-App, statische Website, MCP-Server, Shell-Skript, Claude-Skill) und meldet in wenigen Zeilen GRÜN / GELB / ROT mit der echten Fehlerausgabe statt einer Vermutung. Nutzen bei "läuft das?", "probier das aus", "smoke test" und von selbst direkt nach dem Bau, bevor etwas als fertig gilt. Nicht für Code-Bewertung (code-review) oder Anforderungs-Abnahme (system-test).
---

# Smoke-Test

Ein Code-Review liest den Quelltext und findet keinen Fehler, weil der Code richtig aussieht.
Trotzdem fehlt ein Paket, ist ein Pfad hartkodiert, oder das Programm startet und tut still
nichts. Du bist der Handgriff „einmal einschalten und schauen, ob Licht angeht“.

## Die eine Regel

**Du meldest nur, was du gesehen hast.** Die echte Fehlerzeile, den echten Exit-Code.
Kennst du die Ursache nicht sicher, schreibst du die Ausgabe hin und sagst, dass die Ursache
offen ist. Eine plausible, falsche Vermutung kostet mehr Zeit als ein ehrliches „bricht ab,
hier steht warum“.

## Ablauf

1. **Objekt bestimmen.** Ohne Argument: was in dieser Sitzung gebaut wurde.
2. **Art erkennen** aus den Dateien (`pyproject.toml`, `package.json`, `index.html`,
   `SKILL.md` …) und den kürzesten realen Startweg wählen – den, den ein Nutzer auch geht.
3. **Prüfplan in drei Zeilen vorlegen**, dann starten:
   ```
   Start:     <exakter Befehl>
   Eingabe:   <Argumente, Testdaten, Ordner, den ich anfasse>
   GRÜN wenn: <Datei da, Exit 0, Seite antwortet, Log-Zeile X>
   ```
   Nie ins Leere fragen („wie soll ich testen?“) – immer einen fertigen Plan vorschlagen.
   Ohne Rückfrage starten nur, wenn das Objekt nichts schreibt, keine Kundendaten anfasst und
   das Kriterium eindeutig ist. Schreibt es, arbeitest du in einem Ausweichordner.
4. **Starten, mit Zeitlimit** (60 s, Builds 180 s). Ein Ding, das hängt, ist ein Befund.
   Achtung macOS: `timeout` gibt es dort nicht; einen Hintergrund-Wächter nutzen.
5. **Die drei Klassiker prüfen,** die ein Review nicht fängt:
   - fehlende Abhängigkeit (Import steht nicht in `pyproject.toml` / `package.json`)
   - hartkodierter Pfad (`/Users/`, `C:\`)
   - stiller Tod (startet, kein Fehler, keine Ausgabe, nichts passiert)

**MCP-Server:** `initialize` und `tools/list` über stdio schicken, ein lesendes Werkzeug
aufrufen. Achte darauf, dass nichts außer JSON-RPC auf stdout landet.

## Bericht

```
GRÜN — <objekt>
Start: <befehl>
Geprüft gegen: <GRÜN-wenn-Kriterium>
Ergebnis: <eine Zeile>
```

```
ROT — <objekt>
Start: <befehl>
<Exit-Code / HTTP-Status>
<echte Fehlerzeile, wörtlich>
```

GELB: läuft heute, bricht morgen bei jemand anderem (Warnung auf stderr, Paket fehlt in den
Abhängigkeiten, ist aber lokal installiert).

## Was du nicht tust

- Nicht reparieren. Ein stiller Fix verdeckt, dass der Fehler da war.
- Keinen Code bewerten, keine Unit-Tests schreiben.
- Nichts nach außen: keine Mail, kein Deploy, keine Zahlung, kein `git push`. Führt der
  Startweg zwingend nach außen: abbrechen und das melden.
- Nichts löschen, keine Produktiv-Datenbank beschreiben.
