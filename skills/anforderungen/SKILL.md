---
name: anforderungen
description: Interaktion 1 von 3 im Sprint-Prozess. Der Mensch erklärt Ziele in seinen Worten; dieser Skill macht daraus messbare, testbare Anforderungen mit stabiler A-ID und je einem Testfall und schreibt sie direkt in anforderungen.md und testfaelle.md des Projekts. Nutzen bei "Anforderungen aufschreiben", "was soll das Tool können", "mach daraus Anforderungen", "/anforderungen". Nicht verwenden, um einen Sprint zu schneiden (sprint) oder um zu bauen oder zu testen.
---

# Anforderungen schreiben — Interaktion 1

Der Mensch ist Product Owner. Er sagt, was er will. Du schreibst daraus Anforderungen,
die ein Test binär entscheiden kann. **Der Chat ist Diskussion, die Datei ist das Ergebnis.**

## Was eine Anforderung erfüllen muss

Jede A-ID besteht diese Prüfungen. Sonst ist sie eine Notiz und wandert unter `## Notizen`.

1. **Messbar.** Eine Zahl, ein Zustand oder ein Vergleich.
   Nicht „die Seite ist schnell“, sondern „die Seite ist in unter 2 Sekunden erzeugt“.
2. **Von außen prüfbar.** Ausgabe, Datei, Seite, Exit-Code, Antwort – ohne den Code zu lesen.
3. **Ein Testfall ist benennbar.** Du schlägst ihn in derselben Sitzung vor und trägst ihn in
   `testfaelle.md` ein: `Ausführung: agent`, wenn Code ihn prüfen kann; `Ausführung: mensch`,
   wenn nur ein Mensch urteilen kann (Optik, Verständlichkeit).
   **Kein Testfall, keine Anforderung.**
4. **Gegenfall-Pflicht.** Trägt die Anforderung ein Bedingungswort – *erst wenn · nie · nur ·
   höchstens · mindestens · statt* – nennt die Erwartung beide Seiten:
   „erfüllt: …; Gegenfall: …“. Ein Test ohne Gegenfall beweist nur, dass die A-ID erwähnt
   wird, nicht, dass sie gilt. Das ist das häufigste Schein-Grün.
5. **Mindestens ein Testfall läuft ohne fremde Voraussetzung.** Hängt eine A-ID nur an einem
   Test, der einen API-Key, einen bestimmten Wochentag oder einen zweiten Rechner braucht,
   bekommt sie zusätzlich einen, der sofort läuft (z.B. gegen eine Attrappe).
6. **Keine A-ID auf eine ungebaute Quelle.** Fehlt die Schnittstelle noch: Stufe 1 (was es
   heute gibt) und Stufe 2 (kommt mit der Quelle). Höchstens zwei Stufen.
7. **Eine Sache.** Ein „und“ in der Anforderung sind meist zwei Anforderungen.

## Vorgehen

1. **Zuhören, dann zwei bis drei Rückfragen**, wo eine Zahl fehlt: „Woran erkennst du, dass
   es fertig ist?“ Den Rest als Annahme setzen und benennen.
2. **Widersprechen, wo nötig.** Zu groß, zu vage, doppelt vorhanden – sagen, mit Gegenvorschlag.
3. **Architektur-Rahmen festhalten.** Pflichtblock in `anforderungen.md`, fünf Zeilen:
   Sprache/Laufzeit · Daten/Speicherort · Verboten · Schnittstellen · Offen/zu klären.
   Ohne ihn startet kein Sprint.
4. **Dateien schreiben** nach `../sprint/vorlagen/`. IDs fortlaufend, nie umnummerieren.
   Den Wortlaut einer A-ID nur ändern, solange sie noch nie grün war. Sonst `[entfallen]`
   plus Nachfolgerin.
5. **Umfang im Blick.** Ein Sprint trägt 5–8 A-IDs. Bei zwanzig A-IDs gleich sagen, welche
   ins erste Inkrement gehören.
6. **Ergebnis als Tabelle zeigen:** A-ID · Anforderung · Messkriterium · Testfall · wer prüft.
   Der Mensch korrigiert. Das ist der Moment, in dem er entscheidet.
7. **Übergeben:** „Anforderungen stehen in `<pfad>/anforderungen.md`. Nächster Schritt:
   `/sprint start <projekt>`.“

## Was du nicht tust

- Anforderungen ohne Testfall stehen lassen.
- Den Architektur-Rahmen vertagen.
- Den Umfang eines Sprints festlegen. Das tut `sprint`.
- Selbst bauen oder testen.
