import { generatePuzzle } from '../src/game/generator';
import { solve, nextHint } from '../src/game/solver';
import { evaluate, BridgeCounts, getCount } from '../src/game/rules';
import { Difficulty, GameConfig } from '../src/game/types';

const diffs: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];
const sizes = [5, 7, 9, 13, 18];
const maxes = [1, 2, 3, 11];

let runs = 0;
let failures = 0;

for (const difficulty of diffs) {
  for (const n of sizes) {
    for (const maxBridges of maxes) {
      for (let s = 0; s < 6; s++) {
        runs++;
        const config: GameConfig = {
          cols: n,
          rows: n,
          maxBridges,
          difficulty,
          seed: s * 104729 + n * 17 + maxBridges,
        };
        const puzzle = generatePuzzle(config);
        const problems: string[] = [];

        // solver must not report a contradiction on a valid puzzle
        if (!solve(puzzle).ok) problems.push('solver reports contradiction');

        // the hint engine, played to the end, must solve the puzzle
        const counts: BridgeCounts = new Map();
        let steps = 0;
        const cap = puzzle.edges.length * (maxBridges + 1) + 50;
        while (!evaluate(puzzle, counts).solved && steps < cap) {
          const h = nextHint(puzzle, counts);
          if (!h) break;
          const cur = getCount(counts, h.edgeId);
          if (h.to === 0) counts.delete(h.edgeId);
          else counts.set(h.edgeId, h.to);
          if (getCount(counts, h.edgeId) === cur) {
            problems.push('hint made no progress');
            break;
          }
          steps++;
        }
        if (!evaluate(puzzle, counts).solved) {
          problems.push('hints did not reach a solution');
        }

        if (problems.length) {
          failures++;
          if (failures <= 12) {
            console.error(
              `FAIL ${difficulty} ${n}x${n} max=${maxBridges} seed=${config.seed}: ${problems.join(', ')}`,
            );
          }
        }
      }
    }
  }
}

console.log(`\nran ${runs} puzzles through the hint engine, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
