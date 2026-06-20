/** Sci-fi neon palette shared by React UI and the Phaser scene. */
export const THEME = {
  bg: 0x05070f,
  bgCss: '#05070f',
  panel: '#0b1022',
  grid: 0x16203a,
  gridGlow: 0x1f2d4d,

  // islands
  node: 0x0a1530,
  nodeStroke: 0x35e0ff,
  nodeStrokeSatisfied: 0x39ff9e,
  nodeStrokeError: 0xff3b6b,
  nodeText: '#dff6ff',

  // bridges
  bridge: 0x35e0ff,
  bridgeGlow: 0x7af9ff,
  bridgeHint: 0x2a3a5c,

  // accents
  amberNum: 0xffcf4d,
  greenNum: 0x39ff9e,
  cyan: '#35e0ff',
  magenta: '#ff45c8',
  green: '#39ff9e',
  red: '#ff3b6b',
  amber: '#ffcf4d',
  text: '#dff6ff',
  textDim: '#6f86b8',
} as const;

export const cssHex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
