import { readFileSync } from "node:fs";
import { DatenStore } from "../dist/store.js";

export const STICHTAG = "2026-10-01";

/** Frische Demodaten im Speicher -- kein Test schreibt auf die Platte. */
export function demoStore() {
  const daten = JSON.parse(readFileSync(new URL("../daten/demo.json", import.meta.url), "utf-8"));
  return DatenStore.imSpeicher(daten);
}
