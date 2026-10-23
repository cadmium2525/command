import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMANDS, EVENTS } from '../src/data/catalog';
import { createEmptySave, mergeSaves, normalizeSave, progress, recordAttempt, toggleFavorite } from '../src/core/state';
import type { SaveData } from '../src/data/types';

function discover(count: number): SaveData {
  return EVENTS.slice(0, count).reduce((save, event) => recordAttempt(save, event.command).save, createEmptySave());
}

test('new saves are independent and default to explicit playback with audio available', () => {
  const first = createEmptySave();
  assert.equal(first.schemaVersion, 2);
  assert.deepEqual(first.attemptedCommands, []);
  assert.deepEqual(first.discoveredEventIds, []);
  assert.deepEqual(first.viewedEventIds, []);
  assert.deepEqual(first.favoriteEventIds, []);
  assert.equal(first.settings.autoSkip, false);
  assert.equal(first.settings.muted, false);
  const second = createEmptySave();
  assert.notEqual(first.attemptedCommands, second.attemptedCommands);
  assert.notEqual(first.settings, second.settings);
});

test('every command is discoverable without randomness and all 43 misses are recorded', () => {
  let save = createEmptySave();
  let found = 0;
  let missed = 0;
  for (const command of COMMANDS) {
    const result = recordAttempt(save, command.command);
    save = result.save;
    assert.ok(save.attemptedCommands.includes(command.command));
    if (command.eventId === null) {
      missed += 1;
      assert.equal(result.event, undefined);
      assert.equal(result.isNew, false);
    } else {
      found += 1;
      assert.equal(result.event?.eventId, command.eventId);
      assert.equal(result.isNew, true);
      // No playback completion callback is necessary for discovery.
      assert.ok(save.discoveredEventIds.includes(command.eventId));
    }
  }
  assert.equal(found, 173);
  assert.equal(missed, 43);
  assert.equal(save.attemptedCommands.length, 216);
  assert.equal(save.discoveredEventIds.length, 173);
  assert.equal(progress(save).complete, true);
  assert.equal(progress(save).percent, 100);
});

test('repeat attempts do not inflate collection or attempted counters', () => {
  const first = recordAttempt(createEmptySave(), EVENTS[0].command);
  const snapshot = JSON.stringify(first.save);
  const repeated = recordAttempt(first.save, EVENTS[0].command);
  assert.equal(repeated.isNew, false);
  assert.equal(repeated.save.discoveredEventIds.length, 1);
  assert.equal(repeated.save.attemptedCommands.length, 1);
  assert.equal(JSON.stringify(first.save), snapshot, 'recordAttempt does not mutate prior state');
  const miss = COMMANDS.find(entry => entry.eventId === null)!;
  const missedOnce = recordAttempt(repeated.save, miss.command);
  const missedTwice = recordAttempt(missedOnce.save, miss.command);
  assert.equal(missedTwice.save.attemptedCommands.length, 2);
  assert.equal(progress(missedTwice.save).discovered, 1);
});

test('partial, invalid, and four-input commands cannot create an attempt', () => {
  const save = createEmptySave();
  for (const command of ['', 'U', 'UU', 'UUUU', 'ABAB', 'XYZ', 'uuu', ' UUU']) {
    const result = recordAttempt(save, command);
    assert.equal(result.isNew, false, command);
    assert.equal(result.event, undefined, command);
    assert.deepEqual(result.save, save, command);
  }
});

test('unlock boundaries are exactly 5, 87, and 173 distinct discoveries', () => {
  for (const count of [0, 1, 4, 5, 34, 35, 86, 87, 172, 173]) {
    const status = progress(discover(count));
    assert.equal(status.discovered, count);
    assert.equal(status.attempted, count);
    assert.equal(status.libraryUnlocked, count >= 5, `library at ${count}`);
    assert.equal(status.explorerUnlocked, count >= 87, `explorer at ${count}`);
    assert.equal(status.complete, count === 173, `completion at ${count}`);
    assert.ok(status.percent >= 0 && status.percent <= 100);
  }
});

test('normalization removes invalid values, duplicates, and undiscovered favorites', () => {
  const known = EVENTS[0];
  const unknown = 'NOT_AN_EVENT';
  const save = normalizeSave({
    schemaVersion: 2,
    attemptedCommands: [known.command, known.command, 'UUUU', 'XYZ', null, 7],
    discoveredEventIds: [known.eventId, known.eventId, unknown, null],
    viewedEventIds: [known.eventId, unknown, EVENTS[1].eventId],
    favoriteEventIds: [known.eventId, known.eventId, unknown, EVENTS[1].eventId],
    settings: { muted: true, reducedMotion: 'false', autoSkip: true },
    completionSeen: 'yes',
  });
  assert.deepEqual(save.attemptedCommands, [known.command]);
  assert.deepEqual(save.discoveredEventIds, [known.eventId]);
  assert.deepEqual(save.viewedEventIds, [known.eventId]);
  assert.deepEqual(save.favoriteEventIds, [known.eventId]);
  assert.equal(save.settings.muted, true);
  assert.equal(save.settings.autoSkip, true);
  assert.equal(save.settings.reducedMotion, false);
  assert.equal(save.completionSeen, false);
});

test('null, primitives, and malformed root objects normalize to a playable save', () => {
  for (const raw of [undefined, null, false, 5, 'broken', [], { attemptedCommands: 'UUU', discoveredEventIds: null, settings: [] }]) {
    const save = normalizeSave(raw);
    assert.equal(save.schemaVersion, 2);
    assert.deepEqual(save.attemptedCommands, []);
    assert.deepEqual(save.discoveredEventIds, []);
    assert.equal(progress(save).complete, false);
    assert.equal(save.settings.autoSkip, false);
  }
});

test('version 1 progress is migrated without losing known discoveries', () => {
  const legacy = discover(7);
  const migrated = normalizeSave({ ...legacy, schemaVersion: 1 });
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.discoveredEventIds, legacy.discoveredEventIds);
  assert.deepEqual(migrated.attemptedCommands, legacy.attemptedCommands);
});

test('legacy array aliases migrate and restore the attempted command for every discovery', () => {
  const known = EVENTS[0];
  const migrated = normalizeSave({
    schemaVersion: 1,
    attempted: [],
    discovered: [known.eventId],
    viewed: [known.eventId],
    favorites: [known.eventId],
  });
  assert.deepEqual(migrated.attemptedCommands, [known.command]);
  assert.deepEqual(migrated.discoveredEventIds, [known.eventId]);
  assert.deepEqual(migrated.viewedEventIds, [known.eventId]);
  assert.deepEqual(migrated.favoriteEventIds, [known.eventId]);
});

test('an unsupported future schema is never interpreted as current progress', () => {
  const future = normalizeSave({ ...discover(5), schemaVersion: 999 });
  assert.deepEqual(future, createEmptySave());
});

test('a completion acknowledgement is valid only after every event is discovered', () => {
  assert.equal(normalizeSave({ ...discover(172), completionSeen: true }).completionSeen, false);
  assert.equal(normalizeSave({ ...discover(173), completionSeen: true }).completionSeen, true);
  assert.equal(normalizeSave({ ...discover(173), completionSeen: false }).completionSeen, false);
});

test('favorites toggle only known discoveries and preserve original state', () => {
  const save = discover(1);
  const favorite = toggleFavorite(save, EVENTS[0].eventId);
  assert.deepEqual(favorite.favoriteEventIds, [EVENTS[0].eventId]);
  assert.deepEqual(save.favoriteEventIds, []);
  assert.deepEqual(toggleFavorite(favorite, EVENTS[0].eventId).favoriteEventIds, []);
  assert.deepEqual(toggleFavorite(save, EVENTS[1].eventId).favoriteEventIds, []);
  assert.deepEqual(toggleFavorite(save, 'NOT_AN_EVENT').favoriteEventIds, []);
});

test('merging concurrent progress preserves both tabs without duplicated discoveries', () => {
  const left = toggleFavorite(discover(3), EVENTS[0].eventId);
  const right = toggleFavorite(recordAttempt(createEmptySave(), EVENTS[4].command).save, EVENTS[4].eventId);
  const leftSnapshot = JSON.stringify(left);
  const rightSnapshot = JSON.stringify(right);
  const merged = mergeSaves(left, right);
  assert.equal(merged.discoveredEventIds.length, 4);
  assert.equal(merged.attemptedCommands.length, 4);
  assert.deepEqual(new Set(merged.favoriteEventIds), new Set([EVENTS[0].eventId, EVENTS[4].eventId]));
  assert.deepEqual(mergeSaves(merged, merged), merged);
  assert.equal(JSON.stringify(left), leftSnapshot);
  assert.equal(JSON.stringify(right), rightSnapshot);
});
