import { COMMANDS, EVENTS, EVENT_BY_COMMAND, EVENT_BY_ID } from '../data/catalog';
import type { SaveData } from '../data/types';

export const createEmptySave = (): SaveData => ({
  schemaVersion: 2, attemptedCommands: [], discoveredEventIds: [], viewedEventIds: [], favoriteEventIds: [],
  settings: { muted: false, reducedMotion: false, autoSkip: false }, completionSeen: false,
});
const commandSet = new Set(COMMANDS.map(x => x.command));
const uniqueStrings = (value: unknown, allowed: Set<string>): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string' && allowed.has(x)))] : [];

/** Validate persisted values and migrate the documented v1 array aliases. */
export function normalizeSave(raw: unknown): SaveData {
  const empty = createEmptySave();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== undefined && r.schemaVersion !== 1 && r.schemaVersion !== 2) return empty;
  const ids = new Set(EVENTS.map(e => e.eventId));
  const discoveredEventIds = uniqueStrings(r.discoveredEventIds ?? r.discovered, ids);
  const discovered = new Set(discoveredEventIds);
  const attemptedCommands = [...new Set([
    ...uniqueStrings(r.attemptedCommands ?? r.attempted, commandSet),
    ...discoveredEventIds.map(id => EVENT_BY_ID.get(id)!.command),
  ])];
  const settings = r.settings && typeof r.settings === 'object' ? r.settings as Record<string, unknown> : {};
  return {
    schemaVersion: 2, discoveredEventIds, attemptedCommands,
    viewedEventIds: uniqueStrings(r.viewedEventIds ?? r.viewed, discovered),
    favoriteEventIds: uniqueStrings(r.favoriteEventIds ?? r.favorites, discovered),
    settings: {
      muted: settings.muted === true,
      reducedMotion: settings.reducedMotion === true,
      autoSkip: settings.autoSkip === true,
    },
    completionSeen: discovered.size === EVENTS.length && r.completionSeen === true,
  };
}

export function recordAttempt(save: SaveData, command: string) {
  if (!commandSet.has(command)) return { save, event: undefined, isNew: false };
  const event = EVENT_BY_COMMAND.get(command);
  const isNew = !!event && !save.discoveredEventIds.includes(event.eventId);
  return {
    save: {
      ...save,
      attemptedCommands: [...new Set([...save.attemptedCommands, command])],
      discoveredEventIds: isNew ? [...save.discoveredEventIds, event!.eventId] : save.discoveredEventIds,
    },
    event, isNew,
  };
}

export function progress(save: SaveData) {
  const discovered = save.discoveredEventIds.length;
  return {
    discovered, attempted: save.attemptedCommands.length, percent: Math.floor(discovered / EVENTS.length * 100),
    libraryUnlocked: discovered >= 5, explorerUnlocked: discovered >= 87, complete: discovered === EVENTS.length,
    phase: discovered === EVENTS.length ? 'COMPLETE' : discovered >= 87 ? '全コマンド探索' : discovered >= 35 ? '自由探索' : 'ひみつの入口',
  };
}

export function toggleFavorite(save: SaveData, id: string): SaveData {
  if (!save.discoveredEventIds.includes(id)) return save;
  return { ...save, favoriteEventIds: save.favoriteEventIds.includes(id)
    ? save.favoriteEventIds.filter(x => x !== id) : [...save.favoriteEventIds, id] };
}

export function mergeSaves(a: SaveData, b: SaveData): SaveData {
  return normalizeSave({
    ...a,
    attemptedCommands: [...a.attemptedCommands, ...b.attemptedCommands],
    discoveredEventIds: [...a.discoveredEventIds, ...b.discoveredEventIds],
    viewedEventIds: [...a.viewedEventIds, ...b.viewedEventIds],
    favoriteEventIds: [...a.favoriteEventIds, ...b.favoriteEventIds],
    completionSeen: a.completionSeen || b.completionSeen,
  });
}
