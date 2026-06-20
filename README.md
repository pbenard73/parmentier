# NEXUS BRIDGES — Hashi / Bridges (sci-fi)

A **Hashiwokakero** (a.k.a. Bridges / `sgt-bridges`) puzzle game built with
**React + Phaser 3 + TypeScript**, with a neon sci-fi theme.

Connect the glowing nodes with conduits (bridges) so that:

- each node carries exactly as many conduits as its number,
- no two conduits cross,
- every node ends up linked into a single network.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Controls

- **Drag** from a node toward a neighbour to lay a conduit.
- **Drag again** to add more; cycling past the configured maximum clears it.
- **Right-click / drag** removes one conduit.

## Learning tools

- **MODE ENFANT** (child mode, left panel) — turns on learning aids: brighter
  candidate connections, a `-N` badge under each island showing how many bridges
  it still needs, a French step-by-step tutorial, and a one-click **PARTIE
  FACILE** (easy 7×7 game).
- **💡 INDICE** (hint) — a constraint-propagation solver finds the next
  *logically forced* move, highlights it (pulsing), and explains *why* in plain
  French. **JOUER CET INDICE** plays it for you. It also flags mistakes
  (“too many bridges here”).
- **✓ RÉSOUDRE** (solve) — fills in the complete solution.

## Configuration (left panel)

- **Grid width / height** — 5 … 25.
- **Max conduits** — maximum bridges between two nodes, **1 … 11**.
- **Threat level** — `CADET` / `PILOT` / `COMMANDER` / `SINGULARITY`
  (easy → insane): controls node density, cycles and bridge weighting.

Press **DEPLOY NETWORK** to generate a fresh puzzle with the current settings.

## How it works

| Area | File |
| --- | --- |
| Types & constants | `src/game/types.ts` |
| Puzzle generator (constructive, always solvable) | `src/game/generator.ts` |
| Rules: clue totals, crossings, connectivity, win check | `src/game/rules.ts` |
| Constraint-propagation solver + teaching hints | `src/game/solver.ts` |
| Phaser scene: rendering + input | `src/game/scenes/BridgesScene.ts` |
| React ↔ Phaser bridge | `src/game/EventBus.ts`, `src/game/PhaserGame.tsx` |
| UI: config panel, HUD, win overlay | `src/ui/*`, `src/App.tsx` |
| Theme / palette | `src/game/theme.ts`, `src/styles/global.css` |

The generator grows a connected island/bridge network (guaranteeing a valid,
crossing-free, connected solution), then exposes the full set of line-of-sight
candidate edges — most carrying zero bridges — so the player has a genuine
puzzle to solve.

### Tests

A self-checking validation harness generates ~1000 puzzles across every
difficulty, grid size and max-bridge value and asserts each intended solution
is fully valid:

```bash
# generator: every intended solution is valid (clues, connectivity, no crossings)
npx esbuild test/gen.test.ts --bundle --format=esm --platform=node --outfile=/tmp/gen.mjs && node /tmp/gen.mjs

# solver / hint engine: playing hints to the end solves every puzzle
npx esbuild test/solver.test.ts --bundle --format=esm --platform=node --outfile=/tmp/solver.mjs && node /tmp/solver.mjs
```
