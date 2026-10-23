import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS } from '../src/data/catalog';
import { SYMBOLS } from '../src/data/types';
import { PALETTES } from '../src/events/art';
import { clearBlockRows, FallingBlocks, Minigame, SpaceInvaders, SUPPORTED_MECHANICS } from '../src/events/minigames';

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
  assert.deepEqual(new Set(entries.map(event => event.mechanic)), new Set(SUPPORTED_MECHANICS));
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

test('an invader hit removes its target, surviving enemies march and kills persist beyond six seconds', () => {
  const game = new SpaceInvaders(216);
  const initial = game.snapshot;
  game.input('A');
  assert.equal(game.snapshot.bullets.length, 1);
  for (let frame = 0; frame < 120; frame++) game.update(1 / 120);
  const after = game.snapshot;
  assert.equal(after.score, 10, 'one projectile earns exactly one kill');
  assert.equal(after.enemies.length, initial.enemies.length - 1);
  const destroyed = initial.enemies.find(enemy => !after.enemies.some(alive => alive.id === enemy.id))!;
  assert.ok(destroyed, 'the enemy actually disappears');
  assert.ok(after.enemies[0].x > initial.enemies[0].x, 'the formation moves horizontally');
  for (let frame = 0; frame < 6 * 120; frame++) game.update(1 / 120);
  assert.equal(game.wave, 1, 'a new wave waits until all aliens are defeated');
  assert.equal(game.snapshot.enemies.length, 20);
  assert.ok(!game.snapshot.enemies.some(enemy => enemy.id === destroyed.id), 'destroyed aliens stay destroyed');
  assert.ok(game.snapshot.enemies[0].y > initial.enemies[0].y, 'edge contact advances the formation');
});

test('enemy projectiles damage the ship, and the shield blocks damage with a recharge period', () => {
  const game = new SpaceInvaders(216);
  let projectileSeen = false;
  for (let frame = 0; frame < 8 * 120 && game.lives === 3; frame++) {
    const state = game.snapshot;
    const incoming = state.enemyBullets.find(bullet => bullet.y > 110);
    if (incoming) {
      projectileSeen = true;
      if (Math.abs(incoming.x - state.x) > 9) game.input(incoming.x < state.x ? 'L' : 'R');
    }
    game.update(1 / 120);
  }
  assert.ok(projectileSeen);
  assert.equal(game.lives, 2, 'a projectile crossing the ship costs a life');
  const shielded = new SpaceInvaders(216);
  let guarded = false;
  for (let frame = 0; frame < 3 * 120; frame++) {
    const state = shielded.snapshot;
    const incoming = state.enemyBullets.find(bullet => bullet.y > 110);
    if (incoming) {
      if (Math.abs(incoming.x - state.x) > 9) shielded.input(incoming.x < state.x ? 'L' : 'R');
      if (!guarded && incoming.y > 135) { shielded.input('B'); guarded = true; }
    }
    shielded.update(1 / 120);
  }
  assert.equal(guarded, true);
  assert.equal(shielded.lives, 3, 'the shield intercepts an otherwise damaging projectile');
  assert.equal(shielded.snapshot.shieldReady, false);
  shielded.input('B');
  assert.equal(shielded.snapshot.shield, false, 'repeated presses cannot bypass the cooldown');
  for (let frame = 0; frame < 3 * 120; frame++) shielded.update(1 / 120);
  shielded.input('B');
  assert.equal(shielded.snapshot.shield, true, 'the shield becomes available after recharging');
});

test('a complete invader formation can be defeated and starts a fresh harder wave', () => {
  const games = [new SpaceInvaders(216), new SpaceInvaders(216)];
  for (const game of games) {
    for (let frame = 0; frame < 30 * 60 && game.wave === 1 && !game.gameOver; frame++) {
      const state = game.snapshot;
      // Aiming through the actual controls exercises movement, bullet travel and collision together.
      const target = state.enemies
        .filter(a => !state.enemies.some(b => b.id % 7 === a.id % 7 && b.y > a.y))
        .sort((a, b) => Math.abs(a.x - state.x) - Math.abs(b.x - state.x))[0];
      if (target) {
        const aim = target.x + state.direction * state.speed * (150 - target.y) / 185;
        if (Math.abs(aim - state.x) > 8) game.input(aim < state.x ? 'L' : 'R');
        game.input('A');
        game.input('B');
      }
      game.update(1 / 60);
    }
    assert.equal(game.wave, 2);
    assert.equal(game.score, 210);
    assert.equal(game.snapshot.enemies.length, 21);
    assert.ok(game.snapshot.enemies.every(enemy => enemy.id >= 21));
  }
  assert.deepEqual(games[0].snapshot, games[1].snapshot, 'the same inputs and seed reproduce a run');
});

test('three invader hits end the game, and A restores the original formation and lives', () => {
  const game = new SpaceInvaders(216);
  const initial = game.snapshot;
  for (let frame = 0; frame < 30 * 120 && !game.gameOver; frame++) {
    const state = game.snapshot;
    const incoming = state.enemyBullets.filter(bullet => bullet.y > 100).sort((a, b) => b.y - a.y)[0];
    if (incoming && Math.abs(incoming.x - state.x) > 9) game.input(incoming.x < state.x ? 'L' : 'R');
    game.update(1 / 120);
  }
  assert.equal(game.lives, 0);
  assert.equal(game.gameOver, true);
  const stopped = game.snapshot;
  game.update(10);
  game.input('R');
  assert.deepEqual(game.snapshot, stopped);
  game.input('A');
  assert.deepEqual(game.snapshot, initial);
});

test('falling pieces rotate, stay inside walls, stop on locked cells and lock without overlap', () => {
  const game = new FallingBlocks(149); // The deterministic bag begins I, O, L, S.
  assert.equal(game.snapshot.active.type, 'I');
  const horizontal = game.snapshot.active.cells;
  assert.equal(new Set(horizontal.map(([, y]) => y)).size, 1);
  game.input('A');
  assert.equal(new Set(game.snapshot.active.cells.map(([x]) => x)).size, 1, 'A turns the bar upright');
  for (let step = 0; step < 20; step++) game.input('L');
  assert.equal(Math.min(...game.snapshot.active.cells.map(([x]) => x)), 0);
  assert.equal(game.move(-1), false, 'a piece cannot pass through a wall');
  game.input('U');
  assert.ok(game.snapshot.active.cells.every(([x, y]) => x >= 0 && x < 10 && y >= 0 && y < 16), 'rotation kicks the bar into the board');
  game.input('B');
  assert.equal(game.pieces, 1);
  assert.equal(game.snapshot.board.flat().filter(Boolean).length, 4);
  while (game.move(0, 1)) { /* Lower the next piece to its collision surface. */ }
  const before = game.snapshot;
  assert.equal(game.move(0, 1), false);
  assert.deepEqual(game.snapshot.active, before.active);
  assert.ok(before.active.cells.every(([x, y]) => before.board[y][x] === 0), 'the falling piece never occupies a locked cell');
  game.input('D');
  assert.equal(game.pieces, 2, 'soft drop locks a blocked piece');
  assert.equal(game.snapshot.board.flat().filter(Boolean).length, 8);
});

test('four placed tetrominoes clear a complete row and the remaining blocks fall', () => {
  const game = new FallingBlocks(149);
  // I at columns 6–9, O at 0–1, a turned L at 2–3, then S at 4–5.
  for (const input of 'RRRBLLLBULLBRB') game.input(input as 'R' | 'L' | 'B' | 'U');
  assert.equal(game.lines, 1);
  assert.equal(game.pieces, 4);
  assert.ok(game.score >= 100);
  assert.equal(game.snapshot.board.flat().filter(Boolean).length, 6, 'six cells remain after clearing ten of the sixteen placed cells');
  assert.ok(game.snapshot.board.every(row => row.some(cell => cell === 0)), 'the completed row is removed');
  assert.equal(game.snapshot.board[15].filter(Boolean).length, 5, 'the row above settles into the cleared row');
});

test('simultaneous full rows clear together while preserving all surviving row order', () => {
  const board = [[0, 3, 0, 0], [1, 1, 1, 1], [0, 2, 2, 0], [4, 4, 4, 4]];
  const original = structuredClone(board);
  const result = clearBlockRows(board);
  assert.equal(result.cleared, 2);
  assert.deepEqual(result.board, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 3, 0, 0], [0, 2, 2, 0]]);
  assert.deepEqual(board, original, 'clearing rows does not mutate the source board');
});

test('a full stack ends the block game and A restarts a clean board with the same seeded bag', () => {
  const game = new FallingBlocks(149);
  const first = game.snapshot.active;
  for (let piece = 0; piece < 40 && !game.gameOver; piece++) game.input('B');
  assert.equal(game.gameOver, true);
  const stopped = game.snapshot;
  game.update(10);
  game.input('L');
  assert.deepEqual(game.snapshot, stopped, 'game over stops gravity and movement');
  game.input('A');
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
  assert.equal(game.pieces, 0);
  assert.ok(game.snapshot.board.flat().every(cell => cell === 0));
  assert.deepEqual(game.snapshot.active, first);
});
