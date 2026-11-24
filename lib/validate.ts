export const MAX_LENGTH = 500;
export const MIN_CYRILLIC_RATIO = 0.5;
export const ERROR_NOT_RUSSIAN = "Калякай по человечески, долбоеб!";
export const ERROR_EMPTY = "Введите фразу";
export const ERROR_TOO_LONG = `Слишком длинная фраза (максимум ${MAX_LENGTH} символов)`;

const CYRILLIC = /[Ѐ-ӿ]/;
const LETTER = /\p{L}/u;

/** Share of Cyrillic letters among all letters (0 when there are no letters). */
export function cyrillicRatio(text: string): number {
  let letters = 0;
  let cyrillic = 0;
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    letters++;
    if (CYRILLIC.test(ch)) cyrillic++;
  }
  return letters === 0 ? 0 : cyrillic / letters;
}

export function isMostlyCyrillic(text: string): boolean {
  return cyrillicRatio(text) >= MIN_CYRILLIC_RATIO;
}

export type ValidationResult = { ok: true; text: string } | { ok: false; error: string };

/** Shared by the client form and the API route. */
export function validateInput(value: unknown): ValidationResult {
  if (typeof value !== "string") return { ok: false, error: ERROR_EMPTY };
  const text = value.trim();
  if (text.length === 0) return { ok: false, error: ERROR_EMPTY };
  if (text.length > MAX_LENGTH) return { ok: false, error: ERROR_TOO_LONG };
  if (!isMostlyCyrillic(text)) return { ok: false, error: ERROR_NOT_RUSSIAN };
  return { ok: true, text };
}
