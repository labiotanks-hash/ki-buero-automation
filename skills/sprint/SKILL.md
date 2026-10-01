---
name: sprint
description: Sprint-Leiter im Sprint-Prozess — Interaktion 2 und 3 von 3. "/sprint start <projekt>" schneidet aus den Anforderungen das nächste Inkrement, holt das "go" des Menschen und fährt dann eigenständig Entwicklung, Smoke, Systemtest und Code-Review mit Fix-Schleifen bis "abnahmereif". "/sprint abnahme <projekt>" bucht die Ergebnisse der User-Testfälle und schließt das Inkrement. Nicht verwenden, um Anforderungen zu formulieren (anforderungen) oder für Einzeltests außerhalb eines Sprints (smoke-test, system-test).
---

# Sprint-Leiter

Du entscheidest nicht, WAS gebaut wird. Das steht in `anforderungen.md`.
Du sorgst dafür, dass jedes Inkrement sauber geschnitten, eigenständig gebaut, nachweisbar
geprüft und sauber geschlossen wird.

**Der Mensch hat drei Interaktionen. Zwei davon laufen über dich. Alles dazwischen läuft ohne ihn.**

## Dateien im Projektordner

| Datei | Wer schreibt | Inhalt |
|---|---|---|
| `anforderungen.md` | Skill `anforderungen` | A-IDs, Architektur-Rahmen |
| `testfaelle.md` | Skill `anforderungen` | TF-IDs, je TF: deckt A-x, Erwartung, Ebene, Ausführung, Code |
| `projekt-status.md` | du | Inkremente, Anforderungs-Spiegel, Testschuld, Risiken |
| `sprints/sprint-<n>.md` | du | Sprint-Blatt: Ziel, DoD, A-IDs im Wortlaut, Testplan |
| `testprotokoll.md` | Testcode, append-only | eine Zeile je Testlauf |

Vorlagen: `vorlagen/`. **Dateien sind die Schnittstellen.** Kein Agent sieht das Gespräch
eines anderen.

---

## /sprint start <projekt> — Interaktion 2

### Phase A: Umfang schneiden (bis zum „go“)

1. **WIP-Regel.** Höchstens ein aktiver Sprint (`[~]`) je Projekt. Ist einer offen: nicht
   starten, sondern `/sprint abnahme` vorschlagen.
2. **Kill-Kriterium.** Steht in `projekt-status.md` unter `## Risiken` ein Kill-Kriterium
   und ist es eingetreten: nicht starten. Lage in drei Sätzen, Empfehlung.
3. **Vorbedingungen.** `anforderungen.md` mit Architektur-Rahmen muss existieren. Jede A-ID
   des Inkrements braucht einen Testfall. Trägt die A-ID ein Bedingungswort, braucht der
   Testfall einen Gegenfall. Fehlt etwas: zurück an `anforderungen`, mit Liste.
   **Du schreibst keine Anforderungen und erfindest keine Testfälle.**
4. **Umfang schneiden.** Ein Satz Ziel, eine prüfbare DoD mit den A-IDs, die betroffenen TFs.
   5–8 A-IDs, nie mehr. Zu groß wird geteilt, nie gedehnt.
5. **Testplan ableiten.** Je TF die Art: automatisch (Code) > Agent einmalig von Hand >
   User-Test > selbst probieren. Ein Systemtest darf ins nächste Inkrement wandern
   (`nachgelagert`), nur wenn der Smoke läuft, jede A-ID der DoD einen TF hat, der jetzt
   läuft, und ein Grund dabeisteht. Fällige Testschuld ist Pflichtteil.
6. **Sprint-Blatt schreiben und zeigen.** `sprints/sprint-<n>.md` mit allen A-IDs **im
   vollen Wortlaut**, Architektur-Rahmen, Testplan, „bewusst nicht drin“.
   Dem Menschen das ganze Blatt im Chat zeigen. **Auf sein „go“ warten.**
   Nach dem go: Start-Commit (`git rev-parse HEAD`) eintragen. Danach ändert sich das Blatt nicht.

### Phase B: Eintragen

7. `projekt-status.md`: Inkrement auf `[~]`, Anforderungs-Spiegel (`▶` dieses Inkrement,
   `○` geplant, `✓` grün, `◐` teilweise, `!` rot), nachgelagerte TFs unter `## Testschuld`.

### Phase C: Eigenständig bauen und prüfen (ohne den Menschen)

Du orchestrierst Subagenten. Jeder bekommt **das komplette Sprint-Blatt wörtlich** in den
Auftrag – er sieht diesen Chat nicht. Ein Subagent, der den Architektur-Rahmen verletzt,
hat die DoD verfehlt, auch wenn alle Tests grün sind.

8. **Entwicklung.** Subagent baut das Inkrement. Regel: jeder Agent-Testfall wird als Code
   ausprogrammiert; der Testlauf schreibt seine Protokollzeile selbst. Commit-Pflicht.
9. **Smoke.** Testbefehl des Projekts oder Skill `smoke-test`. ROT → zurück zu 8.
10. **Systemtest.** Testbefehl ausführen (Exit 0 grün, 1 rot, 2 unvollständig – übersprungen
    zählt nie als grün). TFs ohne Code: Skill `system-test`. User-TFs blockieren nicht,
    sie sind Interaktion 3.
11. **Code-Review mit gerichteter Mutation.** Subagent liest `git diff <Start-Commit>..HEAD`
    mit A-IDs und Rahmen im Wortlaut. Pflichtteil: je A-ID das **verbotene Verhalten**
    ableiten, genau diesen Defekt einbauen, Testbefehl laufen lassen, Defekt zurücknehmen.
    Bleibt die Suite grün, deckt der Test die A-ID nicht → MUSS-Befund.
    Ergebnis je A-ID: `A-x · Mutation: <Defekt> · Suite: rot|grün`.
    Zufällige Mutationen ersetzen das nicht. Lesen allein findet scheingrüne Tests nicht.
    Am Ende `git status`: kein Rest einer Mutation im Arbeitsbaum.
12. **Fix-Schleifen.** MUSS-Befunde → zurück zu 8, danach 9 und 10 komplett wiederholen.
    Behebt ein Fix ein Muster, sucht er das Muster im ganzen Objekt.
    **Höchstens zwei Schleifen**, dann Abbruch und Lage an den Menschen.
13. **Append-only-Gegenprobe.** `git diff <Start-Commit>..HEAD -- testprotokoll.md` darf
    keine gelöschten Zeilen zeigen.

### Phase D: Meldung „abnahmereif“

14. Höchstens zehn Zeilen: was gebaut (Commit) · Smoke/Systemtest grün/rot/nachgelagert ·
    Review-Befunde und was behoben wurde · **welche User-TFs der Mensch jetzt prüft – je TF:
    was öffnen (voller Pfad), was tun, was erscheinen muss.**
15. **Code zum Selberlesen.** Ein fertiger Befehl, der die geänderte Code-Datei und die
    Testdatei öffnet, und ein zweiter, der den ganzen Diff seit dem Start-Commit zeigt.
    Testfälle, die nur als Text in einer `.md` stehen, sind kein Nachweis.
16. Schluss: „Wenn geprüft: `/sprint abnahme <projekt>` mit deinen Ergebnissen.“
    Ohne User-TF: „Nichts zu prüfen – direkt `/sprint abnahme <projekt>`.“

---

## /sprint abnahme <projekt> — Interaktion 3

Der Mensch meldet seine Ergebnisse („TF-2 grün, TF-6 rot: Link führt auf falsche Datei“).

1. **Protokollieren.** Je TF eine Zeile an `testprotokoll.md`:
   `- JJJJ-MM-TT HH:MM GRÜN|ROT — TF-<n> (User-Test) — <Befund wörtlich>`.
2. **Bei ROT:** zurück an Entwicklung, Smoke und betroffene TFs erneut, dann neu um Abnahme
   bitten. Höchstens zwei Schleifen.
3. **Bei alles GRÜN:** Inkrement `[x]`, A-ID `✓` nur, wenn **alle** deckenden TFs zuletzt grün
   sind; `◐`, wenn ein deckender TF nachgelagert ist.
4. **Retro, drei Zeilen:** hielt · hakte · ändern. Ist „ändern“ eine Prozessregel, wird sie
   in diesen Skill eingetragen, nicht nur notiert.
5. Commit. Abschlussmeldung in höchstens sechs Zeilen.

## Grenzen

- Du baust nie selbst und testest nie selbst – du beauftragst.
- **Der letzte Schritt nach außen bleibt beim Menschen:** live stellen, Mail senden, Geld
  ausgeben, ein neues Repo veröffentlichen.
