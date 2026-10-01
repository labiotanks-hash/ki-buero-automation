import { bewerteLeistung, type Bewertung } from "./ampel.js";
import type { DatenStore, Leistung, Vergabeeinheit } from "./store.js";

/**
 * Die zwei Geldkreise -- bewusst in zwei getrennten Funktionen ohne gemeinsame Summe.
 *
 * HONORAR   = was das Büro verdient. Liest nur store.daten.honorar.
 * BAUKOSTEN = was der Bauherr an die Firmen zahlt. Liest nur store.daten.baukosten.
 *
 * Es gibt absichtlich keine Funktion, die beides addiert. Eine Zahl
 * "Projektvolumen = Honorar + Baukosten" wäre fachlich falsch und gefährlich:
 * wer sie liest, verwechselt Bauherrengeld mit Büroumsatz.
 */

export type LeistungStand = Leistung & { interne_kosten_eur: number } & Bewertung;

export type HonorarStand = {
  angeboten_eur: number;
  abgerechnet_eur: number;
  bezahlt_eur: number;
  interne_kosten_eur: number;
  ist_stunden: number;
  bewertung: Bewertung;
  leistungen: LeistungStand[];
};

export function honorarStand(store: DatenStore, projektId: string): HonorarStand {
  const satz = store.daten.stundensatz_intern_eur;
  const leistungen = store.daten.honorar.leistungen
    .filter((l) => l.projekt_id === projektId)
    .map((l) => {
      const intern = l.ist_stunden * satz;
      return {
        ...l,
        interne_kosten_eur: intern,
        ...bewerteLeistung({
          angebotenEur: l.angeboten_eur,
          abgerechnetEur: l.abgerechnet_eur,
          interneKostenEur: intern,
        }),
      };
    });

  const summe = (f: (l: LeistungStand) => number) => leistungen.reduce((s, l) => s + f(l), 0);
  const angeboten = summe((l) => l.angeboten_eur);
  const abgerechnet = summe((l) => l.abgerechnet_eur);
  const intern = summe((l) => l.interne_kosten_eur);

  return {
    angeboten_eur: angeboten,
    abgerechnet_eur: abgerechnet,
    bezahlt_eur: summe((l) => l.bezahlt_eur),
    interne_kosten_eur: intern,
    ist_stunden: summe((l) => l.ist_stunden),
    bewertung: bewerteLeistung({
      angebotenEur: angeboten,
      abgerechnetEur: abgerechnet,
      interneKostenEur: intern,
    }),
    leistungen,
  };
}

export type VeStand = Vergabeeinheit & {
  beauftragt_inkl_nachtraege_eur: number | null;
  prognose_eur: number;
  abgerechnet_eur: number;
  bezahlt_eur: number;
};

/** Kostenstand einer Vergabeeinheit: Budget -> Auftrag (+ Nachträge) -> Prognose -> Rechnungen. */
export function veStand(store: DatenStore, ve: Vergabeeinheit): VeStand {
  const nachtraege = store.daten.baukosten.nachtraege.filter((n) => n.vergabeeinheit_id === ve.id);
  const rechnungen = store.daten.baukosten.eingangsrechnungen.filter(
    (r) => r.vergabeeinheit_id === ve.id,
  );

  const beauftragteNt = nachtraege
    .filter((n) => n.status === "beauftragt")
    .reduce((s, n) => s + n.betrag_eur, 0);
  const erwarteteNt = nachtraege
    .filter((n) => n.status === "erwartet")
    .reduce((s, n) => s + n.betrag_eur, 0);

  const beauftragt = ve.auftragssumme_eur === null ? null : ve.auftragssumme_eur + beauftragteNt;

  // Prognose: von Hand gesetzt > Auftrag inkl. aller beauftragten und erwarteten Nachträge > Planbudget.
  const prognose =
    ve.prognose_manuell_eur ??
    (beauftragt !== null ? beauftragt + erwarteteNt : (ve.planbudget_eur ?? 0));

  return {
    ...ve,
    beauftragt_inkl_nachtraege_eur: beauftragt,
    prognose_eur: prognose,
    abgerechnet_eur: rechnungen.reduce((s, r) => s + r.betrag_netto_eur, 0),
    bezahlt_eur: rechnungen
      .filter((r) => r.status === "bezahlt")
      .reduce((s, r) => s + r.betrag_netto_eur, 0),
  };
}

export type BaukostenStand = {
  planbudget_eur: number;
  beauftragt_eur: number;
  prognose_eur: number;
  abgerechnet_eur: number;
  bezahlt_eur: number;
  vergabeeinheiten: VeStand[];
};

export function baukostenStand(store: DatenStore, projektId: string): BaukostenStand {
  const einheiten = store.daten.baukosten.vergabeeinheiten
    .filter((v) => v.projekt_id === projektId)
    .map((v) => veStand(store, v));
  const summe = (f: (v: VeStand) => number) => einheiten.reduce((s, v) => s + f(v), 0);
  return {
    planbudget_eur: summe((v) => v.planbudget_eur ?? 0),
    beauftragt_eur: summe((v) => v.beauftragt_inkl_nachtraege_eur ?? 0),
    prognose_eur: summe((v) => v.prognose_eur),
    abgerechnet_eur: summe((v) => v.abgerechnet_eur),
    bezahlt_eur: summe((v) => v.bezahlt_eur),
    vergabeeinheiten: einheiten,
  };
}
