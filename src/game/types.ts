export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';

export interface GameConfig {
  /** number of columns in the grid */
  cols: number;
  /** number of rows in the grid */
  rows: number;
  /** maximum number of bridges allowed between two islands (1..11) */
  maxBridges: number;
  difficulty: Difficulty;
  /**
   * Forbid loops (cycles) in the generated solution network, like the
   * "no loops" option in Ubuntu's sgt-bridges. When true (the default) the
   * solution is a tree, so no island chain ever closes back on itself.
   */
  noLoops?: boolean;
  /** optional fixed seed for reproducible puzzles */
  seed?: number;
}

export interface Island {
  id: number;
  col: number;
  row: number;
  /** required total number of bridges connected to this island (its "clue") */
  value: number;
}

/** A potential connection between two aligned islands with clear line of sight. */
export interface Edge {
  id: number;
  a: number; // island id
  b: number; // island id
  orientation: 'h' | 'v';
  /** number of bridges in the solved puzzle (used by the generator only) */
  solution: number;
}

export interface Puzzle {
  config: GameConfig;
  islands: Island[];
  edges: Edge[];
  /** pairs of edge ids that would visually cross each other */
  crossings: Array<[number, number]>;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'CADET',
  normal: 'PILOT',
  hard: 'COMMANDER',
  insane: 'SINGULARITY',
};

export const MAX_BRIDGES_LIMIT = 11;
export const MIN_GRID = 5;
export const MAX_GRID = 25;
