/**
 * Ampel- und Status-Logik für eine Honorar-Leistung.
 *
 * Im Produktivsystem ist diese Datei eine wortgleiche Kopie der Logik aus der
 * Weboberfläche. Damit bewerten MCP-Server und Web dieselbe Leistung nie
 * unterschiedlich.
 */

export const SCHWELLEN = {
  driftGelbPp: 15,
  driftRotPp: 30,
  budgetGelbPct: 85,
  budgetRotPct: 100,
} as const;

export type Ampel = "gruen" | "gelb" | "rot" | "grau";
export type Status =
  | "nicht_begonnen"
  | "fertig_abgerechnet"
  | "abrechnungsluecke"
  | "laeuft";

export type Bewertung = {
  verbrauchPct: number | null;
  abgerechnetPct: number | null;
  offenEur: number;
  ergebnisEur: number;
  lueckePp: number | null;
  status: Status;
  ampel: Ampel;
};

const CENT = 0.01;

/**
 * Bewertet eine Leistung.
 * - verbrauch   = interne Kosten (Stunden x Satz) / angebotenes Honorar
 * - abgerechnet = abgerechnetes Honorar / angebotenes Honorar
 * - Lücke       = verbrauch - abgerechnet, in Prozentpunkten
 */
export function bewerteLeistung(input: {
  angebotenEur: number;
  abgerechnetEur: number;
  interneKostenEur: number;
}): Bewertung {
  const { angebotenEur, abgerechnetEur, interneKostenEur } = input;

  const verbrauchPct = angebotenEur > 0 ? (interneKostenEur / angebotenEur) * 100 : null;
  const abgerechnetPct = angebotenEur > 0 ? (abgerechnetEur / angebotenEur) * 100 : null;
  const offenEur = angebotenEur - abgerechnetEur;
  const ergebnisEur = abgerechnetEur - interneKostenEur;
  const lueckePp =
    verbrauchPct !== null && abgerechnetPct !== null ? verbrauchPct - abgerechnetPct : null;

  let status: Status;
  if (interneKostenEur <= CENT && abgerechnetEur <= CENT) {
    status = "nicht_begonnen";
  } else if (offenEur <= CENT) {
    status = "fertig_abgerechnet";
  } else if (lueckePp !== null && lueckePp >= SCHWELLEN.driftGelbPp) {
    status = "abrechnungsluecke";
  } else {
    status = "laeuft";
  }

  let ampel: Ampel;
  if (status === "nicht_begonnen") {
    ampel = "grau";
  } else if (
    (verbrauchPct !== null && verbrauchPct >= SCHWELLEN.budgetRotPct) ||
    (lueckePp !== null && lueckePp >= SCHWELLEN.driftRotPp)
  ) {
    ampel = "rot";
  } else if (
    (verbrauchPct !== null && verbrauchPct >= SCHWELLEN.budgetGelbPct) ||
    (lueckePp !== null && lueckePp >= SCHWELLEN.driftGelbPp)
  ) {
    ampel = "gelb";
  } else {
    ampel = "gruen";
  }

  return { verbrauchPct, abgerechnetPct, offenEur, ergebnisEur, lueckePp, status, ampel };
}

export const AMPEL_TEXT: Record<Ampel, string> = {
  gruen: "Im Rahmen",
  gelb: "Beobachten",
  rot: "Handeln",
  grau: "Nicht begonnen",
};
