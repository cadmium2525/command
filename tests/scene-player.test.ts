import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS, TRUE_ENDING } from '../src/data/catalog';
import { ScenePlayer, SUPPORTED_ACTIONS } from '../src/events/player';
import { SUPPORTED_MECHANICS } from '../src/events/minigames';
import { PALETTES } from '../src/events/art';

test('every narrative action, palette, and minigame maps to an implemented renderer', () => {
  for (const event of [...EVENTS, TRUE_ENDING]) {
    assert.ok(PALETTES[event.palette], `${event.eventId}: unknown palette ${event.palette}`);
    for (const beat of event.timeline) assert.ok((SUPPORTED_ACTIONS as readonly string[]).includes(beat.action), `${event.eventId}: unknown action ${beat.action}`);
    if (event.mechanic) assert.ok((SUPPORTED_MECHANICS as readonly string[]).includes(event.mechanic), `${event.eventId}: unknown mechanic ${event.mechanic}`);
    if (event.category === 'minigame') assert.ok(event.mechanic, `${event.eventId}: missing mechanic`);
  }
});

function virtualBrowser() {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let nextId = 0;
  let now = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const context = new Proxy({}, {
    get: () => (...values: unknown[]) => {
      for (const value of values) if (typeof value === 'number') assert.ok(Number.isFinite(value), 'drawing coordinates remain finite');
    },
    set: (_target, _name, value) => {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), 'drawing properties remain finite');
      return true;
    },
  });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => context } as unknown as HTMLCanvasElement;
  globalThis.requestAnimationFrame = callback => { const id = ++nextId; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  return {
    canvas,
    pending: () => frames.size,
    step: (milliseconds = 100) => {
      now += milliseconds;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(now);
    },
    restore: () => {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    },
  };
}

test('all 173 events and the true ending finish, deliver every beat, and leave no timers', () => {
  const browser = virtualBrowser();
  try {
    for (const [index, event] of [...EVENTS, TRUE_ENDING].entries()) {
      const beats: number[] = [];
      let completions = 0;
      let reportedProgress = 0;
      const scene = new ScenePlayer(browser.canvas, event, {
        reducedMotion: index % 2 === 0,
        onBeat: (_beat, beatIndex) => beats.push(beatIndex),
        onProgress: value => {
          assert.ok(value >= reportedProgress && value <= 1, `${event.eventId}: monotonic progress`);
          reportedProgress = value;
        },
        onComplete: () => { completions += 1; },
      });
      scene.input('A');
      for (let frame = 0; frame <= Math.ceil(event.durationMs / 100) + 3 && completions === 0; frame++) browser.step();
      assert.equal(completions, 1, `${event.eventId}: complete exactly once`);
      assert.equal(reportedProgress, 1, event.eventId);
      assert.deepEqual(beats, event.timeline.map((_beat, beatIndex) => beatIndex), event.eventId);
      assert.equal(browser.pending(), 0, `${event.eventId}: no frame after completion`);
      browser.step();
      assert.equal(completions, 1, event.eventId);
      scene.dispose();
    }
  } finally {
    browser.restore();
  }
});

test('skipping and disposing a scene cancels its scheduled work immediately', () => {
  const browser = virtualBrowser();
  try {
    let completions = 0;
    const scene = new ScenePlayer(browser.canvas, TRUE_ENDING, { reducedMotion: true, onComplete: () => { completions += 1; } });
    browser.step();
    browser.step();
    assert.equal(browser.pending(), 1);
    scene.dispose();
    assert.equal(browser.pending(), 0);
    scene.input('A');
    for (let frame = 0; frame < 10; frame++) browser.step();
    assert.equal(completions, 0);
    scene.dispose();
    assert.equal(browser.pending(), 0);
  } finally {
    browser.restore();
  }
});

test('a paused scene keeps its position and resumes without jumping over beats', () => {
  const browser = virtualBrowser();
  try {
    const event = { ...EVENTS[0], durationMs: 400, timeline: [
      { at: 0, text: 'はじまり', action: 'enter' },
      { at: 200, text: 'おしまい', action: 'celebrate' },
    ] };
    const beats: number[] = [];
    let completions = 0;
    const scene = new ScenePlayer(browser.canvas, event, { reducedMotion: true, onBeat: (_beat, index) => beats.push(index), onComplete: () => { completions += 1; } });
    browser.step();
    scene.pause();
    for (let frame = 0; frame < 10; frame++) browser.step();
    assert.deepEqual(beats, [0]);
    assert.equal(completions, 0);
    scene.pause(false);
    for (let frame = 0; frame < 8; frame++) browser.step();
    assert.deepEqual(beats, [0, 1]);
    assert.equal(completions, 1);
    assert.equal(browser.pending(), 0);
  } finally {
    browser.restore();
  }
});
