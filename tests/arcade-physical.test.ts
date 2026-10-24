import assert from 'node:assert/strict';
import test from 'node:test';
import type { InputSymbol } from '../src/data/types';
import type { ArcadeDefinition, ArcadeEngine, ArcadeFamily } from '../src/events/arcade-types';
import { PALETTES } from '../src/events/art';
import { BlocksArcade, BreakoutArcade, CatchArcade, createPhysicalGame, DodgeArcade, InvadersArcade, MazeArcade, PHYSICAL_DEFINITIONS, PongArcade, RunnerArcade, SnakeArcade } from '../src/events/arcade-physical';

const definition=(family:ArcadeFamily,variant=0):ArcadeDefinition=>PHYSICAL_DEFINITIONS.find(d=>d.family===family&&d.variant===variant)!;
const advance=(game:ArcadeEngine,seconds:number)=>{for(let frame=0;frame<Math.ceil(seconds*120)&&!game.outcome;frame++)game.update(1/120);};
const context=new Proxy({}, {get:()=> (...values:unknown[])=>{for(const value of values)if(typeof value==='number')assert.ok(Number.isFinite(value),'finite drawing coordinate');},set:(_target,_key,value)=>{if(typeof value==='number')assert.ok(Number.isFinite(value),'finite drawing property');return true;}}) as CanvasRenderingContext2D;

test('92 physical definitions contain the agreed nine families, explicit rules and distinct titles',()=>{
  assert.equal(PHYSICAL_DEFINITIONS.length,92);
  assert.equal(new Set(PHYSICAL_DEFINITIONS.map(d=>d.title)).size,92);
  for(const [family,count] of Object.entries({blocks:13,invaders:12,snake:10,breakout:10,pong:9,runner:10,dodge:10,catch:9,maze:9})){
    const rows=PHYSICAL_DEFINITIONS.filter(d=>d.family===family);
    assert.deepEqual(rows.map(d=>d.variant),Array.from({length:count},(_,i)=>i));
    assert.equal(new Set(rows.map(d=>d.rule)).size,count);
    for(const row of rows){assert.ok(row.rule.length>=12);assert.ok(row.controls.length>5);assert.equal(row.durationMs,0);assert.ok(['endless','board','gag'].includes(row.playMode));}
  }
});

test('all 92 physical games draw finite geometry through prolonged play and freeze only after a real outcome',()=>{
  for(const def of PHYSICAL_DEFINITIONS){
    const game=createPhysicalGame(def,216);game.draw(context,PALETTES.midnight,false);
    for(let frame=0;frame<600&&!game.outcome;frame++){game.update(.1);if(frame%25===0)game.draw(context,PALETTES.midnight,true);}
    assert.ok(Number.isFinite(game.score)&&game.score>=0);
    if(game.outcome){const before=JSON.stringify(game.snapshot);for(const key of ['L','R','U','D','A','B'] as InputSymbol[])game.input(key);game.update(1);game.draw(context,PALETTES.midnight,false);assert.equal(JSON.stringify(game.snapshot),before,`${def.family}-${def.variant} stops at its result`);}
  }
});

test('all physical variants are deterministic under the same controls and keep independent state',()=>{
  const keys:InputSymbol[]=['A','R','U','B','L','D'];
  for(const def of PHYSICAL_DEFINITIONS){
    const first=createPhysicalGame(def,73),second=createPhysicalGame(def,73);
    for(let frame=0;frame<500;frame++){if(frame%7===0){const key=keys[Math.floor(frame/7)%keys.length];first.input(key);second.input(key);}first.update(.02);second.update(.02);}
    assert.deepEqual(first.snapshot,second.snapshot,`${def.family}-${def.variant}`);
    const saved=JSON.stringify(second.snapshot);first.input('A');first.update(.1);assert.equal(JSON.stringify(second.snapshot),saved);
  }
});

test('one-third board has twelve permanent steel rows and naturally loses in a few seconds',()=>{
  const game=new BlocksArcade(definition('blocks',1),216),start=game.snapshot;
  assert.equal(start.height,18);assert.equal(start.width,10);
  assert.ok(start.board.slice(0,6).flat().every(v=>v===0));
  assert.ok(start.board.slice(6).flat().every(v=>v===9));
  let elapsed=0;while(!game.outcome&&elapsed<8){game.update(.05);elapsed+=.05;}
  assert.equal(game.outcome?.status,'lose');assert.ok(elapsed<5);
  assert.equal(game.snapshot.board.flat().filter(v=>v===9).length,120);
  assert.deepEqual(game.snapshot.board.slice(6),start.board.slice(6),'steel rows cannot be erased or shifted');
});

test('permanent fragments cannot be removed and neither impossible block variant can win',()=>{
  for(const variant of [1,2])for(const seed of [1,19,73,216]){
    const game=new BlocksArcade(definition('blocks',variant),seed);
    const fixed=game.snapshot.board.flatMap((row,y)=>row.flatMap((v,x)=>v===9?[[x,y]]:[]));
    for(let piece=0;piece<80&&!game.outcome;piece++){for(let i=0;i<piece%5;i++)game.input(piece%2?'L':'R');game.input('A');game.input('B');}
    if(!game.outcome)advance(game,30);
    assert.equal(game.outcome?.status,'lose');
    for(const [x,y] of fixed)assert.equal(game.snapshot.board[y][x],9,'every immutable fragment remains in its original cell');
  }
});

test('normal falling blocks rotate, collide, lock and clear a row through actual controls',()=>{
  const game=new BlocksArcade(definition('blocks'),3943);
  for(const key of 'RRRBLLLLBULLBRB')game.input(key as InputSymbol);
  assert.equal(game.snapshot.pieces,4);assert.equal(game.snapshot.lines,1);
  assert.equal(game.outcome,null,'the first cleared row continues into the next piece');assert.ok(game.score>=100);
  assert.equal(game.snapshot.board.flat().filter(Boolean).length,6);
  const bar=new BlocksArcade(definition('blocks',4),3);bar.input('A');for(let i=0;i<20;i++)bar.input('L');
  assert.equal(new Set(bar.snapshot.active.map(([x])=>x)).size,1,'bar rotates upright');
  assert.equal(Math.min(...bar.snapshot.active.map(([x])=>x)),0,'left wall stops movement');
  bar.input('B');assert.equal(bar.snapshot.board.flat().filter(Boolean).length,4,'hard drop locks four cells');
});

test('block twists change controls, gravity, cell size, rotation and the clearing threshold',()=>{
  const normal=new BlocksArcade(definition('blocks'),104),reverse=new BlocksArcade(definition('blocks',6),104);
  const firstX=normal.snapshot.active[0][0];normal.input('R');reverse.input('R');assert.equal(normal.snapshot.active[0][0],firstX+1);assert.equal(reverse.snapshot.active[0][0],firstX-1);
  const up=new BlocksArcade(definition('blocks',7),104),startY=up.snapshot.active[0][1];advance(up,.4);assert.ok(up.snapshot.active[0][1]<startY);
  assert.equal(new BlocksArcade(definition('blocks',5),104).snapshot.active.length,16,'double-size piece occupies sixteen cells');
  const broken=new BlocksArcade(definition('blocks',9),104),before=broken.snapshot.active;broken.input('A');assert.deepEqual(broken.snapshot.active,before);
  const tolerant=new BlocksArcade(definition('blocks',10),104),strict=new BlocksArcade(definition('blocks',0),104);
  for(const game of [tolerant,strict])for(const key of 'LLLBRBURRRRB')game.input(key as InputSymbol);
  assert.equal(tolerant.snapshot.lines,1,'a row with one hole clears only in the lenient variant');assert.equal(tolerant.outcome,null);assert.equal(strict.snapshot.lines,0);assert.equal(strict.snapshot.board[15].filter(Boolean).length,9);
  const rising=new BlocksArcade(definition('blocks',12),4);advance(rising,3.6);assert.equal(rising.snapshot.board[15].filter(Boolean).length,9,'new garbage has one real gap');
});

function aimInvaders(game:InvadersArcade,stopAtKills=Infinity){
  for(let frame=0;frame<90*60&&!game.outcome&&game.snapshot.kills<stopAtKills;frame++){
    const state=game.snapshot,target=state.enemies.filter(a=>!state.enemies.some(b=>b.id%7===a.id%7&&b.y>a.y)).sort((a,b)=>Math.abs(a.x-state.x)-Math.abs(b.x-state.x))[0];
    if(target){const aim=target.x+state.direction*state.speed*(177-target.y)/205;if(Math.abs(aim-state.x)>7)game.input(aim<state.x?'L':'R');game.input('A');game.input('B');}
    game.update(1/60);
  }
}

test('invader shots remove enemies, while the enormous variant takes twelve hits to defeat',()=>{
  const normal=new InvadersArcade(definition('invaders'),216);aimInvaders(normal,8);assert.equal(normal.outcome,null,'eight kills no longer end a full board');assert.ok(normal.snapshot.enemies.length>0);aimInvaders(normal);assert.equal(normal.snapshot.outcome?.status,'win');assert.equal(normal.snapshot.kills,21);assert.equal(normal.snapshot.enemies.length,0);
  const giant=new InvadersArcade(definition('invaders',1),216);assert.equal(giant.snapshot.enemies.length,1);assert.ok(giant.snapshot.enemies[0].w>120);assert.equal(giant.snapshot.enemies[0].hp,12);
  aimInvaders(giant);assert.equal(giant.outcome?.status,'win');assert.equal(giant.score,120);assert.equal(giant.snapshot.enemies.length,0);
});

test('invader variants alter real hitboxes, armor, projectiles, movement and ammunition',()=>{
  const tiny=new InvadersArcade(definition('invaders',2),3);assert.ok(tiny.snapshot.enemies.every(e=>e.w===5));
  const armored=new InvadersArcade(definition('invaders',7),3);assert.ok(armored.snapshot.enemies.every(e=>e.hp===2));
  const flee=new InvadersArcade(definition('invaders',3),3),oldY=flee.snapshot.enemies[0].y;flee.input('A');assert.ok(flee.snapshot.enemies[0].y<oldY);
  const bounce=new InvadersArcade(definition('invaders',4),3);bounce.input('A');assert.notEqual(bounce.snapshot.shots[0].vx,0);
  const triple=new InvadersArcade(definition('invaders',9),3);triple.input('A');assert.equal(triple.snapshot.shots.length,3);
  const peaceful=new InvadersArcade(definition('invaders',5),3);advance(peaceful,3);assert.equal(peaceful.snapshot.shots.filter(s=>s.enemy).length,0);
  const reverse=new InvadersArcade(definition('invaders',6),3);reverse.input('R');assert.ok(reverse.snapshot.x<160);
  const limited=new InvadersArcade(definition('invaders',10),3);for(let i=0;i<9;i++){limited.input('A');advance(limited,.17);}assert.equal(limited.snapshot.ammo,0);advance(limited,2);assert.equal(limited.outcome?.status,'lose','missing the required targets spends the finite ammunition');
});

test('snake food changes the body, wraps at the boundary, and follows its stated reverse controls',()=>{
  for(const variant of [0,1,2]){const game=new SnakeArcade(definition('snake',variant),3);const start=game.snapshot.body.length;for(let i=0;i<3;i++)game.input('A');assert.equal(game.snapshot.eaten,1);assert.equal(game.snapshot.body.length,start+(variant===0?1:variant===1?0:-1));}
  const wrap=new SnakeArcade(definition('snake',3),3);for(let i=0;i<16;i++)wrap.input('A');assert.equal(wrap.snapshot.body[0].x,0);assert.equal(wrap.outcome,null);
  const wall=new SnakeArcade(definition('snake'),3);for(let i=0;i<16;i++)wall.input('A');assert.equal(wall.outcome?.status,'lose');
  const reverse=new SnakeArcade(definition('snake',4),3);reverse.input('U');reverse.input('A');reverse.input('R');reverse.input('A');assert.equal(reverse.snapshot.body[0].x,7);
  const moving=new SnakeArcade(definition('snake',5),3),food=moving.snapshot.food;moving.input('B');advance(moving,1.45);assert.notDeepEqual(moving.snapshot.food,food);
});

function playBreakout(game:BreakoutArcade,stopAt=Infinity){
  for(let frame=0;frame<300*60&&!game.outcome&&game.snapshot.destroyed<stopAt;frame++){
    const state=game.snapshot,ball=[...state.balls].sort((a,b)=>b.y-a.y)[0];
    if(ball){let aim=ball.x;if(ball.vy>0){aim=ball.x+ball.vx*(183-ball.y-ball.r)/ball.vy;while(aim<8||aim>312)aim=aim<8?16-aim:624-aim;}
      aim+=state.destroyed%4<2?-12:12;if(Math.abs(aim-state.x)>7)game.input((aim<state.x)!==(game.def.variant===4)?'L':'R');}
    game.input('A');game.update(1/60);
  }
}

test('breakout ball hits remove bricks and the paddle can finish an actual round',()=>{
  const game=new BreakoutArcade(definition('breakout'),3);assert.equal(game.snapshot.launched,false);game.input('A');advance(game,.8);
  assert.ok(game.snapshot.balls[0].y<172,'serve launches upward');
  playBreakout(game,6);assert.ok(game.snapshot.destroyed>=6);assert.equal(game.outcome,null,'six broken bricks no longer end the board');playBreakout(game);assert.equal(game.snapshot.outcome?.status,'win');assert.equal(game.snapshot.destroyed,27);assert.ok(game.score>=270);
});

test('breakout twists alter paddle, giant ball, durable bricks, gravity and a genuinely moving row',()=>{
  const thin=new BreakoutArcade(definition('breakout',3),3);assert.ok(thin.snapshot.width<20);
  const giant=new BreakoutArcade(definition('breakout',2),3);assert.ok(giant.snapshot.balls[0].r>10);
  const reverse=new BreakoutArcade(definition('breakout',4),3);reverse.input('R');assert.ok(reverse.snapshot.x<160);
  const steel=new BreakoutArcade(definition('breakout',5),3),fixedIds=steel.snapshot.bricks.filter(b=>b.hp<0).map(b=>b.id);playBreakout(steel);assert.deepEqual(steel.snapshot.bricks.filter(b=>b.hp<0).map(b=>b.id),fixedIds);
  const moving=new BreakoutArcade(definition('breakout',6),3),x=moving.snapshot.bricks[0].x;moving.input('A');advance(moving,.3);assert.notEqual(moving.snapshot.bricks[0].x,x);
  const gravity=new BreakoutArcade(definition('breakout',7),3),normal=new BreakoutArcade(definition('breakout'),3);for(const game of [gravity,normal]){game.input('A');advance(game,.2);}assert.ok(gravity.snapshot.balls[0].vy>normal.snapshot.balls[0].vy);
  const split=new BreakoutArcade(definition('breakout',9),3);let divided=false;
  for(let frame=0;frame<24*60&&!split.outcome;frame++){const ball=[...split.snapshot.balls].sort((a,b)=>b.y-a.y)[0];if(ball&&Math.abs(ball.x-split.snapshot.x)>8)split.input(ball.x<split.snapshot.x?'L':'R');split.input('A');split.update(1/60);if(split.snapshot.balls.length>1)divided=true;}
  assert.equal(divided,true,'three physical hits split the ball');
});

test('pong returns count toward a win and variants change ball count, hitbox and control direction',()=>{
  const game=new PongArcade(definition('pong'),3);
  for(let frame=0;frame<24*60&&!game.outcome;frame++){const state=game.snapshot,ball=[...state.balls].sort((a,b)=>a.x-b.x)[0];if(Math.abs(ball.y-state.y)>7)game.input(ball.y<state.y?'U':'D');game.update(1/60);}
  assert.equal(game.outcome?.status,'win');assert.equal(game.snapshot.returns,5);
  assert.equal(new PongArcade(definition('pong',1),3).snapshot.balls.length,3);
  assert.ok(new PongArcade(definition('pong',4),3).snapshot.balls[0].r*2>46,'the title is supported by a ball larger than the paddle');
  const reverse=new PongArcade(definition('pong',6),3);reverse.input('U');assert.ok(reverse.snapshot.y>110);
  const curved=new PongArcade(definition('pong',5),3),normal=new PongArcade(definition('pong'),3);advance(curved,.4);advance(normal,.4);assert.notEqual(curved.snapshot.balls[0].vy,normal.snapshot.balls[0].vy);
});

test('runner jumping clears obstacles while ceiling obstacles actually require ducking',()=>{
  const game=new RunnerArcade(definition('runner'),3);
  for(let frame=0;frame<20*60&&!game.outcome;frame++){
    const state=game.snapshot,next=state.obstacles.filter(o=>!o.passed&&o.x>state.x).sort((a,b)=>a.x-b.x)[0];
    if(next&&next.x-state.x<52&&state.y>=174.9)game.input('A');game.update(1/60);
  }
  assert.equal(game.outcome?.status,'win');assert.equal(game.snapshot.lives,3);
  const stand=new RunnerArcade(definition('runner',6),3);advance(stand,4);assert.ok(stand.snapshot.lives<3,'standing meets the overhead beam');
  const duck=new RunnerArcade(definition('runner',6),3);for(let frame=0;frame<60*60&&!duck.outcome;frame++){duck.input('D');duck.update(1/60);}assert.equal(duck.outcome,null);assert.equal(duck.snapshot.lives,3);assert.ok(duck.snapshot.cleared>20);assert.ok(duck.snapshot.elapsed>59);assert.ok(duck.snapshot.level>1);assert.ok(duck.snapshot.speed>124);
});

test('runner gravity, double jumps, holes, opposite approach and time stop affect physical state',()=>{
  const normal=new RunnerArcade(definition('runner'),3),heavy=new RunnerArcade(definition('runner',1),3),moon=new RunnerArcade(definition('runner',2),3);
  for(const game of [normal,heavy,moon]){game.input('A');advance(game,.5);}assert.ok(moon.snapshot.vy<normal.snapshot.vy);assert.ok(heavy.snapshot.vy>normal.snapshot.vy);
  const double=new RunnerArcade(definition('runner',3),3);double.input('A');advance(double,.2);double.input('A');assert.equal(double.snapshot.jumps,2);assert.ok(double.snapshot.vy<0);
  const reverse=new RunnerArcade(definition('runner',4),3);advance(reverse,.8);assert.ok(reverse.snapshot.obstacles[0].x<0);assert.ok(reverse.snapshot.x>200);
  const hole=new RunnerArcade(definition('runner',7),3);advance(hole,5);assert.equal(hole.outcome?.status,'lose');assert.match(hole.outcome?.reason??'',/穴/);
  const freeze=new RunnerArcade(definition('runner',9),3);advance(freeze,1);freeze.input('A');const x=freeze.snapshot.obstacles[0].x;advance(freeze,.3);assert.equal(freeze.snapshot.obstacles[0].x,x);
});

test('dodge bullets physically cause damage, guard prevents a hit and narrow arenas constrain movement',()=>{
  const shot=new DodgeArcade(definition('dodge',1),216);advance(shot,15);assert.ok(shot.snapshot.lives<3);
  const guarded=new DodgeArcade(definition('dodge',1),216);let blocked=false;
  for(let frame=0;frame<8*120&&!guarded.outcome;frame++){const before=guarded.snapshot,near=before.bullets.some(b=>Math.hypot(b.x-before.x,b.y-before.y)<25);if(near&&!blocked){guarded.input('B');blocked=true;}guarded.update(1/120);if(blocked&&guarded.snapshot.bullets.length<before.bullets.length){assert.equal(guarded.snapshot.lives,3);break;}}
  assert.equal(blocked,true);
  const narrow=new DodgeArcade(definition('dodge',4),3);for(let i=0;i<30;i++)narrow.input('R');assert.ok(narrow.snapshot.x<=219);for(let i=0;i<30;i++)narrow.input('U');assert.ok(narrow.snapshot.y>=76);
  const warnings=new DodgeArcade(definition('dodge',8),3);advance(warnings,.4);assert.ok(warnings.snapshot.warnings.length>0);assert.equal(warnings.snapshot.bullets.length,0);warnings.input('R');warnings.input('R');advance(warnings,1);assert.ok(warnings.snapshot.bullets.length>0,'moving off the warning leaves a visible expanding burst');
  const zone=new DodgeArcade(definition('dodge',9),3),initial=zone.snapshot.zone;advance(zone,.4);assert.notDeepEqual(zone.snapshot.zone,initial);
});

function playCatch(game:CatchArcade){
  for(let frame=0;frame<25*60&&!game.outcome;frame++){
    const state=game.snapshot,target=state.items.filter(i=>!i.bad).sort((a,b)=>game.def.variant===3?a.y-b.y:b.y-a.y)[0];
    if(target){if(Math.abs(target.x-state.x)>7)game.input((target.x<state.x)!==(game.def.variant===6)?'L':'R');if(game.def.variant===7&&target.shape!==state.shape)game.input('A');}
    game.update(1/60);
  }
}

test('catch keeps its five-star gag while other variants continue collecting beyond their old quotas',()=>{
  for(const variant of [0,3,5,6,7,8]){const game=new CatchArcade(definition('catch',variant),3);playCatch(game);assert.equal(game.outcome?.status,variant===0?'win':undefined,`variant ${variant}`);assert.ok(game.snapshot.caught>=3);if(variant!==0){assert.ok(game.snapshot.caught>10);assert.ok(game.snapshot.elapsed>24);assert.ok(game.snapshot.level>1);assert.ok(game.snapshot.speed>82);}if(variant===8)assert.ok(game.snapshot.width<42);}
  const bombs=new CatchArcade(definition('catch',1),3);advance(bombs,1.4);assert.ok(bombs.snapshot.items.some(i=>i.bad));
  const wind=new CatchArcade(definition('catch',2),3);advance(wind,.1);assert.ok(wind.snapshot.items.some(i=>i.vx!==0));
});

function followMaze(game:MazeArcade){
  const target=game.snapshot.boardsCleared+1;
  for(let step=0;step<200&&!game.outcome&&game.snapshot.boardsCleared<target;step++){
    const state=game.snapshot,next=state.route[1];if(!next)break;let dx=next.x-state.x,dy=next.y-state.y;
    if(game.def.variant===1)dx*=-1;
    if(game.def.variant===4)for(let i=0;i<state.rotation;i++){const old=dx;dx=dy;dy=-old;}
    game.input(dx>0?'R':dx<0?'L':dy>0?'D':'U');
  }
}

test('all nine maze exits lead to another playable board, including sliding, key and rotating controls',()=>{
  for(let variant=0;variant<9;variant++){
    const game=new MazeArcade(definition('maze',variant),73);if(variant===4||variant===6)advance(game,3.1);followMaze(game);assert.equal(game.outcome,null,`variant ${variant}`);assert.equal(game.snapshot.boardsCleared,1);if(variant===5)assert.equal(game.snapshot.keysCollected,1);followMaze(game);assert.equal(game.snapshot.boardsCleared,2);assert.equal(game.snapshot.level,3);assert.ok(game.snapshot.route.length>1);
  }
});

test('maze walls stop movement, break charges open real walls and the pursuer can catch the player',()=>{
  const game=new MazeArcade(definition('maze'),73);game.input('U');assert.equal(game.snapshot.y,1);
  const breakable=new MazeArcade(definition('maze',7),73);
  const state=breakable.snapshot;const wall=[{x:1,y:0,key:'R'},{x:0,y:1,key:'D'}].find(d=>state.grid[state.y+d.y][state.x+d.x]===1)!;
  assert.ok(wall);breakable.input(wall.key as InputSymbol);breakable.input('A');assert.equal(breakable.snapshot.charges,2);assert.equal(breakable.snapshot.grid[state.y+wall.y][state.x+wall.x],0);
  const chased=new MazeArcade(definition('maze',8),73);advance(chased,26);assert.equal(chased.outcome?.status,'lose');assert.match(chased.outcome?.reason??'',/追跡/);
});

test('an incoming ball returned with A counts once and strong shots can complete a rally',()=>{
  const game=new PongArcade(definition('pong'),3);
  let testedRepeat=false;
  for(let frame=0;frame<22*120&&!game.outcome;frame++){
    const state=game.snapshot,ball=state.balls.filter(b=>b.vx<0).sort((a,b)=>a.x-b.x)[0];
    if(ball){if(Math.abs(ball.y-state.y)>8)game.input(ball.y<state.y?'U':'D');
      const before=game.snapshot.returns;game.input('A');
      if(game.snapshot.returns>before){const returns=game.snapshot.returns,score=game.score;game.input('A');assert.equal(game.snapshot.returns,returns);assert.equal(game.score,score);testedRepeat=true;}
    }
    game.update(1/120);
  }
  assert.equal(testedRepeat,true);assert.equal(game.outcome?.status,'win');assert.equal(game.snapshot.returns,5);assert.ok(game.score>=50);
});

test('blocks continue through multiple cleared rows and increase gravity with cumulative lines',()=>{
  const game=new BlocksArcade(definition('blocks',3),9),initialInterval=game.snapshot.fallInterval;
  for(let rowPair=0;rowPair<4;rowPair++)for(const target of [0,2,4,6,8]){
    const left=Math.min(...game.snapshot.active.map(([x])=>x));
    for(let step=0;step<Math.abs(target-left);step++)game.input(target<left?'L':'R');
    game.input('B');assert.equal(game.outcome,null);
  }
  assert.equal(game.snapshot.lines,8);assert.equal(game.snapshot.pieces,20);assert.equal(game.snapshot.level,2);assert.ok(game.snapshot.fallInterval<initialInterval);
  assert.ok(game.snapshot.board.flat().every(v=>v===0),'multiple full boards clear without ending the run');
});

function feedSnake(game:SnakeArcade,target:number){
  for(let step=0;step<3000&&!game.outcome&&game.snapshot.eaten<target;step++){
    const state=game.snapshot,head=state.body[0],food=state.food[0],queue=[head],previous=new Map<string,{point:{x:number;y:number};key:InputSymbol}|null>([[`${head.x},${head.y}`,null]]);
    for(let i=0;i<queue.length;i++){
      const current=queue[i];if(current.x===food.x&&current.y===food.y)break;
      for(const [dx,dy,key] of [[1,0,'R'],[0,1,'D'],[-1,0,'L'],[0,-1,'U']] as const){const next={x:current.x+dx,y:current.y+dy},id=`${next.x},${next.y}`;
        if((i===0&&dx===-state.direction.x&&dy===-state.direction.y)||next.x<0||next.x>=24||next.y<0||next.y>=13||previous.has(id)||[...state.body.slice(0,-1),...state.walls,...state.poison].some(p=>p.x===next.x&&p.y===next.y))continue;
        previous.set(id,{point:current,key});queue.push(next);
      }
    }
    assert.ok(previous.has(`${food.x},${food.y}`),'food is reachable');
    let point=food,key:InputSymbol='R';while(true){const item=previous.get(`${point.x},${point.y}`);if(!item)break;key=item.key;if(item.point.x===head.x&&item.point.y===head.y)break;point=item.point;}
    game.input(key);game.input('A');
  }
}

test('only snake title gags stop at their promised amount while normal feeding keeps going and accelerates',()=>{
  const endless=new SnakeArcade(definition('snake',1),31);feedSnake(endless,10);assert.equal(endless.snapshot.eaten,10);assert.equal(endless.outcome,null);assert.equal(endless.snapshot.body.length,3);assert.ok(endless.snapshot.level>1);assert.ok(endless.snapshot.interval<.17);
  const gag=new SnakeArcade(definition('snake'),31);feedSnake(gag,10);assert.equal(gag.snapshot.eaten,3);assert.equal(gag.outcome?.status,'win');
  const shrinking=new SnakeArcade(definition('snake',2),31);feedSnake(shrinking,10);assert.equal(shrinking.snapshot.body.length,1);assert.equal(shrinking.outcome?.status,'win');
  const wrap=new SnakeArcade(definition('snake',3),31);advance(wrap,40);assert.equal(wrap.outcome,null);assert.ok(wrap.snapshot.elapsed>39);assert.ok(wrap.snapshot.level>1);
});

test('endless pong and dodge survive far beyond the former time limits and increase difficulty',()=>{
  const pong=new PongArcade(definition('pong',2),3);
  for(let frame=0;frame<65*60&&!pong.outcome;frame++){
    const state=pong.snapshot,ball=[...state.balls].sort((a,b)=>a.x-b.x)[0];if(Math.abs(ball.y-state.y)>7)pong.input(ball.y<state.y?'U':'D');pong.input('A');pong.update(1/60);
  }
  assert.equal(pong.outcome,null);assert.ok(pong.snapshot.elapsed>64);assert.ok(pong.snapshot.returns>10);assert.ok(pong.snapshot.level>1);
  const dodge=new DodgeArcade(definition('dodge',9),31);
  for(let frame=0;frame<75*60&&!dodge.outcome;frame++){
    const state=dodge.snapshot,dx=state.zone.x+state.zone.w/2-state.x,dy=state.zone.y+state.zone.h/2-state.y;
    if(Math.abs(dx)>7)dodge.input(dx<0?'L':'R');else if(Math.abs(dy)>7)dodge.input(dy<0?'U':'D');dodge.update(1/60);
  }
  assert.equal(dodge.outcome,null);assert.ok(dodge.snapshot.elapsed>74);assert.equal(dodge.snapshot.level,4);assert.ok(dodge.score>500);
});

test('maze has no general timer and adds pursuit on the third board instead of ending at an exit',()=>{
  const game=new MazeArcade(definition('maze'),31);advance(game,40);assert.equal(game.outcome,null);assert.ok(game.snapshot.elapsed>39);
  followMaze(game);followMaze(game);assert.equal(game.snapshot.boardsCleared,2);assert.equal(game.outcome,null);assert.equal(game.snapshot.pursuerActive,false);
  advance(game,4.1);assert.equal(game.snapshot.outcome?.status,'lose','waiting at the next entrance lets the new pursuer catch up');
});

test('block gravity also speeds up with elapsed time while the line count stays unchanged',()=>{
  const game=new BlocksArcade(definition('blocks',3),9);
  // Slow, safe placement keeps the run alive until just before the timed level increase.
  for(let piece=0;piece<10;piece++){
    const target=[0,2,4,6,8][piece%5],left=Math.min(...game.snapshot.active.map(([x])=>x));
    for(let move=0;move<Math.abs(target-left);move++)game.input(target<left?'L':'R');
    advance(game,2.98);game.input('B');assert.equal(game.outcome,null);
  }
  const before=game.snapshot;assert.ok(before.elapsed<30&&before.elapsed>29);assert.equal(before.lines,4);
  advance(game,.3);
  const after=game.snapshot;assert.equal(after.lines,before.lines);assert.ok(after.elapsed>30);assert.equal(after.level,before.level+1);assert.ok(after.fallInterval<before.fallInterval,'elapsed time directly shortens the fall interval');
});

test('sliding mazes change their board after an exit and wall-break allowance remains three on later boards',()=>{
  const sliding=new MazeArcade(definition('maze',2),31),first=sliding.snapshot.grid;followMaze(sliding);assert.equal(sliding.snapshot.boardsCleared,1);assert.notDeepEqual(sliding.snapshot.grid,first);followMaze(sliding);assert.equal(sliding.snapshot.boardsCleared,2);
  const breaking=new MazeArcade(definition('maze',7),31);for(let board=0;board<7;board++){followMaze(breaking);assert.equal(breaking.snapshot.charges,3);assert.equal(breaking.outcome,null);}
});
