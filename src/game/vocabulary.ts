import { normaliseGuess } from './referee.js';

export interface VocabEntry { name: string; aliases: string[] }

const MAX_CACHE = 50_000;

function threshold(length: number): number { return length <= 4 ? 1 : length <= 8 ? 2 : 3; }

/** Levenshtein distance with an early exit once every cell in a row exceeds the limit. */
function boundedDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
      if (current[j]! < rowMin) rowMin = current[j]!;
    }
    if (rowMin > limit) return limit + 1;
    [previous, current] = [current, previous];
  }
  return previous[b.length]!;
}

/**
 * The closed set of answers a round's vote bars may display: every entity of the puzzle's fact table.
 * Every entity is matched the same way (exact name or alias, then a close spelling), so the way a vote is
 * grouped never reveals which entity is the answer.
 */
export class Vocabulary {
  private readonly exact = new Map<string, string>();
  private readonly labels = new Map<string, string>();
  private readonly targets: Array<{ text: string; key: string }> = [];
  private readonly cache = new Map<string, string | null>();
  readonly answerKey: string;

  constructor(answer: VocabEntry, entries: VocabEntry[]) {
    this.answerKey = this.add(answer);
    for (const entry of entries) this.add(entry);
  }

  private add(entry: VocabEntry): string {
    const names = [entry.name, ...entry.aliases].map(normaliseGuess).filter(Boolean);
    const existing = names.map(name => this.exact.get(name)).find(Boolean);
    if (existing) return existing;
    const key = `v${this.labels.size}`;
    this.labels.set(key, entry.name);
    for (const name of names) {
      if (this.exact.has(name)) continue;
      this.exact.set(name, key);
      this.targets.push({ text: name, key });
    }
    return key;
  }

  get size(): number { return this.labels.size; }
  label(key: string): string | undefined { return this.labels.get(key); }
  has(key: string): boolean { return this.labels.has(key); }

  /** Returns the entity key for a normalised vote, or null when the vote is not a known entity. */
  match(normalised: string): string | null {
    const exact = this.exact.get(normalised);
    if (exact) return exact;
    const cached = this.cache.get(normalised);
    if (cached !== undefined) return cached;
    let best: string | null = null;
    let bestDistance = Infinity;
    let tie = false;
    for (const target of this.targets) {
      const limit = threshold(target.text.length);
      const distance = boundedDistance(normalised, target.text, limit);
      if (distance > limit) continue;
      if (distance < bestDistance) { best = target.key; bestDistance = distance; tie = false; }
      else if (distance === bestDistance && target.key !== best) tie = true;
    }
    const result = tie ? null : best;
    if (this.cache.size >= MAX_CACHE) this.cache.clear();
    this.cache.set(normalised, result);
    return result;
  }
}
