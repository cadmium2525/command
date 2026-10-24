export const SYMBOLS = ['U', 'D', 'L', 'R', 'A', 'B'] as const;
export type InputSymbol = (typeof SYMBOLS)[number];
export const SYMBOL_LABELS: Record<InputSymbol, string> = { U: '↑', D: '↓', L: '←', R: '→', A: 'A', B: 'B' };
export type Category = 'remix' | 'gag' | 'story' | 'minigame' | 'ending';
export type Actor = 'hero' | 'cat' | 'ghost' | 'robot' | 'slime' | 'bird' | 'star' | 'moon' | 'fish' | 'box' | 'title' | 'crown' | 'plant' | 'cake';
export interface TimelineBeat {
  at: number;
  text: string;
  action: string;
  actor?: Actor;
  prop?: Actor;
  value?: number;
}
export interface GameEvent {
  eventId: string;
  command: string;
  title: string;
  category: Category;
  durationClass: 'short' | 'gag' | 'event' | 'minigame' | 'ending';
  durationMs: number;
  sceneType: string;
  timeline: TimelineBeat[];
  assetIds: string[];
  skippable: true;
  tags: string[];
  palette: string;
  actor: Actor;
  prop: Actor;
  game: ArcadeDefinition;
  mechanic?: string;
}
export interface CommandEntry { command: string; eventId: string | null }
export interface Settings { muted: boolean; reducedMotion: boolean; autoSkip: boolean }
export interface SaveData {
  schemaVersion: 2;
  attemptedCommands: string[];
  discoveredEventIds: string[];
  viewedEventIds: string[];
  favoriteEventIds: string[];
  settings: Settings;
  completionSeen: boolean;
}
export const CATEGORY_LABELS: Record<Category, string> = {
  remix: '旧日常枠', gag: '旧ハプニング枠', story: '旧物語枠', minigame: 'アーケード', ending: '旧結末枠',
};
export const displayCommand = (command: string) => [...command].map(s => SYMBOL_LABELS[s as InputSymbol]).join(' ');
import type { ArcadeDefinition } from '../events/arcade-types';
