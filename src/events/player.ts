import type { GameEvent, InputSymbol, TimelineBeat } from '../data/types';
import { loadWorldImage, onWorldImageReady } from '../assets/registry';
import { clamp, hash, PALETTES, pixelText } from './art';
import { ArcadeGame } from './arcade';

export interface SceneOptions {
  reducedMotion:boolean;
  onBeat?:(beat:TimelineBeat,index:number)=>void;
  onProgress?:(progress:number,detail:string)=>void;
  onComplete:()=>void;
}

/** A fixed-step arcade session. The completed board stays until an explicit return. */
export class ScenePlayer {
  private readonly ctx:CanvasRenderingContext2D;
  private readonly game:ArcadeGame;
  private frame=0;
  private disposed=false;
  private finished=false;
  private paused=false;
  private previous:number|null=null;
  private elapsed=0;
  private readyElapsed=0;
  private ready=true;
  private accumulator=0;
  private reportAt=-1;
  constructor(private readonly canvas:HTMLCanvasElement,private readonly event:GameEvent,private readonly options:SceneOptions){
    canvas.width=320;canvas.height=200;canvas.style.imageRendering='pixelated';
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Canvas 2D を初期化できませんでした。');
    this.ctx=ctx;ctx.imageSmoothingEnabled=false;
    this.game=new ArcadeGame(event.game,hash(event.eventId),event.durationMs);
    this.options.onBeat?.({at:0,text:event.game.rule,action:'play'},0);
    this.draw();this.report();this.schedule();
  }
  get progress(){return this.finished?1:this.event.durationMs>0?clamp(this.elapsed/this.event.durationMs,0,1):0;}
  get currentBeatIndex(){return 0;}
  get totalBeats(){return 1;}
  get durationMs(){return this.event.durationMs;}
  get isComplete(){return this.finished;}
  get result(){return this.game.outcome;}
  get score(){return this.game.score;}
  get instruction(){return this.game.instruction;}
  get currentFamily(){const family=this.game.snapshot.activeFamily;return typeof family==='string'?family:this.event.game.family;}
  get snapshot(){const state=this.game.snapshot;return {...state,enginePhase:state.phase,phase:this.finished?'result':this.ready?'ready':'playing'};}
  input(key:InputSymbol|'START'){
    if(this.disposed||this.finished||this.paused)return;
    if(this.ready){this.ready=false;this.readyElapsed=1800;this.previous=null;}
    else this.game.input(key==='START'?'A':key);
    if(this.game.outcome)this.complete();else{this.draw();this.report();}
  }
  pause(value=true){
    if(this.disposed||this.finished)return;
    this.paused=value;this.previous=null;
    if(value){cancelAnimationFrame(this.frame);this.frame=0;}else this.schedule();
  }
  setReducedMotion(value:boolean){this.options.reducedMotion=value;if(!this.disposed)this.draw();}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.frame=0;}
  nextBeat(){}
  previousBeat(){}
  reveal(){if(!this.disposed&&!this.finished){this.game.finish();this.complete();}}
  private schedule(){if(!this.frame&&!this.disposed&&!this.finished&&!this.paused)this.frame=requestAnimationFrame(this.tick);}
  private report(){
    this.reportAt=this.elapsed;
    const detail=this.finished?`${this.game.outcome?.reason??''}　SCORE ${this.game.score}`
      :`${this.ready?'準備中 · ボタンで開始 / ':''}${this.game.instruction}　SCORE ${this.game.score}`;
    this.options.onProgress?.(this.progress,detail);
    if(this.canvas.dataset){this.canvas.dataset.phase=this.finished?'result':this.ready?'ready':'playing';this.canvas.dataset.family=this.event.game.family;this.canvas.dataset.variant=String(this.event.game.variant);this.canvas.dataset.score=String(this.game.score);this.canvas.dataset.elapsed=String(Math.floor(this.elapsed));this.canvas.dataset.playMode=this.event.game.playMode;}
  }
  private tick=(now:number)=>{
    this.frame=0;if(this.disposed||this.paused||this.finished)return;
    const dt=this.previous===null?0:clamp((now-this.previous)/1000,0,.1);this.previous=now;
    if(this.ready){this.readyElapsed+=dt*1000;if(this.readyElapsed>=1800)this.ready=false;}
    else{
      this.accumulator+=dt;
      while(this.accumulator>=1/120&&!this.game.outcome){this.accumulator-=1/120;this.elapsed+=1000/120;this.game.update(1/120);}
    }
    if(this.game.outcome){this.complete();return;}
    this.draw();if(this.elapsed-this.reportAt>=80)this.report();this.schedule();
  };
  private complete(){
    if(this.finished)return;
    this.finished=true;cancelAnimationFrame(this.frame);this.frame=0;
    this.draw();this.report();this.options.onComplete();
  }
  private draw(){
    const p=PALETTES[this.event.palette]??PALETTES.amber,ctx=this.ctx;
    ctx.save();ctx.fillStyle=p.bg;ctx.fillRect(0,0,320,200);
    this.game.draw(ctx,p,this.options.reducedMotion);
    // Leave the engine's score, lives, ammunition and goals readable at the sides.
    ctx.fillStyle=p.bg;ctx.fillRect(141,0,38,19);
    const seconds=Math.floor(this.elapsed/1000),clock=this.event.durationMs>0?`${Math.ceil(Math.max(0,this.event.durationMs-this.elapsed)/1000)}S`:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    pixelText(ctx,this.event.durationMs>0?'LEFT':'TIME',160,1,p.ink,1,'center');
    pixelText(ctx,clock,160,10,p.light,1,'center');
    if(this.ready){
      ctx.fillStyle='#080e12e8';ctx.fillRect(69,73,182,53);
      ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=p.pale;
      ctx.font='bold 14px system-ui, sans-serif';ctx.fillText('プレイ準備',160,83);
      ctx.font='10px system-ui, sans-serif';ctx.fillText('Aボタン / START で開始',160,108);
    }
    ctx.restore();
  }
}

export function drawTitle(canvas:HTMLCanvasElement,reducedMotion=false):()=>void{
  canvas.width=320;canvas.height=200;canvas.style.imageRendering='pixelated';
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return()=>{};
  ctx.imageSmoothingEnabled=false;let frame=0,disposed=false;const start=performance.now();
  const paint=(now:number)=>{
    const p=PALETTES.ocean;ctx.fillStyle=p.bg;ctx.fillRect(0,0,320,200);
    const image=loadWorldImage('titleWorld');
    if(image)ctx.drawImage(image,0,0,320,200);
    else{ctx.fillStyle=p.dark;for(let i=0;i<15;i++)ctx.fillRect(i*23,132-(i%4)*14,20,68);}
    const y=157+(reducedMotion?0:Math.round(Math.sin((now-start)/900)*2));
    ctx.fillStyle=p.bg;ctx.fillRect(135,y-27,50,37);ctx.fillStyle=p.light;ctx.fillRect(138,y-25,44,32);
    ctx.fillStyle=p.deep;ctx.fillRect(144,y-21,32,19);pixelText(ctx,'173',160,y-16,p.pale,1,'center');
    ctx.fillStyle=p.accent;ctx.fillRect(146,y+3,3,5);ctx.fillRect(154,y+3,3,5);ctx.fillRect(162,y+3,3,5);ctx.fillRect(170,y+3,3,5);
  };
  const tick=(now:number)=>{if(disposed)return;paint(now);if(!reducedMotion)frame=requestAnimationFrame(tick);};
  tick(start);const detach=onWorldImageReady('titleWorld',()=>{if(!disposed)paint(performance.now());});
  return()=>{disposed=true;cancelAnimationFrame(frame);detach();};
}
