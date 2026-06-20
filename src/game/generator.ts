import {
  Difficulty,
  Edge,
  GameConfig,
  Island,
  Puzzle,
} from './types';

/** Deterministic PRNG (mulberry32) so puzzles are reproducible from a seed. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DiffParams {
  density: number; // fraction of cells that become islands
  crossChance: number; // probability of adding a cycle-creating link
  countSkew: number; // >1 favours fewer bridges per link
}

const DIFFICULTY: Record<Difficulty, DiffParams> = {
  easy: { density: 0.1, crossChance: 0.04, countSkew: 3.0 },
  normal: { density: 0.14, crossChance: 0.1, countSkew: 2.0 },
  hard: { density: 0.18, crossChance: 0.18, countSkew: 1.5 },
  insane: { density: 0.22, crossChance: 0.28, countSkew: 1.0 },
};

const EMPTY = -1;
const BRIDGE_H = -2;
const BRIDGE_V = -3;

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Constructive generator: grows a connected network of islands and bridges,
 * which guarantees the resulting puzzle is solvable. The full set of
 * line-of-sight candidate edges is then exposed (most with 0 bridges) so the
 * player has a genuine puzzle to reason about.
 */
export function generatePuzzle(config: GameConfig): Puzzle {
  const seed = config.seed ?? Math.floor(Math.random() * 0xffffffff);

  // a few attempts in case a tiny grid produces a degenerate layout
  for (let attempt = 0; attempt < 12; attempt++) {
    const puzzle = build(config, seed + attempt * 1013904223);
    if (puzzle && puzzle.islands.length >= 2) return puzzle;
  }
  // fall back to a trivially valid 2-island puzzle
  return build({ ...config, difficulty: 'easy' }, seed) ?? trivial(config);
}

function build(config: GameConfig, seed: number): Puzzle | null {
  const { cols, rows } = config;
  const maxBridges = Math.max(1, Math.min(11, Math.round(config.maxBridges)));
  const params = DIFFICULTY[config.difficulty];
  const rng = makeRng(seed);
  const randInt = (n: number) => Math.floor(rng() * n);

  const grid: number[] = new Array(cols * rows).fill(EMPTY);
  const at = (c: number, r: number) => grid[r * cols + c];
  const set = (c: number, r: number, v: number) => {
    grid[r * cols + c] = v;
  };
  const inside = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows;

  const islands: Island[] = [];
  const solution = new Map<string, number>();

  const addIsland = (c: number, r: number): Island => {
    const island: Island = { id: islands.length, col: c, row: r, value: 0 };
    islands.push(island);
    set(c, r, island.id);
    return island;
  };

  const hasIslandNeighbor = (c: number, r: number) =>
    DIRS.some(([dc, dr]) => {
      const nc = c + dc;
      const nr = r + dr;
      return inside(nc, nr) && at(nc, nr) >= 0;
    });

  const pickCount = () => {
    const v = 1 + Math.floor(Math.pow(rng(), params.countSkew) * maxBridges);
    return Math.max(1, Math.min(maxBridges, v));
  };

  const connect = (a: Island, b: Island, orientation: 'h' | 'v') => {
    const count = pickCount();
    // mark intermediate cells so nothing else may occupy / cross them
    const stepC = Math.sign(b.col - a.col);
    const stepR = Math.sign(b.row - a.row);
    let c = a.col + stepC;
    let r = a.row + stepR;
    const mark = orientation === 'h' ? BRIDGE_H : BRIDGE_V;
    while (c !== b.col || r !== b.row) {
      set(c, r, mark);
      c += stepC;
      r += stepR;
    }
    solution.set(pairKey(a.id, b.id), count);
    a.value += count;
    b.value += count;
  };

  // seed the first island roughly centred
  addIsland(
    Math.floor(cols / 2 - 2 + randInt(4)),
    Math.floor(rows / 2 - 2 + randInt(4)),
  );

  const targetIslands = Math.max(
    2,
    Math.min(
      Math.round(cols * rows * params.density),
      Math.floor((cols * rows) / 3),
    ),
  );

  let attempts = 0;
  const maxAttempts = 6000;
  while (islands.length < targetIslands && attempts < maxAttempts) {
    attempts++;
    const src = islands[randInt(islands.length)];
    const dirs = shuffle(DIRS, rng);

    let grew = false;
    for (const [dc, dr] of dirs) {
      const orientation: 'h' | 'v' = dc !== 0 ? 'h' : 'v';
      const empties: Array<[number, number, number]> = []; // c, r, dist
      let obstacleIsland = -1;
      let obstacleDist = 0;

      for (let dist = 1; ; dist++) {
        const c = src.col + dc * dist;
        const r = src.row + dr * dist;
        if (!inside(c, r)) break;
        const cell = at(c, r);
        if (cell === EMPTY) {
          empties.push([c, r, dist]);
          continue;
        }
        if (cell >= 0) {
          obstacleIsland = cell;
          obstacleDist = dist;
        }
        break; // any non-empty cell (island or bridge) blocks the ray
      }

      // Option A: cross-link to an existing island to create a cycle
      if (
        obstacleIsland >= 0 &&
        obstacleDist >= 2 &&
        !solution.has(pairKey(src.id, obstacleIsland)) &&
        rng() < params.crossChance
      ) {
        connect(src, islands[obstacleIsland], orientation);
        grew = true;
        break;
      }

      // Option B: plant a new island on an empty cell at distance >= 2
      const landable = empties.filter(
        ([c, r, dist]) => dist >= 2 && !hasIslandNeighbor(c, r),
      );
      if (landable.length > 0) {
        const [c, r] = landable[randInt(landable.length)];
        const next = addIsland(c, r);
        connect(src, next, orientation);
        grew = true;
        break;
      }
    }
    if (!grew) continue;
  }

  if (islands.length < 2) return null;

  return finalise(config, islands, solution, at, cols, rows);
}

/** Build the full candidate-edge set + crossing list from island geometry. */
function finalise(
  config: GameConfig,
  islands: Island[],
  solution: Map<string, number>,
  at: (c: number, r: number) => number,
  cols: number,
  rows: number,
): Puzzle {
  const edges: Edge[] = [];
  const pairKeyToEdge = new Map<string, number>();

  const addEdge = (a: number, b: number, orientation: 'h' | 'v') => {
    const id = edges.length;
    const key = pairKey(a, b);
    edges.push({ id, a, b, orientation, solution: solution.get(key) ?? 0 });
    pairKeyToEdge.set(key, id);
  };

  for (const isl of islands) {
    // nearest island to the right
    for (let c = isl.col + 1; c < cols; c++) {
      const cell = at(c, isl.row);
      if (cell >= 0) {
        addEdge(isl.id, cell, 'h');
        break;
      }
    }
    // nearest island below
    for (let r = isl.row + 1; r < rows; r++) {
      const cell = at(isl.col, r);
      if (cell >= 0) {
        addEdge(isl.id, cell, 'v');
        break;
      }
    }
  }

  // crossings: an h-edge and a v-edge that intersect geometrically
  const byId = new Map(islands.map((i) => [i.id, i]));
  const hEdges = edges.filter((e) => e.orientation === 'h');
  const vEdges = edges.filter((e) => e.orientation === 'v');
  const crossings: Array<[number, number]> = [];
  for (const h of hEdges) {
    const ha = byId.get(h.a)!;
    const hb = byId.get(h.b)!;
    const hr = ha.row;
    const hc1 = Math.min(ha.col, hb.col);
    const hc2 = Math.max(ha.col, hb.col);
    for (const v of vEdges) {
      const va = byId.get(v.a)!;
      const vb = byId.get(v.b)!;
      const vc = va.col;
      const vr1 = Math.min(va.row, vb.row);
      const vr2 = Math.max(va.row, vb.row);
      if (hc1 < vc && vc < hc2 && vr1 < hr && hr < vr2) {
        crossings.push([h.id, v.id]);
      }
    }
  }

  return { config, islands, edges, crossings };
}

function trivial(config: GameConfig): Puzzle {
  const islands: Island[] = [
    { id: 0, col: 0, row: 0, value: 1 },
    { id: 1, col: 2, row: 0, value: 1 },
  ];
  const edges: Edge[] = [{ id: 0, a: 0, b: 1, orientation: 'h', solution: 1 }];
  return { config, islands, edges, crossings: [] };
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
