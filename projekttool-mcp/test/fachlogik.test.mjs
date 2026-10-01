import { test } from "node:test";
import assert from "node:assert/strict";
import { findeProjekt } from "../dist/projekt.js";
import { baukostenStand, honorarStand } from "../dist/geldkreise.js";
import { datenpruefung } from "../dist/pruefung.js";
import { demoStore, STICHTAG } from "./hilfe.mjs";

test("Projekt per Namensteil, ohne Groß-/Kleinschreibung", () => {
  const store = demoStore();
  assert.equal(findeProjekt(store, "linden").id, "p-lindenweg");
  assert.equal(findeProjekt(store, "MÜHL").id, "p-muehlgasse");
});

test("mehrdeutiger Namensteil rät nicht, sondern nennt die Auswahl", () => {
  const store = demoStore();
  assert.throws(() => findeProjekt(store, "en"), /passt auf mehrere Projekte/);
});

test("unbekanntes Projekt nennt die vorhandenen", () => {
  const store = demoStore();
  assert.throws(() => findeProjekt(store, "Rathaus"), /Vorhanden sind: Wohnhaus Lindenweg/);
});

test("Geldkreise: Honorar und Baukosten werden getrennt berechnet", () => {
  const store = demoStore();
  const h = honorarStand(store, "p-lindenweg");
  const k = baukostenStand(store, "p-lindenweg");
  assert.equal(h.angeboten_eur, 94000);
  assert.equal(h.interne_kosten_eur, (520 + 320 + 110) * 70);
  // Auftrag Rohbau + Elektro + beauftragter Nachtrag; Maler noch ohne Auftrag
  assert.equal(k.beauftragt_eur, 172500 + 39800 + 1200);
  assert.equal(k.abgerechnet_eur, 95000 + 60000 + 5000 + 28000 + 14500);
});

test("Geldkreise: Baukosten-Änderung lässt das Honorar unberührt (Gegenfall)", () => {
  const store = demoStore();
  const vorher = structuredClone(honorarStand(store, "p-lindenweg"));
  store.daten.baukosten.eingangsrechnungen[0].betrag_netto_eur += 50000;
  store.daten.baukosten.nachtraege.push({
    id: "n-x", vergabeeinheit_id: "ve-11", nummer: null, bezeichnung: "Test", betrag_eur: 9999, status: "beauftragt",
  });
  assert.deepEqual(honorarStand(store, "p-lindenweg"), vorher);
});

test("Datenprüfung findet genau die eingebauten Widersprüche", () => {
  const store = demoStore();
  const aktive = store.daten.projekte.filter((p) => p.aktiv).map((p) => p.id);
  const befunde = datenpruefung(store, { projektIds: aktive, stichtag: STICHTAG });
  const paare = befunde.map((b) => `${b.regel}|${b.id}`).sort();
  assert.deepEqual(paare, [
    "Abrechnungslücke|l-102",
    "Abrechnungslücke|l-202",
    "Beauftragt ohne Auftragnehmer|ve-21",
    "Beauftragt ohne Auftragssumme|ve-21",
    "Bezahlt ohne Zahldatum|re-1003",
    "Doppelte Rechnungsnummer|re-1002,re-1005",
    "Honorar verbraucht|l-201",
    "Prognose über Planbudget|ve-12",
    "Prognose über Planbudget|ve-22",
    "Rechnungen ohne Auftragssumme|ve-21",
    "Rechnungen über Auftragssumme|ve-12",
    "Überfällige Rechnung|re-1002",
  ]);
  // sortiert: alle "hoch" vor allen "mittel"
  const schweren = befunde.map((b) => b.schwere);
  assert.equal(schweren.lastIndexOf("hoch") < schweren.indexOf("mittel"), true);
});

test("Datenprüfung: abgeschlossenes Projekt wird nur auf ausdrücklichen Wunsch geprüft", () => {
  const store = demoStore();
  const aktive = store.daten.projekte.filter((p) => p.aktiv).map((p) => p.id);
  const standard = datenpruefung(store, { projektIds: aktive, stichtag: STICHTAG });
  assert.equal(standard.some((b) => b.projekt === "Dachausbau Mühlgasse"), false);
  const gezielt = datenpruefung(store, { projektIds: ["p-muehlgasse"], stichtag: STICHTAG });
  assert.deepEqual(gezielt.map((b) => `${b.regel}|${b.id}`), ["Prognose über Planbudget|ve-31"]);
});

test("Datenprüfung: Überfälligkeit hängt am Stichtag (Gegenfall)", () => {
  const store = demoStore();
  const frueh = datenpruefung(store, { projektIds: ["p-lindenweg"], stichtag: "2026-09-20" });
  assert.equal(frueh.some((b) => b.regel === "Überfällige Rechnung"), false);
});

test("Datenprüfung: min_schwere filtert", () => {
  const store = demoStore();
  const hoch = datenpruefung(store, { projektIds: ["p-lindenweg", "p-sonnenhang"], stichtag: STICHTAG, minSchwere: "hoch" });
  assert.equal(hoch.every((b) => b.schwere === "hoch"), true);
  assert.equal(hoch.length, 7);
});
