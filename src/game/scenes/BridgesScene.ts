import Phaser from 'phaser';
import { GameConfig, Island, Puzzle } from '../types';
import { generatePuzzle } from '../generator';
import {
  BridgeCounts,
  evaluate,
  getCount,
  islandTotals,
  wouldCross,
} from '../rules';
import { THEME } from '../theme';
import { EventBus, EVENTS } from '../EventBus';
import { Hint, nextHint, fullSolution } from '../solver';

type Dir = 'left' | 'right' | 'up' | 'down';

interface Layout {
  cell: number;
  originX: number;
  originY: number;
  radius: number;
}

export class BridgesScene extends Phaser.Scene {
  private puzzle!: Puzzle;
  private counts: BridgeCounts = new Map();
  private history: Array<[number, number]> = []; // [edgeId, previousCount]

  private layout: Layout = { cell: 40, originX: 0, originY: 0, radius: 16 };

  private gridGfx!: Phaser.GameObjects.Graphics;
  private hintGfx!: Phaser.GameObjects.Graphics;
  private bridgeGfx!: Phaser.GameObjects.Graphics;
  private islandGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private subLabels: Phaser.GameObjects.Text[] = [];
  private badges: Phaser.GameObjects.Text[] = [];

  // per-island neighbour edge lookup by direction
  private neighbour = new Map<number, Partial<Record<Dir, number>>>();
  private islandById = new Map<number, Island>();

  private dragFrom: Island | null = null;
  private hoverEdge = -1;
  private solvedFlag = false;
  private offs: Array<() => void> = [];
  private kidMode = false;
  private currentHint: Hint | null = null;

  constructor() {
    super('bridges');
  }

  create(): void {
    this.gridGfx = this.add.graphics();
    this.hintGfx = this.add.graphics();
    this.bridgeGfx = this.add.graphics();
    this.islandGfx = this.add.graphics();
    this.fxGfx = this.add.graphics();

    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);

    this.scale.on('resize', this.relayout, this);

    this.offs.push(
      EventBus.on(EVENTS.NEW_GAME, (config: GameConfig) => this.startGame(config)),
      EventBus.on(EVENTS.RESET, () => this.reset()),
      EventBus.on(EVENTS.UNDO, () => this.undo()),
      EventBus.on(EVENTS.HINT, () => this.showHint()),
      EventBus.on(EVENTS.APPLY_HINT, () => this.applyHint()),
      EventBus.on(EVENTS.SOLVE, () => this.solveAll()),
      EventBus.on(EVENTS.KID_MODE, (on: boolean) => this.setKidMode(on)),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);

    EventBus.emit(EVENTS.READY);
  }

  private teardown(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.scale.off('resize', this.relayout, this);
  }

  // ---- lifecycle -------------------------------------------------------

  private startGame(config: GameConfig): void {
    this.puzzle = generatePuzzle(config);
    this.counts = new Map();
    this.history = [];
    this.solvedFlag = false;
    this.currentHint = null;

    this.islandById = new Map(this.puzzle.islands.map((i) => [i.id, i]));
    this.buildNeighbours();
    this.rebuildLabels();
    this.relayout();
    this.emitProgress();
  }

  private reset(): void {
    if (!this.puzzle) return;
    this.counts = new Map();
    this.history = [];
    this.solvedFlag = false;
    this.currentHint = null;
    this.redraw();
    this.emitProgress();
  }

  private undo(): void {
    const last = this.history.pop();
    if (!last) return;
    const [edgeId, prev] = last;
    if (prev === 0) this.counts.delete(edgeId);
    else this.counts.set(edgeId, prev);
    this.solvedFlag = false;
    this.currentHint = null;
    this.redraw();
    this.emitProgress();
  }

  // ---- learning mode: hints & solver ----------------------------------

  private setKidMode(on: boolean): void {
    this.kidMode = on;
    if (this.puzzle) this.redraw();
  }

  private showHint(): void {
    if (!this.puzzle) return;
    const hint = nextHint(this.puzzle, this.counts);
    this.currentHint = hint;
    this.redraw();
    if (!hint) {
      EventBus.emit(EVENTS.HINT_INFO, {
        text: 'Tout est cohérent — continue comme ça !',
        kind: 'none',
        hasMove: false,
      });
      return;
    }
    this.pulseEdge(hint.edgeId, hint.kind === 'fix-error');
    EventBus.emit(EVENTS.HINT_INFO, {
      text: hint.reason,
      kind: hint.kind,
      hasMove: true,
    });
  }

  private applyHint(): void {
    if (!this.puzzle) return;
    const hint = this.currentHint ?? nextHint(this.puzzle, this.counts);
    if (!hint) return;
    this.changeBridge(hint.edgeId, hint.delta, true);
    this.currentHint = null;
  }

  private solveAll(): void {
    if (!this.puzzle) return;
    this.counts = fullSolution(this.puzzle);
    this.history = [];
    this.currentHint = null;
    this.redraw();
    this.emitProgress();
  }

  private buildNeighbours(): void {
    this.neighbour.clear();
    for (const isl of this.puzzle.islands) this.neighbour.set(isl.id, {});
    for (const edge of this.puzzle.edges) {
      const a = this.islandById.get(edge.a)!;
      const b = this.islandById.get(edge.b)!;
      if (edge.orientation === 'h') {
        const [left, right] = a.col < b.col ? [a, b] : [b, a];
        this.neighbour.get(left.id)!.right = edge.id;
        this.neighbour.get(right.id)!.left = edge.id;
      } else {
        const [up, down] = a.row < b.row ? [a, b] : [b, a];
        this.neighbour.get(up.id)!.down = edge.id;
        this.neighbour.get(down.id)!.up = edge.id;
      }
    }
  }

  private rebuildLabels(): void {
    this.labels.forEach((t) => t.destroy());
    this.subLabels.forEach((t) => t.destroy());
    this.badges.forEach((t) => t.destroy());
    this.labels = [];
    this.subLabels = [];
    this.badges = [];
    for (const isl of this.puzzle.islands) {
      const label = this.add
        .text(0, 0, String(isl.value), {
          fontFamily: 'Orbitron, sans-serif',
          fontStyle: '800',
          color: THEME.nodeText,
        })
        .setOrigin(0.5);
      this.labels[isl.id] = label;

      const sub = this.add
        .text(0, 0, '', {
          fontFamily: 'Share Tech Mono, monospace',
          color: THEME.amber,
        })
        .setOrigin(0.5)
        .setVisible(false);
      this.subLabels[isl.id] = sub;
    }
  }

  // ---- layout ----------------------------------------------------------

  private relayout(): void {
    if (!this.puzzle) return;
    const { width, height } = this.scale;
    const { cols, rows } = this.puzzle.config;
    const margin = Math.max(28, Math.min(width, height) * 0.06);
    const cw = (width - margin * 2) / Math.max(1, cols - 1);
    const ch = (height - margin * 2) / Math.max(1, rows - 1);
    const cell = Math.max(16, Math.min(cw, ch, 72));
    const gridW = (cols - 1) * cell;
    const gridH = (rows - 1) * cell;
    this.layout = {
      cell,
      originX: (width - gridW) / 2,
      originY: (height - gridH) / 2,
      radius: Math.max(11, Math.min(cell * 0.34, 26)),
    };
    this.redraw();
  }

  private px(col: number): number {
    return this.layout.originX + col * this.layout.cell;
  }
  private py(row: number): number {
    return this.layout.originY + row * this.layout.cell;
  }

  // ---- drawing ---------------------------------------------------------

  private redraw(): void {
    if (!this.puzzle) return;
    this.drawGrid();
    this.drawHints();
    this.drawBridges();
    this.drawIslands();
  }

  private drawGrid(): void {
    const g = this.gridGfx;
    g.clear();
    const { width, height } = this.scale;
    g.fillStyle(THEME.bg, 1).fillRect(0, 0, width, height);
    // faint lattice dots
    g.fillStyle(THEME.gridGlow, 0.5);
    const { cols, rows } = this.puzzle.config;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        g.fillCircle(this.px(c), this.py(r), 1.2);
      }
    }
  }

  private drawHints(): void {
    const g = this.hintGfx;
    g.clear();
    // ambient candidate connections — only shown as a learning aid, i.e. in
    // kid mode or on the easy difficulty
    const traceLines = this.kidMode || this.puzzle.config.difficulty === 'easy';
    if (traceLines) {
      g.lineStyle(this.kidMode ? 2.5 : 2, THEME.bridgeHint, this.kidMode ? 0.6 : 0.35);
      for (const edge of this.puzzle.edges) {
        if (getCount(this.counts, edge.id) > 0) continue;
        const a = this.islandById.get(edge.a)!;
        const b = this.islandById.get(edge.b)!;
        g.lineBetween(this.px(a.col), this.py(a.row), this.px(b.col), this.py(b.row));
      }
    }
    // persistent highlight of the active teaching hint
    if (this.currentHint) {
      const edge = this.puzzle.edges[this.currentHint.edgeId];
      const a = this.islandById.get(edge.a)!;
      const b = this.islandById.get(edge.b)!;
      const err = this.currentHint.kind === 'fix-error';
      g.lineStyle(4, err ? THEME.nodeStrokeError : THEME.amberNum, 0.85);
      g.lineBetween(this.px(a.col), this.py(a.row), this.px(b.col), this.py(b.row));
    }
    // highlight the edge currently hovered while dragging
    if (this.hoverEdge >= 0) {
      const edge = this.puzzle.edges[this.hoverEdge];
      const a = this.islandById.get(edge.a)!;
      const b = this.islandById.get(edge.b)!;
      const cross = wouldCross(this.puzzle, edge.id, this.counts);
      g.lineStyle(4, cross ? THEME.nodeStrokeError : THEME.bridgeGlow, 0.6);
      g.lineBetween(this.px(a.col), this.py(a.row), this.px(b.col), this.py(b.row));
    }
  }

  private drawBridges(): void {
    const g = this.bridgeGfx;
    g.clear();
    this.badges.forEach((t) => t.destroy());
    this.badges = [];
    const r = this.layout.radius;

    for (const edge of this.puzzle.edges) {
      const n = getCount(this.counts, edge.id);
      if (n === 0) continue;
      const a = this.islandById.get(edge.a)!;
      const b = this.islandById.get(edge.b)!;
      const horiz = edge.orientation === 'h';

      const ax = this.px(a.col);
      const ay = this.py(a.row);
      const bx = this.px(b.col);
      const by = this.py(b.row);

      // trim endpoints to island edge
      const dirx = Math.sign(bx - ax);
      const diry = Math.sign(by - ay);
      const x1 = ax + dirx * r;
      const y1 = ay + diry * r;
      const x2 = bx - dirx * r;
      const y2 = by - diry * r;

      const lines = Math.min(n, 3);
      const gap = 5;
      const offsets = symmetricOffsets(lines, gap);

      for (const o of offsets) {
        const ox = horiz ? 0 : o;
        const oy = horiz ? o : 0;
        // glow
        g.lineStyle(7, THEME.bridgeGlow, 0.16);
        g.lineBetween(x1 + ox, y1 + oy, x2 + ox, y2 + oy);
        // core
        g.lineStyle(2.5, THEME.bridge, 0.95);
        g.lineBetween(x1 + ox, y1 + oy, x2 + ox, y2 + oy);
      }

      if (n >= 3) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const badge = this.add
          .text(mx, my, `×${n}`, {
            fontFamily: 'Share Tech Mono, monospace',
            color: THEME.text,
            backgroundColor: '#091226',
            padding: { x: 4, y: 1 },
            fontSize: '13px',
          })
          .setOrigin(0.5);
        this.badges.push(badge);
      }
    }
  }

  private drawIslands(): void {
    const g = this.islandGfx;
    g.clear();
    const r = this.layout.radius;
    const state = evaluate(this.puzzle, this.counts);
    const totals = this.kidMode ? islandTotals(this.puzzle, this.counts) : null;

    for (const isl of this.puzzle.islands) {
      const x = this.px(isl.col);
      const y = this.py(isl.row);
      const over = state.over.get(isl.id);
      const ok = state.satisfied.get(isl.id);
      const stroke = over
        ? THEME.nodeStrokeError
        : ok
          ? THEME.nodeStrokeSatisfied
          : THEME.nodeStroke;

      // outer glow
      g.fillStyle(stroke, 0.12).fillCircle(x, y, r + 6);
      // body
      g.fillStyle(THEME.node, 1).fillCircle(x, y, r);
      g.lineStyle(2.5, stroke, 1).strokeCircle(x, y, r);

      const label = this.labels[isl.id];
      if (label) {
        label.setPosition(x, y);
        label.setFontSize(Math.round(r * 0.95));
        label.setColor(ok ? THEME.green : over ? THEME.red : THEME.nodeText);
      }

      const sub = this.subLabels[isl.id];
      if (sub) {
        const remaining = totals ? isl.value - (totals.get(isl.id) ?? 0) : 0;
        if (totals && remaining > 0 && !over) {
          sub.setVisible(true);
          sub.setPosition(x, y + r + 9);
          sub.setFontSize(Math.max(9, Math.round(r * 0.5)));
          sub.setColor(THEME.amber);
          sub.setText(`-${remaining}`);
        } else {
          sub.setVisible(false);
        }
      }
    }
  }

  // ---- input -----------------------------------------------------------

  private islandAt(x: number, y: number): Island | null {
    const r = this.layout.radius + 6;
    let best: Island | null = null;
    let bestD = r * r;
    for (const isl of this.puzzle.islands) {
      const dx = x - this.px(isl.col);
      const dy = y - this.py(isl.row);
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = isl;
      }
    }
    return best;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.puzzle) return;
    this.dragFrom = this.islandAt(p.worldX, p.worldY);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.puzzle || !this.dragFrom) return;
    const edgeId = this.gestureEdge(this.dragFrom, p.worldX, p.worldY);
    if (edgeId !== this.hoverEdge) {
      this.hoverEdge = edgeId;
      this.drawHints();
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.puzzle) {
      this.dragFrom = null;
      return;
    }
    const from = this.dragFrom;
    this.dragFrom = null;
    this.hoverEdge = -1;
    if (!from) return;

    const edgeId = this.gestureEdge(from, p.worldX, p.worldY);
    if (edgeId < 0) {
      this.drawHints();
      return;
    }
    this.changeBridge(edgeId, p.button === 2 ? -1 : 1);
  }

  private gestureEdge(from: Island, x: number, y: number): number {
    const target = this.islandAt(x, y);
    const map = this.neighbour.get(from.id)!;
    if (target && target.id !== from.id) {
      for (const dir of ['left', 'right', 'up', 'down'] as Dir[]) {
        const e = map[dir];
        if (e === undefined) continue;
        const edge = this.puzzle.edges[e];
        if (edge.a === target.id || edge.b === target.id) return e;
      }
    }
    // directional gesture from the island
    const dx = x - this.px(from.col);
    const dy = y - this.py(from.row);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.layout.cell * 0.4) return -1;
    const dir: Dir =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? 'right'
          : 'left'
        : dy > 0
          ? 'down'
          : 'up';
    return map[dir] ?? -1;
  }

  private changeBridge(edgeId: number, delta: number, fromHint = false): void {
    const max = this.puzzle.config.maxBridges;
    const cur = getCount(this.counts, edgeId);
    let next: number;
    if (delta > 0) {
      next = cur + 1;
      if (next > max) next = 0; // cycle back to remove
      if (!fromHint && next > cur && wouldCross(this.puzzle, edgeId, this.counts)) {
        this.flashBlocked(edgeId);
        return;
      }
    } else {
      next = Math.max(0, cur - 1);
    }
    if (next === cur) return;
    if (!fromHint) this.currentHint = null;

    this.history.push([edgeId, cur]);
    if (next === 0) this.counts.delete(edgeId);
    else this.counts.set(edgeId, next);

    this.redraw();
    this.emitProgress();
  }

  private flashBlocked(edgeId: number): void {
    const edge = this.puzzle.edges[edgeId];
    const a = this.islandById.get(edge.a)!;
    const b = this.islandById.get(edge.b)!;
    const g = this.fxGfx;
    g.clear();
    g.lineStyle(4, THEME.nodeStrokeError, 0.9);
    g.lineBetween(this.px(a.col), this.py(a.row), this.px(b.col), this.py(b.row));
    this.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0 },
      duration: 320,
      onComplete: () => {
        g.clear();
        g.setAlpha(1);
      },
    });
  }

  private pulseEdge(edgeId: number, isError: boolean): void {
    const edge = this.puzzle.edges[edgeId];
    const a = this.islandById.get(edge.a)!;
    const b = this.islandById.get(edge.b)!;
    const color = isError ? THEME.nodeStrokeError : THEME.amberNum;
    const g = this.fxGfx;
    this.tweens.killTweensOf(g);
    g.setAlpha(1);
    const draw = () => {
      g.clear();
      g.lineStyle(6, color, 0.9);
      g.lineBetween(this.px(a.col), this.py(a.row), this.px(b.col), this.py(b.row));
      g.fillStyle(color, 0.9);
      g.fillCircle(this.px(a.col), this.py(a.row), this.layout.radius + 4);
      g.fillCircle(this.px(b.col), this.py(b.row), this.layout.radius + 4);
    };
    draw();
    this.tweens.add({
      targets: g,
      alpha: { from: 0.95, to: 0.2 },
      duration: 420,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        g.clear();
        g.setAlpha(1);
      },
    });
  }

  // ---- progress / win --------------------------------------------------

  private emitProgress(): void {
    const state = evaluate(this.puzzle, this.counts);
    EventBus.emit(EVENTS.PROGRESS, {
      remaining: state.remaining,
      total: this.puzzle.islands.length,
      solved: state.solved,
    });
    if (state.solved && !this.solvedFlag) {
      this.solvedFlag = true;
      this.celebrate();
      EventBus.emit(EVENTS.SOLVED);
    }
  }

  private celebrate(): void {
    const r = this.layout.radius;
    for (const isl of this.puzzle.islands) {
      const x = this.px(isl.col);
      const y = this.py(isl.row);
      const ring = this.add.circle(x, y, r, 0x39ff9e, 0).setStrokeStyle(3, 0x39ff9e, 1);
      this.tweens.add({
        targets: ring,
        scale: 2.4,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeOut',
        delay: (isl.col + isl.row) * 25,
        onComplete: () => ring.destroy(),
      });
    }
  }
}

/** Evenly spread `n` parallel offsets centred on 0. */
function symmetricOffsets(n: number, gap: number): number[] {
  if (n <= 1) return [0];
  const start = -((n - 1) / 2) * gap;
  return Array.from({ length: n }, (_, i) => start + i * gap);
}
