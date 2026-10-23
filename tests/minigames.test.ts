import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS } from '../src/data/catalog';
import { SYMBOLS } from '../src/data/types';
import { PALETTES } from '../src/events/art';
import { Minigame } from '../src/events/minigames';

function checkedCanvas() {
  let operations = 0;
  const canvas = new Proxy({}, {
    get: () => (...args: unknown[]) => {
      operations += 1;
      for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), 'finite drawing coordinate');
    },
    set: (_target, _name, value) => {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), 'finite drawing property');
      return true;
    },
  }) as CanvasRenderingContext2D;
  return { canvas, count: () => operations };
}

test('all 13 minigames have different registered mechanics and survive their full duration', () => {
  const entries = EVENTS.filter(event => event.category === 'minigame');
  assert.equal(entries.length, 13);
  assert.equal(new Set(entries.map(event => event.mechanic)).size, 13);
  for (const entry of entries) {
    assert.ok(entry.mechanic, entry.eventId);
    const game = new Minigame(entry.mechanic!, 216);
    const drawing = checkedCanvas();
    const frames = Math.ceil(entry.durationMs / 1000 * 30);
    for (let frame = 0; frame <= frames; frame++) {
      game.update(frame / 30, 1 / 30);
      if (frame % 8 === 0) game.input(SYMBOLS[Math.floor(frame / 8) % SYMBOLS.length]);
      if (frame % 90 === 0) {
        game.draw(drawing.canvas, PALETTES.midnight, false);
        game.draw(drawing.canvas, PALETTES.midnight, true);
      }
    }
    assert.ok(Number.isFinite(game.score) && game.score >= 0, entry.eventId);
    assert.ok(Number.isFinite(game.misses) && game.misses >= 0, entry.eventId);
    assert.ok(game.detail.length > 10, entry.eventId);
    assert.ok(drawing.count() > 0, entry.eventId);
  }
});

test('user input changes an interactive game and repeated runs are deterministic', () => {
  const games = [new Minigame('clicker', 216), new Minigame('clicker', 216)];
  for (const game of games) {
    game.update(1, 1 / 30);
    assert.equal(game.score, 0);
    game.input('A');
    game.input('A');
    game.input('B');
    assert.equal(game.score, 1, 'charging and releasing creates a star');
  }
  assert.equal(games[0].detail, games[1].detail);
  games[0].input('A');
  games[0].input('A');
  games[0].input('B');
  assert.equal(games[0].score, 2);
  assert.equal(games[1].score, 1, 'scene state is independent between plays');
});

test('the maze has a reachable exit through the directional controls', () => {
  const game = new Minigame('maze', 216);
  game.update(1, 1 / 30);
  for (const command of 'RRRRDDRRUURRRRRRDDDDDD') game.input(command as 'R' | 'D' | 'U');
  assert.match(game.detail, /出口を発見/);
  assert.ok(game.score >= 10);
});
