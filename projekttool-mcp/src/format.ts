/** Ausgabe-Hilfen: Euro, Prozent, Markdown-Tabellen und die einheitliche Werkzeug-Antwort. */

export const CHARACTER_LIMIT = 25_000;

export type ToolAntwort = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
};

export function eur(wert: number | null | undefined): string {
  if (wert === null || wert === undefined) return "–";
  return wert.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function pct(wert: number | null | undefined): string {
  if (wert === null || wert === undefined) return "–";
  return `${wert.toFixed(0)} %`;
}

export function tabelle(kopf: string[], zeilen: string[][]): string {
  if (!zeilen.length) return "_(keine Einträge)_";
  const trenner = kopf.map(() => "---");
  return [kopf, trenner, ...zeilen].map((z) => `| ${z.join(" | ")} |`).join("\n");
}

/**
 * Jede Antwort trägt beides: Markdown für den Menschen im Chat und strukturierte
 * Daten für das Modell. Zu lange Texte werden gekürzt statt den Kontext zu fluten.
 */
export function antwort(markdown: string, daten: Record<string, unknown>): ToolAntwort {
  const text =
    markdown.length > CHARACTER_LIMIT
      ? markdown.slice(0, CHARACTER_LIMIT) + "\n\n… gekürzt. Abfrage eingrenzen, um den Rest zu sehen."
      : markdown;
  return { content: [{ type: "text", text }], structuredContent: daten };
}

export function fehler(nachricht: string): ToolAntwort {
  return { content: [{ type: "text", text: `Fehler: ${nachricht}` }], isError: true };
}

/**
 * Einheitliche Fehlerbehandlung: ein fachlicher Fehler wird als lesbare Meldung
 * an das Modell zurückgegeben, nicht als Absturz des Servers.
 */
export async function sicher(ausfuehren: () => Promise<ToolAntwort> | ToolAntwort): Promise<ToolAntwort> {
  try {
    return await ausfuehren();
  } catch (e) {
    return fehler(e instanceof Error ? e.message : String(e));
  }
}
