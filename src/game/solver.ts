import { Puzzle } from './types';
import { BridgeCounts, getCount } from './rules';

interface Bounds {
  lo: number;
  hi: number;
}

export interface SolveResult {
  bounds: Map<number, Bounds>; // edgeId -> [lo, hi] proven in every solution
  ok: boolean; // no contradiction found
  solved: boolean; // every edge pinned (lo === hi)
}

export interface Hint {
  edgeId: number;
  /** target bridge count the player should move this edge to */
  to: number;
  /** +1 add, -1 remove */
  delta: number;
  kind: 'fix-error' | 'forced' | 'solution';
  /** child-friendly explanation (French) */
  reason: string;
}

const incidentEdges = (puzzle: Puzzle) => {
  const map = new Map<number, number[]>();
  for (const isl of puzzle.islands) map.set(isl.id, []);
  for (const e of puzzle.edges) {
    map.get(e.a)!.push(e.id);
    map.get(e.b)!.push(e.id);
  }
  return map;
};

/**
 * Constraint-propagation solver. Derives, for every candidate edge, the bridge
 * count range that holds in *all* valid solutions. Used to produce logical
 * hints and to detect contradictions.
 */
export function solve(puzzle: Puzzle): SolveResult {
  const max = puzzle.config.maxBridges;
  const bounds = new Map<number, Bounds>();
  const islandById = new Map(puzzle.islands.map((i) => [i.id, i]));
  const incident = incidentEdges(puzzle);

  for (const e of puzzle.edges) {
    const va = islandById.get(e.a)!.value;
    const vb = islandById.get(e.b)!.value;
    bounds.set(e.id, { lo: 0, hi: Math.min(max, va, vb) });
  }

  let ok = true;
  let changed = true;
  let guard = 0;

  while (changed && ok && guard++ < 10000) {
    changed = false;

    // island capacity constraints
    for (const isl of puzzle.islands) {
      const es = incident.get(isl.id)!;
      let sumLo = 0;
      let sumHi = 0;
      for (const id of es) {
        sumLo += bounds.get(id)!.lo;
        sumHi += bounds.get(id)!.hi;
      }
      if (sumHi < isl.value || sumLo > isl.value) {
        ok = false;
        break;
      }
      for (const id of es) {
        const b = bounds.get(id)!;
        const newLo = Math.max(b.lo, isl.value - (sumHi - b.hi));
        const newHi = Math.min(b.hi, isl.value - (sumLo - b.lo));
        if (newLo > b.lo) {
          b.lo = newLo;
          changed = true;
        }
        if (newHi < b.hi) {
          b.hi = newHi;
          changed = true;
        }
        if (b.lo > b.hi) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (!ok) break;

    // crossing constraints: a forced bridge forbids any crossing edge
    for (const [h, v] of puzzle.crossings) {
      const bh = bounds.get(h)!;
      const bv = bounds.get(v)!;
      if (bh.lo >= 1 && bv.hi > 0) {
        bv.hi = 0;
        changed = true;
      }
      if (bv.lo >= 1 && bh.hi > 0) {
        bh.hi = 0;
        changed = true;
      }
      if (bh.lo > bh.hi || bv.lo > bv.hi) {
        ok = false;
        break;
      }
    }
  }

  let solved = ok;
  for (const b of bounds.values()) if (b.lo !== b.hi) solved = false;

  return { bounds, ok, solved };
}

/** The generator's stored solution as concrete bridge counts (always valid). */
export function fullSolution(puzzle: Puzzle): BridgeCounts {
  const counts: BridgeCounts = new Map();
  for (const e of puzzle.edges) if (e.solution > 0) counts.set(e.id, e.solution);
  return counts;
}

/**
 * Next teaching hint given the player's current bridges:
 *  1. flag an obvious over-connection (too many bridges),
 *  2. otherwise reveal a logically forced bridge with its reasoning,
 *  3. otherwise fall back to the stored solution.
 */
export function nextHint(puzzle: Puzzle, counts: BridgeCounts): Hint | null {
  const { bounds } = solve(puzzle);
  const islandById = new Map(puzzle.islands.map((i) => [i.id, i]));
  const incident = incidentEdges(puzzle);

  // 1. correction: player placed more than is ever possible here
  for (const e of puzzle.edges) {
    const cur = getCount(counts, e.id);
    const b = bounds.get(e.id)!;
    if (cur > b.hi) {
      return {
        edgeId: e.id,
        to: b.hi,
        delta: -1,
        kind: 'fix-error',
        reason:
          b.hi === 0
            ? 'Ici, aucun pont n’est possible (il croiserait un autre pont). Retire-le.'
            : `Il y a trop de ponts ici : il n’en faut pas plus de ${b.hi}.`,
      };
    }
  }

  // 2. a forced bridge the player has not placed yet — pick the clearest one
  let best: Hint | null = null;
  let bestScore = Infinity;
  for (const e of puzzle.edges) {
    const cur = getCount(counts, e.id);
    const b = bounds.get(e.id)!;
    if (b.lo > cur) {
      // prefer the endpoint with the fewest still-open directions (clearest lesson)
      const score = Math.min(openDirs(e.a), openDirs(e.b));
      if (score < bestScore) {
        bestScore = score;
        const isl =
          openDirs(e.a) <= openDirs(e.b)
            ? islandById.get(e.a)!
            : islandById.get(e.b)!;
        best = {
          edgeId: e.id,
          to: cur + 1,
          delta: 1,
          kind: 'forced',
          reason: forcedReason(isl.value, openDirs(isl.id)),
        };
      }
    }
  }
  if (best) return best;

  // 3. fall back to the known solution
  for (const e of puzzle.edges) {
    const cur = getCount(counts, e.id);
    if (e.solution > cur) {
      return {
        edgeId: e.id,
        to: cur + 1,
        delta: 1,
        kind: 'solution',
        reason: 'D’après la solution, un pont de plus est nécessaire ici.',
      };
    }
  }

  return null; // nothing to suggest (already solved or fully consistent)

  function openDirs(islandId: number): number {
    let n = 0;
    for (const id of incident.get(islandId)!) {
      if (bounds.get(id)!.hi > 0) n++;
    }
    return n;
  }
}

function forcedReason(value: number, dirs: number): string {
  if (dirs <= 1) {
    return `Cette île (${value}) n’a plus qu’une seule connexion possible : le pont doit passer par ici.`;
  }
  return `Cette île a besoin de ${value} ponts au total : avec ses connexions restantes, celui-ci est obligatoire.`;
}
