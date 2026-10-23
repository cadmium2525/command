import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { COMMANDS, EVENTS, EVENT_BY_COMMAND, EVENT_BY_ID, TRUE_ENDING } from '../src/data/catalog';
import { SYMBOLS } from '../src/data/types';
import { ASSET_REGISTRY } from '../src/assets/registry';

const allCommands = SYMBOLS.flatMap(a => SYMBOLS.flatMap(b => SYMBOLS.map(c => `${a}${b}${c}`)));

test('all 216 three-input commands exist once in a deterministic order', () => {
  assert.equal(COMMANDS.length, 216);
  assert.equal(new Set(COMMANDS.map(entry => entry.command)).size, 216);
  assert.deepEqual(COMMANDS.map(entry => entry.command), allCommands);
  for (const entry of COMMANDS) assert.match(entry.command, /^[UDLRAB]{3}$/);
});

test('173 events map one-to-one to commands and the remaining 43 are misses', () => {
  assert.equal(EVENTS.length, 173);
  assert.equal(EVENT_BY_ID.size, 173);
  assert.equal(EVENT_BY_COMMAND.size, 173);
  assert.equal(new Set(EVENTS.map(event => event.command)).size, 173);
  assert.equal(new Set(EVENTS.map(event => event.eventId)).size, 173);
  assert.equal(COMMANDS.filter(entry => entry.eventId === null).length, 43);
  for (const entry of COMMANDS) {
    const event = EVENT_BY_COMMAND.get(entry.command);
    assert.equal(event?.eventId ?? null, entry.eventId);
    if (event) assert.equal(EVENT_BY_ID.get(entry.eventId!), event);
  }
});

test('category counts and playback durations match the production specification', () => {
  const expected = {
    remix: { count: 90, min: 2_000, max: 5_000, durationClass: 'short' },
    gag: { count: 45, min: 3_000, max: 10_000, durationClass: 'gag' },
    story: { count: 20, min: 10_000, max: 30_000, durationClass: 'event' },
    minigame: { count: 13, min: 30_000, max: 60_000, durationClass: 'minigame' },
    ending: { count: 5, min: 60_000, max: 180_000, durationClass: 'ending' },
  };
  for (const [category, rule] of Object.entries(expected)) {
    const events = EVENTS.filter(event => event.category === category);
    assert.equal(events.length, rule.count, category);
    for (const event of events) {
      assert.equal(event.durationClass, rule.durationClass, event.eventId);
      assert.ok(event.durationMs >= rule.min && event.durationMs <= rule.max, `${event.eventId}: ${event.durationMs} ms`);
      assert.equal(event.skippable, true, event.eventId);
    }
  }
});

test('every event has an individual title and a nonempty, ordered, timed narrative', () => {
  assert.equal(new Set(EVENTS.map(event => event.title)).size, EVENTS.length);
  const narratives = new Set<string>();
  for (const event of [...EVENTS, TRUE_ENDING]) {
    assert.ok(event.eventId.trim().length > 0);
    assert.ok(event.title.trim().length >= 3, event.eventId);
    assert.doesNotMatch(event.title, /(?:TODO|placeholder|仮タイトル|未実装)/i);
    assert.ok(event.sceneType.length > 0, event.eventId);
    assert.ok(event.timeline.length >= 3, `${event.eventId}: at least a setup, development, and payoff`);
    assert.ok(event.assetIds.length > 0, event.eventId);
    assert.ok(event.tags.length > 0, event.eventId);
    let previous = -1;
    for (const beat of event.timeline) {
      assert.ok(Number.isFinite(beat.at) && beat.at >= 0 && beat.at < event.durationMs, `${event.eventId}: beat at ${beat.at}`);
      assert.ok(beat.at >= previous, `${event.eventId}: chronological timeline`);
      assert.ok(beat.text.trim().length > 0, event.eventId);
      assert.ok(beat.action.trim().length > 0, event.eventId);
      previous = beat.at;
    }
    const narrative = event.timeline.map(beat => `${beat.text}:${beat.action}`).join('|');
    assert.ok(!narratives.has(narrative), `${event.eventId}: duplicated story`);
    narratives.add(narrative);
  }
});

test('true completion ending is separate from the 173 collectible events', () => {
  assert.equal(EVENT_BY_ID.has(TRUE_ENDING.eventId), false);
  assert.ok(TRUE_ENDING.durationMs >= 60_000 && TRUE_ENDING.durationMs <= 180_000);
  assert.equal(TRUE_ENDING.skippable, true);
});

test('every event asset resolves through the centralized original-art registry', () => {
  for (const event of [...EVENTS, TRUE_ENDING]) {
    for (const assetId of event.assetIds) {
      assert.ok(ASSET_REGISTRY[assetId], `${event.eventId}: missing asset ${assetId}`);
      assert.equal(ASSET_REGISTRY[assetId].status, 'ready');
    }
  }
});

test('every registered file asset is included in the static public directory', () => {
  for (const asset of Object.values(ASSET_REGISTRY)) {
    if (!asset.path) continue;
    const relative = asset.path.replace(/^\//, '');
    assert.ok(existsSync(path.resolve('public', relative)), `${asset.id}: missing local asset ${relative}`);
  }
});

test('173 events have distinct visual scripts even without text, palette, or timing', () => {
  const signatures = EVENTS.map(event => JSON.stringify([
    event.actor,
    event.prop,
    event.timeline.map(beat => beat.action),
    event.mechanic ?? null,
  ]));
  assert.equal(new Set(signatures).size, 173, 'cast, prop, ordered actions, and mechanic distinguish each event');
});
