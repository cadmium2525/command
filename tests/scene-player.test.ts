import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS, TRUE_ENDING } from '../src/data/catalog';
import { ScenePlayer, SUPPORTED_ACTIONS } from '../src/events/player';
import { SUPPORTED_MECHANICS } from '../src/events/minigames';
import { PALETTES } from '../src/events/art';
import { createPlaybackTimeline, readingDuration } from '../src/events/pacing';

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
  const scales: number[] = [];
  const drawing: { method: PropertyKey; values: unknown[] }[] = [];
  let capture = false;
  const context = new Proxy({}, {
    get: (_target, name) => (...values: unknown[]) => {
      for (const value of values) if (typeof value === 'number') assert.ok(Number.isFinite(value), 'drawing coordinates remain finite');
      if (name === 'scale') scales.push(Number(values[1]));
      if (capture) drawing.push({ method: name, values });
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
    scales,
    drawing,
    capture: () => { drawing.length = 0; capture = true; },
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
      for (let frame = 0; frame <= Math.ceil(scene.durationMs / 100) + 3 && completions === 0; frame++) browser.step();
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
    assert.equal(browser.pending(), 0, 'pausing stops scheduled animation work');
    for (let frame = 0; frame < 10; frame++) browser.step();
    assert.deepEqual(beats, [0]);
    assert.equal(completions, 0);
    scene.pause(false);
    for (let frame = 0; frame < 32; frame++) browser.step();
    assert.deepEqual(beats, [0, 1]);
    assert.equal(completions, 0, 'the final caption still receives its own reading hold');
    for (let frame = 0; frame < 32; frame++) browser.step();
    assert.equal(completions, 1);
    assert.equal(browser.pending(), 0);
  } finally {
    browser.restore();
  }
});

test('reading holds give Japanese captions time without altering the production catalogue', () => {
  assert.equal(readingDuration('はい。'), 3000);
  assert.equal(readingDuration('あ'.repeat(40)), 5400);
  assert.equal(readingDuration('あ'.repeat(200)), 10000);
  for (const event of [...EVENTS, TRUE_ENDING]) {
    const original = JSON.stringify(event);
    const playback = createPlaybackTimeline(event);
    assert.equal(JSON.stringify(event), original, 'original duration and timestamps are not mutated');
    if (event.mechanic) {
      assert.equal(playback.durationMs, event.durationMs, 'minigames keep their real-time clock');
      assert.deepEqual(playback.timeline, event.timeline);
    } else {
      assert.ok(playback.durationMs >= event.durationMs);
      for (const [index, beat] of playback.timeline.entries()) {
        const hold = (playback.timeline[index + 1]?.at ?? playback.durationMs) - beat.at;
        assert.ok(hold >= readingDuration(beat.text), `${event.eventId}: caption ${index + 1} has enough time`);
      }
    }
  }
});

test('short scenes hold both captions and preserve the final frame until explicitly dismissed', () => {
  const browser = virtualBrowser();
  try {
    const event = { ...EVENTS[0], durationMs: 400, timeline: [
      { at: 0, text: '箱を見つけた。', action: 'enter' },
      { at: 200, text: '箱のうしろに、猫が隠れていた。', action: 'reveal' },
    ] };
    const beats: number[] = [];
    let completions = 0;
    const scene = new ScenePlayer(browser.canvas, event, { reducedMotion: true, onBeat: (_beat, index) => beats.push(index), onComplete: () => { completions++; } });
    assert.equal(scene.durationMs, 6000);
    for (let frame = 0; frame < 29; frame++) browser.step();
    assert.deepEqual(beats, [0], 'the original 200ms beat is extended to a readable hold');
    for (let frame = 0; frame < 31; frame++) browser.step();
    assert.deepEqual(beats, [0, 1]);
    assert.equal(completions, 0, 'the final caption has not been skipped');
    browser.step();
    assert.equal(completions, 1);
    assert.equal(scene.progress, 1);
    assert.equal(scene.isComplete, true);
    assert.equal(browser.pending(), 0);
    scene.input('A');
    scene.previousBeat();
    assert.equal(scene.currentBeatIndex, 0, 'finished stories can review earlier still frames');
    scene.nextBeat();
    scene.nextBeat();
    browser.step();
    assert.equal(completions, 1, 'reviewing never awards completion twice');
    assert.equal(browser.pending(), 0);
    scene.dispose();
  } finally { browser.restore(); }
});

test('reading controls change story beats while minigame controls never skip their clock', () => {
  const browser = virtualBrowser();
  try {
    const beats: number[] = [];
    let completions = 0;
    const story = new ScenePlayer(browser.canvas, EVENTS.find(event => !event.mechanic)!, { reducedMotion: false, onBeat: (_beat, index) => beats.push(index), onComplete: () => { completions++; } });
    story.nextBeat();
    assert.equal(story.currentBeatIndex, 1);
    story.previousBeat();
    assert.equal(story.currentBeatIndex, 0);
    assert.deepEqual(beats, [0, 1, 0]);
    assert.equal(completions, 0);
    assert.equal(browser.pending(), 1);
    story.dispose();
    const event = EVENTS.find(candidate => candidate.mechanic)!;
    const game = new ScenePlayer(browser.canvas, event, { reducedMotion: false, onComplete: () => { completions++; } });
    game.nextBeat();game.previousBeat();
    assert.equal(game.progress, 0);
    assert.equal(game.currentBeatIndex, 0);
    assert.equal(game.durationMs, event.durationMs);
    game.dispose();
    assert.equal(browser.pending(), 0);
  } finally { browser.restore(); }
});

test('a grown actor stays large through the next action and shrinks back to its original size', () => {
  const browser = virtualBrowser();
  try {
    const event = { ...EVENTS[0], actor: 'hero' as const, prop: 'box' as const, durationMs: 900, timeline: [
      { at: 0, text: '主人公が大きくなる。', action: 'grow' },
      { at: 300, text: '大きいまま体を揺らす。', action: 'shake' },
      { at: 600, text: '元の大きさに戻る。', action: 'shrink' },
    ] };
    const scene = new ScenePlayer(browser.canvas, event, { reducedMotion: false, onComplete: () => {} });
    assert.equal(Math.max(...browser.scales), 1.8, 'the actor starts at its normal scale');
    browser.scales.length = 0;
    scene.nextBeat();
    assert.equal(Math.max(...browser.scales), 2.9, 'the next caption retains the visible growth');
    for (let frame = 0; frame < 10; frame++) browser.step();
    assert.equal(browser.scales.at(-1), 2.9, 'shaking does not reset the actor');
    scene.nextBeat();
    for (let frame = 0; frame < 32; frame++) browser.step();
    assert.equal(browser.scales.at(-1), 1.8, 'the final frame returns to the original size');
    assert.equal(browser.pending(), 0);
    scene.dispose();
  } finally { browser.restore(); }
});

test('space scenes retain the moon group and floating height while the next caption is read', () => {
  const browser = virtualBrowser();
  try {
    const space = new ScenePlayer(browser.canvas, EVENTS.find(event => event.command === 'UUU')!, { reducedMotion: true, onComplete: () => {} });
    space.nextBeat();
    browser.capture();
    space.nextBeat();
    assert.equal(browser.drawing.filter(call => call.method === 'scale' && call.values[1] === .6).length, 5, 'the five orbiting moons remain visible during the final greeting');
    assert.deepEqual(browser.drawing.filter(call => call.method === 'translate').at(-1)?.values, [110, 94], 'the traveller remains up in space');
    space.dispose();
    const event = { ...EVENTS[0], durationMs: 400, timeline: [
      { at: 0, text: 'ふわりと浮かんだ。', action: 'float' },
      { at: 200, text: '空中で踊り始めた。', action: 'dance' },
    ] };
    const floating = new ScenePlayer(browser.canvas, event, { reducedMotion: true, onComplete: () => {} });
    browser.capture();floating.nextBeat();
    assert.deepEqual(browser.drawing.filter(call => call.method === 'translate').at(-1)?.values, [110, 112], 'dancing keeps the actor above the ground');
    floating.dispose();
  } finally { browser.restore(); }
});

test('a sleeping actor wakes to walk and the early ending displays an actual END sign', () => {
  const browser = virtualBrowser();
  try {
    const event = { ...EVENTS[0], durationMs: 400, timeline: [
      { at: 0, text: 'ひと休み。', action: 'sleep' },
      { at: 200, text: '起きて歩こう。', action: 'walk' },
    ] };
    const scene = new ScenePlayer(browser.canvas, event, { reducedMotion: true, onComplete: () => {} });
    scene.nextBeat();
    for (let frame = 0; frame < 20; frame++) browser.step();
    browser.capture();browser.step();
    assert.equal(browser.drawing.filter(call => call.method === 'rotate').at(-1)?.values[0], 0, 'walking restores an upright posture');
    scene.dispose();
    browser.capture();
    const ending = new ScenePlayer(browser.canvas, EVENTS.find(candidate => candidate.command === 'BBB')!, { reducedMotion: true, onComplete: () => {} });
    assert.ok(browser.drawing.some(call => call.method === 'fillText' && call.values[0] === 'END'), 'the fake ending has a concrete readable payoff');
    ending.dispose();
  } finally { browser.restore(); }
});
