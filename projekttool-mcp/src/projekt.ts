import type { DatenStore, Projekt } from "./store.js";

/**
 * Löst eine Projektangabe auf -- ID oder Namensteil.
 *
 * Niemand tippt IDs. Im Büro sagt man "Lindenweg", und genau das muss reichen.
 * Bei mehreren Treffern wird nicht geraten, sondern die Auswahl zurückgemeldet.
 */
export function findeProjekt(store: DatenStore, bezeichnung: string): Projekt {
  const suche = bezeichnung.trim().toLowerCase();
  const alle = store.daten.projekte;

  const perId = alle.find((p) => p.id.toLowerCase() === suche);
  if (perId) return perId;

  const treffer = alle.filter((p) => p.name.toLowerCase().includes(suche));
  if (treffer.length === 0) {
    throw new Error(
      `Kein Projekt gefunden zu "${bezeichnung}". Vorhanden sind: ${alle.map((p) => p.name).join(", ")}`,
    );
  }
  if (treffer.length > 1) {
    const exakt = treffer.find((p) => p.name.toLowerCase() === suche);
    if (exakt) return exakt;
    throw new Error(
      `"${bezeichnung}" passt auf mehrere Projekte: ${treffer.map((p) => p.name).join(", ")}. ` +
        `Bitte genauer benennen.`,
    );
  }
  return treffer[0]!;
}
