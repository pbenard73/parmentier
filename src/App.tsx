import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { ConfigPanel } from './ui/ConfigPanel';
import { HUD } from './ui/HUD';
import { EventBus, EVENTS } from './game/EventBus';
import { GameConfig } from './game/types';

const DEFAULT_CONFIG: GameConfig = {
  cols: 9,
  rows: 9,
  maxBridges: 2,
  difficulty: 'normal',
  noLoops: true,
};

const EASY_CONFIG: GameConfig = {
  cols: 7,
  rows: 7,
  maxBridges: 2,
  difficulty: 'easy',
  noLoops: true,
};

interface Progress {
  remaining: number;
  total: number;
  solved: boolean;
}

export interface HintInfo {
  text: string;
  kind: string;
  hasMove: boolean;
}

export default function App() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [generation, setGeneration] = useState(0);
  const [kidMode, setKidMode] = useState(false);
  const [hint, setHint] = useState<HintInfo | null>(null);
  const [progress, setProgress] = useState<Progress>({
    remaining: 0,
    total: 0,
    solved: false,
  });
  const [showWin, setShowWin] = useState(false);

  useEffect(() => {
    const offProgress = EventBus.on(EVENTS.PROGRESS, (p: Progress) => {
      setProgress(p);
      if (!p.solved) setShowWin(false);
    });
    const offSolved = EventBus.on(EVENTS.SOLVED, () => setShowWin(true));
    const offHint = EventBus.on(EVENTS.HINT_INFO, (h: HintInfo) => setHint(h));
    return () => {
      offProgress();
      offSolved();
      offHint();
    };
  }, []);

  const patchConfig = (patch: Partial<GameConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  const newGame = () => {
    setShowWin(false);
    setHint(null);
    setGeneration((g) => g + 1);
  };

  const toggleKid = (on: boolean) => {
    setKidMode(on);
    EventBus.emit(EVENTS.KID_MODE, on);
    setHint(null);
  };

  const easyGame = () => {
    setConfig(EASY_CONFIG);
    setShowWin(false);
    setHint(null);
    setGeneration((g) => g + 1);
  };

  return (
    <div className="app">
      <div className="scanlines" />
      <header className="topbar">
        <div className="brand">
          <span className="logo">◈</span> NEXUS&nbsp;BRIDGES
          <span className="sub">// HASHIWOKAKERO</span>
        </div>
        <div className="meta">
          {config.cols}×{config.rows} · {config.difficulty.toUpperCase()} · MAX{' '}
          {config.maxBridges}
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar left">
          <ConfigPanel
            config={config}
            kidMode={kidMode}
            onChange={patchConfig}
            onNewGame={newGame}
            onToggleKid={toggleKid}
            onEasyGame={easyGame}
          />
        </aside>

        <section className="stage">
          <PhaserGame config={config} generation={generation} />
          {showWin && (
            <div className="win-overlay" onClick={() => setShowWin(false)}>
              <div className="win-card">
                <h1>NETWORK ONLINE</h1>
                <p>All nodes synchronised. Grid integrity 100%.</p>
                <button className="cta" onClick={newGame}>
                  ⚡ NEW MISSION
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="sidebar right">
          <HUD
            remaining={progress.remaining}
            total={progress.total}
            solved={progress.solved}
            kidMode={kidMode}
            hint={hint}
            onReset={() => EventBus.emit(EVENTS.RESET)}
            onUndo={() => EventBus.emit(EVENTS.UNDO)}
            onHint={() => EventBus.emit(EVENTS.HINT)}
            onApplyHint={() => EventBus.emit(EVENTS.APPLY_HINT)}
            onSolve={() => EventBus.emit(EVENTS.SOLVE)}
          />
        </aside>
      </main>
    </div>
  );
}
