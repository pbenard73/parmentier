# CLAUDE.md

Guidance for working in this repository.

## What this is

**NEXUS BRIDGES** — a Hashiwokakero (Bridges / `sgt-bridges`) puzzle game with a
neon sci-fi theme. Stack: **Vite + React 18 + Phaser 3 + TypeScript**. No backend.

## Commands

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # tsc -b && vite build  -> dist/
npm run preview    # serve the production build
npm run typecheck  # tsc -b --noEmit

# Tests — no test runner; bundle with esbuild, run with node:
npx esbuild test/gen.test.ts    --bundle --format=esm --platform=node --outfile=/tmp/gen.mjs    && node /tmp/gen.mjs
npx esbuild test/solver.test.ts --bundle --format=esm --platform=node --outfile=/tmp/solver.mjs && node /tmp/solver.mjs
```

Always run `npm run typecheck` and both tests after touching `game/` logic.

## Architecture

React renders the **chrome** (config panel, HUD, win overlay); Phaser renders the
**playfield** on a canvas. They never call each other directly — everything goes
through a singleton event bus.

```
React UI  ──emit──▶  EventBus (src/game/EventBus.ts)  ──emit──▶  BridgesScene (Phaser)
   ▲                                                                  │
   └──────────────────────── PROGRESS / HINT_INFO / SOLVED ◀──────────┘
```

- **UI → game:** `NEW_GAME`, `RESET`, `UNDO`, `HINT`, `APPLY_HINT`, `SOLVE`, `KID_MODE`
- **game → UI:** `READY`, `PROGRESS`, `HINT_INFO`, `SOLVED`

`PhaserGame.tsx` creates the Phaser game once, and on `READY` kicks off the first
`NEW_GAME` with the current config. A bumped `generation` prop triggers a fresh puzzle.

## Key files

| File | Responsibility |
| --- | --- |
| `src/game/types.ts` | Core types + constants (`MAX_BRIDGES_LIMIT`, grid bounds) |
| `src/game/generator.ts` | Constructive puzzle generator |
| `src/game/rules.ts` | Clue totals, crossing check, connectivity, win evaluation |
| `src/game/solver.ts` | Constraint-propagation solver + teaching hints |
| `src/game/scenes/BridgesScene.ts` | All rendering + pointer input |
| `src/game/EventBus.ts` | Singleton emitter + event name constants |
| `src/game/PhaserGame.tsx` | React ↔ Phaser lifecycle wrapper |
| `src/game/theme.ts` | Palette (numeric for Phaser, CSS strings for DOM) |
| `src/App.tsx`, `src/ui/*` | React shell: config panel, HUD, win card |
| `src/styles/global.css` | All styling (sci-fi theme, no CSS framework) |

## Domain model & invariants

- **Island** = a node at integer `(col, row)` with a `value` (its clue).
- **Edge** = a *candidate* connection between two line-of-sight islands. The full
  candidate set is exposed; most edges have `solution: 0`. The player builds along
  these edges only.
- **`edge.solution`** is the generator's known-good bridge count for that edge —
  always a complete, valid, crossing-free, connected solution. `SOLVE` and the hint
  fallback rely on it.
- **`puzzle.crossings`** = precomputed pairs of edges (one `h`, one `v`) that would
  intersect. Two crossing edges may not both be > 0.
- **Win** = every island's bridges equal its clue AND all islands form one connected
  component (`rules.ts:evaluate`).

### Generator (generator.ts)

Grows a connected island/bridge network cell-by-cell (blocking cells so nothing
crosses), then derives clues from bridge counts and computes the full candidate-edge
+ crossing sets. Guarantees a puzzle is **solvable but not necessarily unique** — any
clue-satisfying, connected, crossing-free configuration wins. Seeded
(`mulberry32`) so a given `seed` reproduces a puzzle.

### Solver / hints (solver.ts)

`solve()` runs constraint propagation (island capacity + crossing exclusion) to a
fixpoint, returning per-edge `[lo, hi]` ranges valid in *every* solution.
`nextHint()` returns, in priority order: (1) a correction if the player exceeded an
edge's `hi`, (2) a logically forced bridge (`lo > current`) with a French
explanation, (3) a fallback move from `edge.solution`. The fallback guarantees a
hint **always** makes progress even when pure logic stalls.

## Conventions & gotchas

- **EventBus is a module singleton.** `BridgesScene` registers its listeners in
  `create()` and **must** remove them in `teardown()` (wired to `SHUTDOWN`/`DESTROY`).
  React StrictMode double-mounts in dev — without cleanup you get a ghost scene
  reacting to events. Keep this pattern when adding listeners.
- **Colors:** Phaser needs numeric hex (`0x35e0ff`); DOM/CSS needs strings
  (`#35e0ff`). `theme.ts` carries both — use the right one (e.g. `amberNum` vs `amber`).
- **Trace lines** (ambient candidate connections) render **only** when
  `kidMode || difficulty === 'easy'`. Hint/hover highlights are separate and always
  draw. See `BridgesScene.drawHints`.
- **maxBridges** is 1–11 and caps bridges per edge; clues can therefore be large.
  Bridges render as ≤3 parallel lines plus a `×N` badge for higher counts.
- **Layout** is computed in `relayout()` from the canvas size (Phaser
  `Scale.RESIZE`); islands sit on a lattice, pixel position via `px()/py()`.
- **Adding an event:** add the name to `EVENTS` in `EventBus.ts`, emit from the UI,
  handle (and clean up) in `BridgesScene.create()/teardown()`.
- No test framework is installed; tests are plain scripts under `test/` run via the
  esbuild+node commands above. Add new logic tests the same way.
- Kid-mode / tutorial strings are intentionally in **French**; the sci-fi chrome is
  in English.
