import type { InputSymbol } from '../data/types';
import type { Palette } from './art';

export const ARCADE_FAMILIES = ['blocks','invaders','snake','breakout','pong','runner','dodge','catch','maze','memory','rhythm','typing','balance','fishing','racer','lander','reaction','clicker'] as const;
export type ArcadeFamily = (typeof ARCADE_FAMILIES)[number];
export interface ArcadeDefinition {
  family: ArcadeFamily;
  variant: number;
  title: string;
  /** Instructions describe the task without revealing the title/punchline. */
  rule: string;
  controls: string;
  /** Endless play, a whole board/boss, or an intentionally short title gag. */
  playMode: 'endless'|'board'|'gag';
  /** Zero means no time limit. Positive values are reserved for timed gags. */
  durationMs: number;
}
export interface ArcadeOutcome { status: 'win'|'lose'|'time'|'stopped'; reason: string }
export interface ArcadeEngine {
  score: number;
  outcome: ArcadeOutcome|null;
  /** Dynamic controls for a mode that changes games or stages. */
  readonly instruction?: string;
  input(key: InputSymbol): void;
  /** Seconds, fixed step supplied by the player. */
  update(dt: number): void;
  /** Full 320 × 200 playfield; player draws a compact timer above it. */
  draw(ctx: CanvasRenderingContext2D, palette: Palette, reducedMotion: boolean): void;
  readonly snapshot: Record<string, unknown>;
}
export const FAMILY_LABELS: Record<ArcadeFamily,string> = {
  blocks:'落ちもの',invaders:'シューティング',snake:'スネーク',breakout:'ブロック崩し',pong:'ラリー',runner:'ランナー',dodge:'弾よけ',catch:'キャッチ',maze:'迷路',memory:'記憶',rhythm:'リズム',typing:'コマンド',balance:'バランス',fishing:'つり',racer:'レース',lander:'着陸',reaction:'反射神経',clicker:'連打',
};
