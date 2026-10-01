import { readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from "node:fs";

/**
 * Lokale Demo-Datenbank als JSON-Datei.
 *
 * Im Produktivsystem steht hier eine Postgres-Datenbank (Supabase) mit Views für
 * Honorar und Baukosten. Für die Demo reicht eine Datei: dieselben Werkzeuge,
 * dieselben Regeln, kein Konto nötig.
 *
 * Die beiden Geldkreise liegen in getrennten Bereichen der Datei:
 *   honorar   -> das Geld des Architekturbüros (Leistungen, Stunden, Abrechnung)
 *   baukosten -> das Geld des Bauherrn (Vergabeeinheiten, Nachträge, Rechnungen der Firmen)
 */

export type Projekt = {
  id: string;
  name: string;
  ort: string | null;
  auftraggeber: string | null;
  status: string;
  aktiv: boolean;
};

export type Leistung = {
  id: string;
  projekt_id: string;
  name: string;
  angeboten_eur: number;
  abgerechnet_eur: number;
  bezahlt_eur: number;
  ist_stunden: number;
};

export type VeStatus = "geplant" | "ausgeschrieben" | "beauftragt" | "abgeschlossen";

export type Vergabeeinheit = {
  id: string;
  projekt_id: string;
  nummer: string | null;
  name: string;
  status: VeStatus;
  auftragnehmer: string | null;
  planbudget_eur: number | null;
  auftragssumme_eur: number | null;
  prognose_manuell_eur: number | null;
};

export type NachtragStatus = "erwartet" | "beauftragt" | "abgelehnt";

export type Nachtrag = {
  id: string;
  vergabeeinheit_id: string;
  nummer: string | null;
  bezeichnung: string;
  betrag_eur: number;
  status: NachtragStatus;
};

export type RechnungStatus = "erfasst" | "freigegeben" | "bezahlt";

export type Eingangsrechnung = {
  id: string;
  vergabeeinheit_id: string;
  rechnungsnummer: string | null;
  betrag_netto_eur: number;
  rechnungsdatum: string;
  faellig_am: string | null;
  status: RechnungStatus;
  freigegeben_am: string | null;
  bezahlt_am: string | null;
};

export type Daten = {
  stundensatz_intern_eur: number;
  projekte: Projekt[];
  honorar: { leistungen: Leistung[] };
  baukosten: {
    vergabeeinheiten: Vergabeeinheit[];
    nachtraege: Nachtrag[];
    eingangsrechnungen: Eingangsrechnung[];
  };
};

export class DatenStore {
  constructor(
    public daten: Daten,
    private readonly pfad: string | null,
  ) {}

  /** Lädt die Datei. Fehlt sie, wird sie aus der Vorlage angelegt (Arbeitskopie). */
  static ausDatei(pfad: string, vorlage?: string): DatenStore {
    if (!existsSync(pfad)) {
      if (!vorlage) throw new Error(`Datendatei ${pfad} fehlt.`);
      copyFileSync(vorlage, pfad);
    }
    const daten = JSON.parse(readFileSync(pfad, "utf-8")) as Daten;
    return new DatenStore(daten, pfad);
  }

  /** Nur im Speicher -- für Tests. speichern() schreibt dann nichts auf die Platte. */
  static imSpeicher(daten: Daten): DatenStore {
    return new DatenStore(structuredClone(daten), null);
  }

  /** Schreibt atomar: erst in eine Nebendatei, dann umbenennen. Kein halber Stand. */
  speichern(): void {
    if (!this.pfad) return;
    const tmp = `${this.pfad}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.daten, null, 2) + "\n", "utf-8");
    renameSync(tmp, this.pfad);
  }

  neueId(praefix: string, liste: { id: string }[]): string {
    let n = liste.length + 1;
    while (liste.some((e) => e.id === `${praefix}-${n}`)) n++;
    return `${praefix}-${n}`;
  }
}
