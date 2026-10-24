import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ARCADE_DEFINITIONS, COMMANDS, EVENTS, EVENT_BY_COMMAND, EVENT_BY_ID, TRUE_ENDING } from '../src/data/catalog';
import { SYMBOLS } from '../src/data/types';
import { ASSET_REGISTRY } from '../src/assets/registry';
import { ARCADE_FAMILIES } from '../src/events/arcade-types';
import { PHYSICAL_DEFINITIONS } from '../src/events/arcade-physical';
import { SKILL_DEFINITIONS } from '../src/events/arcade-skill';
import { COMPLETION_DEFINITION } from '../src/events/completion-arcade';

const allCommands = SYMBOLS.flatMap(a => SYMBOLS.flatMap(b => SYMBOLS.map(c => `${a}${b}${c}`)));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('all 216 three-input commands exist once in their original order', () => {
  assert.equal(COMMANDS.length, 216);
  assert.equal(new Set(COMMANDS.map(entry => entry.command)).size, 216);
  assert.deepEqual(COMMANDS.map(entry => entry.command), allCommands);
  for (const entry of COMMANDS) assert.match(entry.command, /^[UDLRAB]{3}$/);
});

test('173 playable games map one-to-one to commands and the remaining 43 are misses', () => {
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

test('every legacy event ID and command address remains compatible with existing saves', () => {
  // Fingerprints captured from the released narrative catalogue before the arcade migration.
  assert.equal(digest(EVENTS.map(event => [event.eventId, event.command])), 'fc2aa5a6caa405a30dd63fad08259fedf879f430adc8550a767cece804b1e7c0');
  assert.equal(digest(COMMANDS), '989605f631e1a5ef5063ac4d2c019fd43ae66cec4c6e1e7692fc9978b05734a5');
  assert.equal(EVENT_BY_COMMAND.get('UUU')?.eventId, 'remix-001');
  assert.equal(EVENT_BY_COMMAND.get('AAA')?.eventId, 'remix-002');
  assert.equal(EVENT_BY_COMMAND.get('DDD')?.eventId, 'story-001');
  assert.equal(EVENT_BY_COMMAND.get('BBB')?.eventId, 'ending-001');
});

test('18 game families have complete, unique zero-based variant ranges totaling 173 games', () => {
  const expected = { blocks:13, invaders:12, snake:10, breakout:10, pong:9, runner:10, dodge:10, catch:9, maze:9, memory:9, rhythm:9, typing:9, balance:9, fishing:9, racer:9, lander:9, reaction:9, clicker:9 };
  assert.equal(ARCADE_FAMILIES.length, 18);
  assert.equal(PHYSICAL_DEFINITIONS.length, 92);
  assert.equal(SKILL_DEFINITIONS.length, 81);
  assert.equal(ARCADE_DEFINITIONS.length, 173);
  assert.equal(new Set(EVENTS.map(event => `${event.game.family}:${event.game.variant}`)).size, 173);
  assert.equal(new Set(EVENTS.map(event => event.title)).size, 173);
  assert.deepEqual([...new Set(EVENTS.map(event => event.game.family))].sort(), [...ARCADE_FAMILIES].sort());
  for (const family of ARCADE_FAMILIES) {
    const games = EVENTS.filter(event => event.game.family === family);
    assert.equal(games.length, expected[family], family);
    assert.deepEqual(games.map(event => event.game.variant).sort((a,b) => a-b), Array.from({ length:expected[family] }, (_,index) => index), family);
  }
});

test('every collectible directly references its authored engine rules, controls, title and clock', () => {
  for (const [index, event] of EVENTS.entries()) {
    const game = ARCADE_DEFINITIONS[index];
    assert.equal(event.game, game, `${event.eventId}: canonical engine definition`);
    assert.equal(event.title, game.title, event.eventId);
    assert.equal(event.durationMs, game.durationMs, event.eventId);
    assert.equal(event.mechanic, game.family, event.eventId);
    assert.equal(event.category, 'minigame', event.eventId);
    assert.equal(event.durationClass, 'minigame', event.eventId);
    assert.equal(event.sceneType, `arcade-${game.family}`, event.eventId);
    assert.equal(event.skippable, true, event.eventId);
    assert.ok(Number.isSafeInteger(game.durationMs) && game.durationMs >= 0 && game.durationMs <= 120_000, event.eventId);
    assert.ok(['endless','board','gag'].includes(game.playMode), event.eventId);
    if (game.durationMs > 0) assert.equal(game.playMode, 'gag', `${event.eventId}: only an authored gag may force a timer`);
    else assert.equal(game.durationMs, 0, `${event.eventId}: normal play has no forced timer`);
    assert.ok(game.rule.trim().length > 0, event.eventId);
    assert.ok(game.controls.trim().length > 0, event.eventId);
    assert.ok(game.title.trim().length >= 3, event.eventId);
    assert.doesNotMatch(game.title, /(?:TODO|placeholder|仮タイトル|未実装)/i);
    assert.deepEqual(event.timeline, [{ at:0, action:'play', text:`${game.rule} ${game.controls}` }], event.eventId);
  }
});

test('the playable completion bonus remains separate from the 173 collection addresses', () => {
  assert.equal(TRUE_ENDING.eventId, 'true-ending');
  assert.equal(TRUE_ENDING.command, '');
  assert.equal(EVENT_BY_ID.has(TRUE_ENDING.eventId), false);
  assert.equal(TRUE_ENDING.game, COMPLETION_DEFINITION);
  assert.equal(TRUE_ENDING.title, COMPLETION_DEFINITION.title);
  assert.equal(TRUE_ENDING.durationMs, 0);
  assert.equal(TRUE_ENDING.game.playMode, 'endless');
  assert.equal(TRUE_ENDING.category, 'minigame');
  assert.equal(TRUE_ENDING.skippable, true);
});

test('all games use ready code artwork and every registered file exists in public', () => {
  for (const event of [...EVENTS, TRUE_ENDING]) {
    assert.deepEqual(event.assetIds, ['world'], event.eventId);
    for (const assetId of event.assetIds) {
      assert.ok(ASSET_REGISTRY[assetId], `${event.eventId}: missing asset ${assetId}`);
      assert.equal(ASSET_REGISTRY[assetId].status, 'ready');
      assert.equal(ASSET_REGISTRY[assetId].kind, 'procedural');
    }
  }
  for (const asset of Object.values(ASSET_REGISTRY)) {
    if (!asset.path) continue;
    assert.ok(existsSync(path.resolve('public', asset.path.replace(/^\//, ''))), `${asset.id}: missing local asset ${asset.path}`);
  }
});
