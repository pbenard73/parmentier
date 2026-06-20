import { Puzzle } from './types';

export type BridgeCounts = Map<number, number>; // edgeId -> bridge count

export const getCount = (counts: BridgeCounts, edgeId: number): number =>
  counts.get(edgeId) ?? 0;

/** Sum of bridges currently connected to each island. */
export function islandTotals(puzzle: Puzzle, counts: BridgeCounts): Map<number, number> {
  const totals = new Map<number, number>();
  for (const isl of puzzle.islands) totals.set(isl.id, 0);
  for (const edge of puzzle.edges) {
    const n = getCount(counts, edge.id);
    if (n === 0) continue;
    totals.set(edge.a, (totals.get(edge.a) ?? 0) + n);
    totals.set(edge.b, (totals.get(edge.b) ?? 0) + n);
  }
  return totals;
}

/**
 * Would placing/raising a bridge on `edgeId` cross an existing (count > 0)
 * perpendicular bridge? Crossings are precomputed on the puzzle.
 */
export function wouldCross(
  puzzle: Puzzle,
  edgeId: number,
  counts: BridgeCounts,
): boolean {
  for (const [h, v] of puzzle.crossings) {
    const other = h === edgeId ? v : v === edgeId ? h : -1;
    if (other === -1) continue;
    if (getCount(counts, other) > 0) return true;
  }
  return false;
}

/** All islands connected through active bridges into a single component. */
export function isConnected(puzzle: Puzzle, counts: BridgeCounts): boolean {
  if (puzzle.islands.length === 0) return false;
  const adj = new Map<number, number[]>();
  for (const isl of puzzle.islands) adj.set(isl.id, []);
  for (const edge of puzzle.edges) {
    if (getCount(counts, edge.id) > 0) {
      adj.get(edge.a)!.push(edge.b);
      adj.get(edge.b)!.push(edge.a);
    }
  }
  const seen = new Set<number>();
  const stack = [puzzle.islands[0].id];
  seen.add(puzzle.islands[0].id);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nb of adj.get(cur)!) {
      if (!seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return seen.size === puzzle.islands.length;
}

export interface SolveState {
  solved: boolean;
  satisfied: Map<number, boolean>; // island id -> exactly met
  over: Map<number, boolean>; // island id -> too many bridges
  remaining: number; // count of unsatisfied islands
}

export function evaluate(puzzle: Puzzle, counts: BridgeCounts): SolveState {
  const totals = islandTotals(puzzle, counts);
  const satisfied = new Map<number, boolean>();
  const over = new Map<number, boolean>();
  let remaining = 0;
  let allExact = true;
  for (const isl of puzzle.islands) {
    const t = totals.get(isl.id) ?? 0;
    const exact = t === isl.value;
    satisfied.set(isl.id, exact);
    over.set(isl.id, t > isl.value);
    if (!exact) {
      allExact = false;
      remaining++;
    }
  }
  const solved = allExact && isConnected(puzzle, counts);
  return { solved, satisfied, over, remaining };
}
