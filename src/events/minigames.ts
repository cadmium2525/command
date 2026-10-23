import type { InputSymbol } from '../data/types';
import { actor, bar, clamp, panel, pixelText, seeded, symbol, type Palette } from './art';

type Item={id:number;x:number;y:number;vx:number;vy:number;hit:boolean};
const KEYS:InputSymbol[]=['U','R','D','L','A','B'];
export const SUPPORTED_MECHANICS=['catch','runner','rhythm','memory','balance','fishing','maze','typing','invaders','escape','clicker','pong','choice'] as const;
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
  private shots:Item[]=[];
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
  constructor(kind:string,seed:number){this.kind=kind;this.seed=seed;this.memory=Array.from({length:4},(_,i)=>KEYS[Math.floor(seeded(seed+i*21)*4)]);this.sequence=Array.from({length:6},(_,i)=>KEYS[Math.floor(seeded(seed+i*67)*6)]);}

  private say(text:string,seconds=1.2){this.feedback=text;this.feedbackUntil=this.time+seconds;}
  private keyHit(s:InputSymbol){return s==='A'||s==='U';}
  input(s:InputSymbol|'START'){
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
        if(key==='L')this.x-=19;if(key==='R')this.x+=19;
        if(key==='A'||key==='U')this.shots.push({id:this.shots.length,x:this.x,y:151,vx:0,vy:-135,hit:false});
        if(key==='B'){this.shieldUntil=this.time+1;this.say('SHIELD');}break;
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
    const goals:Record<string,number>={catch:5,runner:5,rhythm:7,fishing:2,typing:6,invaders:6,escape:2,clicker:5,pong:4,choice:2};
    this.succeeded=this.kind==='maze'||this.kind==='memory'?this.stage>0:this.kind==='balance'?this.score>=5&&this.score>this.misses:this.score>=(goals[this.kind]??1);
    this.say(this.succeeded?'MISSION COMPLETE!':'GOOD TRY! KEEP EXPLORING',999);
  }
  update(time:number,dt:number){
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
        const wave=Math.floor(time/6);if(wave!==this.lastSpawn){this.lastSpawn=wave;this.items=Array.from({length:12},(_,i)=>({id:wave*12+i,x:45+(i%6)*43,y:36+Math.floor(i/6)*25,vx:0,vy:4,hit:false}));}
        for(const item of this.items){item.y+=item.vy*dt;item.x+=Math.cos(time*1.8+Math.floor(item.id/6))*dt*11;}
        for(const shot of this.shots){shot.y+=shot.vy*dt;for(const item of this.items)if(!item.hit&&!shot.hit&&Math.abs(item.x-shot.x)<12&&Math.abs(item.y-shot.y)<12){item.hit=true;shot.hit=true;this.score++;this.say('HIT!');}}
        this.shots=this.shots.filter(s=>s.y>20&&!s.hit);break;
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
    const instructions:Record<string,string>={catch:'← →で移動・Aで星へダッシュ',runner:'↑ / Aでジャンプ・↓ / Bでかがむ',rhythm:'中央の線に重なる記号を入力',memory:'最初の4つを覚えて、同じ順に入力',balance:'← →で傾きを調整・Aで安定',fishing:'← →で釣り位置・Aで投げる／魚が近い時に釣る',maze:'矢印で迷路を進む・Aでヒント・Bで入口へ',typing:'光っているコマンドを順番に入力',invaders:'← →で移動・Aで発射・Bでシールド',escape:'← →で扉を選び、星の扉をAで開く',clicker:'Aで充電・20以上でBを押して星を灯す',pong:'↑ ↓でラケット・Aで強打・Bで追いつく',choice:'← →で箱を選ぶ・Aで開ける'};
    const result=this.kind==='maze'&&this.stage>0?'　出口を発見！':this.kind==='memory'&&this.stage>0?'　記憶成功！':'';
    return `${this.finished?(this.succeeded?'クリア！':'タイムアップ。ナイストライ！'):instructions[this.kind]??'Aであそぶ'}　｜　スコア ${this.score}${result}`;
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
      case 'invaders':
        for(const item of this.items)if(!item.hit)actor(ctx,item.id%2?'slime':'ghost',item.x,item.y,p,{scale:.56});
        for(const shot of this.shots){ctx.fillStyle=p.pale;ctx.fillRect(shot.x-1,shot.y,2,6);}
        actor(ctx,'hero',this.x,160,p,{scale:.8});ctx.fillStyle=p.light;ctx.fillRect(this.x-12,156,24,3);if(this.shieldUntil>t){ctx.strokeStyle=p.light;ctx.strokeRect(this.x-17,135,34,27);}break;
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
