import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS } from '../src/data/catalog';
import { createEmptySave, recordAttempt } from '../src/core/state';
import { RECOVERY_KEY, SAVE_KEY, loadSave, persistSave } from '../src/core/storage';

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('saved discoveries survive serialization and a fresh load', () => {
  const storage = new MemoryStorage();
  const save = recordAttempt(createEmptySave(), EVENTS[0].command).save;
  save.settings.muted = true;
  assert.deepEqual(persistSave(storage, save), { ok: true, warning: null });
  assert.ok(storage.values.has(SAVE_KEY));
  const loaded = loadSave(storage);
  assert.deepEqual(loaded.data, save);
  assert.equal(loaded.warning, null);
  assert.equal(loaded.migrated, false);
});

test('empty storage initializes without a warning', () => {
  const loaded = loadSave(new MemoryStorage());
  assert.deepEqual(loaded.data, createEmptySave());
  assert.equal(loaded.warning, null);
  assert.equal(loaded.migrated, false);
});

test('broken JSON produces a safe, playable save and a warning', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, '{"schemaVersion":2,"discoveredEventIds":');
  const loaded = loadSave(storage);
  assert.deepEqual(loaded.data, createEmptySave());
  assert.ok(loaded.warning);
});

test('storage read failures do not prevent play', () => {
  const storage = {
    getItem() { throw new Error('Storage access denied'); },
    setItem() {},
    removeItem() {},
  };
  const loaded = loadSave(storage);
  assert.deepEqual(loaded.data, createEmptySave());
  assert.ok(loaded.warning);
});

test('quota failures return a warning without destroying in-memory discoveries', () => {
  const save = recordAttempt(createEmptySave(), EVENTS[0].command).save;
  const snapshot = JSON.stringify(save);
  const storage = {
    getItem() { return null; },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() {},
  };
  const result = persistSave(storage, save);
  assert.equal(result.ok, false);
  assert.ok(result.warning);
  assert.equal(JSON.stringify(save), snapshot);
});

test('unavailable storage produces a warning and keeps the game playable', () => {
  const result = persistSave(undefined, createEmptySave());
  assert.equal(result.ok, false);
  assert.ok(result.warning);
});

test('old schema is marked as migrated and known discoveries remain available', () => {
  const storage = new MemoryStorage();
  const legacy = recordAttempt(createEmptySave(), EVENTS[0].command).save;
  storage.setItem(SAVE_KEY, JSON.stringify({ ...legacy, schemaVersion: 1 }));
  const loaded = loadSave(storage);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.data.schemaVersion, 2);
  assert.deepEqual(loaded.data.discoveredEventIds, legacy.discoveredEventIds);
});

test('an unsupported future schema is retained in storage and warns the player', () => {
  const storage = new MemoryStorage();
  const serialized = JSON.stringify({ schemaVersion: 999, discoveredEventIds: [EVENTS[0].eventId] });
  storage.setItem(SAVE_KEY, serialized);
  const loaded = loadSave(storage);
  assert.deepEqual(loaded.data, createEmptySave());
  assert.ok(loaded.warning);
  assert.equal(storage.getItem(SAVE_KEY), serialized);
});

test('a new save preserves unreadable and future originals in recovery storage', () => {
  const save = recordAttempt(createEmptySave(), EVENTS[0].command).save;
  for (const original of ['{broken JSON', JSON.stringify({ schemaVersion: 999, futureData: ['keep this'] })]) {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, original);
    assert.equal(persistSave(storage, save).ok, true);
    assert.equal(storage.getItem(RECOVERY_KEY), original);
    assert.deepEqual(loadSave(storage).data, save);
  }
});

test('if recovery cannot be stored, the unreadable original is never overwritten', () => {
  const storage = new MemoryStorage();
  const original = '{this must survive';
  storage.setItem(SAVE_KEY, original);
  const limited = {
    getItem: (key: string) => storage.getItem(key),
    setItem: (key: string, value: string) => {
      if (key === RECOVERY_KEY) throw new Error('QuotaExceededError');
      storage.setItem(key, value);
    },
    removeItem: (key: string) => storage.removeItem(key),
  };
  const result = persistSave(limited, recordAttempt(createEmptySave(), EVENTS[0].command).save);
  assert.equal(result.ok, false);
  assert.ok(result.warning);
  assert.equal(storage.getItem(SAVE_KEY), original);
});

test('later normal saves keep the existing recovery copy intact', () => {
  const storage = new MemoryStorage();
  storage.setItem(RECOVERY_KEY, 'original recovery');
  storage.setItem(SAVE_KEY, JSON.stringify(createEmptySave()));
  const save = recordAttempt(createEmptySave(), EVENTS[0].command).save;
  assert.equal(persistSave(storage, save).ok, true);
  assert.equal(storage.getItem(RECOVERY_KEY), 'original recovery');
  assert.deepEqual(loadSave(storage).data, save);
});
