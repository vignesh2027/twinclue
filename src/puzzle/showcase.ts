import type { Puzzle } from './types.js';

/**
 * Tables whose answers are generic things, not someone's trademark. Game characters are left out, so a video or a
 * VIDEO_SAFE stream never shows a third-party character or brand.
 */
export const VIDEO_SAFE_TABLES: ReadonlySet<string> = new Set(['countries', 'animals', 'foods and dishes', 'musical instruments', 'space objects', 'sports']);

/** Only audited, forged puzzles qualify: they carry the fact table they came from. */
export function isVideoSafe(puzzle: Puzzle): boolean {
  return Boolean(puzzle.sourceTable && VIDEO_SAFE_TABLES.has(puzzle.sourceTable));
}

/**
 * Eight lively audited puzzles for the demo and the video, one or two per category. Their wording is the audited
 * wording: changing a clue would need a fresh blind audit.
 */
export const SHOWCASE_IDS = [
  'forge-836ad8450a', // Japan
  'forge-161e9d7023', // penguin
  'forge-3d42d657d0', // tom yum
  'forge-bfb227a198', // bansuri
  'forge-289c87bf59', // Switzerland
  'forge-ac5b802003', // Mars
  'forge-ed80615956', // falafel
  'forge-09857ed25d', // badminton
] as const;

export function showcasePuzzles(pack: Puzzle[]): Puzzle[] {
  const byId = new Map(pack.map(puzzle => [puzzle.id, puzzle]));
  return SHOWCASE_IDS.map(id => byId.get(id)).filter((puzzle): puzzle is Puzzle => Boolean(puzzle) && isVideoSafe(puzzle!));
}
