import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DatenStore } from "./store.js";
import { registriereLesendeWerkzeuge } from "./tools/lesen.js";
import { registriereSchreibendeWerkzeuge } from "./tools/schreiben.js";

export const SERVER_NAME = "projekttool-mcp-demo";
export const SERVER_VERSION = "1.0.0";

/**
 * Diese Anleitung reist mit dem Server zum Modell. Sie ist die wichtigste Zeile des
 * ganzen Projekts: Sie legt die Regeln fest, bevor das erste Werkzeug aufgerufen wird.
 */
export const ANLEITUNG =
  "Werkzeuge für das Projekt-Controlling eines Architekturbüros. Zwei Geldkreise, die nie " +
  "vermischt werden dürfen: HONORAR ist das Geld des Büros (Leistungen, Stunden, Abrechnung), " +
  "BAUKOSTEN ist das Geld des Bauherrn (Vergabeeinheiten, Nachträge, Rechnungen der Firmen). " +
  "Projekte lassen sich per Namensteil ansprechen. Vor jeder Korrektur erst " +
  "projekttool_datenpruefung oder ein Detail-Werkzeug aufrufen. Schreibende Werkzeuge laufen " +
  "standardmäßig als Vorschau (vorschau=true) und speichern erst mit vorschau=false -- vorher " +
  "immer die ausdrückliche Zustimmung des Menschen holen.";

export function erstelleServer(store: DatenStore, optionen: { nurLesen: boolean }): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: ANLEITUNG },
  );
  registriereLesendeWerkzeuge(server, store);
  // Im Nur-Lesen-Betrieb gibt es die schreibenden Werkzeuge gar nicht.
  // Was nicht existiert, kann auch nicht versehentlich aufgerufen werden.
  if (!optionen.nurLesen) registriereSchreibendeWerkzeuge(server, store);
  return server;
}
