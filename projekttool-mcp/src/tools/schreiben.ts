import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { antwort, eur, sicher, tabelle } from "../format.js";
import { honorarStand, veStand } from "../geldkreise.js";
import type { DatenStore, Eingangsrechnung, Nachtrag } from "../store.js";

/**
 * Schreibende Werkzeuge.
 *
 * Grundregel: vorschau=true ist die Voreinstellung. Ein Aufruf ohne ausdrückliches
 * vorschau=false rechnet nur und zeigt Vorher/Nachher. Das Modell muss die Vorschau
 * dem Menschen zeigen und dessen Zustimmung einholen, bevor es ein zweites Mal mit
 * vorschau=false aufruft.
 *
 * Die fachlichen Regeln der Weboberfläche gelten hier genauso -- deshalb gibt es diese
 * Werkzeuge statt freiem SQL.
 */

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

const vorschauFeld = z
  .boolean()
  .default(true)
  .describe(
    "true (Standard) zeigt nur Vorher/Nachher und speichert nichts. Erst false schreibt. " +
      "Immer zuerst die Vorschau zeigen und erst nach ausdrücklicher Zustimmung speichern.",
  );

const schreibend = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

function zeige(w: unknown): string {
  if (w === null || w === undefined) return "–";
  return typeof w === "number" ? eur(w) : String(w);
}

const HINWEIS_SPEICHERN =
  "_Zum Speichern denselben Aufruf mit `vorschau: false` wiederholen — erst nach Zustimmung des Menschen._";

export function registriereSchreibendeWerkzeuge(server: McpServer, store: DatenStore): void {
  server.registerTool(
    "projekttool_eingangsrechnung_aktualisieren",
    {
      title: "Eingangsrechnung korrigieren",
      description:
        "Korrigiert eine Eingangsrechnung (Status, Betrag, Daten, Nummer). ARBEITSWEISE: erst mit " +
        "vorschau=true, Vorschau dem Menschen zeigen, Zustimmung holen, dann vorschau=false. " +
        "Erzwungene Regeln: 'bezahlt' braucht bezahlt_am, 'freigegeben' braucht freigegeben_am, " +
        "kein negativer Betrag. Überschreitet die Summe danach den Auftrag, wird gewarnt.",
      inputSchema: {
        rechnung_id: z.string().describe("ID aus projekttool_eingangsrechnungen_suchen, z.B. 're-1003'."),
        status: z.enum(["erfasst", "freigegeben", "bezahlt"]).optional(),
        betrag_netto_eur: z.number().optional(),
        rechnungsnummer: z.string().optional(),
        faellig_am: z.string().regex(DATUM, "Format JJJJ-MM-TT").optional(),
        freigegeben_am: z.string().regex(DATUM, "Format JJJJ-MM-TT").optional(),
        bezahlt_am: z.string().regex(DATUM, "Format JJJJ-MM-TT").optional(),
        vorschau: vorschauFeld,
      },
      annotations: schreibend,
    },
    async (p) =>
      sicher(() => {
        const alt = store.daten.baukosten.eingangsrechnungen.find((r) => r.id === p.rechnung_id);
        if (!alt) {
          throw new Error(
            `Keine Eingangsrechnung mit der ID ${p.rechnung_id}. Erst projekttool_eingangsrechnungen_suchen aufrufen.`,
          );
        }

        const felder = ["status", "betrag_netto_eur", "rechnungsnummer", "faellig_am", "freigegeben_am", "bezahlt_am"] as const;
        const aenderungen: Partial<Eingangsrechnung> = {};
        for (const f of felder) {
          if (p[f] !== undefined && p[f] !== alt[f]) (aenderungen as Record<string, unknown>)[f] = p[f];
        }
        if (Object.keys(aenderungen).length === 0) {
          return antwort(`# Rechnung ${alt.rechnungsnummer ?? alt.id}\n\nWerte entsprechen bereits dem Bestand. Nichts zu tun.`, {
            gespeichert: false, rechnung_id: alt.id, aenderungen: [], hinweise: [],
          });
        }

        const neu: Eingangsrechnung = { ...alt, ...aenderungen };
        if (neu.status === "bezahlt" && !neu.bezahlt_am) {
          throw new Error("Status 'bezahlt' ohne Zahldatum ist nicht zulässig. bezahlt_am (JJJJ-MM-TT) mitgeben.");
        }
        if (neu.status === "freigegeben" && !neu.freigegeben_am) {
          throw new Error("Status 'freigegeben' ohne Freigabedatum ist nicht zulässig. freigegeben_am mitgeben.");
        }
        if (neu.betrag_netto_eur < 0) throw new Error("Ein negativer Nettobetrag ist nicht zulässig.");

        const hinweise: string[] = [];
        const ve = store.daten.baukosten.vergabeeinheiten.find((v) => v.id === alt.vergabeeinheit_id);
        if (ve) {
          const stand = veStand(store, ve);
          const summeDanach = stand.abgerechnet_eur - alt.betrag_netto_eur + neu.betrag_netto_eur;
          if (stand.beauftragt_inkl_nachtraege_eur && summeDanach > stand.beauftragt_inkl_nachtraege_eur + 0.01) {
            hinweise.push(
              `WARNUNG: Rechnungen dieser Vergabeeinheit danach ${eur(summeDanach)}, beauftragt inkl. ` +
                `Nachträgen ${eur(stand.beauftragt_inkl_nachtraege_eur)}. Fehlt ein Nachtrag?`,
            );
          }
        }

        const diff = Object.entries(aenderungen).map(([feld, nachher]) => ({
          feld,
          vorher: alt[feld as keyof Eingangsrechnung],
          nachher,
        }));

        let gespeichert = false;
        if (!p.vorschau) {
          Object.assign(alt, aenderungen);
          store.speichern();
          gespeichert = true;
        }

        const md = [
          `# Rechnung ${alt.rechnungsnummer ?? alt.id}`,
          "",
          gespeichert
            ? `**Gespeichert.** ${diff.length} Feld(er) geändert.`
            : `**Vorschau — nichts gespeichert.** ${diff.length} Feld(er) würden sich ändern.`,
          "",
          tabelle(["Feld", "Vorher", "Nachher"], diff.map((d) => [d.feld, zeige(d.vorher), zeige(d.nachher)])),
          hinweise.length ? "\n" + hinweise.map((h) => `- ${h}`).join("\n") : "",
          gespeichert ? "" : `\n${HINWEIS_SPEICHERN}`,
        ].join("\n");

        return antwort(md, { gespeichert, rechnung_id: alt.id, aenderungen: diff, hinweise });
      }),
  );

  server.registerTool(
    "projekttool_nachtrag_anlegen",
    {
      title: "Nachtrag anlegen",
      description:
        "Legt einen Nachtrag zu einer Vergabeeinheit an -- der übliche Weg, wenn Rechnungen den " +
        "Auftrag übersteigen. ARBEITSWEISE: erst vorschau=true, zeigen, Zustimmung, dann " +
        "vorschau=false. Status 'beauftragt' erhöht den Auftrag, 'erwartet' nur die Prognose, " +
        "'abgelehnt' wirkt nirgends. Berührt nur Geldkreis BAUKOSTEN, nie das Honorar.",
      inputSchema: {
        vergabeeinheit_id: z.string().describe("ID aus projekttool_vergabeeinheiten, z.B. 've-12'."),
        bezeichnung: z.string().min(3, "Bitte die Leistung des Nachtrags benennen."),
        betrag_eur: z.number().min(0, "Ein negativer Nachtragsbetrag ist nicht zulässig."),
        status: z.enum(["erwartet", "beauftragt", "abgelehnt"]).default("erwartet"),
        nummer: z.string().optional(),
        vorschau: vorschauFeld,
      },
      annotations: { ...schreibend, destructiveHint: false },
    },
    async (p) =>
      sicher(() => {
        const ve = store.daten.baukosten.vergabeeinheiten.find((v) => v.id === p.vergabeeinheit_id);
        if (!ve) {
          throw new Error(`Keine Vergabeeinheit mit der ID ${p.vergabeeinheit_id}. Erst projekttool_vergabeeinheiten aufrufen.`);
        }
        const vorher = veStand(store, ve);
        const nachtrag: Nachtrag = {
          id: store.neueId("n", store.daten.baukosten.nachtraege),
          vergabeeinheit_id: ve.id,
          nummer: p.nummer ?? null,
          bezeichnung: p.bezeichnung,
          betrag_eur: p.betrag_eur,
          status: p.status,
        };

        const beauftragtNachher =
          p.status === "beauftragt" && vorher.beauftragt_inkl_nachtraege_eur !== null
            ? vorher.beauftragt_inkl_nachtraege_eur + p.betrag_eur
            : vorher.beauftragt_inkl_nachtraege_eur;

        // Kontrollrechnung: das Honorar des Projekts darf sich durch einen Nachtrag nie ändern.
        const honorarVorher = honorarStand(store, ve.projekt_id).angeboten_eur;

        let gespeichert = false;
        if (!p.vorschau) {
          store.daten.baukosten.nachtraege.push(nachtrag);
          store.speichern();
          gespeichert = true;
        }

        const honorarNachher = honorarStand(store, ve.projekt_id).angeboten_eur;
        if (honorarNachher !== honorarVorher) {
          throw new Error("Interner Fehler: Nachtrag hat das Honorar verändert. Geldkreise vermischt.");
        }

        const md = [
          `# Nachtrag zu VE ${ve.nummer ?? ""} ${ve.name}`,
          "",
          gespeichert ? "**Angelegt.**" : "**Vorschau — nichts gespeichert.**",
          "",
          tabelle(
            ["Nummer", "Bezeichnung", "Betrag", "Status"],
            [[nachtrag.nummer ?? "–", nachtrag.bezeichnung, eur(nachtrag.betrag_eur), nachtrag.status]],
          ),
          "",
          `Auftrag inkl. Nachträgen: ${eur(vorher.beauftragt_inkl_nachtraege_eur)} → **${eur(beauftragtNachher)}**`,
          gespeichert ? "" : `\n${HINWEIS_SPEICHERN}`,
        ].join("\n");

        return antwort(md, {
          gespeichert,
          nachtrag,
          wirkung: {
            beauftragt_vorher_eur: vorher.beauftragt_inkl_nachtraege_eur,
            beauftragt_nachher_eur: beauftragtNachher,
          },
        });
      }),
  );
}
