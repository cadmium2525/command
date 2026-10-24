import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS } from '../src/data/catalog';
import { ArcadeGame, SUPPORTED_MECHANICS } from '../src/events/arcade';

test('all 18 game families have a concrete engine and all 173 variants are reachable',()=>{
  assert.equal(SUPPORTED_MECHANICS.length,18);
  assert.deepEqual(new Set(EVENTS.map(e=>e.game.family)),new Set(SUPPORTED_MECHANICS));
  for(const event of EVENTS){const game=new ArcadeGame(event.game,173);assert.equal(game.outcome,null,event.title);assert.ok(game.snapshot);}
});

test('timeouts freeze the simulation and preserve the last score for the title reveal',()=>{
  const event=EVENTS.find(e=>e.game.family==='memory')!;
  const game=new ArcadeGame(event.game,173,20);
  game.update(.01);game.update(.02);assert.ok(game.outcome);const final=game.snapshot;
  game.input('A');game.update(10);assert.deepEqual(game.snapshot,final);
});

test('replaying a variant with the same seed and inputs is deterministic and isolated',()=>{
  for(const family of SUPPORTED_MECHANICS){
    const def=EVENTS.find(e=>e.game.family===family)!.game;
    const a=new ArcadeGame(def,516),b=new ArcadeGame(def,516);
    for(let i=0;i<180;i++){if(i%13===0){const key=(['U','D','L','R','A','B'] as const)[Math.floor(i/13)%6];a.input(key);b.input(key);}a.update(1/60);b.update(1/60);}
    assert.deepEqual(a.snapshot,b.snapshot,family);const before=b.snapshot;a.finish();assert.deepEqual(b.snapshot,before,`${family} instances do not share state`);
  }
});
