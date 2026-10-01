#!/usr/bin/env node
/**
 * Startpunkt (stdio). Claude Desktop oder Claude Code starten diesen Prozess selbst.
 *
 * Umgebungsvariablen:
 *   PROJEKTTOOL_DATEN     Pfad zur Datendatei. Standard: daten/arbeitskopie.json
 *                         (wird beim ersten Start aus daten/demo.json angelegt).
 *   PROJEKTTOOL_READONLY  "1" = nur lesende Werkzeuge anbieten.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { erstelleServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import { DatenStore } from "./store.js";

const basis = join(dirname(fileURLToPath(import.meta.url)), "..");
const pfad = process.env.PROJEKTTOOL_DATEN ?? join(basis, "daten", "arbeitskopie.json");
const nurLesen = ["1", "true", "ja"].includes((process.env.PROJEKTTOOL_READONLY ?? "").trim().toLowerCase());

async function main(): Promise<void> {
  const store = DatenStore.ausDatei(pfad, join(basis, "daten", "demo.json"));
  const server = erstelleServer(store, { nurLesen });
  await server.connect(new StdioServerTransport());
  // stderr, nicht stdout: stdout gehört dem MCP-Protokoll.
  console.error(`${SERVER_NAME} ${SERVER_VERSION} läuft (${nurLesen ? "nur lesen" : "lesen und schreiben"}), Daten: ${pfad}`);
}

main().catch((e: unknown) => {
  console.error("Serverfehler:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
