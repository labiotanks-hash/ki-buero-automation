/**
 * Ende-zu-Ende über das echte MCP-Protokoll: ein MCP-Client spricht mit dem Server
 * über einen In-Memory-Transport -- so, wie Claude Desktop es über stdio tut.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { erstelleServer } from "../dist/server.js";
import { demoStore } from "./hilfe.mjs";

async function verbinde({ nurLesen = false } = {}) {
  const store = demoStore();
  const server = erstelleServer(store, { nurLesen });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  const rufe = (name, args = {}) => client.callTool({ name, arguments: args });
  return { store, client, rufe };
}

const SCHREIBEND = ["projekttool_eingangsrechnung_aktualisieren", "projekttool_nachtrag_anlegen"];

test("Server meldet 8 Werkzeuge und gibt die Regeln als instructions mit", async () => {
  const { client } = await verbinde();
  const { tools } = await client.listTools();
  assert.equal(tools.length, 8);
  assert.match(client.getInstructions(), /nie\s+vermischt/);
  assert.match(client.getInstructions(), /vorschau=true/);
});

test("Nur-Lesen-Betrieb: schreibende Werkzeuge existieren nicht", async () => {
  const { client } = await verbinde({ nurLesen: true });
  const namen = (await client.listTools()).tools.map((t) => t.name);
  assert.equal(namen.length, 6);
  for (const n of SCHREIBEND) assert.equal(namen.includes(n), false);
});

test("Projekt-Übersicht per Namensteil, Honorar und Baukosten getrennt", async () => {
  const { rufe } = await verbinde();
  const r = await rufe("projekttool_projekt_uebersicht", { projekt: "Sonnenhang" });
  assert.equal(r.isError, undefined);
  assert.equal(r.structuredContent.projekt.id, "p-sonnenhang");
  assert.ok("honorar" in r.structuredContent && "baukosten" in r.structuredContent);
  assert.match(r.content[0].text, /## Honorar \(Büro\)/);
  assert.match(r.content[0].text, /## Baukosten \(Bauherr\)/);
});

test("Rechnung korrigieren: ohne vorschau-Angabe wird NICHT gespeichert", async () => {
  const { store, rufe } = await verbinde();
  const r = await rufe("projekttool_eingangsrechnung_aktualisieren", {
    rechnung_id: "re-1003", bezahlt_am: "2026-07-28",
  });
  assert.equal(r.structuredContent.gespeichert, false);
  assert.match(r.content[0].text, /Vorschau — nichts gespeichert/);
  assert.equal(store.daten.baukosten.eingangsrechnungen.find((x) => x.id === "re-1003").bezahlt_am, null);
});

test("Rechnung korrigieren: mit vorschau=false wird gespeichert", async () => {
  const { store, rufe } = await verbinde();
  const r = await rufe("projekttool_eingangsrechnung_aktualisieren", {
    rechnung_id: "re-1003", bezahlt_am: "2026-07-28", vorschau: false,
  });
  assert.equal(r.structuredContent.gespeichert, true);
  assert.equal(store.daten.baukosten.eingangsrechnungen.find((x) => x.id === "re-1003").bezahlt_am, "2026-07-28");
});

test("Fachregel: 'bezahlt' ohne Zahldatum wird abgelehnt, auch mit vorschau=false", async () => {
  const { store, rufe } = await verbinde();
  const r = await rufe("projekttool_eingangsrechnung_aktualisieren", {
    rechnung_id: "re-1004", status: "bezahlt", vorschau: false,
  });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /ohne Zahldatum ist nicht zulässig/);
  assert.equal(store.daten.baukosten.eingangsrechnungen.find((x) => x.id === "re-1004").status, "erfasst");
});

test("Warnung, wenn eine Korrektur die Vergabeeinheit über den Auftrag hebt", async () => {
  const { rufe } = await verbinde();
  const r = await rufe("projekttool_eingangsrechnung_aktualisieren", {
    rechnung_id: "re-1001", betrag_netto_eur: 120000,
  });
  assert.equal(r.structuredContent.hinweise.length, 1);
  assert.match(r.structuredContent.hinweise[0], /Fehlt ein Nachtrag/);
});

test("Nachtrag: Vorschau ändert nichts, Speichern erhöht nur den Auftrag, nie das Honorar", async () => {
  const { store, rufe } = await verbinde();
  const honorarVorher = (await rufe("projekttool_projekt_uebersicht", { projekt: "Lindenweg" })).structuredContent.honorar;

  const v = await rufe("projekttool_nachtrag_anlegen", {
    vergabeeinheit_id: "ve-12", bezeichnung: "Außenbeleuchtung", betrag_eur: 1500, status: "beauftragt",
  });
  assert.equal(v.structuredContent.gespeichert, false);
  assert.equal(store.daten.baukosten.nachtraege.length, 2);

  const s = await rufe("projekttool_nachtrag_anlegen", {
    vergabeeinheit_id: "ve-12", bezeichnung: "Außenbeleuchtung", betrag_eur: 1500, status: "beauftragt", vorschau: false,
  });
  assert.equal(s.structuredContent.gespeichert, true);
  assert.equal(s.structuredContent.wirkung.beauftragt_nachher_eur, 39800 + 1200 + 1500);
  assert.equal(store.daten.baukosten.nachtraege.length, 3);

  const honorarNachher = (await rufe("projekttool_projekt_uebersicht", { projekt: "Lindenweg" })).structuredContent.honorar;
  assert.deepEqual(honorarNachher, honorarVorher);
});

test("Fehler werden als lesbare Meldung zurückgegeben, nicht als Absturz", async () => {
  const { rufe } = await verbinde();
  const r = await rufe("projekttool_projekt_uebersicht", { projekt: "en" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /passt auf mehrere Projekte/);
});

test("Datenprüfung über MCP mit festem Stichtag", async () => {
  const { rufe } = await verbinde();
  const r = await rufe("projekttool_datenpruefung", { stichtag: "2026-10-01" });
  assert.equal(r.structuredContent.anzahl, 12);
  assert.deepEqual(r.structuredContent.nach_schwere, { hoch: 7, mittel: 5, niedrig: 0 });
});
