import type { InputSymbol } from '../data/types';
import { actor, bar, clamp, panel, pixelText, seeded, symbol, type Palette } from './art';

type Item={id:number;x:number;y:number;vx:number;vy:number;hit:boolean};
const KEYS:InputSymbol[]=['U','R','D','L','A','B'];
export const SUPPORTED_MECHANICS=['catch','runner','rhythm','memory','balance','fishing','maze','typing','invaders','escape','clicker','pong','blocks'] as const;

type Invader={id:number;x:number;y:number;row:number};
type Projectile={x:number;y:number};

/** A moving formation, persistent enemies and opposing projectiles, in a fixed simulation. */
export class SpaceInvaders {
  score=0;
  lives=3;
  wave=0;
  x=160;
  private enemies:Invader[]=[];
  private bullets:Projectile[]=[];
  private enemyBullets:Projectile[]=[];
  private direction=1;
  private clock=0;
  private accumulator=0;
  private nextFire=0;
  private nextEnemyFire=1.1;
  private fireCount=0;
  private nextWave=0;
  private shieldUntil=0;
  private shieldReady=0;
  private invulnerableUntil=0;
  constructor(private readonly seed:number){this.startWave();}
  get gameOver(){return this.lives===0;}
  get snapshot(){return {score:this.score,lives:this.lives,wave:this.wave,x:this.x,direction:this.direction,speed:12+this.wave*3,gameOver:this.gameOver,shield:this.shieldUntil>this.clock,shieldReady:this.shieldReady<=this.clock,enemies:this.enemies.map(e=>({...e})),bullets:this.bullets.map(b=>({...b})),enemyBullets:this.enemyBullets.map(b=>({...b}))};}
  restart(){
    this.score=0;this.lives=3;this.wave=0;this.x=160;this.clock=0;this.accumulator=0;this.nextFire=0;this.nextEnemyFire=1.1;this.fireCount=0;this.nextWave=0;this.shieldUntil=0;this.shieldReady=0;this.invulnerableUntil=0;this.startWave();
  }
  input(key:InputSymbol){
    if(this.gameOver){if(key==='A')this.restart();return;}
    if(key==='L')this.x=clamp(this.x-19,20,300);
    if(key==='R')this.x=clamp(this.x+19,20,300);
    if((key==='A'||key==='U')&&this.clock>=this.nextFire){this.bullets.push({x:this.x,y:150});this.nextFire=this.clock+.18;}
    if(key==='B'&&this.clock>=this.shieldReady){this.shieldUntil=this.clock+.9;this.shieldReady=this.clock+3.8;}
  }
  update(dt:number){
    if(this.gameOver)return;
    this.accumulator+=Math.max(0,dt);
    while(this.accumulator>=1/120){this.accumulator-=1/120;this.step(1/120);if(this.gameOver){this.accumulator=0;break;}}
  }
  private startWave(){
    this.wave++;this.direction=this.wave%2?1:-1;
    this.enemies=Array.from({length:21},(_,i)=>({id:(this.wave-1)*21+i,x:34+i%7*42,y:39+Math.floor(i/7)*18,row:Math.floor(i/7)}));
    this.bullets=[];this.enemyBullets=[];this.nextEnemyFire=this.clock+1.1;this.invulnerableUntil=this.clock+.6;
  }
  private hurt(){
    if(this.clock<this.shieldUntil||this.clock<this.invulnerableUntil)return;
    this.lives--;this.invulnerableUntil=this.clock+1.4;
  }
  private step(dt:number){
    this.clock+=dt;
    if(this.enemies.length===0){if(this.clock>=this.nextWave)this.startWave();return;}
    const dx=this.direction*(12+this.wave*3)*dt;
    const edge=this.enemies.some(e=>e.x+dx<18||e.x+dx>302);
    if(edge){this.direction*=-1;for(const e of this.enemies)e.y+=7;}
    else for(const e of this.enemies)e.x+=dx;
    for(const bullet of this.bullets)bullet.y-=185*dt;
    for(let i=this.bullets.length-1;i>=0;i--){
      const bullet=this.bullets[i];
      const target=this.enemies.findIndex(e=>Math.abs(e.x-bullet.x)<9&&Math.abs(e.y-bullet.y)<7);
      if(target!==-1){this.enemies.splice(target,1);this.bullets.splice(i,1);this.score+=10;}
      else if(bullet.y<28)this.bullets.splice(i,1);
    }
    if(this.enemies.length===0){this.nextWave=this.clock+.85;this.enemyBullets=[];return;}
    if(this.clock>=this.nextEnemyFire){
      // Only the lowest alien in a column can fire through that column.
      const columns=new Map<number,Invader>();
      for(const enemy of this.enemies){const column=enemy.id%7;const previous=columns.get(column);if(!previous||enemy.y>previous.y)columns.set(column,enemy);}
      const shooters=[...columns.values()];
      const source=shooters[Math.min(shooters.length-1,Math.floor(seeded(this.seed+this.fireCount++*41+this.wave*97)*shooters.length))];
      this.enemyBullets.push({x:source.x,y:source.y+8});this.nextEnemyFire=this.clock+Math.max(.38,1.05-this.wave*.08);
    }
    for(let i=this.enemyBullets.length-1;i>=0;i--){
      const bullet=this.enemyBullets[i];bullet.y+=(56+this.wave*5)*dt;
      if(bullet.y>=150&&bullet.y<=169&&Math.abs(bullet.x-this.x)<12){this.hurt();this.enemyBullets.splice(i,1);}
      else if(bullet.y>173)this.enemyBullets.splice(i,1);
    }
    if(this.enemies.some(e=>e.y>140)){this.lives=0;this.bullets=[];this.enemyBullets=[];}
  }
}

type BlockType='I'|'O'|'T'|'L'|'J'|'S'|'Z';
type Cell=readonly [number,number];
const BLOCK_TYPES:BlockType[]=['I','O','T','L','J','S','Z'];
const BLOCK_SHAPES:Record<BlockType,{size:number;cells:Cell[]}>={
  I:{size:4,cells:[[0,1],[1,1],[2,1],[3,1]]},O:{size:2,cells:[[0,0],[1,0],[0,1],[1,1]]},
  T:{size:3,cells:[[1,0],[0,1],[1,1],[2,1]]},L:{size:3,cells:[[2,0],[0,1],[1,1],[2,1]]},
  J:{size:3,cells:[[0,0],[0,1],[1,1],[2,1]]},S:{size:3,cells:[[1,0],[2,0],[0,1],[1,1]]},Z:{size:3,cells:[[0,0],[1,0],[1,1],[2,1]]},
};
type FallingPiece={type:BlockType;x:number;y:number;cells:Cell[]};

/** Remove complete rows together, then let all surviving rows settle without mutating input. */
export function clearBlockRows(board:readonly (readonly number[])[]){
  const surviving=board.filter(row=>row.some(cell=>cell===0)).map(row=>[...row]);
  const cleared=board.length-surviving.length;
  return {board:[...Array.from({length:cleared},()=>Array<number>(board[0]?.length??10).fill(0)),...surviving],cleared};
}

/** Ten columns, seven distinct four-cell shapes, gravity, wall kicks and full-row clearing. */
export class FallingBlocks {
  score=0;
  lines=0;
  pieces=0;
  gameOver=false;
  private board=Array.from({length:16},()=>Array<number>(10).fill(0));
  private piece!:FallingPiece;
  private queue:BlockType[]=[];
  private bag=0;
  private gravity=0;
  constructor(private readonly seed:number){this.spawn();}
  get snapshot(){return {score:this.score,lines:this.lines,pieces:this.pieces,gameOver:this.gameOver,board:this.board.map(row=>[...row]),active:{type:this.piece.type,cells:this.piece.cells.map(([x,y])=>[x+this.piece.x,y+this.piece.y] as Cell)},next:this.queue.slice(0,3).map(type=>({type,cells:BLOCK_SHAPES[type].cells.map(([x,y])=>[x,y] as Cell)})),ghost:this.ghostCells()};}
  restart(){this.score=0;this.lines=0;this.pieces=0;this.gameOver=false;this.board=Array.from({length:16},()=>Array<number>(10).fill(0));this.queue=[];this.bag=0;this.gravity=0;this.spawn();}
  move(dx:number,dy=0){
    if(this.gameOver||!this.fits(this.piece.cells,this.piece.x+dx,this.piece.y+dy))return false;
    this.piece.x+=dx;this.piece.y+=dy;return true;
  }
  rotate(){
    if(this.gameOver)return false;
    const size=BLOCK_SHAPES[this.piece.type].size;
    const rotated=this.piece.cells.map(([x,y])=>[size-1-y,x] as Cell);
    for(const up of [0,-1,-2])for(const kick of [0,-1,1,-2,2])if(this.fits(rotated,this.piece.x+kick,this.piece.y+up)){this.piece.cells=rotated;this.piece.x+=kick;this.piece.y+=up;return true;}
    return false;
  }
  hardDrop(){
    if(this.gameOver)return 0;
    let distance=0;while(this.move(0,1))distance++;
    this.score+=distance*2;this.lock();return distance;
  }
  input(key:InputSymbol){
    if(this.gameOver){if(key==='A')this.restart();return;}
    if(key==='L')this.move(-1);if(key==='R')this.move(1);
    if(key==='A'||key==='U')this.rotate();
    if(key==='D'){if(this.move(0,1))this.score++;else this.lock();this.gravity=0;}
    if(key==='B')this.hardDrop();
  }
  update(dt:number){
    if(this.gameOver)return;
    this.gravity+=Math.max(0,dt);
    const interval=Math.max(.16,.72*Math.pow(.83,Math.floor(this.lines/4)));
    while(this.gravity>=interval&&!this.gameOver){this.gravity-=interval;if(!this.move(0,1))this.lock();}
  }
  private fits(cells:Cell[],x:number,y:number){return cells.every(([cx,cy])=>cx+x>=0&&cx+x<10&&cy+y>=0&&cy+y<16&&this.board[cy+y][cx+x]===0);}
  private refill(){
    const bag=[...BLOCK_TYPES],base=this.seed+this.bag++*1009;
    for(let i=bag.length-1;i>0;i--){const j=Math.min(i,Math.floor(seeded(base+i*31)*(i+1)));[bag[i],bag[j]]=[bag[j],bag[i]];}
    this.queue.push(...bag);
  }
  private spawn(){
    if(this.queue.length<4)this.refill();
    const type=this.queue.shift()!;this.piece={type,x:3,y:0,cells:BLOCK_SHAPES[type].cells.map(([x,y])=>[x,y] as Cell)};
    this.gameOver=!this.fits(this.piece.cells,this.piece.x,this.piece.y);
  }
  private lock(){
    for(const [x,y] of this.piece.cells)this.board[y+this.piece.y][x+this.piece.x]=BLOCK_TYPES.indexOf(this.piece.type)+1;
    this.pieces++;
    const cleared=clearBlockRows(this.board);this.board=cleared.board;this.lines+=cleared.cleared;
    this.score+=[0,100,300,500,800][cleared.cleared]??0;this.gravity=0;this.spawn();
  }
  private ghostCells(){let y=this.piece.y;if(!this.gameOver)while(this.fits(this.piece.cells,this.piece.x,y+1))y++;return this.piece.cells.map(([x,cy])=>[x+this.piece.x,cy+y] as Cell);}
}
const MAZE=[
  '###############',
  '#.....#.......#',
  '#.###.#.#####.#',
  '#...#...#...#.#',
  '###.#####.#.#.#',
  '#...#.....#...#',
  '#.###.###.###.#',
  '#.....#.......#',
  '###############',
];

/** Fixed-step minigames. They never gate the event's elapsed-time completion. */
export class Minigame {
  readonly kind:string;
  score=0;
  misses=0;
  private x=160;
  private y=137;
  private vy=0;
  private energy=0;
  private angle=0;
  private selected=0;
  private index=0;
  private stage=0;
  private time=0;
  private lastSpawn=-1;
  private feedback='READY';
  private feedbackUntil=1.5;
  private items:Item[]=[];
  private hit=new Set<number>();
  private memory:InputSymbol[]=['U','R','D','A'];
  private sequence:InputSymbol[]=['U','R','A','D','L','B'];
  private mazeX=1;
  private mazeY=1;
  private visited=new Set<string>();
  private fishingCast=false;
  private lastCast=-10;
  private ball={x:160,y:94,vx:-72,vy:39};
  private paddle=96;
  private computer=96;
  private shieldUntil=0;
  private finished=false;
  private succeeded=false;
  private readonly seed:number;
  private readonly invaders?:SpaceInvaders;
  private readonly blocks?:FallingBlocks;
  constructor(kind:string,seed:number){this.kind=kind;this.seed=seed;this.memory=Array.from({length:4},(_,i)=>KEYS[Math.floor(seeded(seed+i*21)*4)]);this.sequence=Array.from({length:6},(_,i)=>KEYS[Math.floor(seeded(seed+i*67)*6)]);if(kind==='invaders')this.invaders=new SpaceInvaders(seed);if(kind==='blocks')this.blocks=new FallingBlocks(seed);}

  private say(text:string,seconds=1.2){this.feedback=text;this.feedbackUntil=this.time+seconds;}
  private keyHit(s:InputSymbol){return s==='A'||s==='U';}
  input(s:InputSymbol|'START'){
    if(this.finished)return;
    const key=s==='START'?'A':s;
    switch(this.kind){
      case 'catch':
        if(key==='L')this.x-=23;if(key==='R')this.x+=23;
        if(key==='A'){const closest=this.items.filter(i=>!i.hit).sort((a,b)=>b.y-a.y)[0];if(closest)this.x+=clamp(closest.x-this.x,-40,40);this.say('DASH');}break;
      case 'runner':
        if(this.keyHit(key)&&this.y>=136){this.vy=-143;this.say('JUMP!');}
        if(key==='L')this.x-=12;if(key==='R')this.x+=12;
        if(key==='B'||key==='D'){this.shieldUntil=this.time+.55;this.say('DUCK');}break;
      case 'rhythm': {
        const n=Math.round((this.time-1.2)/.7),target=1.2+n*.7;
        if(n>=0&&!this.hit.has(n)&&Math.abs(this.time-target)<.31&&key===KEYS[n%KEYS.length]){this.hit.add(n);this.score++;this.say(Math.abs(this.time-target)<.13?'PERFECT!':'NICE!');}else{this.misses++;this.say('NEXT BEAT');}break;
      }
      case 'memory':
        if(this.time<4.2){this.say('WATCH THE LIGHTS');break;}
        if(key===this.memory[this.index]){this.index++;this.score++;this.say('CORRECT!');if(this.index===this.memory.length){this.stage++;this.index=0;this.say('PATTERN COMPLETE!',2);}}
        else{this.misses++;this.index=0;this.say('TRY THE PATTERN AGAIN');}break;
      case 'balance':
        if(key==='L')this.angle-=.19;if(key==='R')this.angle+=.19;if(key==='A'||key==='B')this.angle*=.7;this.say(Math.abs(this.angle)<.3?'STEADY':'CAREFUL');break;
      case 'fishing':
        if(key==='L')this.x-=18;if(key==='R')this.x+=18;
        if(key==='A'||key==='B'){
          if(!this.fishingCast){this.fishingCast=true;this.lastCast=this.time;this.say('LINE CAST!');}
          else if(this.time-this.lastCast>.6&&Math.abs(this.fishX()-this.x)<27){this.score++;this.fishingCast=false;this.say('CAUGHT A STARFISH!',1.7);}
          else{this.misses++;this.say('WAIT FOR THE FISH');}
        }break;
      case 'maze': {
        const dx=key==='L'?-1:key==='R'?1:0,dy=key==='U'?-1:key==='D'?1:0;
        const nx=this.mazeX+dx,ny=this.mazeY+dy;
        if(MAZE[ny]?.[nx]==='.'){
          this.mazeX=nx;this.mazeY=ny;const cell=`${nx},${ny}`;if(!this.visited.has(cell)){this.visited.add(cell);this.score++;}
          if(nx===13&&ny===7){this.stage++;this.score+=10;this.say('EXIT FOUND!',3);}
        }
        if(key==='A'){this.shieldUntil=this.time+2;this.say('FOLLOW THE OPEN CORRIDORS');}
        if(key==='B'){this.mazeX=1;this.mazeY=1;this.say('BACK TO THE ENTRANCE');}break;
      }
      case 'typing':
        if(key===this.sequence[this.index]){this.index++;this.score++;this.say('GOOD!');if(this.index===this.sequence.length){this.index=0;this.stage++;this.sequence=Array.from({length:6},(_,i)=>KEYS[Math.floor(seeded(this.seed+this.stage*400+i*67)*6)]);this.say('COMMAND ACCEPTED!');}}
        else{this.misses++;this.say('CHECK THE NEXT SYMBOL');}break;
      case 'invaders':
        this.invaders!.input(key);this.score=this.invaders!.score;this.misses=3-this.invaders!.lives;
        if(key==='B')this.say(this.invaders!.snapshot.shield?'SHIELD ON':'SHIELD RECHARGING');break;
      case 'blocks': {
        const previous=this.blocks!.lines,over=this.blocks!.gameOver;
        this.blocks!.input(key);this.score=this.blocks!.score;
        if(this.blocks!.lines>previous)this.say(`${this.blocks!.lines-previous} LINE CLEAR!`,2);
        else if(over&&!this.blocks!.gameOver)this.say('NEW GAME!');
        else if(key==='B')this.say('HARD DROP');
        break;
      }
      case 'escape':
        if(key==='L')this.selected=(this.selected+2)%3;if(key==='R')this.selected=(this.selected+1)%3;
        if(key==='A'||key==='U'){
          if(this.selected===this.safeDoor()){this.score++;this.stage++;this.say('DOOR OPEN! NEXT ROOM',1.5);}else{this.misses++;this.say('FOLLOW THE STAR ABOVE');}
        }break;
      case 'clicker':
        if(key==='A'||key==='U'){this.energy=clamp(this.energy+10,0,100);this.say('CHARGE +10');}
        if(key==='B'||key==='D'){if(this.energy>=20){this.energy-=20;this.score++;this.say('ONE MORE STAR!');}else{this.say('CHARGE TO 20 FIRST');}}
        break;
      case 'pong':
        if(key==='U')this.paddle-=16;if(key==='D')this.paddle+=16;
        if(key==='L')this.paddle-=8;if(key==='R')this.paddle+=8;
        if(key==='A'&&this.ball.x<60){this.ball.vx=Math.abs(this.ball.vx)+8;this.ball.vy=(this.ball.y-this.paddle)*4;this.say('POWER SHOT!');}
        if(key==='B')this.paddle=this.ball.y;break;
      case 'choice':
        if(key==='L')this.selected=(this.selected+2)%3;if(key==='R')this.selected=(this.selected+1)%3;
        if(key==='A'||key==='U'){this.score++;this.stage++;this.say(['A POCKET-SIZED MOON','THE CAT CHOSE YOU','A VERY SECRET CAKE'][(this.selected+this.stage)%3],2);}
        if(key==='B'){this.selected=(this.selected+1)%3;this.say('ANOTHER POSSIBILITY');}break;
    }
    this.x=clamp(this.x,20,300);this.paddle=clamp(this.paddle,45,151);
  }

  private fishX(){return 160+Math.sin(this.time*1.05+this.seed%7)*108;}
  private safeDoor(){return (this.stage+this.seed)%3;}
  finish(){
    if(this.finished)return;
    this.finished=true;
    const goals:Record<string,number>={catch:5,runner:5,rhythm:7,fishing:2,typing:6,invaders:60,escape:2,clicker:5,pong:4,choice:2};
    this.succeeded=this.blocks?this.blocks.lines>0||this.blocks.pieces>=8:this.kind==='maze'||this.kind==='memory'?this.stage>0:this.kind==='balance'?this.score>=5&&this.score>this.misses:this.score>=(goals[this.kind]??1);
    this.say(this.succeeded?'MISSION COMPLETE!':'GOOD TRY! KEEP EXPLORING',999);
  }
  update(time:number,dt:number){
    if(this.finished)return;
    this.time=time;
    switch(this.kind){
      case 'catch': {
        const n=Math.floor(time/.85);
        if(n!==this.lastSpawn){this.lastSpawn=n;this.items.push({id:n,x:22+seeded(this.seed+n*51)*276,y:25,vx:0,vy:43+seeded(n*7)*17,hit:false});}
        for(const item of this.items){if(item.hit)continue;item.y+=item.vy*dt;if(item.y>146&&item.y<164&&Math.abs(item.x-this.x)<19){item.hit=true;this.score++;this.say('STAR CAUGHT!');}else if(item.y>176){item.hit=true;this.misses++;}}
        this.items=this.items.filter(i=>i.y<180);break;
      }
      case 'runner': {
        this.x=clamp(this.x,35,95);this.vy+=330*dt;this.y=clamp(this.y+this.vy*dt,70,137);if(this.y>=137)this.vy=0;
        const n=Math.floor(time/1.65);if(n!==this.lastSpawn){this.lastSpawn=n;this.items.push({id:n,x:330,y:n%3===2?113:144,vx:-87,vy:0,hit:false});}
        for(const item of this.items){item.x+=item.vx*dt;if(!item.hit&&Math.abs(item.x-this.x)<13){item.hit=true;const duck=item.y===113&&this.shieldUntil>time;if((item.y===144&&this.y<119)||duck){this.score++;this.say('CLEAR!');}else{this.misses++;this.say('KEEP RUNNING');}}}this.items=this.items.filter(i=>i.x>-20);break;
      }
      case 'rhythm': {
        const passed=Math.floor((time-1.53)/.7);for(let i=0;i<=passed;i++)if(!this.hit.has(i)){this.hit.add(i);this.misses++;}break;
      }
      case 'balance':
        this.angle+=dt*(Math.sin(time*1.2+this.seed)*.25+Math.sin(time*.4)*.15);this.angle=clamp(this.angle,-1.1,1.1);
        this.energy+=dt;if(this.energy>=1){this.energy-=1;if(Math.abs(this.angle)<.38)this.score++;else this.misses++;}break;
      case 'clicker':this.energy=Math.max(0,this.energy-dt*1.2);break;
      case 'invaders': {
        const score=this.score,wave=this.invaders!.wave,lives=this.invaders!.lives;
        this.invaders!.update(dt);this.score=this.invaders!.score;this.misses=3-this.invaders!.lives;
        if(this.invaders!.wave>wave)this.say(`WAVE ${this.invaders!.wave}`,2);
        else if(this.score>score)this.say('ALIEN DESTROYED!');
        else if(this.invaders!.lives<lives)this.say(this.invaders!.gameOver?'GAME OVER - A TO RESTART':'SHIP HIT!',2);
        break;
      }
      case 'blocks': {
        const lines=this.blocks!.lines,over=this.blocks!.gameOver;
        this.blocks!.update(dt);this.score=this.blocks!.score;
        if(this.blocks!.gameOver&&!over)this.say('GAME OVER - A TO RESTART',3);
        else if(this.blocks!.lines>lines)this.say(`${this.blocks!.lines-lines} LINE CLEAR!`,2);
        break;
      }
      case 'pong': {
        const b=this.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;this.computer+=clamp(b.y-this.computer,-35*dt,35*dt);
        if(b.y<35){b.y=35;b.vy=Math.abs(b.vy);}if(b.y>157){b.y=157;b.vy=-Math.abs(b.vy);}
        if(b.vx<0&&b.x<27&&b.x>15&&Math.abs(b.y-this.paddle)<23){b.x=28;b.vx=Math.abs(b.vx)+1;b.vy+=(b.y-this.paddle)*1.4;this.score++;this.say('RETURN!');}
        if(b.vx>0&&b.x>293&&Math.abs(b.y-this.computer)<20){b.x=292;b.vx=-Math.abs(b.vx);}
        if(b.x<7||b.x>313){const left=b.x<7;if(!left){this.score+=3;this.say('POINT!');}else{this.misses++;this.say('NEXT SERVE');}b.x=160;b.y=94;b.vx=left?76:-76;b.vy=39;}
        break;
      }
    }
  }

  get detail():string {
    const instructions:Record<string,string>={catch:'← →で移動・Aで星へダッシュ',runner:'↑ / Aでジャンプ・↓ / Bでかがむ',rhythm:'中央の線に重なる記号を入力',memory:'最初の4つを覚えて、同じ順に入力',balance:'← →で傾きを調整・Aで安定',fishing:'← →で釣り位置・Aで投げる／魚が近い時に釣る',maze:'矢印で迷路を進む・Aでヒント・Bで入口へ',typing:'光っているコマンドを順番に入力',invaders:'← →で移動・Aで発射・Bでシールド（再充電あり）',blocks:'← →で移動・↑ / Aで回転・↓で落下・Bで一気に落とす',escape:'← →で扉を選び、星の扉をAで開く',clicker:'Aで充電・20以上でBを押して星を灯す',pong:'↑ ↓でラケット・Aで強打・Bで追いつく',choice:'← →で箱を選ぶ・Aで開ける'};
    const result=this.kind==='maze'&&this.stage>0?'　出口を発見！':this.kind==='memory'&&this.stage>0?'　記憶成功！':'';
    const over=this.invaders?.gameOver||this.blocks?.gameOver;
    const stats=this.invaders?`　残機 ${this.invaders.lives}・ウェーブ ${this.invaders.wave}`:this.blocks?`　消した列 ${this.blocks.lines}・配置 ${this.blocks.pieces}`:'';
    return `${this.finished?(this.succeeded?'クリア！':'タイムアップ。ナイストライ！'):over?'ゲームオーバー。Aでもう一度！':instructions[this.kind]??'Aであそぶ'}　｜　スコア ${this.score}${stats}${result}`;
  }

  draw(ctx:CanvasRenderingContext2D,p:Palette,reduced:boolean){
    const t=this.time;
    switch(this.kind){
      case 'catch':
        for(const item of this.items)if(!item.hit)actor(ctx,'star',item.x,item.y,p,{scale:.65,rotation:reduced?0:Math.sin(t+item.id)*.2});
        actor(ctx,'hero',this.x,153,p);ctx.fillStyle=p.light;ctx.fillRect(this.x-17,147,34,5);ctx.fillStyle=p.mid;ctx.fillRect(this.x-14,152,28,10);ctx.fillStyle=p.pale;ctx.fillRect(this.x-12,152,24,1);break;
      case 'runner':
        for(let i=0;i<17;i++){ctx.fillStyle=p.mid;ctx.fillRect((i*24-t*87%24),154,11,2);}
        actor(ctx,'hero',this.x,this.y+17,p,{pose:Math.floor(t*10),scale:this.shieldUntil>t?.65:1});
        for(const item of this.items)actor(ctx,item.y===113?'bird':'box',item.x,item.y+10,p,{scale:.75,opacity:item.hit?.5:1});break;
      case 'rhythm': {
        const line=112;ctx.fillStyle=p.mid;ctx.fillRect(line,40,1,104);ctx.fillStyle=p.light;ctx.fillRect(line-1,91,3,18);
        for(let i=Math.max(0,Math.floor((t-5)/.7));i<(t+4)/.7;i++){const x=line+(1.2+i*.7-t)*64;if(x<20||x>304)continue;const s=KEYS[i%6];panel(ctx,x-10,89,21,22,p);symbol(ctx,s,x,97,p.pale,1);}
        actor(ctx,'hero',59,153,p,{pose:Math.floor(t*3)});actor(ctx,'robot',268,153,p,{pose:Math.floor(t*3)});
        pixelText(ctx,'HIT THE LINE',160,54,p.ink,1,'center');break;
      }
      case 'memory': {
        const watch=t<4.2,active=watch?Math.min(3,Math.floor(t/1.05)):-1;
        pixelText(ctx,watch?'WATCH + REMEMBER':'YOUR TURN',160,39,p.pale,1,'center');
        for(let i=0;i<4;i++){panel(ctx,63+i*49,73,43,45,p);if((watch&&i===active)||(!watch&&i===this.index)){ctx.fillStyle=p.mid;ctx.fillRect(65+i*49,75,39,41);}if(watch||i<this.index)symbol(ctx,this.memory[i],84+i*49,89,watch&&i!==active?p.dark:p.pale,2);else pixelText(ctx,'?',84+i*49,89,p.ink,2,'center');if(!watch&&i<this.index)pixelText(ctx,'+',84+i*49,128,p.light,1,'center');}
        actor(ctx,'ghost',160,157,p,{scale:.7});break;
      }
      case 'balance': {
        ctx.fillStyle=p.dark;ctx.fillRect(155,134,10,20);ctx.fillStyle=p.mid;ctx.fillRect(150,151,20,3);
        ctx.save();ctx.translate(160,120);ctx.rotate(reduced?this.angle*.25:this.angle*.6);ctx.fillStyle=p.light;ctx.fillRect(-90,0,180,4);ctx.fillStyle=p.mid;ctx.fillRect(-90,4,180,2);actor(ctx,'hero',0,0,p);actor(ctx,'box',-70,0,p,{scale:.7});actor(ctx,'cat',70,0,p,{scale:.8});ctx.restore();
        bar(ctx,75,49,170,1-Math.abs(this.angle),p);pixelText(ctx,'KEEP THE WORLD IN BALANCE',160,34,p.ink,1,'center');break;
      }
      case 'fishing': {
        ctx.fillStyle=p.deep;ctx.fillRect(0,95,320,72);ctx.fillStyle=p.mid;for(let i=0;i<18;i++)ctx.fillRect((i*29+Math.floor(t*4))%320,101+i%5*11,13,1);
        ctx.fillStyle=p.dark;ctx.fillRect(12,88,62,39);ctx.fillStyle=p.light;ctx.fillRect(10,87,66,3);ctx.fillStyle=p.mid;ctx.fillRect(18,126,4,34);ctx.fillRect(64,126,4,34);actor(ctx,'hero',48,87,p);
        ctx.strokeStyle=p.ink;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(54,66);ctx.lineTo(79,46);if(this.fishingCast){ctx.lineTo(Math.round(this.x),110);ctx.stroke();ctx.fillStyle=p.pale;ctx.fillRect(this.x-2,107,4,3);ctx.fillStyle=p.light;ctx.fillRect(this.x-2,110,4,3);}else ctx.stroke();
        actor(ctx,'fish',this.fishX(),136,p,{scale:.8,flip:Math.cos(t*1.05)<0});if(this.fishingCast&&Math.abs(this.fishX()-this.x)<27)pixelText(ctx,'!',this.x,95,p.pale,1,'center');break;
      }
      case 'maze': {
        const ox=70,oy=43,sz=12;ctx.fillStyle=p.bg;ctx.fillRect(ox-3,oy-3,186,114);
        MAZE.forEach((row,y)=>[...row].forEach((cell,x)=>{if(cell==='#'){ctx.fillStyle=p.mid;ctx.fillRect(ox+x*sz,oy+y*sz,11,11);ctx.fillStyle=p.dark;ctx.fillRect(ox+x*sz+1,oy+y*sz+2,9,8);}else if(this.visited.has(`${x},${y}`)){ctx.fillStyle=p.dark;ctx.fillRect(ox+x*sz+5,oy+y*sz+5,2,2);}}));
        actor(ctx,'star',ox+13*sz+6,oy+7*sz+10,p,{scale:.4});actor(ctx,'hero',ox+this.mazeX*sz+6,oy+this.mazeY*sz+11,p,{scale:.42});
        if(this.stage>0)pixelText(ctx,'EXIT FOUND!',160,162,p.pale,1,'center');break;
      }
      case 'typing':
        pixelText(ctx,'REPAIR THE SECRET TERMINAL',160,42,p.ink,1,'center');panel(ctx,39,66,242,53,p);
        for(let i=0;i<6;i++){if(i===this.index){ctx.fillStyle=p.mid;ctx.fillRect(47+i*38,75,32,34);}symbol(ctx,this.sequence[i],63+i*38,85,i<this.index?p.ink:p.pale,2);if(i===this.index)pixelText(ctx,'^',63+i*38,113,p.light,1,'center');}
        actor(ctx,'robot',76,155,p,{scale:.8});pixelText(ctx,`PACKETS ${this.stage}`,201,140,p.light,1,'center');break;
      case 'invaders': {
        const state=this.invaders!.snapshot;
        ctx.fillStyle=p.bg;ctx.fillRect(8,28,304,145);ctx.fillStyle=p.dark;
        for(let i=0;i<28;i++)ctx.fillRect(13+(i*71)%295,31+(i*43)%132,1,1);
        // Small original sprites alternate their legs as the formation marches.
        const frames=[['00100000100','00010001000','00111111100','01101110110','11111111111','10111111101','10100000101','00011011000'].join(''),['00100000100','00010001000','00111111100','01101110110','11111111111','00111111100','00100000100','01000000010'].join('')];
        const sprite=frames[reduced?0:Math.floor(t*3)%2];
        for(const enemy of state.enemies){ctx.fillStyle=enemy.row===0?p.pale:enemy.row===1?p.light:p.ink;for(let i=0;i<sprite.length;i++)if(sprite[i]==='1')ctx.fillRect(Math.round(enemy.x)+(i%11)-5,Math.round(enemy.y)+Math.floor(i/11)-3,1,1);}
        ctx.fillStyle=p.pale;for(const bullet of state.bullets)ctx.fillRect(Math.round(bullet.x)-1,Math.round(bullet.y)-4,2,6);
        ctx.fillStyle=p.accent;for(const bullet of state.enemyBullets){ctx.fillRect(Math.round(bullet.x)-1,Math.round(bullet.y),2,5);ctx.fillRect(Math.round(bullet.x)+1,Math.round(bullet.y)+4,1,3);}
        ctx.fillStyle=p.light;ctx.fillRect(state.x-11,158,22,5);ctx.fillRect(state.x-7,154,14,4);ctx.fillRect(state.x-2,149,4,5);ctx.fillStyle=p.pale;ctx.fillRect(state.x-2,157,4,3);
        if(state.shield){ctx.strokeStyle=p.pale;ctx.strokeRect(state.x-16,145,32,22);}
        pixelText(ctx,`WAVE ${state.wave}`,14,166,p.ink);pixelText(ctx,`LIVES ${state.lives}`,307,166,p.light,1,'right');
        if(state.gameOver){panel(ctx,68,81,184,39,p);pixelText(ctx,'GAME OVER',160,89,p.pale,1,'center');pixelText(ctx,'A TO RESTART',160,105,p.light,1,'center');}
        break;
      }
      case 'blocks': {
        const state=this.blocks!.snapshot,ox=114,oy=29,cell=9;
        const colors=[p.deep,p.light,p.pale,p.accent,p.ink,p.mid,p.light,p.ink];
        ctx.fillStyle=p.bg;ctx.fillRect(10,28,300,146);panel(ctx,ox-3,oy-2,96,148,p);
        ctx.fillStyle=p.bg;ctx.fillRect(ox,oy,90,144);
        const tile=(x:number,y:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(ox+x*cell+1,oy+y*cell+1,7,7);ctx.fillStyle=p.pale;ctx.fillRect(ox+x*cell+1,oy+y*cell+1,6,1);};
        state.board.forEach((row,y)=>row.forEach((v,x)=>{if(v)tile(x,y,colors[v]);else{ctx.fillStyle=p.deep;ctx.fillRect(ox+x*cell+8,oy+y*cell,1,9);ctx.fillRect(ox+x*cell,oy+y*cell+8,9,1);}}));
        if(!state.gameOver){ctx.strokeStyle=p.mid;for(const [x,y] of state.ghost)ctx.strokeRect(ox+x*cell+1.5,oy+y*cell+1.5,6,6);for(const [x,y] of state.active.cells)tile(x,y,colors[BLOCK_TYPES.indexOf(state.active.type)+1]);}
        pixelText(ctx,'NEXT',233,34,p.ink);
        state.next.forEach((next,i)=>{ctx.fillStyle=colors[BLOCK_TYPES.indexOf(next.type)+1];for(const [x,y] of next.cells)ctx.fillRect(234+x*7,49+i*31+y*7,6,6);});
        pixelText(ctx,'LINES',38,53,p.ink);pixelText(ctx,String(state.lines),53,67,p.pale,2,'center');
        pixelText(ctx,'STACK',38,99,p.ink);pixelText(ctx,String(state.pieces),53,113,p.light,2,'center');
        pixelText(ctx,'A ROTATE',19,149,p.ink);pixelText(ctx,'B DROP',227,149,p.ink);
        if(state.gameOver){panel(ctx,61,79,198,43,p);pixelText(ctx,'STACK FULL!',160,89,p.pale,1,'center');pixelText(ctx,'A TO RESTART',160,106,p.light,1,'center');}
        break;
      }
      case 'escape':
        pixelText(ctx,'THE STAR KNOWS THE WAY',160,39,p.ink,1,'center');
        for(let i=0;i<3;i++){const x=57+i*78;ctx.fillStyle=p.mid;ctx.fillRect(x,75,49,78);ctx.fillStyle=p.deep;ctx.fillRect(x+3,78,43,72);ctx.fillStyle=p.dark;ctx.fillRect(x+6,81,37,66);ctx.fillStyle=p.light;ctx.fillRect(x+35,117,3,3);if(i===this.safeDoor())actor(ctx,'star',x+24,68,p,{scale:.55});if(i===this.selected){ctx.fillStyle=p.pale;ctx.fillRect(x-2,155,53,2);actor(ctx,'hero',x+24,156,p,{scale:.65});}pixelText(ctx,String(i+1),x+24,91,p.ink,1,'center');}break;
      case 'clicker':
        pixelText(ctx,'WAKE THE CONSTELLATION',160,38,p.ink,1,'center');
        for(let i=0;i<7;i++)actor(ctx,'star',61+i*33,69-(i%2)*13,p,{scale:.48,opacity:i<this.score%8?1:.18});
        actor(ctx,'robot',160,148,p,{scale:1.7});ctx.fillStyle=this.energy>=20?p.light:p.mid;ctx.fillRect(154,124,12,6);bar(ctx,96,159,128,this.energy/100,p);pixelText(ctx,`${Math.floor(this.energy)}/100`,160,170,p.light,1,'center');break;
      case 'pong':
        ctx.fillStyle=p.deep;ctx.fillRect(15,31,290,130);ctx.strokeStyle=p.mid;ctx.strokeRect(15.5,31.5,290,130);ctx.fillStyle=p.dark;for(let i=0;i<11;i++)ctx.fillRect(159,34+i*12,2,6);
        ctx.fillStyle=p.light;ctx.fillRect(21,this.paddle-20,5,40);ctx.fillStyle=p.ink;ctx.fillRect(294,this.computer-18,5,36);ctx.fillStyle=p.pale;ctx.fillRect(Math.round(this.ball.x)-2,Math.round(this.ball.y)-2,4,4);break;
      case 'choice':
        pixelText(ctx,'EVERY BOX HIDES A POSSIBILITY',160,40,p.ink,1,'center');
        for(let i=0;i<3;i++){const x=81+i*79;actor(ctx,'box',x,131,p,{scale:i===this.selected?1.4:1.1});pixelText(ctx,String(i+1),x,100,p.pale,1,'center');if(i===this.selected){ctx.fillStyle=p.light;ctx.fillRect(x-20,139,40,2);actor(ctx,'hero',x,171,p,{scale:.7});}}
        if(this.feedbackUntil>t&&this.stage>0)actor(ctx,(['moon','cat','cake'] as const)[(this.selected+this.stage)%3],160,76,p,{scale:.75});break;
      default:actor(ctx,'hero',160,145,p);
    }
    // Two compact HUD strips keep the playfield open.
    panel(ctx,8,8,304,17,p);pixelText(ctx,`SCORE ${String(this.score).padStart(2,'0')}`,17,13,p.pale);pixelText(ctx,`TRY ${String(this.misses).padStart(2,'0')}`,302,13,p.ink,1,'right');
    if(this.feedbackUntil>t){panel(ctx,35,177,250,15,p);pixelText(ctx,this.feedback,160,181,p.light,1,'center');}
  }
}
