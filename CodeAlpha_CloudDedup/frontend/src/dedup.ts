export const SIMILARITY_THRESHOLD = 0.82;

export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bigrams(value: string): string[] {
  if (value.length < 2) return [value];

  const result: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    result.push(value.slice(index, index + 2));
  }
  return result;
}

export function similarity(first: string, second: string): number {
  if (first === second) return 1;

  const a = bigrams(first);
  const b = bigrams(second);
  const remaining = [...b];
  let matches = 0;

  for (const pair of a) {
    const position = remaining.indexOf(pair);
    if (position !== -1) {
      matches += 1;
      remaining.splice(position, 1);
    }
  }

  if (a.length + b.length === 0) return 1;
  return (2 * matches) / (a.length + b.length);
}

export function recordSimilarity(
  normalizedTitle: string,
  normalizedDescription: string,
  existingTitle: string,
  existingDescription: string
): number {
  return (
    similarity(normalizedTitle, existingTitle) +
    similarity(normalizedDescription, existingDescription)
  ) / 2;
}
