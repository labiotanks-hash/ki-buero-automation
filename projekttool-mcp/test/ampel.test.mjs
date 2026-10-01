import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerteLeistung } from "../dist/ampel.js";

test("nicht begonnen ist grau", () => {
  const b = bewerteLeistung({ angebotenEur: 10000, abgerechnetEur: 0, interneKostenEur: 0 });
  assert.equal(b.status, "nicht_begonnen");
  assert.equal(b.ampel, "grau");
});

test("Lücke ab 30 Prozentpunkten ist rot, darunter ab 15 gelb", () => {
  const rot = bewerteLeistung({ angebotenEur: 10000, abgerechnetEur: 2000, interneKostenEur: 5500 });
  assert.equal(rot.ampel, "rot");
  assert.equal(rot.status, "abrechnungsluecke");
  const gelb = bewerteLeistung({ angebotenEur: 10000, abgerechnetEur: 2000, interneKostenEur: 4000 });
  assert.equal(gelb.ampel, "gelb");
});

test("Verbrauch ab 100 % ist rot, auch wenn fertig abgerechnet", () => {
  const b = bewerteLeistung({ angebotenEur: 10000, abgerechnetEur: 10000, interneKostenEur: 10500 });
  assert.equal(b.status, "fertig_abgerechnet");
  assert.equal(b.ampel, "rot");
});

test("im Rahmen ist grün", () => {
  const b = bewerteLeistung({ angebotenEur: 10000, abgerechnetEur: 3000, interneKostenEur: 3500 });
  assert.equal(b.ampel, "gruen");
});
