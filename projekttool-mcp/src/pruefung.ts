import { SCHWELLEN } from "./ampel.js";
import { eur } from "./format.js";
import { baukostenStand, honorarStand } from "./geldkreise.js";
import type { DatenStore } from "./store.js";

/**
 * Datenprüfung: findet Widersprüche, BEVOR sie in einer Abrechnung landen.
 * Ändert nichts. Jeder Befund sagt, was als Nächstes zu tun ist --
 * ein Befund ohne Handlungsanweisung ist nur Lärm.
 */

export type Schwere = "hoch" | "mittel" | "niedrig";

export type Befund = {
  regel: string;
  schwere: Schwere;
  projekt: string;
  betrifft: string;
  id: string;
  beschreibung: string;
  hinweis: string;
};

export const REGELN = [
  "Beauftragt ohne Auftragssumme",
  "Beauftragt ohne Auftragnehmer",
  "Rechnungen über Auftragssumme",
  "Rechnungen ohne Auftragssumme",
  "Doppelte Rechnungsnummer",
  "Rechnung mit Betrag 0",
  "Bezahlt ohne Zahldatum",
  "Überfällige Rechnung",
  "Abrechnungslücke",
  "Honorar verbraucht",
  "Prognose über Planbudget",
] as const;

const RANG: Record<Schwere, number> = { hoch: 0, mittel: 1, niedrig: 2 };

export function datenpruefung(
  store: DatenStore,
  optionen: { projektIds: string[]; stichtag: string; minSchwere?: Schwere },
): Befund[] {
  const befunde: Befund[] = [];
  const { projektIds, stichtag } = optionen;
  const minRang = RANG[optionen.minSchwere ?? "niedrig"];

  for (const projektId of projektIds) {
    const projekt = store.daten.projekte.find((p) => p.id === projektId);
    if (!projekt) continue;
    const name = projekt.name;

    // --- Baukosten (Geld des Bauherrn) ---------------------------------------
    const bk = baukostenStand(store, projektId);
    for (const ve of bk.vergabeeinheiten) {
      const veName = `VE ${ve.nummer ?? ""} ${ve.name}`.replace(/\s+/g, " ").trim();
      const rechnungen = store.daten.baukosten.eingangsrechnungen.filter(
        (r) => r.vergabeeinheit_id === ve.id,
      );

      if (ve.status === "beauftragt" && !ve.auftragssumme_eur) {
        befunde.push({
          regel: REGELN[0], schwere: "hoch", projekt: name, betrifft: veName, id: ve.id,
          beschreibung: "Status 'beauftragt', aber keine Auftragssumme hinterlegt.",
          hinweis: "Auftragssumme aus dem Auftragsschreiben nachtragen.",
        });
      }
      if (ve.status === "beauftragt" && !ve.auftragnehmer) {
        befunde.push({
          regel: REGELN[1], schwere: "mittel", projekt: name, betrifft: veName, id: ve.id,
          beschreibung: "Status 'beauftragt', aber kein Auftragnehmer eingetragen.",
          hinweis: "Auftragnehmer ergänzen.",
        });
      }

      const summe = rechnungen.reduce((s, r) => s + r.betrag_netto_eur, 0);
      if (ve.beauftragt_inkl_nachtraege_eur && summe > ve.beauftragt_inkl_nachtraege_eur + 0.01) {
        befunde.push({
          regel: REGELN[2], schwere: "hoch", projekt: name, betrifft: veName, id: ve.id,
          beschreibung:
            `Rechnungen ${eur(summe)} liegen über dem Auftrag inkl. Nachträgen ` +
            `${eur(ve.beauftragt_inkl_nachtraege_eur)} (Differenz ${eur(summe - ve.beauftragt_inkl_nachtraege_eur)}).`,
          hinweis: "Prüfen, ob ein Nachtrag fehlt (nachtrag_anlegen) oder eine Rechnung falsch zugeordnet ist.",
        });
      }
      // Gegenstück zur Regel davor: ohne Auftrag gibt es keine Obergrenze -- der schwerere Fall.
      if (!ve.auftragssumme_eur && rechnungen.length > 0) {
        befunde.push({
          regel: REGELN[3], schwere: "hoch", projekt: name, betrifft: veName, id: ve.id,
          beschreibung: `${rechnungen.length} Rechnung(en) über ${eur(summe)}, aber keine Auftragssumme.`,
          hinweis: "Ohne Auftragssumme ist keine Rechnung prüfbar. Auftrag nachtragen.",
        });
      }

      const nachNummer = new Map<string, string[]>();
      for (const r of rechnungen) {
        if (!r.rechnungsnummer) continue;
        nachNummer.set(r.rechnungsnummer, [...(nachNummer.get(r.rechnungsnummer) ?? []), r.id]);
      }
      for (const [nummer, ids] of nachNummer) {
        if (ids.length > 1) {
          befunde.push({
            regel: REGELN[4], schwere: "hoch", projekt: name, betrifft: `${veName}, Nr. ${nummer}`,
            id: ids.join(","),
            beschreibung: `Rechnungsnummer ${nummer} kommt ${ids.length}-mal vor (${ids.join(", ")}).`,
            hinweis: "Doppelerfassung oder Tippfehler? Beleg prüfen, dann korrigieren.",
          });
        }
      }

      for (const r of rechnungen) {
        const rName = `Rechnung ${r.rechnungsnummer ?? r.id}`;
        if (r.betrag_netto_eur <= 0) {
          befunde.push({
            regel: REGELN[5], schwere: "hoch", projekt: name, betrifft: rName, id: r.id,
            beschreibung: "Nettobetrag ist 0.", hinweis: "Betrag vom Beleg übernehmen.",
          });
        }
        if (r.status === "bezahlt" && !r.bezahlt_am) {
          befunde.push({
            regel: REGELN[6], schwere: "mittel", projekt: name, betrifft: rName, id: r.id,
            beschreibung: "Status 'bezahlt', aber kein Zahldatum.",
            hinweis: "Zahldatum aus dem Kontoauszug nachtragen (eingangsrechnung_aktualisieren).",
          });
        }
        if (r.status !== "bezahlt" && r.faellig_am && r.faellig_am < stichtag) {
          befunde.push({
            regel: REGELN[7], schwere: "hoch", projekt: name, betrifft: rName, id: r.id,
            beschreibung: `Fällig seit ${r.faellig_am}, Status '${r.status}'.`,
            hinweis: "Zahlung anstoßen oder Status korrigieren, falls schon bezahlt.",
          });
        }
      }

      if (ve.planbudget_eur && ve.prognose_eur > ve.planbudget_eur + 0.01) {
        befunde.push({
          regel: REGELN[10], schwere: "mittel", projekt: name, betrifft: veName, id: ve.id,
          beschreibung:
            `Prognose ${eur(ve.prognose_eur)} über Planbudget ${eur(ve.planbudget_eur)} ` +
            `(+${eur(ve.prognose_eur - ve.planbudget_eur)}).`,
          hinweis: "Mit dem Bauherrn besprechen, bevor weiter beauftragt wird.",
        });
      }
    }

    // --- Honorar (Geld des Büros) --------------------------------------------
    const hon = honorarStand(store, projektId);
    for (const l of hon.leistungen) {
      if (l.lueckePp !== null && l.lueckePp >= SCHWELLEN.driftRotPp) {
        befunde.push({
          regel: REGELN[8], schwere: "hoch", projekt: name, betrifft: l.name, id: l.id,
          beschreibung:
            `Verbrauch ${l.verbrauchPct!.toFixed(0)} %, abgerechnet ${l.abgerechnetPct!.toFixed(0)} % ` +
            `-- Lücke ${l.lueckePp.toFixed(0)} Prozentpunkte.`,
          hinweis: "Abschlagsrechnung stellen: Leistung ist erbracht, aber nicht abgerechnet.",
        });
      }
      if (l.verbrauchPct !== null && l.verbrauchPct >= SCHWELLEN.budgetRotPct) {
        befunde.push({
          regel: REGELN[9], schwere: "mittel", projekt: name, betrifft: l.name, id: l.id,
          beschreibung: `Interne Kosten ${eur(l.interne_kosten_eur)} = ${l.verbrauchPct.toFixed(0)} % des Honorars.`,
          hinweis: "Nachtragshonorar prüfen oder Leistung als Verlust verbuchen.",
        });
      }
    }
  }

  return befunde
    .filter((b) => RANG[b.schwere] <= minRang)
    .sort((a, b) => RANG[a.schwere] - RANG[b.schwere]);
}
