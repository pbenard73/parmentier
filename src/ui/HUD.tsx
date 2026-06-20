import type { HintInfo } from '../App';

interface Props {
  remaining: number;
  total: number;
  solved: boolean;
  kidMode: boolean;
  hint: HintInfo | null;
  onReset: () => void;
  onUndo: () => void;
  onHint: () => void;
  onApplyHint: () => void;
  onSolve: () => void;
}

export function HUD({
  remaining,
  total,
  solved,
  kidMode,
  hint,
  onReset,
  onUndo,
  onHint,
  onApplyHint,
  onSolve,
}: Props) {
  const linked = total - remaining;
  const pct = total > 0 ? Math.round((linked / total) * 100) : 0;

  return (
    <div className="panel hud">
      <h2 className="panel-title">// NETWORK STATUS</h2>

      <div className={`status ${solved ? 'online' : ''}`}>
        {solved ? 'NETWORK ONLINE' : 'CALIBRATING…'}
      </div>

      <div className="gauge">
        <div className="gauge-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="metrics">
        <span>
          NODES SYNCED <em>{linked}</em> / {total}
        </span>
        <span>{pct}%</span>
      </div>

      <div className="hud-actions">
        <button className="ghost" onClick={onUndo}>
          ↶ UNDO
        </button>
        <button className="ghost" onClick={onReset}>
          ⟲ RESET
        </button>
      </div>

      {/* Assist / learning tools */}
      <div className="assist">
        <div className="assist-row">
          <button className="ghost hint" onClick={onHint}>
            💡 INDICE
          </button>
          <button className="ghost solve" onClick={onSolve}>
            ✓ RÉSOUDRE
          </button>
        </div>
        {hint && (
          <div className={`hint-box ${hint.kind === 'fix-error' ? 'error' : ''}`}>
            <p>{hint.text}</p>
            {hint.hasMove && (
              <button className="cta soft small" onClick={onApplyHint}>
                ▶ JOUER CET INDICE
              </button>
            )}
          </div>
        )}
      </div>

      {kidMode ? (
        <div className="legend tutorial">
          <h3>👋 Comment jouer</h3>
          <p>
            🔵 Chaque cercle est une <b>île</b>. Le chiffre = le nombre de
            <b> ponts</b> qu’elle doit avoir.
          </p>
          <p>
            ✏️ <b>Glisse</b> d’une île vers sa voisine pour tracer un pont. Glisse
            encore pour en mettre deux.
          </p>
          <p>
            🟠 Le petit <b>-N</b> sous une île montre combien de ponts il manque
            encore.
          </p>
          <p>🚫 Les ponts ne se croisent jamais et restent tout droits.</p>
          <p>
            💡 Bloqué ? Appuie sur <b>INDICE</b> : le jeu t’explique le prochain
            coup.
          </p>
        </div>
      ) : (
        <div className="legend">
          <p>
            <b>DRAG</b> from a node toward a neighbour to lay a conduit.
          </p>
          <p>
            <b>DRAG AGAIN</b> to add more; cycling past the max clears it.
          </p>
          <p>
            <b>RIGHT-CLICK / DRAG</b> removes one conduit.
          </p>
          <p>Match every node's number and link all nodes into one grid.</p>
        </div>
      )}
    </div>
  );
}
