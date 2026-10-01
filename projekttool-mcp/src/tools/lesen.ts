import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AMPEL_TEXT } from "../ampel.js";
import { antwort, eur, pct, sicher, tabelle } from "../format.js";
import { baukostenStand, honorarStand } from "../geldkreise.js";
import { findeProjekt } from "../projekt.js";
import { datenpruefung } from "../pruefung.js";
import type { DatenStore } from "../store.js";

export const projektFeld = z
  .string()
  .min(2, "Bitte mindestens zwei Zeichen angeben")
  .describe(
    "Projekt als Name oder Namensteil (z.B. 'Lindenweg') oder als ID. Bei mehreren Treffern " +
      "meldet das Werkzeug die Auswahl zurück, statt zu raten.",
  );

const nurLesen = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export function registriereLesendeWerkzeuge(server: McpServer, store: DatenStore): void {
  server.registerTool(
    "projekttool_projekte_liste",
    {
      title: "Projekte auflisten",
      description:
        "Listet die Projekte mit Honorarstand und Ampel. Einstieg, wenn unklar ist, welche " +
        "Projekte es gibt oder wie eines genau heißt. Danach projekttool_projekt_uebersicht.",
      inputSchema: {
        nur_aktive: z.boolean().default(true).describe("Nur laufende Projekte zeigen."),
        suche: z.string().optional().describe("Filter auf Namensteil, Ort oder Auftraggeber."),
      },
      annotations: nurLesen,
    },
    async ({ nur_aktive, suche }) =>
      sicher(() => {
        const s = suche?.toLowerCase();
        const projekte = store.daten.projekte
          .filter((p) => !nur_aktive || p.aktiv)
          .filter(
            (p) =>
              !s ||
              [p.name, p.ort ?? "", p.auftraggeber ?? ""].some((f) => f.toLowerCase().includes(s)),
          );

        const zeilen = projekte.map((p) => {
          const h = honorarStand(store, p.id);
          return {
            id: p.id,
            name: p.name,
            ort: p.ort,
            status: p.status,
            honorar_angeboten_eur: h.angeboten_eur,
            honorar_abgerechnet_eur: h.abgerechnet_eur,
            honorar_offen_eur: h.bewertung.offenEur,
            ampel: h.bewertung.ampel,
          };
        });

        const md = [
          `# Projekte${nur_aktive ? " (aktiv)" : ""}`,
          "",
          tabelle(
            ["Projekt", "Ort", "Status", "Honorar angeboten", "abgerechnet", "offen", "Ampel"],
            zeilen.map((z) => [
              z.name,
              z.ort ?? "–",
              z.status,
              eur(z.honorar_angeboten_eur),
              eur(z.honorar_abgerechnet_eur),
              eur(z.honorar_offen_eur),
              AMPEL_TEXT[z.ampel],
            ]),
          ),
        ].join("\n");
        return antwort(md, { anzahl: zeilen.length, projekte: zeilen });
      }),
  );

  server.registerTool(
    "projekttool_projekt_uebersicht",
    {
      title: "Projekt-Übersicht",
      description:
        "Lage eines Projekts: Honorar (das Geld des Büros) und Baukosten (das Geld des Bauherrn) " +
        "-- in zwei getrennten Blöcken. Diese Zahlen NIE addieren oder gegeneinander verrechnen. " +
        "Für Fragen wie 'wie steht Projekt X' oder 'liegen wir im Honorar'.",
      inputSchema: { projekt: projektFeld },
      annotations: nurLesen,
    },
    async ({ projekt }) =>
      sicher(() => {
        const p = findeProjekt(store, projekt);
        const h = honorarStand(store, p.id);
        const k = baukostenStand(store, p.id);

        const honorar = {
          angeboten_eur: h.angeboten_eur,
          abgerechnet_eur: h.abgerechnet_eur,
          bezahlt_eur: h.bezahlt_eur,
          interne_kosten_eur: h.interne_kosten_eur,
          ist_stunden: h.ist_stunden,
          offen_eur: h.bewertung.offenEur,
          verbrauch_pct: h.bewertung.verbrauchPct,
          abgerechnet_pct: h.bewertung.abgerechnetPct,
          ampel: h.bewertung.ampel,
        };
        const baukosten = {
          planbudget_eur: k.planbudget_eur,
          beauftragt_eur: k.beauftragt_eur,
          prognose_eur: k.prognose_eur,
          abgerechnet_eur: k.abgerechnet_eur,
          bezahlt_eur: k.bezahlt_eur,
          abweichung_prognose_zu_budget_eur: k.prognose_eur - k.planbudget_eur,
        };

        const md = [
          `# ${p.name}`,
          "",
          `${p.ort ?? "ohne Ort"} · Auftraggeber: ${p.auftraggeber ?? "–"} · ${p.status}`,
          "",
          `## Honorar (Büro) — ${AMPEL_TEXT[h.bewertung.ampel]}`,
          "",
          tabelle(
            ["Angeboten", "Abgerechnet", "Bezahlt", "Interne Kosten", "Offen"],
            [[eur(h.angeboten_eur), eur(h.abgerechnet_eur), eur(h.bezahlt_eur), eur(h.interne_kosten_eur), eur(h.bewertung.offenEur)]],
          ),
          "",
          `Verbrauch ${pct(h.bewertung.verbrauchPct)} · abgerechnet ${pct(h.bewertung.abgerechnetPct)} · ${h.ist_stunden} Stunden`,
          "",
          "## Baukosten (Bauherr)",
          "",
          tabelle(
            ["Planbudget", "Beauftragt", "Prognose", "Abgerechnet", "Bezahlt"],
            [[eur(k.planbudget_eur), eur(k.beauftragt_eur), eur(k.prognose_eur), eur(k.abgerechnet_eur), eur(k.bezahlt_eur)]],
          ),
        ].join("\n");

        return antwort(md, { projekt: p, honorar, baukosten });
      }),
  );

  server.registerTool(
    "projekttool_leistungen_honorar",
    {
      title: "Honorar je Leistung",
      description:
        "Honorar je Leistungsphase mit Verbrauch, Abrechnungsstand und Lücke. Zeigt, was " +
        "abgerechnet werden kann. Nur Geldkreis HONORAR.",
      inputSchema: { projekt: projektFeld },
      annotations: nurLesen,
    },
    async ({ projekt }) =>
      sicher(() => {
        const p = findeProjekt(store, projekt);
        const h = honorarStand(store, p.id);
        const md = [
          `# Honorar je Leistung — ${p.name}`,
          "",
          tabelle(
            ["Leistung", "Angeboten", "Abgerechnet", "Verbrauch", "Lücke", "Ampel"],
            h.leistungen.map((l) => [
              l.name,
              eur(l.angeboten_eur),
              eur(l.abgerechnet_eur),
              pct(l.verbrauchPct),
              l.lueckePp === null ? "–" : `${l.lueckePp.toFixed(0)} pp`,
              AMPEL_TEXT[l.ampel],
            ]),
          ),
        ].join("\n");
        return antwort(md, { projekt: p.name, leistungen: h.leistungen });
      }),
  );

  server.registerTool(
    "projekttool_vergabeeinheiten",
    {
      title: "Baukosten je Vergabeeinheit",
      description:
        "Baukosten je Vergabeeinheit: Budget -> Auftrag inkl. Nachträgen -> Prognose -> Rechnungen. " +
        "Liefert die IDs für nachtrag_anlegen. Nur Geldkreis BAUKOSTEN.",
      inputSchema: { projekt: projektFeld },
      annotations: nurLesen,
    },
    async ({ projekt }) =>
      sicher(() => {
        const p = findeProjekt(store, projekt);
        const k = baukostenStand(store, p.id);
        const md = [
          `# Vergabeeinheiten — ${p.name}`,
          "",
          tabelle(
            ["ID", "Nr.", "Gewerk", "Status", "Budget", "Beauftragt", "Prognose", "Abgerechnet"],
            k.vergabeeinheiten.map((v) => [
              v.id,
              v.nummer ?? "–",
              v.name,
              v.status,
              eur(v.planbudget_eur),
              eur(v.beauftragt_inkl_nachtraege_eur),
              eur(v.prognose_eur),
              eur(v.abgerechnet_eur),
            ]),
          ),
        ].join("\n");
        return antwort(md, { projekt: p.name, vergabeeinheiten: k.vergabeeinheiten });
      }),
  );

  server.registerTool(
    "projekttool_eingangsrechnungen_suchen",
    {
      title: "Eingangsrechnungen suchen",
      description:
        "Rechnungen der beauftragten Firmen, optional je Projekt und Status. Liefert die IDs für " +
        "eingangsrechnung_aktualisieren. Nur Geldkreis BAUKOSTEN.",
      inputSchema: {
        projekt: projektFeld.optional(),
        status: z.enum(["erfasst", "freigegeben", "bezahlt"]).optional(),
      },
      annotations: nurLesen,
    },
    async ({ projekt, status }) =>
      sicher(() => {
        const veIds = projekt
          ? new Set(
              store.daten.baukosten.vergabeeinheiten
                .filter((v) => v.projekt_id === findeProjekt(store, projekt).id)
                .map((v) => v.id),
            )
          : null;
        const rechnungen = store.daten.baukosten.eingangsrechnungen
          .filter((r) => !veIds || veIds.has(r.vergabeeinheit_id))
          .filter((r) => !status || r.status === status);
        const md = [
          "# Eingangsrechnungen",
          "",
          tabelle(
            ["ID", "VE", "Nr.", "Netto", "Fällig", "Status", "Bezahlt am"],
            rechnungen.map((r) => [
              r.id,
              r.vergabeeinheit_id,
              r.rechnungsnummer ?? "–",
              eur(r.betrag_netto_eur),
              r.faellig_am ?? "–",
              r.status,
              r.bezahlt_am ?? "–",
            ]),
          ),
        ].join("\n");
        return antwort(md, { anzahl: rechnungen.length, rechnungen });
      }),
  );

  server.registerTool(
    "projekttool_datenpruefung",
    {
      title: "Daten auf Widersprüche prüfen",
      description:
        "Prüft Projektdaten auf Widersprüche und Warnzeichen (Rechnung über Auftrag, bezahlt ohne " +
        "Datum, doppelte Rechnungsnummer, Abrechnungslücke, Prognose über Budget u.a.). Ändert " +
        "nichts. VOR jeder Korrektur aufrufen, um den Ist-Stand zu kennen.",
      inputSchema: {
        projekt: projektFeld.optional().describe("Weglassen prüft alle aktiven Projekte."),
        min_schwere: z.enum(["hoch", "mittel", "niedrig"]).default("niedrig"),
        stichtag: z
          .string()
          .regex(DATUM, "Format JJJJ-MM-TT")
          .optional()
          .describe("Stichtag für 'überfällig'. Standard: heute."),
      },
      annotations: nurLesen,
    },
    async ({ projekt, min_schwere, stichtag }) =>
      sicher(() => {
        const tag = stichtag ?? new Date().toISOString().slice(0, 10);
        const projektIds = projekt
          ? [findeProjekt(store, projekt).id]
          : store.daten.projekte.filter((p) => p.aktiv).map((p) => p.id);
        const befunde = datenpruefung(store, { projektIds, stichtag: tag, minSchwere: min_schwere });
        const zaehle = (s: string) => befunde.filter((b) => b.schwere === s).length;
        const md = [
          `# Datenprüfung (Stichtag ${tag})`,
          "",
          `${befunde.length} Befund(e): ${zaehle("hoch")} hoch, ${zaehle("mittel")} mittel, ${zaehle("niedrig")} niedrig.`,
          "",
          tabelle(
            ["Schwere", "Regel", "Projekt", "Betrifft", "Was", "Nächster Schritt"],
            befunde.map((b) => [b.schwere, b.regel, b.projekt, b.betrifft, b.beschreibung, b.hinweis]),
          ),
        ].join("\n");
        return antwort(md, {
          stichtag: tag,
          anzahl: befunde.length,
          nach_schwere: { hoch: zaehle("hoch"), mittel: zaehle("mittel"), niedrig: zaehle("niedrig") },
          befunde,
        });
      }),
  );
}
