import { GameConfig, Difficulty, DIFFICULTY_LABELS, MAX_BRIDGES_LIMIT, MIN_GRID, MAX_GRID } from '../game/types';

interface Props {
  config: GameConfig;
  kidMode: boolean;
  onChange: (patch: Partial<GameConfig>) => void;
  onNewGame: () => void;
  onToggleKid: (on: boolean) => void;
  onEasyGame: () => void;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];

export function ConfigPanel({
  config,
  kidMode,
  onChange,
  onNewGame,
  onToggleKid,
  onEasyGame,
}: Props) {
  return (
    <div className="panel config">
      <h2 className="panel-title">// MISSION PARAMETERS</h2>

      <button
        className={`kid-toggle ${kidMode ? 'on' : ''}`}
        onClick={() => onToggleKid(!kidMode)}
      >
        <span className="kid-icon">🧒</span>
        <span className="kid-label">
          MODE ENFANT
          <em>{kidMode ? 'ACTIVÉ — aides affichées' : 'apprendre en douceur'}</em>
        </span>
        <span className={`switch ${kidMode ? 'on' : ''}`} />
      </button>

      {kidMode && (
        <button className="cta soft" onClick={onEasyGame}>
          🌱 PARTIE FACILE (7×7)
        </button>
      )}

      <label className="field">
        <span>
          GRID WIDTH <em>{config.cols}</em>
        </span>
        <input
          type="range"
          min={MIN_GRID}
          max={MAX_GRID}
          value={config.cols}
          onChange={(e) => onChange({ cols: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>
          GRID HEIGHT <em>{config.rows}</em>
        </span>
        <input
          type="range"
          min={MIN_GRID}
          max={MAX_GRID}
          value={config.rows}
          onChange={(e) => onChange({ rows: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>
          MAX CONDUITS <em>{config.maxBridges}</em>
        </span>
        <input
          type="range"
          min={1}
          max={MAX_BRIDGES_LIMIT}
          value={config.maxBridges}
          onChange={(e) => onChange({ maxBridges: Number(e.target.value) })}
        />
      </label>

      <button
        className={`kid-toggle ${config.noLoops !== false ? 'on' : ''}`}
        onClick={() => onChange({ noLoops: config.noLoops === false })}
      >
        <span className="kid-icon">⛓️</span>
        <span className="kid-label">
          BOUCLES INTERDITES
          <em>
            {config.noLoops !== false
              ? 'ACTIVÉ — réseau sans boucle'
              : 'boucles autorisées'}
          </em>
        </span>
        <span className={`switch ${config.noLoops !== false ? 'on' : ''}`} />
      </button>

      <div className="field">
        <span>THREAT LEVEL</span>
        <div className="seg">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`seg-btn ${config.difficulty === d ? 'active' : ''}`}
              onClick={() => onChange({ difficulty: d })}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <button className="cta" onClick={onNewGame}>
        ⚡ DEPLOY NETWORK
      </button>
    </div>
  );
}
