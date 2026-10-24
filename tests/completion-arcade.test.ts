import assert from 'node:assert/strict';
import test from 'node:test';
import type { InputSymbol } from '../src/data/types';
import type { ArcadeDefinition, ArcadeEngine, ArcadeOutcome } from '../src/events/arcade-types';
import { CompletionArcade, COMPLETION_DEFINITION, COMPLETION_FAMILIES, createCompletionGame } from '../src/events/completion-arcade';
import { PALETTES } from '../src/events/art';

class TestCartridge implements ArcadeEngine {
  score = 0;
  outcome: ArcadeOutcome | null = null;
  time = 0;
  lives = 3;
  inputs: InputSymbol[] = [];
  constructor(private readonly mode: 'calm'|'win'|'hit'|'lose' = 'calm') {}
  input(key: InputSymbol) {
    if (this.outcome) return;
    this.inputs.push(key);
    this.score += 7;
    if (key === 'A' && this.mode === 'win') this.outcome = { status:'win', reason:'board clear' };
    if (key === 'B' && this.mode === 'lose') this.outcome = { status:'lose', reason:'collision' };
    if (key === 'B' && this.mode === 'hit') this.lives--;
  }
  update(dt: number) { if (!this.outcome) { this.time += dt; this.score += dt * 10; } }
  draw() {}
  get snapshot() { return { time:this.time, lives:this.lives, score:this.score, inputs:[...this.inputs] }; }
}
const advance = (game: ArcadeEngine, seconds: number) => {
  for (let frame=0; frame<Math.ceil(seconds*120) && !game.outcome; frame++) game.update(1/120);
};
const resume = (game: CompletionArcade) => { advance(game,.7); game.input('A'); assert.equal(game.snapshot.phase,'playing'); };

test('completion has its own unlimited reward definition and five real basic genres', () => {
  assert.equal(COMPLETION_DEFINITION.playMode,'endless');
  assert.equal(COMPLETION_DEFINITION.durationMs,0);
  assert.equal(COMPLETION_DEFINITION.variant,173);
  assert.deepEqual(COMPLETION_FAMILIES,['blocks','invaders','snake','breakout','runner']);
  const game=createCompletionGame(173);
  assert.equal(game.outcome,null);
  assert.equal(game.snapshot.activeFamily,'blocks');
  assert.equal(game.snapshot.lives,3);
  assert.ok(game.instruction?.includes('落ちもの'));
  assert.equal(game.instruction?.includes(COMPLETION_DEFINITION.title),false,'the final title is not part of play instructions');
});

test('section clocks rotate all five games without ending the session and carry earned points', () => {
  const loaded: string[]=[];
  const game=new CompletionArcade(173,(definition: ArcadeDefinition) => { loaded.push(definition.family); return new TestCartridge(); });
  let previous=0;
  for (let round=0; round<10; round++) {
    game.input('R');
    advance(game,Number(game.snapshot.sectionDuration)+.02);
    assert.equal(game.outcome,null);
    assert.equal(game.snapshot.phase,'ready');
    assert.equal(game.snapshot.round,round+1);
    assert.equal(game.snapshot.lives,3);
    assert.ok(game.score>previous,'section score remains after loading a fresh engine');
    previous=game.score;
    resume(game);
  }
  assert.deepEqual(loaded.slice(0,5),[...COMPLETION_FAMILIES]);
  assert.deepEqual(loaded.slice(5,10),[...COMPLETION_FAMILIES]);
  assert.ok(Number(game.snapshot.totalTime)>120);
  assert.ok(Number(game.snapshot.speed)>1);
  assert.ok(Number(game.snapshot.sectionDuration)<14);
});

test('READY pauses the new cartridge and gives changed controls a readable transition', () => {
  const cartridges: TestCartridge[]=[];
  const game=new CompletionArcade(73,() => { const engine=new TestCartridge(); cartridges.push(engine); return engine; });
  advance(game,14.02);
  assert.equal(game.snapshot.activeFamily,'invaders');
  assert.ok(game.instruction.includes('シューティング'));
  assert.ok(game.instruction.includes('発射'));
  const time=cartridges[1].time;
  game.input('L'); game.input('A'); advance(game,.4);
  assert.equal(game.snapshot.phase,'ready');
  assert.equal(cartridges[1].time,time);
  assert.deepEqual(cartridges[1].inputs,[]);
  advance(game,.3); game.input('A');
  assert.equal(game.snapshot.phase,'playing');
  assert.deepEqual(cartridges[1].inputs,[],'the ready confirmation is not fired into the new game');
  game.input('A');
  assert.deepEqual(cartridges[1].inputs,['A']);
});

test('clearing a cartridge awards a bonus and immediately prepares the next genre', () => {
  const game=new CompletionArcade(73,() => new TestCartridge('win'));
  game.input('A');
  assert.equal(game.outcome,null);
  assert.equal(game.snapshot.phase,'ready');
  assert.equal(game.snapshot.activeFamily,'invaders');
  assert.equal(game.snapshot.lives,3);
  assert.equal(game.score,57);
  assert.ok(game.instruction.includes('クリア'));
});

test('individual damage consumes one of three shared lives, not three lives per cartridge', () => {
  const game=new CompletionArcade(73,() => new TestCartridge('hit'));
  for (const remaining of [2,1,0]) {
    game.input('B');
    assert.equal(game.snapshot.lives,remaining);
    if (remaining) { assert.equal(game.outcome,null); resume(game); }
  }
  assert.equal(game.outcome?.status,'lose');
  assert.equal(game.snapshot.phase,'result');
  const before=game.snapshot;
  game.input('A'); game.input('B'); game.update(20);
  assert.deepEqual(game.snapshot,before,'the final board and score remain stable');
});

test('a natural loss costs a shared life even without a decrease in the cartridge life counter', () => {
  const game=new CompletionArcade(216,() => new TestCartridge('lose'));
  game.input('B');
  assert.equal(game.snapshot.lives,2);
  assert.equal(game.snapshot.phase,'ready');
  assert.equal(game.snapshot.activeFamily,'invaders');
  assert.equal(game.outcome,null);
});

const context=new Proxy({}, {
  get:() => (...values:unknown[]) => { for(const value of values) if(typeof value==='number') assert.ok(Number.isFinite(value)); },
  set:(_target,_key,value) => { if(typeof value==='number') assert.ok(Number.isFinite(value)); return true; },
}) as CanvasRenderingContext2D;

test('real blocks give way to real invaders with shared score, readable controls and finite rendering', () => {
  const game=createCompletionGame(173);
  assert.equal((game.snapshot.engine as Record<string,unknown>).family,'blocks');
  game.draw(context,PALETTES.midnight,false);
  for(let piece=0; piece<30 && game.snapshot.activeFamily==='blocks'; piece++) game.input('B');
  assert.equal(game.snapshot.activeFamily,'invaders');
  assert.equal(game.snapshot.lives,2);
  assert.ok(game.score>0,'hard drops earn points before the first loss');
  const banked=game.score;
  advance(game,2.1);
  assert.equal(game.snapshot.phase,'playing');
  assert.equal((game.snapshot.engine as Record<string,unknown>).family,'invaders');
  assert.ok(game.instruction?.includes('発射'));
  for(let frame=0; frame<180 && !game.outcome && game.snapshot.activeFamily==='invaders'; frame++) {
    if(frame%22===0) game.input('A');
    game.update(1/120);
  }
  assert.ok(game.score>=banked);
  game.draw(context,PALETTES.midnight,true);
});

test('the same seed and controls produce independent reproducible remix sessions', () => {
  const first=createCompletionGame(516),second=createCompletionGame(516);
  for(let frame=0; frame<2400 && !first.outcome; frame++) {
    if(frame%31===0) for(const game of [first,second]) game.input((['L','R','A','B'] as const)[Math.floor(frame/31)%4]);
    first.update(1/120); second.update(1/120);
  }
  assert.deepEqual(first.snapshot,second.snapshot);
  const before=second.snapshot;
  first.input('B'); first.update(.1);
  assert.deepEqual(second.snapshot,before);
});
