import type { InputSymbol } from '../data/types';
import { bar, clamp, pixelText, seeded, symbol, type Palette } from './art';
import type { ArcadeDefinition, ArcadeEngine, ArcadeFamily, ArcadeOutcome } from './arcade-types';

const KEYS:InputSymbol[]=['U','R','D','L','A','B'];
const OPPOSITE:Record<InputSymbol,InputSymbol>={U:'D',D:'U',L:'R',R:'L',A:'B',B:'A'};
function definitions(family:ArcadeFamily,titles:string[],rules:string[],controls:string|string[],durationMs=20000):ArcadeDefinition[]{
  return titles.map((title,variant)=>({family,variant,title,rule:rules[variant],controls:typeof controls==='string'?controls:controls[variant],durationMs}));
}

export const SKILL_DEFINITIONS:ArcadeDefinition[]=[
  ...definitions('memory',
    ['記憶の四つ角','逆からお願いします','六つも覚えたのに','覚えた向きの反対へ','二択なのに六連続','一瞬だけの暗記帳','全部見せたのに','一度きりの記憶力','覚え直し三本勝負'],
    ['点灯する4方向を覚え、同じ順番で入力。2回間違えるまでに最後まで。','点灯した4方向を、最後から逆順に入力。','6方向の長い並びを、同じ順番で入力。','点灯する4方向を覚え、各矢印の反対方向を順に入力。','AとBだけの6個の並びを覚え、同じ順番で入力。','速く点灯する5方向を覚え、同じ順番で入力。','6方向を同時に1秒だけ表示。消えたら左から順に入力。','7方向を覚えて入力。間違いは1回で終了。','3個、4個、5個の並びを順に覚えて入力。3ラウンドクリア。'],
    '表示を覚える → 消えたら方向またはA/Bで回答',24000),
  ...definitions('rhythm',
    ['十拍の皆勤賞','右手と左手の交代勤務','四方向の音楽隊','揺れる拍子の待ち合わせ','休符にも仕事がある','だんだん急ぐ指揮者','ぴったり以外は遅刻','二つでひとつの拍手','六種類の忙しい拍'],
    ['丸が判定線に来たらA。10拍中7拍を合わせる。','AとBが交互に来る。10拍中7拍を合わせる。','4方向の矢印を、判定線に来る順に入力。','短い間隔と長い間隔が混ざる。線に来た記号を入力。','灰色の×は休符。押さずに通し、明るいAだけ合わせる。','拍の間隔が少しずつ短くなる。Aで追いかける。','Aを判定線のごく近くで入力。許されるずれは0.07秒。','各拍でAとBを両方入力。片方だけでは半分。','方向とA/Bの6種類が来る。表示どおりに入力。'],
    '線に来た記号を入力。×には何も押さない',20000),
  ...definitions('typing',
    ['八手で開いた扉','右から読む説明書','指だけ反対向き','二文字の長い行列','訂正できない一行','一秒ごとの締め切り','消えるカンニングペーパー','十六手の長い旅','選んでから決めてください'],
    ['8個の方向を左から入力。Bで直前の入力を取り消せる。','8個の方向を、右端から左へ入力。','表示された方向の反対を左から入力。','AとBの12個の並びを左から入力。','10個の方向を入力。一度でも違うと終了。','次の矢印を1秒以内に入力。10個続ける。','最初の2秒で8方向を覚える。消えたら左から入力。','方向とA/Bが混ざる16個の並びを入力。','下の6記号から←→で選び、Aで確定。上の8記号を作る。'],
    ['方向で入力／Bで1字戻す','方向で右から入力／Bで1字戻す','反対方向で入力／Bで1字戻す','A/Bで入力','方向で入力。訂正不可','方向で入力。1字1秒','方向で入力。最初の2秒で覚える','方向とA/Bで入力','←→で記号を選ぶ／Aで確定'],22000),
  ...definitions('balance',
    ['真ん中にいるだけなのに','反対向きの水平器','横風のある平常心','滑りすぎる調整役','動く真ん中を探して','狭まっていく安心圏','重たい荷物の機嫌','ブレーキなしの慎重派','縦にも横にも落ち着いて'],
    ['針を中央の安全帯に合計6秒置く。傾きすぎると終了。','左右の操作が反対。安全帯に合計6秒置く。','強い横風に抵抗し、安全帯に合計6秒置く。','調整後も勢いが残る。安全帯に合計6秒置く。','安全帯が左右に動く。追いかけて合計6秒入れる。','安全帯が時間とともに狭まる。合計6秒保つ。','重い針は傾くほど加速する。中央に合計5秒保つ。','Aのブレーキが使えない。左右だけで合計6秒保つ。','横と縦の針を両方、安全帯に合計4秒置く。'],
    ['←→で傾きを調整／Aで制動（3回）','←→は反対向き／Aで制動（3回）','←→で調整／Aで制動（3回）','←→で調整／Aで制動（3回）','←→で動く安全帯を追う／Aで制動','←→で調整／Aで制動（3回）','←→で調整／Aで制動（3回）','←→だけで調整','←→で横針／↑↓で縦針／Aで制動'],22000),
  ...definitions('fishing',
    ['二匹ぶんの待ち時間','針先ほどの大物','逃げ足だけは一級品','底の方のご近所さん','三段重ねの釣り場','釣らない方がいい四角','逆向きの釣りざお','上下する水の気分','一投だけの達人'],
    ['明るいひし形を2匹釣る。針が近づいたらBで引き上げる。','小さなひし形を2匹釣る。針先を正確に合わせる。','速く泳ぐひし形を2匹釣る。左右で針を追従させる。','深い場所のひし形を2匹釣る。早く引き上げない。','3つの深さを泳ぐひし形を3匹釣る。','ひし形を2匹釣る。×付きの四角を釣ると失敗が増える。','左右操作が反対。ひし形を2匹釣る。','上下にも泳ぐひし形を2匹釣る。針の落下も速い。','チャンスは1投。ひし形を1匹釣れば勝ち、空振りで終了。'],
    '←→で船と針を移動／Aで糸を下ろす／Bで釣り上げる',25000),
  ...definitions('racer',
    ['三車線の遠回り','五車線の狭い余裕','急いだ分だけ目が回る','交互にふさがる帰り道','走るより拾う方が大事','一度もぶつかれない保険','見えてからでは近すぎる','ハンドルだけ逆でした','給油しながら帰ります'],
    ['障害を避けて1000m走る。3回ぶつかると終了。','5車線で1200m走る。車線は細く、障害も増える。','高速で1400m走る。早めに車線変更する。','障害が左右交互に並ぶ。すき間を選び1000m走る。','距離ではなく、明るいひし形を6個集める。','1回ぶつかると終了。800mを無事故で走る。','遠くが霧で見えない。出てきた障害を避け1000m走る。','左右操作が反対。1000m走る。','燃料が減る。ひし形で給油し、800mを走り切る。'],
    '←→で車線変更／Aで加速／Bで減速',24000),
  ...definitions('lander',
    ['静かに降りるのも技術','狭いところへようこそ','風任せでは着きません','燃料計を見ていましたか','着地点も引っ越し中','左右逆の管制塔','岩を避けてから着陸','ブレーキは別売りです','重力との相談は不調'],
    ['明るい足場へ静かに着陸。縦速度18未満、横速度16未満が条件。','狭い足場へ静かに着陸。横の位置を正確に合わせる。','横風に流されながら、足場へ静かに着陸する。','燃料は通常の半分。噴射を節約して静かに着陸。','足場が左右に動く。着地する瞬間の位置に合わせる。','左右噴射が反対。明るい足場へ静かに着陸。','途中の岩に触れると終了。避けて足場へ静かに着陸。','Bの減速が使えない。噴射だけで静かに着陸。','重力が強い。早めの噴射で速度を落として着陸。'],
    '←→で横噴射／Aで上向き噴射／Bで全方向減速',24000),
  ...definitions('reaction',
    ['待てた人から先に押す','左右を見てから返事','六択の瞬間判断','赤には返事をしないで','矢印に逆らう反射神経','青だけが本当の合図','三割秒の長い一瞬','二度押してやっと返事','返事の最後はBでした'],
    ['合図のGOが出たらA。早押しは禁止。4回成功する。','合図の←または→を押す。早押しせず4回成功。','合図の方向またはA/Bを押す。4回成功。','赤い×は偽物。緑のAだけに反応し4回成功。','表示された矢印と反対方向を入力。4回成功。','灰色は待機、青い枠だけ本物。青いAに4回反応。','合図のAに0.3秒以内に反応。4回成功。','合図が出たらAを2回。0.65秒以内に両方押し4回成功。','合図が出たらA、そのあとB。順に押して4回成功。'],
    '合図が出るまで待つ／表示に従って方向やA/Bを入力',22000),
  ...definitions('clicker',
    ['十八回ぶんのがんばり','同じ手では進みません','ためてから受け取る主義','熱くなった方が負け','六から八の間に放せ','減る前にもう一回','緑のときだけ勤勉','Bボタンにも出番が来た','投資家の連打大会'],
    ['Aを18回押してゲージを満たす。','AとBを交互に16回押す。同じボタンは2回分後退。','Aで8までため、Bで受け取る。3回受け取れば勝ち。','Aで12までためる。熱が満杯になると終了。待つと冷える。','Aで6〜8までため、Bで放す。成功を3回続ける。','Aで14までためる。毎秒2ずつ減るので追い越す。','緑の時間だけA。赤で押すと進みが減る。8回成功。','Bを16回押す。Aを押すと2回分後退。','Bで収入を得る。Aは5点で収入を強化。50点まで増やす。'],
    ['Aでためる','A→B→A→B…の順に押す','Aでためる／8でB受け取り','Aでためる／待って冷やす','Aでためる／6〜8でB','Aでためる','緑のときA／赤は待つ','Bでためる／Aは減点','Bで収入／Aで5点払い収入強化'],20000),
];

abstract class SkillBase implements ArcadeEngine {
  score=0;outcome:ArcadeOutcome|null=null;protected time=0;
  constructor(protected readonly def:ArcadeDefinition,protected readonly seed:number){}
  protected finish(status:ArcadeOutcome['status'],reason:string){if(!this.outcome)this.outcome={status,reason};}
  update(dt:number){
    if(this.outcome)return;dt=Math.max(0,Math.min(.1,dt));this.time+=dt;this.step(dt);
    if(!this.outcome&&this.time>=this.def.durationMs/1000)this.finish('time','時間切れ');
  }
  protected base(ctx:CanvasRenderingContext2D,p:Palette){
    ctx.fillStyle=p.bg;ctx.fillRect(0,0,320,200);ctx.strokeStyle=p.dark;
    for(let x=0;x<320;x+=20){ctx.beginPath();ctx.moveTo(x,22);ctx.lineTo(x,200);ctx.stroke();}
    pixelText(ctx,`SCORE ${Math.floor(this.score)}`,10,9,p.light);ctx.strokeStyle=p.mid;ctx.strokeRect(4.5,23.5,311,171);
  }
  protected sequence(ctx:CanvasRenderingContext2D,p:Palette,keys:InputSymbol[],index:number,x=22,y=73){
    keys.forEach((key,i)=>{const column=i%10,row=Math.floor(i/10),px=x+column*29,py=y+row*34;ctx.fillStyle=i<index?p.mid:i===index?p.light:p.deep;ctx.fillRect(px-10,py-9,22,23);symbol(ctx,key,px+1,py-2,i===index?p.bg:p.pale,1);});
  }
  abstract input(key:InputSymbol):void;
  protected abstract step(dt:number):void;
  abstract draw(ctx:CanvasRenderingContext2D,p:Palette,reducedMotion:boolean):void;
  abstract get snapshot():Record<string,unknown>;
}

class MemoryGame extends SkillBase {
  private sequenceKeys:InputSymbol[]=[];private index=0;private round=0;private phase:'show'|'input'='show';private phaseTime=0;private lives:number;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);this.lives=def.variant===7?1:2;this.newRound();}
  private get flash(){return this.def.variant===5?.27:.65;}
  private get expected(){const keys=this.def.variant===1?[...this.sequenceKeys].reverse():[...this.sequenceKeys];return this.def.variant===3?keys.map(k=>OPPOSITE[k]):keys;}
  private newRound(){const v=this.def.variant,length=v===8?3+this.round:v===2||v===4||v===6?6:v===5?5:v===7?7:4;const alphabet=v===4?KEYS.slice(4):KEYS.slice(0,4);this.sequenceKeys=Array.from({length},(_,i)=>alphabet[Math.floor(seeded(this.seed+this.round*41+i*79)*alphabet.length)]);this.index=0;this.phase='show';this.phaseTime=0;}
  input(key:InputSymbol){if(this.outcome||this.phase!=='input')return;if(key===this.expected[this.index]){this.index++;this.score++;if(this.index===this.expected.length){this.round++;if(this.def.variant!==8||this.round===3)this.finish('win','すべて覚えて回答できた');else this.newRound();}}else{this.lives--;this.index=0;if(this.lives<=0)this.finish('lose','記憶の並びが違った');}}
  protected step(dt:number){this.phaseTime+=dt;if(this.phase==='show'&&this.phaseTime>=(this.def.variant===6?1:this.sequenceKeys.length*this.flash+.4)){this.phase='input';this.phaseTime=0;}}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);pixelText(ctx,this.phase==='show'?'WATCH':'REPEAT',160,37,p.pale,1,'center');pixelText(ctx,`LIFE ${this.lives}  ROUND ${this.round+1}`,160,175,p.ink,1,'center');if(this.phase==='show'){if(this.def.variant===6)this.sequence(ctx,p,this.sequenceKeys,-1,48,83);else{const n=Math.floor(this.phaseTime/this.flash);if(n<this.sequenceKeys.length&&this.phaseTime%this.flash<this.flash*.78){ctx.fillStyle=p.mid;ctx.fillRect(127,73,66,65);symbol(ctx,this.sequenceKeys[n],160,95,p.pale,4);}pixelText(ctx,`${Math.min(n+1,this.sequenceKeys.length)}/${this.sequenceKeys.length}`,160,149,p.light,1,'center');}}else{this.sequence(ctx,p,this.expected.map((_k,i)=>i<this.index?this.expected[i]:'A'),this.index,48,85);for(let i=this.index;i<this.expected.length;i++){ctx.fillStyle=p.deep;ctx.fillRect(38+i*29,76,22,23);pixelText(ctx,'?',49+i*29,82,p.ink,1,'center');}}}
  get snapshot(){return {family:'memory',variant:this.def.variant,time:this.time,phase:this.phase,sequence:[...this.sequenceKeys],expected:[...this.expected],index:this.index,round:this.round,lives:this.lives};}
}

type Note={at:number;key:InputSymbol;hit:boolean;rest:boolean};
class RhythmGame extends SkillBase {
  private notes:Note[]=[];private misses=0;private hits=0;private readonly window:number;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);const v=def.variant;this.window=v===6?.07:.18;let at=1.3;const count=v===2?12:v===8?14:10;for(let i=0;i<count;i++){const key=v===1?(i%2?'B':'A'):v===2?KEYS[i%4]:v===8?KEYS[Math.floor(seeded(seed+i*27)*6)]:'A';this.notes.push({at,key,hit:false,rest:v===4&&i%3===2});if(v===7)this.notes.push({at,key:'B',hit:false,rest:false});at+=v===3?[.35,.7,.35,1][i%4]:v===5?Math.max(.28,.8-i*.052):.7;}}
  input(key:InputSymbol){if(this.outcome)return;const note=this.notes.find(n=>!n.hit&&Math.abs(n.at-this.time)<=this.window&&n.key===key);if(note&&!note.rest){note.hit=true;this.hits++;this.score+=10;}else{this.misses++;this.score=Math.max(0,this.score-2);}if(this.misses>=6)this.finish('lose','合図と入力がずれすぎた');}
  protected step(){for(const note of this.notes)if(!note.hit&&this.time>note.at+this.window){note.hit=true;if(!note.rest)this.misses++;}if(this.notes.every(n=>n.hit)){const target=Math.ceil(this.notes.filter(n=>!n.rest).length*.7);this.finish(this.hits>=target?'win':'lose',this.hits>=target?'必要な拍を合わせた':'合わせた拍が足りなかった');}}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);ctx.fillStyle=p.light;ctx.fillRect(59,47,2,111);for(const note of this.notes){if(note.hit)continue;const x=60+(note.at-this.time)*75;if(x<17||x>308)continue;const y=note.key==='B'?125:95;ctx.fillStyle=note.rest?p.dark:p.mid;ctx.fillRect(x-9,y-10,20,23);if(note.rest)pixelText(ctx,'X',x+1,y-5,p.ink,1,'center');else symbol(ctx,note.key,x+1,y-2,p.pale);}pixelText(ctx,`HIT ${this.hits} MISS ${this.misses}`,160,175,p.light,1,'center');}
  get snapshot(){return {family:'rhythm',variant:this.def.variant,time:this.time,window:this.window,hits:this.hits,misses:this.misses,notes:this.notes.map(n=>({...n}))};}
}

class TypingGame extends SkillBase {
  private keys:InputSymbol[];private index=0;private errors=0;private lastInput=0;private selected=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);const v=def.variant,length=v===3?12:v===7?16:v===4||v===5?10:8;const alphabet=v===3?KEYS.slice(4):v===7||v===8?KEYS:KEYS.slice(0,4);this.keys=Array.from({length},(_,i)=>alphabet[Math.floor(seeded(seed+i*97)*alphabet.length)]);}
  private get expected(){const keys=this.def.variant===1?[...this.keys].reverse():[...this.keys];return this.def.variant===2?keys.map(k=>OPPOSITE[k]):keys;}
  input(key:InputSymbol){if(this.outcome||(this.def.variant===6&&this.time<2))return;const v=this.def.variant;if(v===8){if(key==='L'){this.selected=(this.selected+5)%6;return;}if(key==='R'){this.selected=(this.selected+1)%6;return;}if(key!=='A')return;key=KEYS[this.selected];}else if(key==='B'&&![3,4,7].includes(v)){this.index=Math.max(0,this.index-1);this.score=this.index;this.lastInput=this.time;return;}if(key===this.expected[this.index]){this.index++;this.score=this.index;this.lastInput=this.time;if(this.index===this.expected.length)this.finish('win','最後まで入力できた');}else{this.errors++;if(v===4||this.errors>=4)this.finish('lose','入力の並びが違った');}}
  protected step(){if(this.def.variant===5&&this.time-this.lastInput>1)this.finish('lose','次の入力が間に合わなかった');}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);pixelText(ctx,`INPUT ${this.index}/${this.keys.length} MISS ${this.errors}`,160,37,p.light,1,'center');if(this.def.variant===6&&this.time>=2){for(let i=0;i<this.keys.length;i++)pixelText(ctx,i<this.index?'.':'?',28+i*29,83,p.ink,1,'center');}else this.sequence(ctx,p,this.keys,this.def.variant===1?this.keys.length-this.index-1:this.index,25,78);if(this.def.variant===8){KEYS.forEach((key,i)=>{ctx.fillStyle=i===this.selected?p.light:p.mid;ctx.fillRect(57+i*35,135,26,28);symbol(ctx,key,70+i*35,143,i===this.selected?p.bg:p.pale);});}if(this.def.variant===5)bar(ctx,30,163,260,1-(this.time-this.lastInput),p);}
  get snapshot(){return {family:'typing',variant:this.def.variant,time:this.time,keys:[...this.keys],expected:[...this.expected],index:this.index,selected:this.selected,errors:this.errors,visible:this.def.variant!==6||this.time<2};}
}

class BalanceGame extends SkillBase {
  private angle=.28;private velocity=0;private vertical=.2;private verticalVelocity=0;private stable=0;private brakes=3;
  private get target(){return this.def.variant===4?Math.sin(this.time*1.4)*.35:0;}
  private get tolerance(){return this.def.variant===5?Math.max(.1,.34-this.time*.015):this.def.variant===7?.16:.24;}
  input(key:InputSymbol){if(this.outcome)return;const v=this.def.variant,sign=v===1?-1:1;if(key==='L')this.velocity-=.27*sign;if(key==='R')this.velocity+=.27*sign;if(v===8){if(key==='U')this.verticalVelocity-=.27;if(key==='D')this.verticalVelocity+=.27;}if(key==='A'&&v!==7&&this.brakes>0){this.velocity*=.25;this.verticalVelocity*=.25;this.brakes--;}}
  protected step(dt:number){const v=this.def.variant,gravity=v===6?1.75:.8,wind=(v===2?.31:.08)*Math.cos(this.time*.9+this.seed%7);this.velocity+=(this.angle*gravity+wind)*dt;this.velocity*=Math.exp(-dt*(v===3?.05:.55));this.angle+=this.velocity*dt;if(v===8){this.verticalVelocity+=(this.vertical*.65+.04*Math.sin(this.time))*dt;this.verticalVelocity*=Math.exp(-dt*.55);this.vertical+=this.verticalVelocity*dt;}const safe=Math.abs(this.angle-this.target)<this.tolerance&&(v!==8||Math.abs(this.vertical)<this.tolerance);if(safe)this.stable+=dt;this.score=Math.floor(this.stable*10);if(Math.abs(this.angle)>1.25||Math.abs(this.vertical)>1.25)this.finish('lose','傾きが限界を越えた');else if(this.stable>=(v===8?4:v===6?5:6))this.finish('win','安全帯で必要な時間を保った');}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);const gauge=(angle:number,target:number,tolerance:number,y:number)=>{ctx.fillStyle=p.dark;ctx.fillRect(30,y,260,8);ctx.fillStyle=p.mid;ctx.fillRect(160+(target-tolerance)*100,y-8,tolerance*200,24);ctx.fillStyle=p.pale;const x=160+clamp(angle,-1.3,1.3)*100;ctx.fillRect(x-3,y-14,6,36);};gauge(this.angle,this.target,this.tolerance,93);if(this.def.variant===8)gauge(this.vertical,0,this.tolerance,141);pixelText(ctx,`HOLD ${this.stable.toFixed(1)}  BRAKE ${this.brakes}`,160,39,p.light,1,'center');bar(ctx,30,177,260,this.stable/(this.def.variant===8?4:this.def.variant===6?5:6),p);}
  get snapshot(){return {family:'balance',variant:this.def.variant,time:this.time,angle:this.angle,velocity:this.velocity,vertical:this.vertical,verticalVelocity:this.verticalVelocity,target:this.target,tolerance:this.tolerance,stable:this.stable,brakes:this.brakes};}
}

class FishingGame extends SkillBase {
  private x=160;private hookY=48;private cast=false;private caught=0;private misses=0;
  private get target(){return this.def.variant===8?1:this.def.variant===4?3:2;}
  private get fish(){const v=this.def.variant,count=v===4?3:v===5?3:1;return Array.from({length:count},(_,i)=>{const speed=v===2?2.1:.65;return {x:160+Math.sin(this.time*speed+i*2+this.seed%11)*105,y:v===3?173:v===4?95+i*32:v===7?125+Math.sin(this.time*1.4)*33:136,good:v!==5||i===0};});}
  input(key:InputSymbol){if(this.outcome)return;const sign=this.def.variant===6?-1:1;if(key==='L')this.x=clamp(this.x-14*sign,18,302);if(key==='R')this.x=clamp(this.x+14*sign,18,302);if(key==='A'&&!this.cast){this.cast=true;this.hookY=48;}if(key==='B'&&this.cast){const margin=this.def.variant===1?7:14;const fish=this.fish.find(f=>Math.abs(f.x-this.x)<margin&&Math.abs(f.y-this.hookY)<margin);if(fish?.good){this.caught++;this.score+=10;if(this.caught>=this.target)this.finish('win','必要な数を釣り上げた');}else{this.misses++;this.score=Math.max(0,this.score-3);if(this.def.variant===8||this.misses>=4)this.finish('lose',fish?'四角い障害を釣ってしまった':'針に魚が掛かっていなかった');}this.cast=false;this.hookY=48;}}
  protected step(dt:number){if(this.cast){this.hookY+=dt*(this.def.variant===7?82:47);if(this.hookY>185){this.cast=false;this.hookY=48;this.misses++;if(this.def.variant===8||this.misses>=4)this.finish('lose','釣り上げる前に糸が底へ届いた');}}}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);ctx.fillStyle=p.deep;ctx.fillRect(6,60,308,132);ctx.fillStyle=p.mid;ctx.fillRect(6,60,308,2);ctx.fillStyle=p.light;ctx.fillRect(this.x-14,43,28,7);ctx.fillRect(this.x-8,50,16,4);if(this.cast){ctx.strokeStyle=p.pale;ctx.beginPath();ctx.moveTo(this.x,49);ctx.lineTo(this.x,this.hookY);ctx.stroke();ctx.fillStyle=p.pale;ctx.fillRect(this.x-2,this.hookY,5,3);}for(const f of this.fish){ctx.fillStyle=f.good?p.light:p.mid;const size=this.def.variant===1?4:7;if(f.good){ctx.beginPath();ctx.moveTo(f.x-size,f.y);ctx.lineTo(f.x,f.y-size/2);ctx.lineTo(f.x+size,f.y);ctx.lineTo(f.x,f.y+size/2);ctx.fill();}else{ctx.fillRect(f.x-7,f.y-7,14,14);pixelText(ctx,'X',f.x,f.y-3,p.bg,1,'center');}}pixelText(ctx,`CATCH ${this.caught}/${this.target}  MISS ${this.misses}`,160,30,p.pale,1,'center');}
  get snapshot(){return {family:'fishing',variant:this.def.variant,time:this.time,x:this.x,hookY:this.hookY,cast:this.cast,caught:this.caught,target:this.target,misses:this.misses,catchRadius:this.def.variant===1?7:14,fallSpeed:this.def.variant===7?82:47,fish:this.fish.map(f=>({...f}))};}
}

type RoadItem={lane:number;y:number;kind:'obstacle'|'coin';id:number};
class RacerGame extends SkillBase {
  private lane:number;private lives:number;private distance=0;private speed:number;private items:RoadItem[]=[];private nextSpawn=.3;private serial=0;private coins=0;private fuel=100;private invulnerable=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);this.lane=Math.floor(this.lanes/2);this.lives=def.variant===5?1:3;this.speed=def.variant===2?115:75;}
  private get lanes(){return this.def.variant===1?5:3;}
  private get target(){return this.def.variant===1?1200:this.def.variant===2?1400:this.def.variant===5||this.def.variant===8?800:1000;}
  input(key:InputSymbol){if(this.outcome)return;const sign=this.def.variant===7?-1:1;if(key==='L')this.lane=clamp(this.lane-sign,0,this.lanes-1);if(key==='R')this.lane=clamp(this.lane+sign,0,this.lanes-1);if(key==='A')this.speed=clamp(this.speed+8,45,this.def.variant===2?160:125);if(key==='B')this.speed=clamp(this.speed-10,40,160);}
  protected step(dt:number){const v=this.def.variant;this.distance+=this.speed*dt;if(v===8){this.fuel-=dt*(this.speed/12);if(this.fuel<=0){this.finish('lose','燃料がなくなった');return;}}if(this.time>=this.nextSpawn){const n=this.serial++;const lane=v===3?n%this.lanes:Math.floor(seeded(this.seed+n*71)*this.lanes);this.items.push({id:n,lane,y:27,kind:v===4||v===8?n%3===0?'obstacle':'coin':n%4===0?'coin':'obstacle'});if(v===1&&n%2===0)this.items.push({id:1000+n,lane:(lane+2)%this.lanes,y:27,kind:'obstacle'});this.nextSpawn=this.time+(v===1?.6:.85);}for(const item of this.items){item.y+=this.speed*dt;if(Math.abs(item.y-169)<13&&item.lane===this.lane){item.y=250;if(item.kind==='coin'){this.coins++;this.score+=5;this.fuel=Math.min(100,this.fuel+28);}else if(this.time>=this.invulnerable){this.lives--;this.invulnerable=this.time+.65;if(this.lives<=0)this.finish('lose','車が障害にぶつかった');}}}this.items=this.items.filter(item=>item.y<210);this.score=Math.max(this.score,Math.floor(this.distance/10)+this.coins*5);if((v===4&&this.coins>=6)||(v!==4&&this.distance>=this.target))this.finish('win',v===4?'必要なひし形を集めた':'目的の距離を走り切った');}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);const width=240/this.lanes,x=(lane:number)=>40+(lane+.5)*width;ctx.fillStyle=p.deep;ctx.fillRect(40,26,240,168);for(let i=0;i<=this.lanes;i++){ctx.fillStyle=p.mid;ctx.fillRect(40+i*width,27,1,165);}for(const item of this.items){if(this.def.variant===6&&item.y<103)continue;ctx.fillStyle=item.kind==='coin'?p.pale:p.mid;if(item.kind==='coin'){ctx.beginPath();ctx.moveTo(x(item.lane)-6,item.y);ctx.lineTo(x(item.lane),item.y-7);ctx.lineTo(x(item.lane)+6,item.y);ctx.lineTo(x(item.lane),item.y+7);ctx.fill();}else ctx.fillRect(x(item.lane)-13,item.y-9,26,18);}if(this.def.variant===6){ctx.fillStyle=p.dark;ctx.globalAlpha=.85;ctx.fillRect(40,27,240,75);ctx.globalAlpha=1;}ctx.fillStyle=this.time<this.invulnerable?p.ink:p.light;ctx.fillRect(x(this.lane)-9,158,18,23);ctx.fillStyle=p.bg;ctx.fillRect(x(this.lane)-6,161,12,6);pixelText(ctx,`${Math.floor(this.distance)}M L${this.lives}`,160,30,p.pale,1,'center');if(this.def.variant===8)bar(ctx,47,187,226,this.fuel/100,p);}
  get snapshot(){return {family:'racer',variant:this.def.variant,time:this.time,lane:this.lane,lanes:this.lanes,lives:this.lives,distance:this.distance,speed:this.speed,target:this.target,goal:this.def.variant===4?'coins':'distance',coins:this.coins,fuel:this.fuel,items:this.items.map(item=>({...item})),visibleItems:this.items.filter(item=>this.def.variant!==6||item.y>=103).map(item=>({...item}))};}
}

class LanderGame extends SkillBase {
  private x=160;private y=30;private vx=0;private vy=0;private fuel:number;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);this.fuel=def.variant===3?30:64;}
  private get pad(){return {x:this.def.variant===4?160+Math.sin(this.time*.22)*79:this.def.variant===6?248:160,width:this.def.variant===1?30:66,y:177};}
  input(key:InputSymbol){if(this.outcome||this.fuel<=0)return;const sign=this.def.variant===5?-1:1;if(key==='L'){this.vx-=10*sign;this.fuel-=2;}if(key==='R'){this.vx+=10*sign;this.fuel-=2;}if(key==='A'){this.vy-=9;this.fuel-=3;}if(key==='B'&&this.def.variant!==7){this.vx*=.55;this.vy*=.58;this.fuel-=4;}this.fuel=Math.max(0,this.fuel);}
  protected step(dt:number){const v=this.def.variant;this.vy+=dt*(v===8?9:4.7);if(v===2)this.vx+=Math.sin(this.time*.8)*dt*3.6;this.x+=this.vx*dt;this.y+=this.vy*dt;this.score=Math.max(this.score,Math.floor(this.y-30));if(this.x<12||this.x>308||this.y<24){this.finish('lose','機体が飛行範囲を出た');return;}if(v===6&&this.x>125&&this.x<192&&this.y>93&&this.y<119){this.finish('lose','途中の岩に接触した');return;}if(this.y>=this.pad.y-7){const safe=Math.abs(this.x-this.pad.x)<=this.pad.width/2-6&&Math.abs(this.vy)<18&&Math.abs(this.vx)<16;this.y=this.pad.y-7;this.score+=safe?100:0;this.finish(safe?'win':'lose',safe?'足場へ安全に着陸した':'足場の外か、着地の速度が速すぎた');}}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);ctx.fillStyle=p.dark;ctx.fillRect(6,179,308,14);ctx.fillStyle=p.light;ctx.fillRect(this.pad.x-this.pad.width/2,this.pad.y,this.pad.width,3);if(this.def.variant===6){ctx.fillStyle=p.mid;ctx.fillRect(125,93,67,26);}ctx.fillStyle=p.pale;ctx.beginPath();ctx.moveTo(this.x,this.y-8);ctx.lineTo(this.x-7,this.y+6);ctx.lineTo(this.x+7,this.y+6);ctx.fill();ctx.fillStyle=p.light;ctx.fillRect(this.x-9,this.y+6,4,2);ctx.fillRect(this.x+5,this.y+6,4,2);pixelText(ctx,`FUEL ${Math.ceil(this.fuel)}  V ${Math.abs(this.vy).toFixed(0)}`,160,36,p.light,1,'center');}
  get snapshot(){return {family:'lander',variant:this.def.variant,time:this.time,x:this.x,y:this.y,vx:this.vx,vy:this.vy,fuel:this.fuel,pad:{...this.pad},obstacles:this.def.variant===6?[{x:125,y:93,w:67,h:26}]:[]};}
}

class ReactionGame extends SkillBase {
  private phase:'wait'|'signal'|'fake'='wait';private until=0;private targetKey:InputSymbol='A';private count=0;private successes=0;private errors=0;private taps=0;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);this.nextRound();}
  private get window(){return this.def.variant===6?.3:this.def.variant===7||this.def.variant===8?.65:.9;}
  private nextRound(){this.phase='wait';this.taps=0;const v=this.def.variant;this.until=this.time+(v===5?.55:1)+seeded(this.seed+this.count*101)*(v===5?.35:1.3);this.targetKey=v===1?this.count%2?'R':'L':v===2?KEYS[Math.floor(seeded(this.seed+this.count*31)*6)]:v===4?KEYS[this.count%4]:'A';}
  private fail(reason:string){this.errors++;if(this.errors>=3)this.finish('lose',reason);else{this.count++;this.nextRound();}}
  input(key:InputSymbol){if(this.outcome)return;if(this.phase!=='signal'){this.fail(this.phase==='fake'?'偽物の合図に反応した':'合図の前に押してしまった');return;}const v=this.def.variant,expected=v===4?OPPOSITE[this.targetKey]:v===8&&this.taps===1?'B':this.targetKey;if(key!==expected){this.fail('合図と違う入力だった');return;}this.taps++;if((v!==7&&v!==8)||this.taps===2){this.successes++;this.score+=10;this.count++;if(this.successes>=4)this.finish('win','必要な回数だけ正しく反応できた');else this.nextRound();}}
  protected step(){if(this.time<this.until)return;if(this.phase==='wait'){const fake=this.def.variant===3?this.count%2===0:this.def.variant===5?this.count%3!==2:false;this.phase=fake?'fake':'signal';this.until=this.time+(fake?.75:this.window);}else if(this.phase==='fake'){this.count++;this.nextRound();}else this.fail('合図への反応が間に合わなかった');}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);const color=this.phase==='signal'?this.def.variant===5?'#65baff':this.def.variant===3?'#78d79a':p.light:this.phase==='fake'?this.def.variant===5?'#8b9195':'#d25a5a':p.dark;ctx.fillStyle=color;ctx.fillRect(102,62,116,91);ctx.strokeStyle=p.pale;ctx.strokeRect(105.5,65.5,109,84);if(this.phase==='signal'||this.phase==='fake'&&this.def.variant===5){symbol(ctx,this.def.variant===8&&this.taps===1?'B':this.targetKey,160,92,p.bg,4);pixelText(ctx,'GO',160,135,p.bg,1,'center');}else pixelText(ctx,this.phase==='fake'?'X':'WAIT',160,101,p.pale,2,'center');pixelText(ctx,`OK ${this.successes}/4 MISS ${this.errors}/3`,160,175,p.light,1,'center');}
  get snapshot(){return {family:'reaction',variant:this.def.variant,time:this.time,phase:this.phase,until:this.until,window:this.window,target:this.targetKey,expected:this.def.variant===4?OPPOSITE[this.targetKey]:this.def.variant===8&&this.taps===1?'B':this.targetKey,successes:this.successes,errors:this.errors,taps:this.taps,requiredTaps:this.def.variant===7||this.def.variant===8?2:1};}
}

class ClickerGame extends SkillBase {
  private energy=0;private heat=0;private expected:InputSymbol='A';private banks=0;private rate=1;
  constructor(def:ArcadeDefinition,seed:number){super(def,seed);if(def.variant===8)this.score=5;}
  private get green(){return Math.floor(this.time/.7)%2===0;}
  private get target(){return this.def.variant===0?18:this.def.variant===1||this.def.variant===7?16:this.def.variant===3?12:this.def.variant===5?14:this.def.variant===6?8:this.def.variant===8?50:24;}
  input(key:InputSymbol){if(this.outcome)return;const v=this.def.variant;if(v===8){if(key==='A'&&this.score>=5){this.score-=5;this.rate++;}if(key==='B')this.score+=this.rate;if(this.score>=50)this.finish('win','投資と収入で目標額へ届いた');return;}if(v===2||v===4){if(key==='A')this.energy++;if(key==='B'){const valid=v===2?this.energy>=8:this.energy>=6&&this.energy<=8;if(valid){this.banks++;this.score+=8;}else{this.banks=0;this.score=0;}this.energy=0;if(this.banks>=3)this.finish('win','ためた力を3回受け取った');}return;}const expected=v===1?this.expected:v===7?'B':'A';if(key!==expected){if(key==='A'||key==='B')this.energy=Math.max(0,this.energy-2);}else if(v===6&&!this.green)this.energy=Math.max(0,this.energy-2);else{this.energy++;if(v===1)this.expected=this.expected==='A'?'B':'A';if(v===3){this.heat+=.19;if(this.heat>1){this.finish('lose','熱が限界を超えた');return;}}}this.score=Math.floor(this.energy);if(this.energy>=this.target)this.finish('win','必要な量をためた');}
  protected step(dt:number){if(this.def.variant===3)this.heat=Math.max(0,this.heat-dt*.42);if(this.def.variant===5){this.energy=Math.max(0,this.energy-dt*2);this.score=Math.floor(this.energy);}}
  draw(ctx:CanvasRenderingContext2D,p:Palette){this.base(ctx,p);const v=this.def.variant,signal=this.green?'#78d79a':'#ed7a7a';pixelText(ctx,v===8?`RATE ${this.rate}`:v===2||v===4?`BANK ${this.banks}/3`:`GOAL ${this.target}`,160,40,p.light,1,'center');bar(ctx,35,84,250,(v===8?this.score:this.energy)/(v===2||v===4?8:this.target),p);const key=v===1?this.expected:v===7?'B':'A';if(v!==8)symbol(ctx,key,160,117,v===6?signal:p.pale,4);else{symbol(ctx,'A',111,119,p.pale,3);symbol(ctx,'B',210,119,p.pale,3);pixelText(ctx,'INVEST   INCOME',160,159,p.light,1,'center');}if(v===3){bar(ctx,35,168,250,this.heat,p);pixelText(ctx,'HEAT',160,184,p.light,1,'center');}if(v===4)pixelText(ctx,`RELEASE 6-8  NOW ${Math.floor(this.energy)}`,160,174,p.light,1,'center');if(v===6)pixelText(ctx,this.green?'GO':'WAIT',160,174,signal,1,'center');}
  get snapshot(){return {family:'clicker',variant:this.def.variant,time:this.time,energy:this.energy,heat:this.heat,expected:this.def.variant===7?'B':this.expected,banks:this.banks,rate:this.rate,target:this.target,green:this.green};}
}

export function createSkillGame(def:ArcadeDefinition,seed:number):ArcadeEngine {
  if(!Number.isInteger(def.variant)||def.variant<0||def.variant>8)throw new Error('Unknown skill variant');
  switch(def.family){
    case 'memory':return new MemoryGame(def,seed);
    case 'rhythm':return new RhythmGame(def,seed);
    case 'typing':return new TypingGame(def,seed);
    case 'balance':return new BalanceGame(def,seed);
    case 'fishing':return new FishingGame(def,seed);
    case 'racer':return new RacerGame(def,seed);
    case 'lander':return new LanderGame(def,seed);
    case 'reaction':return new ReactionGame(def,seed);
    case 'clicker':return new ClickerGame(def,seed);
    default:throw new Error(`Unknown skill family: ${def.family}`);
  }
}
