import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BridgesScene } from './scenes/BridgesScene';
import { THEME } from './theme';
import { EventBus, EVENTS } from './EventBus';
import { GameConfig } from './types';

interface Props {
  config: GameConfig;
  /** bumped to force a brand-new puzzle with the current config */
  generation: number;
}

export function PhaserGame({ config, generation }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // create the Phaser game once
  useEffect(() => {
    if (!hostRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      backgroundColor: THEME.bgCss,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BridgesScene],
      render: { antialias: true },
    });
    gameRef.current = game;

    const off = EventBus.on(EVENTS.READY, () => {
      EventBus.emit(EVENTS.NEW_GAME, configRef.current);
    });

    return () => {
      off();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // regenerate when the user starts a new game
  useEffect(() => {
    if (!gameRef.current) return;
    EventBus.emit(EVENTS.NEW_GAME, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  return <div ref={hostRef} className="phaser-host" />;
}
