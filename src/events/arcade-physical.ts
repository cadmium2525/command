import type { InputSymbol } from '../data/types';
import { clamp, pixelText, seeded, type Palette } from './art';
import type { ArcadeDefinition, ArcadeEngine, ArcadeFamily, ArcadeOutcome } from './arcade-types';

type DefinitionRow=readonly [title:string,rule:string,controls?:string];
const CONTROL:Partial<Record<ArcadeFamily,string>>={blocks:'←→ 移動 / ↑・A 回転 / ↓ 落下 / B 一気に落とす',invaders:'←→ 移動 / A 発射 / B シールド',snake:'矢印 方向転換 / A １歩進む / B 減速',breakout:'←→ ラケット / A 発射 / B 一時減速',pong:'↑↓ ラケット / A 強打 / B 追いつく',runner:'↑・A ジャンプ / ↓・B かがむ / ←→ 移動',dodge:'矢印 移動 / A ダッシュ / B シールド',catch:'←→ 移動 / A ダッシュ / B ガード',maze:'矢印 移動 / A 道のヒント'};
function definitions(family:ArcadeFamily,rows:readonly DefinitionRow[]):ArcadeDefinition[]{return rows.map(([title,rule,controls],variant)=>({family,variant,title,rule:rule+(family==='maze'&&variant!==8?'３面目から追跡者が現れる。':''),controls:(controls??CONTROL[family]!)+(family==='maze'&&variant!==8?' / B 追跡を一瞬止める':''),playMode:family==='invaders'||family==='breakout'?'board':family==='snake'&&(variant===0||variant===2)||['pong','runner','catch'].includes(family)&&variant===0?'gag':'endless',durationMs:0}));}

/** Titles are the final reveal. Engines render only the physical game, score and task. */
export const PHYSICAL_DEFINITIONS:ArcadeDefinition[]=[
  ...definitions('blocks',[
    ['落ちもの、積めるところまで','横一列を埋めて消し続けよう。積み上がると終了。'],
    ['1/3テトリス','盤面を空にしよう。しま模様のマスは動かせない。'],
    ['永久に残るゴミテトリス','残ったマスを全部消そう。しま模様の破片は動かせない。'],
    ['四角しか来ない','同じ四角をすき間なく積んで列を消し続けよう。'],
    ['棒の雨','長い棒だけで列を消し続けよう。'],
    ['全部２倍のテトリス','ひとマスが大きい。大きな形で列を消し続けよう。'],
    ['反抗期テトリス','左右の操作が逆。列を消して積み続けよう。'],
    ['重力、上へ参ります','ブロックが上に落ちる。上側で列を消し続けよう。'],
    ['回りすぎテトリス','ブロックが勝手に回転する。列を消して積み続けよう。'],
    ['回転ボタン故障','回転できない形をそのまま並べて列を消し続けよう。'],
    ['１マスくらい許すテトリス','すき間が１マスあっても列が消える。積み上がるまで続けよう。'],
    ['地震テトリス','積んだブロックが周期的に横へずれる。列を消し続けよう。'],
    ['床がせり上がるテトリス','下から穴あきの列が増える。上まで届く前に列を消そう。'],
  ]),
  ...definitions('invaders',[
    ['いつもの侵略、全員集合','敵をすべて撃ち落とそう。弾に３回当たると終了。'],
    ['クソデカインベーダー','巨大な敵に１２発当てて倒そう。'],
    ['豆粒インベーダー','小さく速い敵をすべて撃ち落とそう。'],
    ['撃つたび逃げる侵略者','撃つと敵が上へ逃げる。全員に命中させよう。'],
    ['跳弾インベーダー','弾が斜めに飛び壁で跳ねる。敵をすべて倒そう。'],
    ['全員非武装だった','敵は撃たないが速く移動する。全員を倒そう。'],
    ['左右が逆の宇宙','左右の操作が逆。敵をすべて撃ち落とそう。'],
    ['宇宙人も防弾ベスト','敵は２発で倒れる。全員を倒そう。'],
    ['弾幕だけ本気','敵が次々に発射する。シールドを使い全員倒そう。'],
    ['当たり判定が本体','大きい自機から３方向に撃つ。全員を倒そう。'],
    ['弾は経費です','使える弾は８発。７体すべてに命中させよう。'],
    ['せっかちな侵略者','敵がすばやく接近する。地上に来る前に全員倒そう。'],
  ]),
  ...definitions('snake',[
    ['おやつは３個まで','壁と自分を避け、エサを３個食べよう。３個で終了。'],
    ['食べても太らないヘビ','食べても体は伸びない。壁を避けて食べ続けよう。'],
    ['食べるほど痩せるヘビ','食べると体が短くなる。長さ１を目指そう。'],
    ['世界は輪っかだった','画面の端は反対側につながる。自分を避けて食べ続けよう。'],
    ['左右が他人のヘビ','左右の操作だけが逆。エサを食べ続けよう。'],
    ['逃げるごはん','エサが定期的に移動する。追いかけて食べ続けよう。'],
    ['赤いのは自己責任','赤いエサは毒。明るいエサだけ食べ続けよう。'],
    ['通路が細いヘビ','通路の壁と自分を避けて食べ続けよう。'],
    ['勝手に曲がるヘビ','２秒ごとに右へ曲がる。操作で修正して食べ続けよう。'],
    ['食べ放題、一口サイズ','エサがたくさん。伸びる体を避けて食べ続けよう。'],
  ]),
  ...definitions('breakout',[
    ['全部壊すまでブロック崩し','ラケットで返して、すべてのブロックを壊そう。'],
    ['一枚岩ブロック崩し','大きな一枚に８回当てて、壊し切ろう。'],
    ['球が主役のブロック崩し','大きいボールですべてのブロックを壊そう。'],
    ['指先ブロック崩し','細いラケットですべてのブロックを壊そう。'],
    ['ラケット反抗期','左右の操作が逆。すべてのブロックを壊そう。'],
    ['壊れるとは言ってない','しま模様のブロックは壊れない。それ以外をすべて壊そう。'],
    ['逃げるブロック','横に動くブロックをすべて壊そう。'],
    ['落ちるものは落ちる','ボールに重力がかかる。すべてのブロックを壊そう。'],
    ['天井勤務のラケット','ラケットは画面の上側。すべてのブロックを壊そう。'],
    ['ひとり増えました','３回当てるとボールが分裂する。すべてのブロックを壊そう。'],
  ]),
  ...definitions('pong',[
    ['５回続けば十分ラリー','左のラケットで５回返そう。５回で終了。３回落とすと失敗。'],
    ['三つ子ラリー','３つのボールを返し続けよう。３回落とすと終了。'],
    ['壁打ちだよ、それ','右側は動かない壁。３回落とすまで返し続けよう。'],
    ['つまようじ卓球','短いラケットで返し続けよう。３回落とすと終了。'],
    ['球がラケットよりでかい','ラケットより大きな球を返し続けよう。'],
    ['気まぐれ変化球','曲がるボールを返し続けよう。３回落とすと終了。'],
    ['逆さまの手首','上下の操作が逆。ボールを返し続けよう。'],
    ['相手だけプロ','右の相手は絶対に外さない。こちらも返し続けよう。'],
    ['ネットが壁だった','中央のすき間を狙い、ボールを返し続けよう。'],
  ]),
  ...definitions('runner',[
    ['障害物は５個まで','地面の障害物を５個ジャンプで越えよう。５個で終了。'],
    ['靴が鉛のランナー','重力が強い。ぶつからずに走り続けよう。'],
    ['月面通勤','ゆっくり落下する。障害物を越え続けよう。'],
    ['二段跳びは福利厚生','空中でもう一度跳べる。障害物を越え続けよう。'],
    ['出勤方向が逆','障害物が左から来る。ぶつからずに走り続けよう。'],
    ['段差の規模じゃない','大きい障害物を飛び越え、走り続けよう。'],
    ['頭上注意だけだった','頭上の障害物をかがんで通り続けよう。'],
    ['床は別売り','床の穴を飛び越え続けよう。一度落ちると終了。'],
    ['始業ダッシュ','速い障害物を越え、ぶつからずに走り続けよう。'],
    ['遅刻寸前の時間停止','Aで一瞬だけ障害物を止められる。走り続けよう。','↑ ジャンプ / A 時間停止 / ↓・B かがむ / ←→ 移動'],
  ]),
  ...definitions('dodge',[
    ['雨、ときどき弾','落ちてくる弾を避け続けよう。３回当たると終了。'],
    ['あなた宛ての弾です','自機を狙う弾を避け続けよう。３回で終了。'],
    ['花火の真下に集合','中心から広がる弾を避け続けよう。３回で終了。'],
    ['でかければ当たる理論','大きい弾を避け続けよう。３回当たると終了。'],
    ['四畳半の弾よけ','狭い枠の中で弾を避け続けよう。３回で終了。'],
    ['なつかれる弾','追いかけてくる弾を避け続けよう。３回で終了。'],
    ['引力も敵です','中心へ引かれる力に逆らい、弾を避け続けよう。'],
    ['左右からお届け','左右から交差する弾を避け続けよう。'],
    ['予告してから爆発','点滅する円から１秒後に弾が広がる。避け続けよう。'],
    ['安全地帯だけ引っ越す','動く明るい枠に入り続けよう。枠の外で体力が減る。'],
  ]),
  ...definitions('catch',[
    ['星を５個だけください','落ちてくる明るい星を５個受け止めよう。５個で終了。'],
    ['爆弾も混ぜました','明るい星を取り続けよう。赤い爆弾は避けよう。'],
    ['横風の仕業','左右に流れる星を受け止め続けよう。'],
    ['上で待っています','上に昇る星を画面上側のカゴで取り続けよう。'],
    ['大口にもほどがある','大きいカゴで星を取り続けよう。混ざる爆弾を避けよう。'],
    ['受け口が針の穴','細いカゴで星を受け止め続けよう。'],
    ['カゴにも反抗期','左右の操作が逆。星を取り続けよう。'],
    ['分別収集の日','Aでカゴの形を切り替え、同じ形を集め続けよう。','←→ 移動 / A 丸・四角 切り替え / B ガード'],
    ['獲るほど口が狭い','星を取るたびにカゴが狭くなる。取り続けよう。'],
  ]),
  ...definitions('maze',[
    ['出口は本当にあります','出口へ着くと次の迷路へ。Aで道のヒント。'],
    ['左右反転の地下道','左右の操作が逆。出口を探して次の迷路へ進もう。'],
    ['床、磨きすぎました','一度押すと壁まで滑る。出口ごとに次の迷路へ。'],
    ['照明予算ゼロ','近くの道だけ見える。出口を探し続けよう。'],
    ['方位磁針の反乱','操作方向が回転する。出口を探し続けよう。'],
    ['鍵がないなら帰れない','先に鍵を取り出口へ。次の迷路にも鍵がある。'],
    ['出口も散歩したい','出口が移動する。追いついて次の迷路へ進もう。'],
    ['壁も道です','Aで正面の壁を各迷路３回壊せる。出口を探し続けよう。','矢印 移動 / A 正面の壁を壊す（３回）'],
    ['後ろから来ています','２秒後に四角が追ってくる。出口へ逃げて次の迷路へ。','矢印 移動 / A 道のヒント / B 追跡を一瞬止める'],
  ]),
];

type Point={x:number;y:number};
abstract class PhysicalGame implements ArcadeEngine {
  score=0;
  outcome:ArcadeOutcome|null=null;
  protected time=0;
  constructor(readonly def:ArcadeDefinition,protected readonly seed:number){}
  abstract input(key:InputSymbol):void;
  abstract draw(ctx:CanvasRenderingContext2D,p:Palette,reduced:boolean):void;
  abstract get snapshot():Record<string,unknown>;
  protected abstract step(dt:number):void;
  protected result(status:ArcadeOutcome['status'],reason:string){if(!this.outcome)this.outcome={status,reason};}
  update(dt:number){if(this.outcome)return;let remaining=Math.max(0,Math.min(dt,1));while(remaining>1e-9&&!this.outcome){const slice=Math.min(remaining,1/120);this.time+=slice;this.step(slice);remaining-=slice;}if(!this.outcome&&this.def.durationMs>0&&this.time*1000>=this.def.durationMs)this.timeout();}
  protected timeout(){this.result('time','時間切れ');}
  protected clear(ctx:CanvasRenderingContext2D,p:Palette){ctx.fillStyle=p.bg;ctx.fillRect(0,0,320,200);pixelText(ctx,`SCORE ${this.score}`,10,7,p.pale);}
  protected hud(ctx:CanvasRenderingContext2D,p:Palette,text:string){pixelText(ctx,text,310,7,p.ink,1,'right');}
}

// The family implementations below keep their own state and never import the old event player.
type GridCell=readonly [number,number];
const SHAPES:GridCell[][]=[[[0,1],[1,1],[2,1],[3,1]],[[0,0],[1,0],[0,1],[1,1]],[[1,0],[0,1],[1,1],[2,1]],[[2,0],[0,1],[1,1],[2,1]],[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]]];
type GridPiece={cells:GridCell[];size:number;x:number;y:number;color:number};
export class BlocksArcade extends PhysicalGame {
  private readonly width=this.def.variant===5?12:10;
  private readonly height=this.def.variant===1?18:16;
  private readonly direction=this.def.variant===7?-1:1;
  private board:number[][]=[];
  private piece!:GridPiece;
  private gravity=0;
  private changes=0;
  private serial=0;
  private lines=0;
  private pieces=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);this.board=Array.from({length:this.height},(_,y)=>this.def.variant===1&&y>=6?Array<number>(this.width).fill(9):this.emptyRow());if(def.variant===2)for(const [x,y] of [[1,15],[4,14],[7,15],[9,13]])this.board[y][x]=9;this.spawn();}
  private emptyRow(){return Array<number>(this.width).fill(0);}
  private get level(){return 1+Math.floor(this.lines/5)+Math.floor(this.time/30);}
  private get fallInterval(){const base=this.def.variant===1?.16:this.def.variant===2?.21:this.def.variant===5?.42:.37;return Math.max(.055,base*Math.pow(.84,this.level-1));}
  get snapshot(){return {family:'blocks',variant:this.def.variant,board:this.board.map(row=>[...row]),width:this.width,height:this.height,lines:this.lines,pieces:this.pieces,active:this.cells(),direction:this.direction,level:this.level,fallInterval:this.fallInterval,elapsed:this.time,score:this.score,outcome:this.outcome};}
  private cells(y=this.piece.y){return this.piece.cells.map(([x,cy])=>[this.piece.x+x,y+cy] as GridCell);}
  private fits(cells:GridCell[],x:number,y:number){return cells.every(([cx,cy])=>x+cx>=0&&x+cx<this.width&&y+cy>=0&&y+cy<this.height&&this.board[y+cy][x+cx]===0);}
  private move(dx:number,dy:number){if(!this.fits(this.piece.cells,this.piece.x+dx,this.piece.y+dy))return false;this.piece.x+=dx;this.piece.y+=dy;return true;}
  private rotate(){
    if(this.def.variant===9)return;
    const cells=this.piece.cells.map(([x,y])=>[this.piece.size-1-y,x] as GridCell);
    for(const lift of [0,-this.direction,-2*this.direction])for(const kick of [0,-1,1,-2,2])if(this.fits(cells,this.piece.x+kick,this.piece.y+lift)){this.piece.cells=cells;this.piece.x+=kick;this.piece.y+=lift;return;}
  }
  private spawn(){
    const kind=this.def.variant===3?1:this.def.variant===4?0:Math.min(6,Math.floor(seeded(this.seed+this.serial++*73)*7));
    const scale=this.def.variant===5?2:1;
    const cells:GridCell[]=[];for(const [x,y] of SHAPES[kind])for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++)cells.push([x*scale+sx,y*scale+sy]);
    const size=(kind===0?4:kind===1?2:3)*scale,maxY=Math.max(...cells.map(([,y])=>y));
    const x=Math.floor((this.width-size)/2);
    this.piece={cells,size,x,y:this.direction===1?0:this.height-maxY-1,color:kind+1};
    if(!this.fits(cells,x,this.piece.y))this.result('lose','積み上がって動けなくなった');
  }
  input(key:InputSymbol){
    if(this.outcome)return;
    const reverse=this.def.variant===6?-1:1;
    if(key==='L'||key==='R')this.move((key==='L'?-1:1)*reverse,0);
    if(key==='U'||key==='A')this.rotate();
    if(key==='D'){if(!this.move(0,this.direction))this.lock();else this.score++;this.gravity=0;}
    if(key==='B'){let dropped=0;while(this.move(0,this.direction))dropped++;this.score+=dropped;this.lock();}
  }
  private lock(){
    for(const [x,y] of this.cells())this.board[y][x]=this.piece.color;
    this.pieces++;this.score+=2;
    const tolerance=this.def.variant===10?1:0;
    const completed:number[]=[];
    this.board.forEach((row,y)=>{if(!row.includes(9)&&row.some(v=>v>0&&v<9)&&row.filter(v=>v===0).length<=tolerance)completed.push(y);});
    if(completed.length){
      this.lines+=completed.length;this.score+=completed.length*100;
      if(this.def.variant===2){
        for(const y of completed)for(let x=0;x<this.width;x++)if(this.board[y][x]!==9)this.board[y][x]=0;
        for(let x=0;x<this.width;x++)for(let y=this.height-2;y>=0;y--)if(this.board[y][x]>0&&this.board[y][x]<9){let ny=y;while(ny+1<this.height&&this.board[ny+1][x]===0)ny++;if(ny!==y){this.board[ny][x]=this.board[y][x];this.board[y][x]=0;}}
      }else{
        const remaining=this.board.filter((_,y)=>!completed.includes(y));
        const blank=Array.from({length:completed.length},()=>this.emptyRow());
        this.board=this.direction===1?[...blank,...remaining]:[...remaining,...blank];
      }
    }
    this.gravity=0;if(!this.outcome)this.spawn();
  }
  protected step(dt:number){
    this.gravity+=dt;this.changes+=dt;
    if(this.def.variant===8&&this.changes>=.7){this.changes-=.7;this.rotate();}
    if(this.def.variant===11&&this.changes>=3){this.changes-=3;const direction=Math.floor(this.time/3)%2?1:-1;this.board=this.board.map(row=>direction===1?[row[row.length-1],...row.slice(0,-1)]:[...row.slice(1),row[0]]);if(!this.fits(this.piece.cells,this.piece.x,this.piece.y)&&!this.move(0,-1))this.result('lose','ずれたブロックにはさまった');}
    if(this.def.variant===12&&this.changes>=3.5){this.changes-=3.5;if(this.board[0].some(Boolean)){this.result('lose','床に押し上げられた');return;}this.board.shift();const hole=Math.floor(seeded(this.seed+Math.floor(this.time)*19)*this.width);this.board.push(Array.from({length:this.width},(_,x)=>x===hole?0:6));this.piece.y--;if(!this.fits(this.piece.cells,this.piece.x,this.piece.y))this.result('lose','上まで押し上げられた');}
    const speed=this.fallInterval;
    if(this.gravity>=speed){this.gravity-=speed;if(!this.move(0,this.direction))this.lock();}
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,_reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LINES ${this.lines} LV ${this.level}`);
    const size=this.def.variant===1?8:9,ox=160-this.width*size/2,oy=37;
    ctx.fillStyle=p.deep;ctx.fillRect(ox-2,oy-2,this.width*size+4,this.height*size+4);
    const tile=(x:number,y:number,v:number)=>{ctx.fillStyle=v===9?p.ink:v%2?p.light:p.accent;ctx.fillRect(ox+x*size+1,oy+y*size+1,7,7);if(v===9){ctx.fillStyle=p.bg;ctx.fillRect(ox+x*size+2,oy+y*size+2,1,5);ctx.fillRect(ox+x*size+5,oy+y*size+2,1,5);}};
    this.board.forEach((row,y)=>row.forEach((v,x)=>{if(v)tile(x,y,v);else{ctx.fillStyle=p.dark;ctx.fillRect(ox+x*size+size-1,oy+y*size,1,size);ctx.fillRect(ox+x*size,oy+y*size+size-1,size,1);}}));
    let ghost=this.piece.y;while(this.fits(this.piece.cells,this.piece.x,ghost+this.direction))ghost+=this.direction;
    ctx.strokeStyle=p.mid;for(const [x,y] of this.cells(ghost))ctx.strokeRect(ox+x*size+1.5,oy+y*size+1.5,6,6);
    for(const [x,y] of this.cells())tile(x,y,this.piece.color);
    pixelText(ctx,this.direction===1?'DROP V':'DROP ^',17,61,p.ink);pixelText(ctx,this.def.variant===1||this.def.variant===2?'CLEAR ALL':'KEEP GOING',258,61,p.light,1,'center');
  }
}

type Alien=Point&{id:number;hp:number;w:number;h:number};
type Shot=Point&{vx:number;vy:number;enemy:boolean};
export class InvadersArcade extends PhysicalGame {
  private x=160;
  private lives=3;
  private enemies:Alien[]=[];
  private shots:Shot[]=[];
  private direction=1;
  private fire=0;
  private enemyFire=.9;
  private serial=0;
  private kills=0;
  private ammo=8;
  private shield=0;
  private shieldReady=0;
  private invulnerable=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);const v=def.variant;if(v===1)this.enemies=[{id:0,x:160,y:66,w:126,h:55,hp:12}];else{const count=v===10?7:21;this.enemies=Array.from({length:count},(_,i)=>({id:i,x:34+i%7*42,y:44+Math.floor(i/7)*20,w:v===2?5:13,h:v===2?5:10,hp:v===7?2:1}));}}
  private get formationSpeed(){const v=this.def.variant;return v===1?24:v===2?42:v===5?65:v===11?72:20;}
  get snapshot(){return {family:'invaders',variant:this.def.variant,x:this.x,lives:this.lives,kills:this.kills,ammo:this.ammo,shield:this.shield>this.time,enemies:this.enemies.map(e=>({...e})),shots:this.shots.map(s=>({...s})),direction:this.direction,speed:this.formationSpeed,elapsed:this.time,score:this.score,outcome:this.outcome};}
  input(key:InputSymbol){
    if(this.outcome)return;const v=this.def.variant;
    if(key==='L'||key==='R')this.x=clamp(this.x+(key==='L'?-17:17)*(v===6?-1:1),v===9?32:14,v===9?288:306);
    if(key==='A'&&this.time>=this.fire&&(v!==10||this.ammo>0)){
      this.fire=this.time+.16;if(v===10)this.ammo--;
      const spread=v===9?[-60,0,60]:[v===4?(this.serial++%2?65:-65):0];
      for(const vx of spread)this.shots.push({x:this.x,y:177,vx,vy:-205,enemy:false});
      if(v===3)for(const enemy of this.enemies)enemy.y=Math.max(28,enemy.y-4);
    }
    if(key==='B'&&this.time>=this.shieldReady){this.shield=this.time+.8;this.shieldReady=this.time+3;}
  }
  protected step(dt:number){
    const v=this.def.variant,speed=this.formationSpeed;
    if(this.enemies.some(e=>e.x+this.direction*speed*dt-e.w/2<9||e.x+this.direction*speed*dt+e.w/2>311)){this.direction*=-1;for(const e of this.enemies)e.y+=v===11?17:v===1?2:6;}
    else for(const e of this.enemies)e.x+=this.direction*speed*dt;
    if(v!==5&&this.time>=this.enemyFire&&this.enemies.length){const source=this.enemies[Math.min(this.enemies.length-1,Math.floor(seeded(this.seed+this.serial++*39)*this.enemies.length))];this.shots.push({x:source.x,y:source.y+source.h/2,vx:v===8?(this.x-source.x)*.3:0,vy:v===8?116:83,enemy:true});this.enemyFire=this.time+(v===8?.21:v===1?.6:.85);}
    for(let i=this.shots.length-1;i>=0;i--){
      const shot=this.shots[i];shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;
      if(!shot.enemy&&v===4&&(shot.x<5||shot.x>315)){shot.x=clamp(shot.x,5,315);shot.vx*=-1;}
      if(shot.enemy&&Math.abs(shot.x-this.x)<(v===9?29:11)&&shot.y>172&&shot.y<192){if(this.time>this.shield&&this.time>this.invulnerable){this.lives--;this.invulnerable=this.time+.9;}this.shots.splice(i,1);continue;}
      if(!shot.enemy){const index=this.enemies.findIndex(e=>Math.abs(e.x-shot.x)<e.w/2+2&&Math.abs(e.y-shot.y)<e.h/2+3);if(index>=0){const enemy=this.enemies[index];enemy.hp--;this.score+=10;if(enemy.hp<=0){this.enemies.splice(index,1);this.kills++;}this.shots.splice(i,1);continue;}}
      if(shot.y<17||shot.y>201||shot.x<-10||shot.x>330)this.shots.splice(i,1);
    }
    if(this.enemies.length===0)this.result('win','敵をすべて撃ち落とした');
    else if(this.lives<=0||this.enemies.some(e=>e.y+e.h/2>168))this.result('lose','自機が破壊された');
    else if(v===10&&this.ammo===0&&!this.shots.some(s=>!s.enemy))this.result('lose','弾を使い切った');
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LIVES ${this.lives}${this.def.variant===10?` AMMO ${this.ammo}`:''}`);
    ctx.fillStyle=p.dark;for(let i=0;i<35;i++)ctx.fillRect(8+i*71%305,28+i*37%163,1,1);
    for(const e of this.enemies){ctx.fillStyle=e.hp>1?p.accent:p.light;ctx.fillRect(e.x-e.w/2,e.y-e.h/2,e.w,e.h);ctx.fillStyle=p.bg;ctx.fillRect(e.x-e.w*.28,e.y-e.h*.16,Math.max(1,e.w*.12),Math.max(1,e.h*.18));ctx.fillRect(e.x+e.w*.16,e.y-e.h*.16,Math.max(1,e.w*.12),Math.max(1,e.h*.18));if(e.w>8){ctx.fillStyle=p.light;const pose=reduced?1:Math.floor(this.time*4)%2;ctx.fillRect(e.x-e.w*.35,e.y+e.h/2,e.w*.15,2+pose*2);ctx.fillRect(e.x+e.w*.2,e.y+e.h/2,e.w*.15,4-pose*2);}}
    for(const shot of this.shots){ctx.fillStyle=shot.enemy?p.accent:p.pale;ctx.fillRect(shot.x-1,shot.y-3,2,6);}
    const width=this.def.variant===9?56:22;ctx.fillStyle=p.pale;ctx.fillRect(this.x-width/2,182,width,6);ctx.fillRect(this.x-3,176,6,7);
    if(this.shield>this.time){ctx.strokeStyle=p.light;ctx.strokeRect(this.x-width/2-4,172,width+8,21);}
    if(this.def.variant===1&&this.enemies[0])pixelText(ctx,`HP ${this.enemies[0].hp}`,160,112,p.pale,1,'center');
  }
}

type Direction=Point;
export class SnakeArcade extends PhysicalGame {
  private body:Point[]=[];
  private direction:Direction={x:1,y:0};
  private nextDirection:Direction={x:1,y:0};
  private food:Point[]=[];
  private poison:Point[]=[];
  private walls:Point[]=[];
  private tick=0;
  private slow=0;
  private foodTimer=0;
  private turnTimer=0;
  private serial=0;
  private eaten=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);const length=def.variant===2?5:3;this.body=Array.from({length},(_,i)=>({x:8-i,y:6}));if(def.variant===7)for(const x of [12,18])for(let y=1;y<12;y++)if(y!==(x===12?6:9))this.walls.push({x,y});if(def.variant===6)this.poison=[{x:14,y:6},{x:17,y:8},{x:10,y:3}];this.food=[{x:11,y:6}];if(def.variant===9)for(let i=0;i<5;i++)this.food.push(this.empty());}
  private get level(){return 1+Math.floor(this.eaten/4)+Math.floor(this.time/30);}
  private get interval(){return Math.max(.065,.17*Math.pow(.9,this.level-1));}
  get snapshot(){return {family:'snake',variant:this.def.variant,body:this.body.map(p=>({...p})),direction:{...this.direction},food:this.food.map(p=>({...p})),poison:this.poison.map(p=>({...p})),walls:this.walls.map(p=>({...p})),eaten:this.eaten,level:this.level,interval:this.interval,elapsed:this.time,score:this.score,outcome:this.outcome};}
  private same(a:Point,b:Point){return a.x===b.x&&a.y===b.y;}
  private empty():Point{
    for(let attempt=0;attempt<1000;attempt++){const key=this.seed+this.serial++*157;const point={x:Math.floor(seeded(key)*24)%24,y:Math.floor(seeded(key+39)*13)%13};if(![...this.body,...this.walls,...this.poison,...this.food].some(other=>this.same(point,other)))return point;}
    this.result('win','盤面をいっぱいにした');return {x:0,y:0};
  }
  input(key:InputSymbol){
    if(this.outcome)return;
    let direction:Direction|undefined;
    if(key==='U')direction={x:0,y:-1};if(key==='D')direction={x:0,y:1};if(key==='L')direction={x:this.def.variant===4?1:-1,y:0};if(key==='R')direction={x:this.def.variant===4?-1:1,y:0};
    if(direction&&(direction.x!==-this.direction.x||direction.y!==-this.direction.y))this.nextDirection=direction;
    if(key==='A'){this.advance();this.tick=0;}
    if(key==='B')this.slow=this.time+.7;
  }
  private advance(){
    if(this.outcome)return;this.direction={...this.nextDirection};
    const head={x:this.body[0].x+this.direction.x,y:this.body[0].y+this.direction.y};
    if(this.def.variant===3){head.x=(head.x+24)%24;head.y=(head.y+13)%13;}
    const index=this.food.findIndex(p=>this.same(p,head)),grows=index>=0&&this.def.variant!==1&&this.def.variant!==2;
    if(head.x<0||head.x>=24||head.y<0||head.y>=13||this.walls.some(p=>this.same(p,head))||this.body.slice(0,grows?this.body.length:-1).some(p=>this.same(p,head))){this.result('lose','壁か体にぶつかった');return;}
    if(this.poison.some(p=>this.same(p,head))){this.result('lose','毒を食べた');return;}
    this.body.unshift(head);
    if(index>=0){
      this.eaten++;this.score+=10;this.food.splice(index,1);
      if(this.def.variant===1)this.body.pop();
      if(this.def.variant===2){this.body.pop();this.body.pop();}
      if(this.def.variant===9)this.body.push({...this.body[this.body.length-1]});
      if((this.def.variant===2&&this.body.length===1)||(this.def.variant===0&&this.eaten===3)){this.result('win',this.def.variant===2?'長さ１になった':'おやつを３個食べた');return;}
      this.food.push(this.empty());
    }else this.body.pop();
  }
  protected step(dt:number){
    this.tick+=dt;this.foodTimer+=dt;this.turnTimer+=dt;
    if(this.def.variant===5&&this.foodTimer>=1.4){this.foodTimer-=1.4;this.food=[this.empty()];}
    if(this.def.variant===8&&this.turnTimer>=2){this.turnTimer-=2;this.nextDirection={x:-this.direction.y,y:this.direction.x};}
    if(this.tick>=(this.slow>this.time?this.interval*1.94:this.interval)){this.tick=0;this.advance();}
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,_reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`FOOD ${this.eaten} LV ${this.level}`);const size=12,ox=16,oy=37;
    ctx.strokeStyle=p.mid;ctx.strokeRect(ox-.5,oy-.5,288,156);
    ctx.fillStyle=p.dark;for(const wall of this.walls)ctx.fillRect(ox+wall.x*size,oy+wall.y*size,size,size);
    this.body.forEach((part,i)=>{ctx.fillStyle=i===0?p.pale:p.light;ctx.fillRect(ox+part.x*size+1,oy+part.y*size+1,10,10);});
    ctx.fillStyle=p.bg;ctx.fillRect(ox+this.body[0].x*size+4,oy+this.body[0].y*size+4,2,2);
    for(const food of this.food){ctx.fillStyle=p.accent;ctx.fillRect(ox+food.x*size+3,oy+food.y*size+3,6,6);}
    for(const food of this.poison){ctx.fillStyle='#ec7474';ctx.fillRect(ox+food.x*size+2,oy+food.y*size+2,8,8);ctx.fillStyle=p.bg;ctx.fillRect(ox+food.x*size+5,oy+food.y*size+3,2,5);}
  }
}

type Brick=Point&{id:number;w:number;h:number;hp:number};
type ArcadeBall=Point&{vx:number;vy:number;r:number};
export class BreakoutArcade extends PhysicalGame {
  private x=160;
  private width=this.def.variant===3?17:54;
  private balls:ArcadeBall[]=[];
  private bricks:Brick[]=[];
  private lives=3;
  private launched=false;
  private hits=0;
  private destroyed=0;
  private slow=0;
  private slowReady=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);const v=def.variant;this.resetBall();this.bricks=v===1?[{id:0,x:30,y:47,w:260,h:25,hp:8}]:Array.from({length:27},(_,i)=>({id:i,x:20+i%9*32,y:37+Math.floor(i/9)*16,w:26,h:10,hp:v===5&&i>=9&&i<18?-1:1}));}
  private resetBall(){this.balls=[{x:this.x,y:172,vx:83,vy:-122,r:this.def.variant===2?13:3}];this.launched=false;}
  get snapshot(){return {family:'breakout',variant:this.def.variant,x:this.x,width:this.width,balls:this.balls.map(b=>({...b})),bricks:this.bricks.map(b=>({...b})),lives:this.lives,launched:this.launched,hits:this.hits,destroyed:this.destroyed,score:this.score,outcome:this.outcome};}
  input(key:InputSymbol){if(this.outcome)return;if(key==='L'||key==='R')this.x=clamp(this.x+(key==='L'?-20:20)*(this.def.variant===4?-1:1),this.width/2+8,312-this.width/2);if(key==='A')this.launched=true;if(key==='B'&&this.time>=this.slowReady){this.slow=this.time+.6;this.slowReady=this.time+2.2;}}
  protected step(dt:number){
    if(!this.launched){this.balls[0].x=this.x;return;}
    const v=this.def.variant;
    for(const brick of this.bricks)if(v===6)brick.x=20+brick.id%9*32+Math.sin(this.time*2+Math.floor(brick.id/9))*8;
    const speed=this.slow>this.time?.48:1;
    for(let index=this.balls.length-1;index>=0;index--){
      const ball=this.balls[index],oldY=ball.y;if(v===7)ball.vy+=65*dt;
      ball.x+=ball.vx*dt*speed;ball.y+=ball.vy*dt*speed;
      if(ball.x-ball.r<7){ball.x=7+ball.r;ball.vx=Math.abs(ball.vx);}if(ball.x+ball.r>313){ball.x=313-ball.r;ball.vx=-Math.abs(ball.vx);}if(ball.y-ball.r<28){ball.y=28+ball.r;ball.vy=Math.abs(ball.vy);}
      if(ball.vy>0&&oldY+ball.r<=183&&ball.y+ball.r>=183&&Math.abs(ball.x-this.x)<this.width/2+ball.r){ball.y=183-ball.r;ball.vy=-Math.max(100,Math.abs(ball.vy));ball.vx=(ball.x-this.x)/(this.width/2)*118;}
      for(let i=this.bricks.length-1;i>=0;i--){const brick=this.bricks[i];if(ball.x+ball.r>brick.x&&ball.x-ball.r<brick.x+brick.w&&ball.y+ball.r>brick.y&&ball.y-ball.r<brick.y+brick.h){if(oldY<=brick.y){ball.y=brick.y-ball.r-.1;ball.vy=-Math.abs(ball.vy);}else if(oldY>=brick.y+brick.h){ball.y=brick.y+brick.h+ball.r+.1;ball.vy=Math.abs(ball.vy);}else{ball.x=ball.vx>0?brick.x-ball.r-.1:brick.x+brick.w+ball.r+.1;ball.vx*=-1;}this.hits++;if(brick.hp>0){brick.hp--;this.score+=10;if(brick.hp===0){this.bricks.splice(i,1);this.destroyed++;}}break;}}
      if(ball.y-ball.r>202)this.balls.splice(index,1);
    }
    if(v===9&&this.hits>=3&&this.balls.length===1&&this.balls[0].r===3){const first=this.balls[0];first.r=3.1;this.balls.push({...first,vx:-first.vx+24,vy:-Math.abs(first.vy),r:3.1});}
    if(this.balls.length===0){this.lives--;if(this.lives===0)this.result('lose','ボールを３回落とした');else this.resetBall();}
    if(this.bricks.every(b=>b.hp<0))this.result('win','壊せるブロックをすべて壊した');
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,_reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LIVES ${this.lives}`);const flip=this.def.variant===8;ctx.save();if(flip){ctx.translate(0,228);ctx.scale(1,-1);}
    ctx.strokeStyle=p.mid;ctx.strokeRect(6.5,27.5,307,171);
    for(const brick of this.bricks){ctx.fillStyle=brick.hp<0?p.mid:brick.hp>1?p.accent:p.light;ctx.fillRect(brick.x,brick.y,brick.w,brick.h);if(brick.hp<0){ctx.fillStyle=p.bg;for(let x=brick.x+3;x<brick.x+brick.w;x+=6)ctx.fillRect(x,brick.y+2,2,brick.h-4);}}
    ctx.fillStyle=p.pale;ctx.fillRect(this.x-this.width/2,183,this.width,5);
    for(const ball of this.balls){ctx.fillStyle=p.pale;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();}
    ctx.restore();if(!this.launched)pixelText(ctx,'A TO SERVE',160,112,p.ink,1,'center');
  }
}

export class PongArcade extends PhysicalGame {
  private y=110;
  private opponent=110;
  private lives=3;
  private returns=0;
  private rescue=0;
  private balls:ArcadeBall[]=[];
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);this.balls=Array.from({length:def.variant===1?3:1},(_,i)=>({x:210+i*28,y:75+i*35,vx:-108-i*6,vy:52-i*37,r:def.variant===4?26:3}));}
  private get level(){return 1+Math.floor(this.returns/8);}
  get snapshot(){return {family:'pong',variant:this.def.variant,y:this.y,opponent:this.opponent,lives:this.lives,returns:this.returns,balls:this.balls.map(b=>({...b})),gap:110+Math.sin(this.time*1.5)*44,level:this.level,elapsed:this.time,score:this.score,outcome:this.outcome};}
  private returnBall(ball:ArcadeBall,power=false){ball.vx=Math.min(power?225:205,Math.abs(ball.vx)+(power?15:4));ball.vy=(ball.y-this.y)*(power?4:3.1);this.returns++;this.score+=10;if(this.def.variant===0&&this.returns===5)this.result('win','５回返した');}
  input(key:InputSymbol){
    if(this.outcome)return;const v=this.def.variant;
    if(key==='U'||key==='D')this.y=clamp(this.y+(key==='U'?-16:16)*(v===6?-1:1),41,185);
    if(key==='A')for(const ball of this.balls)if(ball.vx<0&&ball.x>=19-ball.r&&ball.x<65&&Math.abs(ball.y-this.y)<30)this.returnBall(ball,true);
    if(key==='B'&&this.time>=this.rescue){const target=[...this.balls].sort((a,b)=>a.x-b.x)[0];this.y=clamp(target.y,41,185);this.rescue=this.time+1.25;}
  }
  protected step(dt:number){
    const v=this.def.variant,half=v===3?9:23;
    const threat=[...this.balls].sort((a,b)=>b.x-a.x)[0];this.opponent+=clamp(threat.y-this.opponent,-(v===7?220:68)*dt,(v===7?220:68)*dt);
    for(const ball of this.balls){
      const oldX=ball.x;if(v===5)ball.vy=clamp(ball.vy+Math.sin(this.time*2.8)*84*dt,-145,145);
      const speed=1+(this.level-1)*.08;ball.x+=ball.vx*dt*speed;ball.y+=ball.vy*dt*speed;
      if(ball.y-ball.r<29){ball.y=29+ball.r;ball.vy=Math.abs(ball.vy);}if(ball.y+ball.r>196){ball.y=196-ball.r;ball.vy=-Math.abs(ball.vy);}
      if(ball.vx<0&&oldX-ball.r>=24&&ball.x-ball.r<=24&&Math.abs(ball.y-this.y)<half+ball.r){ball.x=24+ball.r;this.returnBall(ball);}
      if(ball.vx>0&&ball.x+ball.r>=296&&(v===2||Math.abs(ball.y-this.opponent)<(v===7?37:24)+ball.r)){ball.x=296-ball.r;ball.vx=-Math.abs(ball.vx);}
      if(v===8&&((oldX<160&&ball.x>=160)||(oldX>160&&ball.x<=160))&&Math.abs(ball.y-(110+Math.sin(this.time*1.5)*44))>23){ball.x=oldX<160?159-ball.r:161+ball.r;ball.vx*=-1;}
      if(ball.x<-ball.r){this.lives--;ball.x=230;ball.y=85+seeded(this.seed+this.returns*31+this.lives)*60;ball.vx=-110;ball.vy=45;}
      if(ball.x>320+ball.r){this.score+=5;ball.x=210;ball.y=110;ball.vx=-110;ball.vy=53;}
    }
    if(this.lives<=0)this.result('lose','ボールを３回落とした');
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,_reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LIVES ${this.lives} HIT ${this.returns} LV ${this.level}`);ctx.strokeStyle=p.mid;ctx.strokeRect(10.5,28.5,299,168);
    ctx.fillStyle=p.dark;for(let y=34;y<194;y+=12)ctx.fillRect(159,y,2,6);
    if(this.def.variant===8){const gap=110+Math.sin(this.time*1.5)*44;ctx.fillStyle=p.mid;ctx.fillRect(158,29,4,gap-52);ctx.fillRect(158,gap+23,4,173-gap);}
    ctx.fillStyle=p.pale;const h=this.def.variant===3?18:46;ctx.fillRect(19,this.y-h/2,5,h);
    ctx.fillStyle=p.light;if(this.def.variant===2)ctx.fillRect(296,29,4,167);else ctx.fillRect(296,this.opponent-(this.def.variant===7?37:24),5,this.def.variant===7?74:48);
    for(const ball of this.balls){ctx.fillStyle=p.accent;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();}
  }
}

type Obstacle=Point&{id:number;w:number;h:number;type:'solid'|'ceiling'|'gap';passed:boolean};
export class RunnerArcade extends PhysicalGame {
  private x=this.def.variant===4?260:60;
  private y=175;
  private vy=0;
  private jumps=0;
  private duck=0;
  private freeze=0;
  private freezeReady=0;
  private obstacles:Obstacle[]=[];
  private spawn=.7;
  private serial=0;
  private cleared=0;
  private lives=3;
  private invulnerable=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);}
  private get level(){return 1+Math.floor(this.cleared/8);}
  private get speed(){return (this.def.variant===8?215:124)*(1+(this.level-1)*.12);}
  get snapshot(){return {family:'runner',variant:this.def.variant,x:this.x,y:this.y,vy:this.vy,jumps:this.jumps,duck:this.duck>this.time,lives:this.lives,cleared:this.cleared,obstacles:this.obstacles.map(o=>({...o})),frozen:this.freeze>this.time,level:this.level,speed:this.speed,elapsed:this.time,score:this.score,outcome:this.outcome};}
  input(key:InputSymbol){
    if(this.outcome)return;const v=this.def.variant;
    if(key==='L')this.x=clamp(this.x-10,v===4?220:30,v===4?290:110);if(key==='R')this.x=clamp(this.x+10,v===4?220:30,v===4?290:110);
    if((key==='U'||(key==='A'&&v!==9))&&(this.y>=174.9||(v===3&&this.jumps<2))){this.vy=v===1?-285:v===2?-155:v===5?-255:-235;this.jumps++;}
    if(key==='D'||key==='B')this.duck=this.time+.7;
    if(key==='A'&&v===9&&this.time>=this.freezeReady){this.freeze=this.time+.65;this.freezeReady=this.time+2.2;}
  }
  protected step(dt:number){
    const v=this.def.variant,reverse=v===4,gravity=v===1?930:v===2?230:560,speed=this.speed;
    this.vy+=gravity*dt;this.y+=this.vy*dt;if(this.y>=175){this.y=175;this.vy=0;this.jumps=0;}
    if(this.time>=this.spawn){const type=v===7?'gap':v===6?'ceiling':'solid';this.obstacles.push({id:this.serial++,x:reverse?-35:335,y:type==='ceiling'?158:175,w:v===5?36:type==='gap'?49:18,h:v===5?40:type==='ceiling'?16:23,type,passed:false});this.spawn=this.time+Math.max(.7,(v===8?1.02:1.46)/(1+(this.level-1)*.06));}
    for(const o of this.obstacles){
      if(this.freeze<=this.time)o.x+=(reverse?speed:-speed)*dt;
      const overlap=Math.abs(o.x-this.x)<o.w/2+7;
      const height=this.duck>this.time?11:24;
      const collision=overlap&&(o.type==='gap'?this.y>=174:o.type==='ceiling'?this.y-height<o.y&&this.y>o.y-o.h:this.y>o.y-o.h+2);
      if(collision&&this.time>=this.invulnerable){if(o.type==='gap'){this.result('lose','床の穴に落ちた');return;}this.lives--;this.invulnerable=this.time+.9;}
      if(!o.passed&&(reverse?o.x-o.w/2>this.x+9:o.x+o.w/2<this.x-9)){o.passed=true;this.cleared++;this.score+=10;}
    }
    this.obstacles=this.obstacles.filter(o=>o.x>-70&&o.x<390);
    if(this.lives<=0)this.result('lose','障害物に３回ぶつかった');
    else if(v===0&&this.cleared===5)this.result('win','障害物を５個越えた');
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,_reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LIVES ${this.lives} PASS ${this.cleared} LV ${this.level}`);ctx.fillStyle=p.dark;ctx.fillRect(0,176,320,24);ctx.fillStyle=p.mid;ctx.fillRect(0,175,320,2);
    for(const o of this.obstacles){if(o.type==='gap'){ctx.fillStyle=p.bg;ctx.fillRect(o.x-o.w/2,175,o.w,25);ctx.fillStyle=p.accent;ctx.fillRect(o.x-o.w/2-2,175,2,8);ctx.fillRect(o.x+o.w/2,175,2,8);}else{ctx.fillStyle=p.accent;ctx.fillRect(o.x-o.w/2,o.y-o.h,o.w,o.h);ctx.fillStyle=p.light;ctx.fillRect(o.x-o.w/2,o.y-o.h,o.w,2);if(o.type==='ceiling'){ctx.fillStyle=p.mid;ctx.fillRect(o.x-2,30,4,o.y-o.h-30);}}}
    const h=this.duck>this.time?11:24;ctx.fillStyle=this.invulnerable>this.time?p.ink:p.pale;ctx.fillRect(this.x-7,this.y-h,14,h);ctx.fillStyle=p.bg;ctx.fillRect(this.x+(this.def.variant===4?-5:2),this.y-h+4,3,3);
    if(this.freeze>this.time){ctx.strokeStyle=p.light;ctx.strokeRect(4,27,312,169);}
  }
}

type Hazard=Point&{vx:number;vy:number;r:number;id:number};
type Warning=Point&{explode:number};
export class DodgeArcade extends PhysicalGame {
  private x=160;
  private y=166;
  private last:Direction={x:0,y:-1};
  private lives=3;
  private bullets:Hazard[]=[];
  private warnings:Warning[]=[];
  private spawn=.35;
  private serial=0;
  private invulnerable=0;
  private dashReady=0;
  private shieldReady=0;
  private shield=0;
  private outside=0;
  private zone={x:130,y:139,w:60,h:46};
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);}
  private get level(){return 1+Math.floor(this.time/20);}
  get snapshot(){return {family:'dodge',variant:this.def.variant,x:this.x,y:this.y,lives:this.lives,bullets:this.bullets.map(b=>({...b})),warnings:this.warnings.map(w=>({...w})),zone:{...this.zone},shield:this.shield>this.time,level:this.level,elapsed:this.time,score:this.score,outcome:this.outcome};}
  private constrain(){const small=this.def.variant===4;this.x=clamp(this.x,small?101:12,small?219:308);this.y=clamp(this.y,small?76:35,190);}
  input(key:InputSymbol){
    if(this.outcome)return;const vector:Partial<Record<InputSymbol,Direction>>={L:{x:-1,y:0},R:{x:1,y:0},U:{x:0,y:-1},D:{x:0,y:1}};
    if(vector[key]){this.last=vector[key]!;this.x+=this.last.x*14;this.y+=this.last.y*14;}
    if(key==='A'&&this.time>=this.dashReady){this.x+=this.last.x*42;this.y+=this.last.y*42;this.invulnerable=this.time+.26;this.dashReady=this.time+1.8;}
    if(key==='B'&&this.time>=this.shieldReady){this.shield=this.time+.8;this.shieldReady=this.time+3.2;}
    this.constrain();
  }
  private hurt(){if(this.time>=this.invulnerable&&this.time>=this.shield){this.lives--;this.invulnerable=this.time+.8;if(this.lives===0)this.result('lose','３回当たった');}}
  private add(x:number,y:number,vx:number,vy:number,r=3){const speed=1+(this.level-1)*.12;this.bullets.push({x,y,vx:vx*speed,vy:vy*speed,r,id:this.serial++});}
  private pattern(){
    const v=this.def.variant,k=this.serial+this.seed;
    if(v===9){this.zone.x=22+seeded(k+13)*210;this.zone.y=49+seeded(k+53)*89;this.serial++;return;}
    if(v===8){this.warnings.push({x:this.x,y:this.y,explode:this.time+1});this.serial++;return;}
    if(v===2){for(let i=0;i<12;i++){const angle=i*Math.PI/6+this.time*.3;this.add(160,85,Math.cos(angle)*75,Math.sin(angle)*75);}return;}
    if(v===7){const y=42+seeded(k+41)*140;this.add(2,y,100,0);this.add(318,217-y,-100,0);return;}
    const min=v===4?98:12,max=v===4?222:308,x=min+seeded(k*29)* (max-min),y=v===4?70:25;
    if(v===1||v===5){const length=Math.hypot(this.x-x,this.y-y)||1;this.add(x,y,(this.x-x)/length*86,(this.y-y)/length*86);}
    else this.add(x,y,v===6?Math.sin(k)*20:0,v===3?64:91,v===3?15:3);
  }
  protected step(dt:number){
    const v=this.def.variant;
    if(this.time>=this.spawn){this.pattern();this.spawn=this.time+(v===9?1.65:v===8?1.3:v===2?1.0:v===3?.75:v===7?.48:.34)/(1+(this.level-1)*.08);}
    if(v===6){const length=Math.hypot(160-this.x,105-this.y)||1;this.x+=(160-this.x)/length*22*dt;this.y+=(105-this.y)/length*22*dt;this.constrain();}
    for(let i=this.warnings.length-1;i>=0;i--)if(this.time>=this.warnings[i].explode){const warning=this.warnings[i];if(Math.hypot(this.x-warning.x,this.y-warning.y)<18)this.hurt();for(let j=0;j<10;j++){const angle=j*Math.PI/5;this.add(warning.x+Math.cos(angle)*14,warning.y+Math.sin(angle)*14,Math.cos(angle)*84,Math.sin(angle)*84);}this.warnings.splice(i,1);}
    for(let i=this.bullets.length-1;i>=0;i--){
      const bullet=this.bullets[i];
      if(v===5){const length=Math.hypot(this.x-bullet.x,this.y-bullet.y)||1;bullet.vx+=(this.x-bullet.x)/length*33*dt;bullet.vy+=(this.y-bullet.y)/length*33*dt;const speed=Math.hypot(bullet.vx,bullet.vy)||1,target=86*(1+(this.level-1)*.12);bullet.vx=bullet.vx/speed*target;bullet.vy=bullet.vy/speed*target;}
      bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;
      if(Math.hypot(this.x-bullet.x,this.y-bullet.y)<bullet.r+5){this.hurt();this.bullets.splice(i,1);continue;}
      if(bullet.x<-25||bullet.x>345||bullet.y<10||bullet.y>220){this.bullets.splice(i,1);this.score++;}
    }
    if(v===9){if(this.x<this.zone.x||this.x>this.zone.x+this.zone.w||this.y<this.zone.y||this.y>this.zone.y+this.zone.h){this.outside+=dt;if(this.outside>=.55){this.outside=0;this.hurt();}}else{this.outside=0;this.score=Math.floor(this.time*10);}}
    else this.score=Math.max(this.score,Math.floor(this.time*5));
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LIVES ${this.lives} LV ${this.level}`);const v=this.def.variant;
    ctx.strokeStyle=p.mid;if(v===4)ctx.strokeRect(96.5,70.5,127,124);else ctx.strokeRect(7.5,28.5,305,167);
    if(v===9){ctx.fillStyle=p.dark;ctx.fillRect(this.zone.x,this.zone.y,this.zone.w,this.zone.h);ctx.strokeStyle=p.light;ctx.strokeRect(this.zone.x,this.zone.y,this.zone.w,this.zone.h);}
    if(v===6){ctx.fillStyle=p.mid;ctx.beginPath();ctx.arc(160,105,11,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.bg;ctx.beginPath();ctx.arc(160,105,7,0,Math.PI*2);ctx.fill();}
    for(const warning of this.warnings){ctx.strokeStyle=reduced||Math.floor(this.time*8)%2?p.accent:p.mid;ctx.beginPath();ctx.arc(warning.x,warning.y,18,0,Math.PI*2);ctx.stroke();pixelText(ctx,'!',warning.x,warning.y-3,p.accent,1,'center');}
    ctx.fillStyle=p.accent;for(const bullet of this.bullets){ctx.beginPath();ctx.arc(bullet.x,bullet.y,bullet.r,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=this.invulnerable>this.time?p.ink:p.pale;ctx.fillRect(this.x-5,this.y-5,10,10);ctx.fillStyle=p.bg;ctx.fillRect(this.x-2,this.y-2,4,4);
    if(this.shield>this.time){ctx.strokeStyle=p.light;ctx.beginPath();ctx.arc(this.x,this.y,13,0,Math.PI*2);ctx.stroke();}
  }
}

type CatchItem=Point&{id:number;vx:number;bad:boolean;shape:number};
export class CatchArcade extends PhysicalGame {
  private x=160;
  private width=this.def.variant===4?100:this.def.variant===5?13:42;
  private items:CatchItem[]=[];
  private serial=0;
  private next=.05;
  private caught=0;
  private lives=3;
  private missed=0;
  private shape=0;
  private guard=0;
  private guardReady=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);}
  private get level(){return 1+Math.floor(this.caught/10)+Math.floor(this.time/30);}
  private get speed(){return 82*(1+(this.level-1)*.12);}
  get snapshot(){return {family:'catch',variant:this.def.variant,x:this.x,width:this.width,items:this.items.map(i=>({...i})),caught:this.caught,lives:this.lives,missed:this.missed,shape:this.shape,guard:this.guard>this.time,level:this.level,speed:this.speed,elapsed:this.time,score:this.score,outcome:this.outcome};}
  input(key:InputSymbol){
    if(this.outcome)return;
    if(key==='L'||key==='R')this.x+=((key==='L'?-1:1)*(this.def.variant===6?-1:1))*21;
    if(key==='A'){if(this.def.variant===7)this.shape=1-this.shape;else{const target=this.items.filter(i=>!i.bad).sort((a,b)=>this.def.variant===3?a.y-b.y:b.y-a.y)[0];if(target)this.x+=clamp(target.x-this.x,-65,65);}}
    if(key==='B'&&this.time>=this.guardReady){this.guard=this.time+.6;this.guardReady=this.time+2;}
    this.x=clamp(this.x,this.width/2+4,316-this.width/2);
  }
  protected step(dt:number){
    const v=this.def.variant,up=v===3;
    if(this.time>=this.next){const id=this.serial++;this.items.push({id,x:18+seeded(this.seed+id*53)*284,y:up?198:28,vx:v===2?Math.sin(id+this.seed)*45:0,bad:(v===1||v===4)&&id%3===2,shape:id%2});this.next=this.time+Math.max(.22,(v===5?.45:.63)/(1+(this.level-1)*.08));}
    for(let i=this.items.length-1;i>=0;i--){
      const item=this.items[i];item.y+=(up?-this.speed:this.speed)*dt;item.x+=item.vx*dt;
      if(item.x<10||item.x>310){item.x=clamp(item.x,10,310);item.vx*=-1;}
      const line=up?43:183,crossed=up?item.y<=line:item.y>=line;
      if(crossed&&Math.abs(item.x-this.x)<this.width/2+4){
        if(item.bad||(v===7&&item.shape!==this.shape)){if(this.time>=this.guard)this.lives--;}
        else{this.caught++;this.score+=10;if(v===8)this.width=Math.max(12,this.width-6);}
        this.items.splice(i,1);continue;
      }
      if(item.y>205||item.y<23){if(!item.bad)this.missed++;this.items.splice(i,1);}
    }
    if(v===0&&this.caught===5)this.result('win','星を５個受け止めた');else if(this.lives<=0)this.result('lose','危ないものを３回取った');else if(this.missed>=9)this.result('lose','取り逃がしが多すぎた');
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,_reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LIVES ${this.lives} GET ${this.caught} LV ${this.level}`);const y=this.def.variant===3?43:183;
    for(const item of this.items){ctx.fillStyle=item.bad?'#ec7474':p.pale;if(this.def.variant===7&&item.shape===1){ctx.beginPath();ctx.arc(item.x,item.y,5,0,Math.PI*2);ctx.fill();}else if(this.def.variant===7||item.bad)ctx.fillRect(item.x-4,item.y-4,8,8);else{ctx.beginPath();ctx.moveTo(item.x,item.y-6);for(const [dx,dy] of [[2,-2],[6,0],[2,2],[0,6],[-2,2],[-6,0],[-2,-2]])ctx.lineTo(item.x+dx,item.y+dy);ctx.closePath();ctx.fill();}if(item.bad){ctx.fillStyle=p.bg;ctx.fillRect(item.x-1,item.y-3,2,6);}}
    ctx.fillStyle=p.light;ctx.fillRect(this.x-this.width/2,y,this.width,5);ctx.fillRect(this.x-this.width/2,y-8,3,8);ctx.fillRect(this.x+this.width/2-3,y-8,3,8);
    if(this.def.variant===7){ctx.strokeStyle=p.pale;if(this.shape===0)ctx.strokeRect(this.x-4,y+9,8,8);else{ctx.beginPath();ctx.arc(this.x,y+13,4,0,Math.PI*2);ctx.stroke();}}
    if(this.guard>this.time){ctx.strokeStyle=p.accent;ctx.strokeRect(this.x-this.width/2-3,y-12,this.width+6,20);}
  }
}

export class MazeArcade extends PhysicalGame {
  private grid:number[][]=Array.from({length:9},()=>Array<number>(17).fill(1));
  private x=1;
  private y=1;
  private exit:Point={x:15,y:7};
  private key:Point|null=null;
  private hasKey=false;
  private facing:Direction={x:1,y:0};
  private hint=0;
  private charges=3;
  private visited=new Set<string>(['1,1']);
  private serial=0;
  private movement=0;
  private boards=0;
  private keysCollected=0;
  private boardAt=0;
  private pursuer:Point={x:1,y:1};
  private chaseAt=2;
  private chaseStarts=2;
  private freeze=0;
  private freezeReady=0;
  constructor(def:ArcadeDefinition,seed:number){
    super(def,seed);this.resetBoard();
  }
  private resetBoard(){
    this.grid=Array.from({length:9},()=>Array<number>(17).fill(1));this.x=1;this.y=1;this.exit={x:15,y:7};this.key=null;this.hasKey=false;this.charges=3;this.visited=new Set(['1,1']);this.facing={x:1,y:0};this.hint=0;this.movement=0;this.boardAt=this.time;this.pursuer={x:1,y:1};this.chaseStarts=this.time+(this.def.variant===8?Math.max(.8,2-this.boards*.12):4);this.chaseAt=this.chaseStarts;this.freeze=this.time;this.freezeReady=this.time;
    if(this.def.variant===2){for(const y of [1,3,5,7])for(let x=1;x<16;x++)this.grid[y][x]=0;const pattern=(this.boards+5)%8;for(let i=0;i<3;i++)this.grid[2+i*2][pattern&(1<<i)?15:1]=0;}
    else this.carve(1,1);
    if(this.def.variant===5){const route=this.route({x:1,y:1},this.exit);this.key={...route[Math.max(1,Math.floor(route.length*.55))]};}
  }
  private carve(x:number,y:number){
    this.grid[y][x]=0;const choices=[{x:2,y:0},{x:-2,y:0},{x:0,y:2},{x:0,y:-2}];
    for(let i=choices.length-1;i>0;i--){const j=Math.min(i,Math.floor(seeded(this.seed+this.boards*1999+this.serial++*61)*(i+1)));[choices[i],choices[j]]=[choices[j],choices[i]];}
    for(const delta of choices){const nx=x+delta.x,ny=y+delta.y;if(nx>0&&nx<16&&ny>0&&ny<8&&this.grid[ny][nx]===1){this.grid[y+delta.y/2][x+delta.x/2]=0;this.carve(nx,ny);}}
  }
  private get rotation(){return Math.floor((this.time-this.boardAt)/Math.max(1.2,3-this.boards*.12))%4;}
  private get chaseEnabled(){return this.def.variant===8||this.boards>=2;}
  get snapshot(){return {family:'maze',variant:this.def.variant,x:this.x,y:this.y,grid:this.grid.map(row=>[...row]),exit:{...this.exit},key:this.key?{...this.key}:null,hasKey:this.hasKey,keysCollected:this.keysCollected,charges:this.charges,rotation:this.rotation,pursuer:{...this.pursuer},pursuerActive:this.chaseEnabled&&this.time>=this.chaseStarts,chaseInterval:Math.max(.2,.55-this.boards*.035),frozen:this.freeze>this.time,route:this.route({x:this.x,y:this.y},this.key&&!this.hasKey?this.key:this.exit),boardsCleared:this.boards,level:this.boards+1,elapsed:this.time,score:this.score,outcome:this.outcome};}
  private route(from:Point,to:Point):Point[]{
    const queue:Point[]=[from],previous=new Map<string,Point|null>([[`${from.x},${from.y}`,null]]);
    for(let i=0;i<queue.length;i++){const point=queue[i];if(point.x===to.x&&point.y===to.y)break;for(const d of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}]){const next={x:point.x+d.x,y:point.y+d.y},id=`${next.x},${next.y}`;if(this.grid[next.y]?.[next.x]===0&&!previous.has(id)){previous.set(id,point);queue.push(next);}}}
    const result:Point[]=[];let point:Point|null=to;if(!previous.has(`${to.x},${to.y}`))return [];
    while(point){result.unshift(point);point=previous.get(`${point.x},${point.y}`)??null;}return result;
  }
  input(key:InputSymbol){
    if(this.outcome)return;
    let delta:Direction|undefined;if(key==='L')delta={x:-1,y:0};if(key==='R')delta={x:1,y:0};if(key==='U')delta={x:0,y:-1};if(key==='D')delta={x:0,y:1};
    if(delta){
      if(this.def.variant===1)delta.x*=-1;
      if(this.def.variant===4)for(let i=0;i<this.rotation;i++)delta={x:-delta.y,y:delta.x};
      this.facing=delta;
      do {const nx=this.x+delta.x,ny=this.y+delta.y;if(this.grid[ny]?.[nx]!==0)break;this.x=nx;this.y=ny;const board=this.boards;this.collect();if(this.outcome||this.boards!==board)break;}while(this.def.variant===2);
    }
    if(key==='A'){
      if(this.def.variant===7&&this.charges>0){const nx=this.x+this.facing.x,ny=this.y+this.facing.y;if(nx>0&&nx<16&&ny>0&&ny<8&&this.grid[ny][nx]===1){this.grid[ny][nx]=0;this.charges--;}}
      else this.hint=this.time+1.5;
    }
    if(key==='B'&&this.chaseEnabled&&this.time>=this.freezeReady){this.freeze=this.time+1;this.freezeReady=this.time+3;}
  }
  private collect(){
    const id=`${this.x},${this.y}`;if(!this.visited.has(id)){this.visited.add(id);this.score++;}
    if(this.key&&this.x===this.key.x&&this.y===this.key.y&&!this.hasKey){this.hasKey=true;this.keysCollected++;this.score+=10;}
    if(this.chaseEnabled&&this.time>=this.chaseStarts&&this.x===this.pursuer.x&&this.y===this.pursuer.y){this.result('lose','追跡者につかまった');return;}
    if(this.x===this.exit.x&&this.y===this.exit.y&&(this.def.variant!==5||this.hasKey)){this.score+=50;this.boards++;this.resetBoard();}
  }
  protected step(dt:number){
    this.movement+=dt;
    const exitPeriod=Math.max(1,3-this.boards*.1);
    if(this.def.variant===6&&this.movement>=exitPeriod){this.movement-=exitPeriod;const ends:Point[]=[];for(let y=1;y<8;y++)for(let x=1;x<16;x++)if(this.grid[y][x]===0&&[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].filter(d=>this.grid[y+d.y]?.[x+d.x]===0).length===1&&(x!==this.x||y!==this.y))ends.push({x,y});this.exit=ends[Math.min(ends.length-1,Math.floor(seeded(this.seed+this.serial++*77)*ends.length))]??this.exit;}
    if(this.chaseEnabled&&this.time>=this.chaseAt&&this.time>=this.freeze){this.chaseAt=this.time+Math.max(.2,.55-this.boards*.035);const path=this.route(this.pursuer,{x:this.x,y:this.y});if(path[1])this.pursuer={...path[1]};this.collect();}
  }
  draw(ctx:CanvasRenderingContext2D,p:Palette,_reduced:boolean){
    this.clear(ctx,p);this.hud(ctx,p,`LV ${this.boards+1} `+(this.def.variant===5?this.hasKey?'KEY OK':'KEY ?':this.def.variant===7?`BREAK ${this.charges}`:this.def.variant===4?`TURN ${this.rotation}`:'EXIT >'));
    const size=16,ox=24,oy=45,fog=this.def.variant===3,radius=Math.max(1,3-Math.floor(this.boards/3));
    for(let y=0;y<9;y++)for(let x=0;x<17;x++){if(fog&&Math.abs(x-this.x)+Math.abs(y-this.y)>radius)continue;ctx.fillStyle=this.grid[y][x]===1?p.mid:p.deep;ctx.fillRect(ox+x*size,oy+y*size,size-1,size-1);}
    if(!fog||Math.abs(this.exit.x-this.x)+Math.abs(this.exit.y-this.y)<=radius){ctx.fillStyle=p.light;ctx.fillRect(ox+this.exit.x*size+2,oy+this.exit.y*size+2,11,11);ctx.fillStyle=p.bg;ctx.fillRect(ox+this.exit.x*size+5,oy+this.exit.y*size+4,5,9);}
    if(this.key&&!this.hasKey){ctx.fillStyle=p.accent;ctx.fillRect(ox+this.key.x*size+4,oy+this.key.y*size+4,6,6);ctx.fillRect(ox+this.key.x*size+8,oy+this.key.y*size+8,5,3);}
    if(this.hint>this.time){ctx.fillStyle=p.ink;for(const point of this.route({x:this.x,y:this.y},this.key&&!this.hasKey?this.key:this.exit).slice(1,8))ctx.fillRect(ox+point.x*size+6,oy+point.y*size+6,3,3);}
    ctx.fillStyle=p.pale;ctx.fillRect(ox+this.x*size+3,oy+this.y*size+3,9,9);
    if(this.chaseEnabled&&this.time>=this.chaseStarts){ctx.fillStyle=this.freeze>this.time?p.mid:p.accent;ctx.fillRect(ox+this.pursuer.x*size+3,oy+this.pursuer.y*size+3,9,9);}
  }
}

export function createPhysicalGame(def:ArcadeDefinition,seed:number):ArcadeEngine{
  switch(def.family){
    case 'blocks':return new BlocksArcade(def,seed);
    case 'invaders':return new InvadersArcade(def,seed);
    case 'snake':return new SnakeArcade(def,seed);
    case 'breakout':return new BreakoutArcade(def,seed);
    case 'pong':return new PongArcade(def,seed);
    case 'runner':return new RunnerArcade(def,seed);
    case 'dodge':return new DodgeArcade(def,seed);
    case 'catch':return new CatchArcade(def,seed);
    case 'maze':return new MazeArcade(def,seed);
    default:throw new Error(`Unknown physical arcade family: ${def.family}`);
  }
}
