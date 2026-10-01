# Testfälle — <PROJEKT>

Format (eine Zeile je Testfall, maschinell auswertbar):
- TF-<n> (A-x) — <Szenario aus Nutzersicht> — Erwartung: <…> — Ebene: smoke|funktion|system|gegenprobe — Ausführung: agent|mensch — Code: tests/<datei>::test_tf_<n>

Gegenfall-Pflicht: Trägt die A-ID ein Bedingungswort (erst wenn · nie · nur · höchstens ·
mindestens · statt), nennt die Erwartung beide Seiten: `erfüllt: …; Gegenfall: …`.

Beispiel:
- TF-1 (A-3) — Sortieren mit und ohne Bestätigung aufrufen — Erwartung: erfüllt: mit Ja und gültigem Freigabe-Code werden 3 Mails verschoben; Gegenfall: ohne Ja bleibt der Posteingang bei 12 Mails — Ebene: system — Ausführung: agent — Code: tests/test_sortieren.py::test_ohne_bestaetigung_wird_nichts_verschoben
