import assert from 'node:assert/strict';
import test from 'node:test';
import { createSkillGame, SKILL_DEFINITIONS } from '../src/events/arcade-skill';
import type { ArcadeDefinition, ArcadeEngine } from '../src/events/arcade-types';
import type { InputSymbol } from '../src/data/types';
import { PALETTES } from '../src/events/art';

const KEYS:InputSymbol[]=['U','R','D','L','A','B'];
const definitions=(family:string)=>SKILL_DEFINITIONS.filter(def=>def.family===family);
const create=(family:string,variant:number,seed=37)=>createSkillGame(definitions(family)[variant],seed);
const advance=(game:ArcadeEngine,seconds:number)=>{for(let frame=0;frame<seconds*100&&!game.outcome;frame++)game.update(.01);};
const context=new Proxy({}, {get:()=> (...values:unknown[])=>{for(const value of values)if(typeof value==='number')assert.ok(Number.isFinite(value));},set:(_target,_key,value)=>{if(typeof value==='number')assert.ok(Number.isFinite(value));return true;}}) as CanvasRenderingContext2D;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));

function balanceInput(game:ArcadeEngine,variant:number,previousTarget:number){
  const s=game.snapshot,target=Number(s.target),desired=-2*(Number(s.angle)-target)+(target-previousTarget)/.01;
  if(Number(s.velocity)>desired+.14)game.input(variant===1?'R':'L');
  if(Number(s.velocity)<desired-.14)game.input(variant===1?'L':'R');
  if(variant===8){const desiredY=-2*Number(s.vertical);if(Number(s.verticalVelocity)>desiredY+.14)game.input('U');if(Number(s.verticalVelocity)<desiredY-.14)game.input('D');}
  return target;
}
function fishingInput(game:ArcadeEngine,variant:number){
  const s=game.snapshot,fish=(s.fish as {x:number;y:number;good:boolean}[]).find(f=>f.good)!;
  let guard=0;while(Math.abs(Number(game.snapshot.x)-fish.x)>7&&guard++<24){const left=Number(game.snapshot.x)>fish.x;game.input(variant===6?left?'R':'L':left?'L':'R');}
  if(!s.cast)game.input('A');
  const live=game.snapshot,margin=Number(live.catchRadius);
  if(Math.abs(Number(live.hookY)-fish.y)<Math.min(5,margin)&&Math.abs(Number(live.x)-fish.x)<margin)game.input('B');
}
function roadInput(game:ArcadeEngine,variant:number){
  const s=game.snapshot,items=s.visibleItems as {lane:number;y:number;kind:string}[];
  const obstacles=items.filter(item=>item.kind==='obstacle'&&item.y>117&&item.y<190);
  const safe=Array.from({length:Number(s.lanes)},(_,lane)=>lane).filter(lane=>!obstacles.some(item=>item.lane===lane));
  const coin=items.filter(item=>item.kind==='coin'&&item.y>122&&item.y<183&&safe.includes(item.lane)).sort((a,b)=>b.y-a.y)[0];
  const target=coin?.lane??(safe.includes(Number(s.lane))?Number(s.lane):safe[0]);
  if(target!==undefined){let guard=0;while(Number(game.snapshot.lane)!==target&&guard++<6){const left=Number(game.snapshot.lane)>target;game.input(variant===7?left?'R':'L':left?'L':'R');}}
}
function landerInput(game:ArcadeEngine,variant:number){
  const s=game.snapshot,pad=s.pad as {x:number;width:number},x=Number(s.x),vx=Number(s.vx),vy=Number(s.vy),y=Number(s.y),targetVelocity=clamp((pad.x-x)*.65,-18,18);
  if(vx>targetVelocity+6)game.input(variant===5?'R':'L');
  if(vx<targetVelocity-6)game.input(variant===5?'L':'R');
  if(y>125&&vy>13)game.input('A');
}
function clickInput(game:ArcadeEngine,variant:number){
  const s=game.snapshot;
  if(variant===2||variant===4)game.input(Number(s.energy)>=(variant===2?Number(s.target):7)?'B':'A');
  else if(variant===3){if(Number(s.heat)<.65)game.input('A');}
  else if(variant===6){if(s.green)game.input('A');}
  else if(variant===8)game.input(game.score>=Number(s.investmentCost)&&Number(s.rate)<5?'A':'B');
  else game.input(s.expected as InputSymbol);
}

test('81 definitions retain stable variants, with no generic time limit or completion quota',()=>{
  assert.equal(SKILL_DEFINITIONS.length,81);assert.equal(new Set(SKILL_DEFINITIONS.map(def=>def.title)).size,81);
  for(const family of ['memory','rhythm','typing','balance','fishing','racer','lander','reaction','clicker']){
    const rows=definitions(family);assert.deepEqual(rows.map(def=>def.variant),[0,1,2,3,4,5,6,7,8]);
    assert.equal(new Set(rows.map(def=>def.rule)).size,9);
    for(const def of rows){assert.ok(def.rule.length>12);assert.ok(def.controls.length>4);assert.equal(def.durationMs===0,def.playMode==='endless',def.title);}
  }
  assert.deepEqual(SKILL_DEFINITIONS.filter(def=>def.playMode==='gag').map(def=>`${def.family}:${def.variant}`),['memory:8','rhythm:0','typing:0','typing:7','fishing:0','fishing:8','clicker:0','clicker:4']);
});

test('all variants draw finite geometry and failures or short gags freeze their result',()=>{
  for(const def of SKILL_DEFINITIONS){
    const game=createSkillGame(def,241);game.draw(context,PALETTES.midnight,false);
    for(let frame=0;frame<460&&!game.outcome;frame++){game.update(.1);if(frame%25===0)game.draw(context,PALETTES.midnight,true);}
    if(def.playMode==='gag')assert.ok(game.outcome,`${def.title}: timed short exception ends`);
    else assert.notEqual(game.outcome?.status,'time',`${def.title}: no old global time limit`);
    if(game.outcome){const result=JSON.stringify({score:game.score,outcome:game.outcome,snapshot:game.snapshot});game.input('A');game.input('R');game.update(.1);game.draw(context,PALETTES.midnight,false);assert.equal(JSON.stringify({score:game.score,outcome:game.outcome,snapshot:game.snapshot}),result);}
  }
});

test('memory generates new, harder rounds beyond the old duration; only three-bout title ends',()=>{
  for(const def of definitions('memory')){
    const game=createSkillGame(def,42),initialFlash=Number(game.snapshot.flash);
    for(let frame=0;frame<4000&&!game.outcome;frame++){game.update(.01);if(game.snapshot.phase==='input')for(const key of game.snapshot.expected as InputSymbol[])game.input(key);}
    if(def.playMode==='gag'){assert.equal(game.outcome?.status,'win');assert.equal(game.snapshot.round,3);}
    else{assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.round)>=5);assert.ok(game.score>20);assert.ok(Number(game.snapshot.flash)<initialFlash);}
  }
  const wrong=create('memory',7);while(wrong.snapshot.phase==='show')wrong.update(.01);const expected=(wrong.snapshot.expected as InputSymbol[])[0];wrong.input(expected==='U'?'D':'U');assert.equal(wrong.outcome?.status,'lose');
  const reverse=create('memory',1).snapshot;assert.deepEqual(reverse.expected,[...(reverse.sequence as InputSymbol[])].reverse());
});

test('rhythm replenishes songs with faster notes and stricter timing instead of ending after ten hits',()=>{
  for(const def of definitions('rhythm')){
    const game=createSkillGame(def,51),initialWindow=Number(game.snapshot.window);
    for(let frame=0;frame<3800&&!game.outcome;frame++){game.update(.01);const s=game.snapshot;for(const note of s.notes as {at:number;key:InputSymbol;hit:boolean;rest:boolean}[])if(!note.hit&&!note.rest&&Math.abs(note.at-Number(s.time))<.011)game.input(note.key);}
    if(def.playMode==='gag')assert.equal(game.outcome?.status,'win');
    else{assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.round)>=3);assert.ok(game.score>200);assert.ok(Number(game.snapshot.window)<initialWindow);}
  }
  const miss=create('rhythm',1);for(let i=0;i<6;i++)miss.input('L');assert.equal(miss.outcome?.status,'lose');
});

test('command rows regenerate and become longer or tighter; numeric-title rows retain their endings',()=>{
  for(const def of definitions('typing')){
    const game=createSkillGame(def,61),firstKeys=[...game.snapshot.keys as InputSymbol[]];
    for(let frame=0;frame<3800&&!game.outcome;frame++){
      game.update(.01);if(frame%12!==0)continue;
      const s=game.snapshot;if(def.variant===6&&s.visible)continue;const key=(s.expected as InputSymbol[])[Number(s.index)];
      if(def.variant===8){let guard=0;while(KEYS[Number(game.snapshot.selected)]!==key&&guard++<6)game.input('R');game.input('A');}else game.input(key);
    }
    if(def.playMode==='gag')assert.equal(game.outcome?.status,'win');
    else{assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.round)>=5);assert.ok(game.score>firstKeys.length);assert.notDeepEqual(game.snapshot.keys,firstKeys);assert.ok(Number(game.snapshot.deadline)<(def.variant===5?1:8));}
  }
  const strict=create('typing',4);strict.input('B');assert.equal(strict.outcome?.status,'lose');
  const timed=create('typing',5);advance(timed,1.1);assert.equal(timed.outcome?.status,'lose');
});

test('balance awards safe-time score beyond six seconds and increases difficulty without a win quota',()=>{
  for(const def of definitions('balance')){
    const game=createSkillGame(def,15);let previousTarget=Number(game.snapshot.target);const initialTolerance=Number(game.snapshot.tolerance);
    for(let frame=0;frame<3600&&!game.outcome;frame++){previousTarget=balanceInput(game,def.variant,previousTarget);game.update(.01);}
    assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.stable)>15);assert.ok(game.score>150);assert.ok(Number(game.snapshot.level)>=1);assert.ok(Number(game.snapshot.tolerance)<initialTolerance);
  }
  const idle=create('balance',0);advance(idle,12);assert.equal(idle.outcome?.status,'lose');
});

test('normal fishing continues through repeated catches, raises difficulty and loses on mistakes',()=>{
  for(const def of definitions('fishing')){
    const game=createSkillGame(def,7),initialRadius=Number(game.snapshot.catchRadius);
    for(let frame=0;frame<3600&&!game.outcome;frame++){fishingInput(game,def.variant);game.update(.01);}
    if(def.playMode==='gag')assert.equal(game.outcome?.status,'win',def.title);
    else{assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.caught)>=8);assert.ok(Number(game.snapshot.level)>=2);assert.ok(Number(game.snapshot.catchRadius)<initialRadius);}
  }
  const empty=create('fishing',1);for(let i=0;i<4;i++){empty.input('A');empty.input('B');}assert.equal(empty.outcome?.status,'lose');
});

test('all road rules continue beyond old distance and coin goals, with growing traffic',()=>{
  for(const def of definitions('racer')){
    const game=createSkillGame(def,37),initialSpeed=Number(game.snapshot.speed);
    for(let frame=0;frame<3800&&!game.outcome;frame++){roadInput(game,def.variant);game.update(.01);}
    assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.distance)>1800);assert.ok(Number(game.snapshot.level)>=2);assert.ok(Number(game.snapshot.speed)>initialSpeed);assert.ok(game.score>0);
    if(def.variant===4)assert.ok(Number(game.snapshot.coins)>6);
  }
  const crash=create('racer',5);advance(crash,40);assert.equal(crash.outcome?.status,'lose');
});

test('a safe landing starts another harder stage with fuel, and crashes still end the run',()=>{
  for(const def of definitions('lander')){
    const game=createSkillGame(def,19),initial=game.snapshot;
    for(let frame=0;frame<2400&&!game.outcome&&Number(game.snapshot.stage)===0;frame++){landerInput(game,def.variant);game.update(.01);}
    assert.equal(game.outcome,null,def.title);assert.equal(game.snapshot.stage,1);assert.equal(game.snapshot.y,30);assert.ok(Number(game.snapshot.fuel)>0);assert.ok(Number(game.snapshot.gravity)>Number(initial.gravity));assert.ok(Number((game.snapshot.pad as {width:number}).width)<Number((initial.pad as {width:number}).width));assert.ok(game.score>=100);
  }
  const ongoing=create('lander',0,19);for(let frame=0;frame<3900&&!ongoing.outcome;frame++){landerInput(ongoing,0);ongoing.update(.01);}assert.equal(ongoing.outcome,null);assert.ok(Number(ongoing.snapshot.stage)>=3);
  const crash=create('lander',0);advance(crash,12);assert.equal(crash.outcome?.status,'lose');
});

test('reaction continues after four signals with shorter windows, while early input loses',()=>{
  for(const def of definitions('reaction')){
    const game=createSkillGame(def,9),window=Number(game.snapshot.window);
    for(let frame=0;frame<3800&&!game.outcome;frame++){game.update(.01);if(game.snapshot.phase==='signal')game.input(game.snapshot.expected as InputSymbol);}
    assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.successes)>4);assert.ok(game.score>40);assert.ok(Number(game.snapshot.window)<window);
    const early=createSkillGame(def,9);early.input('A');early.input('A');early.input('A');assert.equal(early.outcome?.status,'lose');
  }
});

test('normal clickers advance levels and preserve score; explicit eighteen/release gags still finish',()=>{
  for(const def of definitions('clicker')){
    const game=createSkillGame(def,91);
    for(let frame=0;frame<3800&&!game.outcome;frame++){clickInput(game,def.variant);game.update(.01);}
    if(def.playMode==='gag')assert.equal(game.outcome?.status,'win',def.title);
    else{assert.equal(game.outcome,null,def.title);assert.ok(Number(game.snapshot.level)>=2,def.title);assert.ok(game.score>50,def.title);}
  }
  const hot=create('clicker',3);for(let i=0;i<6;i++)hot.input('A');assert.equal(hot.outcome?.status,'lose');
  const wrong=create('clicker',7);for(let i=0;i<3;i++)wrong.input('A');assert.equal(wrong.outcome?.status,'lose');
});

test('variant differences still change state, physics, goals or valid actions',()=>{
  const fingerprint=(game:ArcadeEngine)=>{const {family,variant,time,...state}=game.snapshot;return JSON.stringify({state,outcome:game.outcome,score:game.score});};
  for(const family of ['memory','rhythm','typing','balance','fishing','racer','lander','clicker']){
    const games=definitions(family).map(def=>createSkillGame(def,37));
    games.forEach(game=>{
      if(family==='memory'||family==='typing')advance(game,2.1);
      if(family==='balance'){game.input('L');game.input('U');advance(game,.4);}
      if(family==='fishing'){game.input('A');game.input('L');advance(game,.5);}
      if(family==='racer'){game.input('L');advance(game,2.1);}
      if(family==='lander'){game.input('L');game.input('B');advance(game,.8);}
      if(family==='clicker'){game.input('A');game.input('A');advance(game,.2);for(let i=0;i<4;i++)game.input('A');game.input('B');}
    });
    assert.equal(new Set(games.map(fingerprint)).size,9,family);
  }
  const single=create('reaction',0),double=create('reaction',7),ordered=create('reaction',8);
  for(const game of [single,double,ordered]){while(game.snapshot.phase==='wait')game.update(.01);game.input('A');}
  assert.equal(single.snapshot.successes,1);assert.equal(double.snapshot.successes,0);assert.equal(double.snapshot.expected,'A');assert.equal(ordered.snapshot.expected,'B');
});

test('green GO and red WAIT remain distinct from the score and level mechanics',()=>{
  const colors:string[]=[];
  const ctx=new Proxy({}, {get:()=>()=>{},set:(_target,key,value)=>{if(key==='fillStyle')colors.push(String(value));return true;}}) as CanvasRenderingContext2D;
  const game=create('clicker',6);game.draw(ctx,PALETTES.midnight,false);assert.ok(colors.includes('#78d79a'));
  colors.length=0;advance(game,.8);game.draw(ctx,PALETTES.midnight,false);assert.ok(colors.includes('#ed7a7a'));
  game.input('A');assert.equal(game.snapshot.errors,1);assert.equal(game.score,0);
});
