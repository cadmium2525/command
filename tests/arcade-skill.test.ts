import assert from 'node:assert/strict';
import test from 'node:test';
import { createSkillGame, SKILL_DEFINITIONS } from '../src/events/arcade-skill';
import type { ArcadeDefinition, ArcadeEngine } from '../src/events/arcade-types';
import type { InputSymbol } from '../src/data/types';
import { PALETTES } from '../src/events/art';

const KEYS:InputSymbol[]=['U','R','D','L','A','B'];
const definitions=(family:string)=>SKILL_DEFINITIONS.filter(def=>def.family===family);
const advance=(game:ArcadeEngine,seconds:number)=>{for(let frame=0;frame<seconds*100&&!game.outcome;frame++)game.update(.01);};
const context=new Proxy({}, {get:()=> (...values:unknown[])=>{for(const value of values)if(typeof value==='number')assert.ok(Number.isFinite(value));},set:(_target,_key,value)=>{if(typeof value==='number')assert.ok(Number.isFinite(value));return true;}}) as CanvasRenderingContext2D;

test('81 skill definitions each have explicit rules and nine distinct variants per family',()=>{
  assert.equal(SKILL_DEFINITIONS.length,81);
  assert.equal(new Set(SKILL_DEFINITIONS.map(def=>def.title)).size,81);
  for(const family of ['memory','rhythm','typing','balance','fishing','racer','lander','reaction','clicker']){
    const rows=definitions(family);assert.deepEqual(rows.map(def=>def.variant),[0,1,2,3,4,5,6,7,8]);
    assert.equal(new Set(rows.map(def=>def.rule)).size,9);
    for(const def of rows){assert.ok(def.rule.length>12);assert.ok(def.controls.length>4);assert.ok(def.durationMs>=8000&&def.durationMs<=30000);}
  }
});

test('all 81 skill games draw finite geometry, naturally finish and freeze their result',()=>{
  for(const def of SKILL_DEFINITIONS){
    const game=createSkillGame(def,241);game.draw(context,PALETTES.midnight,false);
    for(let frame=0;frame<def.durationMs/100+3&&!game.outcome;frame++){game.update(.1);if(frame%25===0)game.draw(context,PALETTES.midnight,true);}
    assert.ok(game.outcome,`${def.family}-${def.variant}: natural ending`);
    const result=JSON.stringify({score:game.score,outcome:game.outcome,snapshot:game.snapshot});
    game.input('A');game.input('R');game.update(.1);game.draw(context,PALETTES.midnight,false);
    assert.equal(JSON.stringify({score:game.score,outcome:game.outcome,snapshot:game.snapshot}),result,'a finished game cannot keep changing');
  }
});

test('every memory variant can be won with its stated order; reverse and opposite rules differ',()=>{
  for(const def of definitions('memory')){
    const game=createSkillGame(def,42);
    for(let frame=0;frame<2400&&!game.outcome;frame++){
      game.update(.01);const state=game.snapshot;
      if(state.phase==='input')for(const key of state.expected as InputSymbol[])game.input(key);
    }
    assert.equal(game.outcome?.status,'win',def.title);
  }
  const reverse=createSkillGame(definitions('memory')[1],42).snapshot;
  assert.deepEqual(reverse.expected,[...(reverse.sequence as InputSymbol[])].reverse());
  const opposite=createSkillGame(definitions('memory')[3],42).snapshot;
  assert.notDeepEqual(opposite.expected,opposite.sequence);
});

test('rhythm variants have hittable notes, rests, acceleration and true paired inputs',()=>{
  for(const def of definitions('rhythm')){
    const game=createSkillGame(def,51);
    for(let frame=0;frame<2000&&!game.outcome;frame++){
      game.update(.01);const state=game.snapshot;
      for(const note of state.notes as {at:number;key:InputSymbol;hit:boolean;rest:boolean}[])if(!note.hit&&!note.rest&&Math.abs(note.at-Number(state.time))<.011)game.input(note.key);
    }
    assert.equal(game.outcome?.status,'win',def.title);
  }
  const pairs=createSkillGame(definitions('rhythm')[7],3).snapshot.notes as {at:number;key:InputSymbol}[];
  assert.equal(pairs[0].at,pairs[1].at);assert.notEqual(pairs[0].key,pairs[1].key);
  const fast=createSkillGame(definitions('rhythm')[5],3).snapshot.notes as {at:number}[];
  assert.ok(fast[1].at-fast[0].at>fast.at(-1)!.at-fast.at(-2)!.at);
});

test('all command variants accept correct inputs, selector mode requires confirmation and strict mode rejects errors',()=>{
  for(const def of definitions('typing')){
    const game=createSkillGame(def,61);if(def.variant===6)advance(game,2.05);
    const expected=game.snapshot.expected as InputSymbol[];
    for(const key of expected){
      if(def.variant===8){let guard=0;while(KEYS[Number(game.snapshot.selected)]!==key&&guard++<6)game.input('R');game.input('A');}
      else game.input(key);
    }
    assert.equal(game.outcome?.status,'win',def.title);
  }
  const strict=createSkillGame(definitions('typing')[4],61);strict.input('B');assert.equal(strict.outcome?.status,'lose');
  const timed=createSkillGame(definitions('typing')[5],61);advance(timed,1.1);assert.equal(timed.outcome?.status,'lose');
});

test('all balance rules allow control into their safety zones, including both axes',()=>{
  for(const def of definitions('balance')){
    const game=createSkillGame(def,15);let previousTarget=Number(game.snapshot.target);
    for(let frame=0;frame<2100&&!game.outcome;frame++){
      const s=game.snapshot,target=Number(s.target),targetVelocity=(target-previousTarget)/.01;previousTarget=target;
      const desired=-2*(Number(s.angle)-target)+targetVelocity;
      if(Number(s.velocity)>desired+.14)game.input(def.variant===1?'R':'L');
      if(Number(s.velocity)<desired-.14)game.input(def.variant===1?'L':'R');
      if(def.variant===8){const desiredY=-2*Number(s.vertical);if(Number(s.verticalVelocity)>desiredY+.14)game.input('U');if(Number(s.verticalVelocity)<desiredY-.14)game.input('D');}
      game.update(.01);
    }
    assert.equal(game.outcome?.status,'win',def.title);
  }
});

test('all fishing rules can catch actual moving targets with the displayed line',()=>{
  for(const def of definitions('fishing')){
    const game=createSkillGame(def,7);
    for(let frame=0;frame<2400&&!game.outcome;frame++){
      const s=game.snapshot,fish=(s.fish as {x:number;y:number;good:boolean}[]).find(f=>f.good)!;
      let guard=0;while(Math.abs(Number(game.snapshot.x)-fish.x)>7&&guard++<24){const left=Number(game.snapshot.x)>fish.x;game.input(def.variant===6?left?'R':'L':left?'L':'R');}
      if(!s.cast)game.input('A');
      if(Math.abs(Number(game.snapshot.hookY)-fish.y)<5)game.input('B');
      game.update(.01);
    }
    assert.equal(game.outcome?.status,'win',def.title);
  }
});

function drive(def:ArcadeDefinition):ArcadeEngine{
  const game=createSkillGame(def,37);
  for(let frame=0;frame<2350&&!game.outcome;frame++){
    const s=game.snapshot,items=s.items as {lane:number;y:number;kind:string}[];
    const obstacles=items.filter(item=>item.kind==='obstacle'&&item.y>117&&item.y<190);
    const safe=Array.from({length:Number(s.lanes)},(_,lane)=>lane).filter(lane=>!obstacles.some(item=>item.lane===lane));
    const coin=items.filter(item=>item.kind==='coin'&&item.y>122&&item.y<183&&safe.includes(item.lane)).sort((a,b)=>b.y-a.y)[0];
    const target=coin?.lane??(safe.includes(Number(s.lane))?Number(s.lane):safe[0]);
    if(target!==undefined){let guard=0;while(Number(game.snapshot.lane)!==target&&guard++<6){const left=Number(game.snapshot.lane)>target;game.input(def.variant===7?left?'R':'L':left?'L':'R');}}
    game.update(.01);
  }
  return game;
}
test('each road has a route to victory including coins, fuel and the one-collision limit',()=>{
  for(const def of definitions('racer'))assert.equal(drive(def).outcome?.status,'win',def.title);
});

test('all landers can reach and land on their actual pad with finite fuel',()=>{
  for(const def of definitions('lander')){
    const game=createSkillGame(def,19);
    for(let frame=0;frame<2350&&!game.outcome;frame++){
      const s=game.snapshot,pad=s.pad as {x:number;width:number},x=Number(s.x),vx=Number(s.vx),vy=Number(s.vy),y=Number(s.y);
      const targetVelocity=clamp((pad.x-x)*.65,-18,18);
      if(vx>targetVelocity+6)game.input(def.variant===5?'R':'L');
      if(vx<targetVelocity-6)game.input(def.variant===5?'L':'R');
      if(y>125&&vy>13)game.input('A');
      game.update(.01);
    }
    assert.equal(game.outcome?.status,'win',`${def.title}: ${JSON.stringify(game.snapshot)}`);
  }
});
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}

test('all reaction rules reward correct signals and punish early inputs',()=>{
  for(const def of definitions('reaction')){
    const game=createSkillGame(def,9);
    for(let frame=0;frame<2150&&!game.outcome;frame++){game.update(.01);if(game.snapshot.phase==='signal')game.input(game.snapshot.expected as InputSymbol);}
    assert.equal(game.outcome?.status,'win',def.title);
    const early=createSkillGame(def,9);early.input('A');early.input('A');early.input('A');assert.equal(early.outcome?.status,'lose');
  }
});

test('clicking variants require their own alternation, banking, heat, release and investment rules',()=>{
  for(const def of definitions('clicker')){
    const game=createSkillGame(def,91);
    for(let frame=0;frame<1900&&!game.outcome;frame++){
      const s=game.snapshot;
      if(def.variant===2||def.variant===4)game.input(Number(s.energy)>= (def.variant===2?8:7)?'B':'A');
      else if(def.variant===3){if(Number(s.heat)<.7)game.input('A');}
      else if(def.variant===6){if(s.green)game.input('A');}
      else if(def.variant===8)game.input(game.score>=5&&Number(s.rate)<5?'A':'B');
      else game.input(s.expected as InputSymbol);
      game.update(.01);
    }
    assert.equal(game.outcome?.status,'win',def.title);
  }
  const overheated=createSkillGame(definitions('clicker')[3],1);for(let i=0;i<6;i++)overheated.input('A');assert.equal(overheated.outcome?.status,'lose');
});

test('variant differences change playable state, goals or valid actions rather than only names and colors',()=>{
  const game=(family:string,variant:number)=>createSkillGame(definitions(family)[variant],37);
  const memory=Array.from({length:9},(_,variant)=>game('memory',variant));
  memory.forEach(engine=>advance(engine,1.1));
  assert.equal(new Set(memory.map(engine=>{const {variant,time,family,...state}=engine.snapshot;return JSON.stringify(state);})).size,9,'memory lengths, alphabets, presentation phase and response order all differ');

  const rhythm=Array.from({length:9},(_,variant)=>game('rhythm',variant));
  assert.equal(new Set(rhythm.map(engine=>JSON.stringify({notes:engine.snapshot.notes,window:engine.snapshot.window}))).size,9,'rhythm changes note content, simultaneity, rest, timing or judging window');

  const typing=Array.from({length:9},(_,variant)=>game('typing',variant));
  typing.forEach(engine=>advance(engine,2.1));
  assert.equal(new Set(typing.map(engine=>JSON.stringify({keys:engine.snapshot.keys,expected:engine.snapshot.expected,visible:engine.snapshot.visible,outcome:engine.outcome}))).size,9,'command variants differ in required input, display, deadline or strict failure');

  const balance=Array.from({length:9},(_,variant)=>game('balance',variant));
  balance.forEach(engine=>{engine.input('L');engine.input('U');advance(engine,.4);});
  assert.equal(new Set(balance.map(engine=>{const {variant,time,family,...state}=engine.snapshot;return JSON.stringify(state);})).size,9,'balance changes physics, controls, safety zone, wind or axis count');
  const noBrake=game('balance',7);noBrake.input('L');const brakesBefore=noBrake.snapshot.brakes;noBrake.input('A');assert.equal(noBrake.snapshot.brakes,brakesBefore,'the brake-free variant really disables braking');

  const fishing=Array.from({length:9},(_,variant)=>game('fishing',variant));
  fishing.forEach(engine=>{engine.input('A');engine.input('L');advance(engine,.5);});
  assert.equal(new Set(fishing.map(engine=>{const {variant,time,family,...state}=engine.snapshot;return JSON.stringify(state);})).size,9,'fishing changes hit size, fish motion/depth/count, junk, controls or one-cast goal');

  const road=Array.from({length:9},(_,variant)=>game('racer',variant));
  road.forEach(engine=>{engine.input('L');advance(engine,2.1);});
  assert.equal(new Set(road.map(engine=>{const {variant,time,family,...state}=engine.snapshot;return JSON.stringify(state);})).size,9,'roads differ in lanes, target, speed, layout, lives, visibility, controls or fuel');
  assert.equal(road[4].snapshot.goal,'coins');assert.ok((road[6].snapshot.visibleItems as unknown[]).length<(road[6].snapshot.items as unknown[]).length);

  const lander=Array.from({length:9},(_,variant)=>game('lander',variant));
  lander.forEach(engine=>{engine.input('L');engine.input('B');advance(engine,.8);});
  assert.equal(new Set(lander.map(engine=>{const {variant,time,family,...state}=engine.snapshot;return JSON.stringify(state);})).size,9,'landers differ in pad, wind, fuel, input, rocks, braking or gravity');

  const normal=game('reaction',0),double=game('reaction',7),ordered=game('reaction',8);
  for(const engine of [normal,double,ordered]){while(engine.snapshot.phase==='wait')engine.update(.01);engine.input('A');}
  assert.equal(normal.snapshot.successes,1);assert.equal(double.snapshot.successes,0);assert.equal(double.snapshot.expected,'A');assert.equal(ordered.snapshot.expected,'B');
  assert.equal(game('reaction',6).snapshot.window,.3);
  const red=game('reaction',3),blue=game('reaction',5);
  for(const engine of [red,blue]){while(engine.snapshot.phase==='wait')engine.update(.01);assert.equal(engine.snapshot.phase,'fake');while(engine.snapshot.phase==='fake')engine.update(.01);while(engine.snapshot.phase==='wait')engine.update(.01);}
  assert.equal(red.snapshot.phase,'signal');assert.equal(blue.snapshot.phase,'fake','blue recognition uses consecutive decoys instead of a simple alternating fake');

  const click=Array.from({length:9},(_,variant)=>game('clicker',variant));
  click.forEach(engine=>{engine.input('A');engine.input('A');advance(engine,.2);for(let i=0;i<4;i++)engine.input('A');engine.input('B');});
  assert.equal(new Set(click.map(engine=>{const {variant,time,family,...state}=engine.snapshot;return JSON.stringify({state,score:engine.score});})).size,9,'clicking changes valid button, alternation, bank, heat, release, decay, gating or investment');
});

test('color recognition games display their stated green, red, blue and gray cues',()=>{
  const colors:string[]=[];
  const ctx=new Proxy({}, {get:()=>()=>{},set:(_target,key,value)=>{if(key==='fillStyle')colors.push(String(value));return true;}}) as CanvasRenderingContext2D;
  const game=createSkillGame(definitions('clicker')[6],3);
  game.draw(ctx,PALETTES.midnight,false);assert.ok(colors.includes('#78d79a'));
  colors.length=0;advance(game,.8);game.draw(ctx,PALETTES.midnight,false);assert.ok(colors.includes('#ed7a7a'));
  const before=game.score;game.input('A');assert.equal(game.score,before,'red WAIT does not reward a click');
  const blue=createSkillGame(definitions('reaction')[5],3);
  while(blue.snapshot.phase==='wait')blue.update(.01);
  colors.length=0;blue.draw(ctx,PALETTES.amber,false);assert.ok(colors.includes('#8b9195'),'the decoy is gray even in the amber palette');
  for(let i=0;i<1500&&blue.snapshot.phase!=='signal';i++)blue.update(.01);
  colors.length=0;blue.draw(ctx,PALETTES.amber,false);assert.ok(colors.includes('#65baff'),'the valid signal is blue');
  const green=createSkillGame(definitions('reaction')[3],3);
  for(let i=0;i<1500&&green.snapshot.phase!=='signal';i++)green.update(.01);
  colors.length=0;green.draw(ctx,PALETTES.amber,false);assert.ok(colors.includes('#78d79a'),'the valid signal is green');
});
