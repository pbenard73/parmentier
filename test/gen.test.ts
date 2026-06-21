import { generatePuzzle } from '../src/game/generator';
import { evaluate, BridgeCounts, wouldCross } from '../src/game/rules';
import { Difficulty, GameConfig } from '../src/game/types';

const diffs: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];
const sizes = [5, 7, 9, 13, 18, 25];
const maxes = [1, 2, 3, 5, 11];

let runs = 0;
let failures = 0;

for (const difficulty of diffs) {
  for (const n of sizes) {
    for (const maxBridges of maxes) {
      for (let s = 0; s < 8; s++) {
        runs++;
        const config: GameConfig = {
          cols: n,
          rows: n,
          maxBridges,
          difficulty,
          seed: s * 7919 + n * 31 + maxBridges,
        };
        const puzzle = generatePuzzle(config);

        // build the intended solution from edge.solution
        const counts: BridgeCounts = new Map();
        for (const e of puzzle.edges) if (e.solution > 0) counts.set(e.id, e.solution);

        const state = evaluate(puzzle, counts);

        const problems: string[] = [];
        if (puzzle.islands.length < 2) problems.push('too few islands');
        if (!state.solved) problems.push('solution not solved');
        // solution must never include crossing bridges
        for (const e of puzzle.edges) {
          if (e.solution > 0 && wouldCross(puzzle, e.id, counts)) {
            // wouldCross checks OTHER active perpendicular edges
            problems.push(`solution crosses at edge ${e.id}`);
            break;
          }
        }
        // every clue within range
        for (const isl of puzzle.islands) {
          if (isl.value < 1) problems.push(`island ${isl.id} value < 1`);
        }
        // noLoops is on by default: a connected loop-free network is a tree,
        // so it must have exactly (islands - 1) active solution edges.
        const activeEdges = puzzle.edges.filter((e) => e.solution > 0).length;
        if (activeEdges !== puzzle.islands.length - 1) {
          problems.push(
            `loop present: ${activeEdges} edges for ${puzzle.islands.length} islands`,
          );
        }

        if (problems.length) {
          failures++;
          if (failures <= 10) {
            console.error(
              `FAIL ${difficulty} ${n}x${n} max=${maxBridges} seed=${config.seed}: ${problems.join(', ')} (islands=${puzzle.islands.length})`,
            );
          }
        }
      }
    }
  }
}

console.log(`\nran ${runs} puzzles, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
