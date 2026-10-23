import type { Actor, GameEvent, InputSymbol, TimelineBeat } from '../data/types';
import { loadWorldImage, onWorldImageReady, resolveAsset } from '../assets/registry';
import { actor, actorLabel, background, bar, captionText, clamp, ease, hash, lerp, PALETTES, pixelText, seeded, titleFrame, type Palette } from './art';
import { Minigame } from './minigames';
import { createPlaybackTimeline } from './pacing';

export const SUPPORTED_ACTIONS = ['enter','rise','fall','bounce','spin','grow','shrink','mirror','rain','shake','explode','portal','chase','stack','dance','hide','spotlight','build','float','type','glitch','walk','jump','transform','celebrate','sleep','pull','swap','blackout','reveal','wave','freeze','orbit','fish','train'] as const;

export interface SceneOptions {
  reducedMotion:boolean;
  onBeat?:(beat:TimelineBeat,index:number)=>void;
  onProgress?:(progress:number,detail:string)=>void;
  onComplete:()=>void;
}

interface StageState {
  kind:Actor; prop:Actor; x:number; y:number; scale:number; rotation:number; opacity:number;
  propX:number; propY:number; propScale:number; propOpacity:number; count:number;
  blackout:number; frozen:boolean; resting:boolean; hidden:boolean;
  layout:'single'|'tower'|'gathered'|'orbit'|'train';
}

/** A disposable 320 × 200 stage. Story time includes the time needed to read. */
export class ScenePlayer {
  private readonly ctx:CanvasRenderingContext2D;
  private readonly palette:Palette;
  private readonly seed:number;
  private readonly game?:Minigame;
  private readonly timeline:TimelineBeat[];
  private readonly states:StageState[];
  private readonly effectiveDuration:number;
  private frame=0;
  private disposed=false;
  private finished=false;
  private previous=0;
  private elapsed=0;
  private beatIndex=-1;
  private reportAt=-1;
  private paused=false;

  constructor(private readonly canvas:HTMLCanvasElement,private readonly event:GameEvent,private readonly options:SceneOptions){
    canvas.width=320;canvas.height=200;canvas.style.imageRendering='pixelated';
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('Canvas 2D を初期化できませんでした。');
    this.ctx=context;this.ctx.imageSmoothingEnabled=false;
    this.palette=PALETTES[event.palette]??PALETTES.amber;this.seed=hash(event.eventId);
    const playback=createPlaybackTimeline(event);this.timeline=playback.timeline;this.effectiveDuration=playback.durationMs;
    event.assetIds.forEach(resolveAsset);
    if(event.mechanic)this.game=new Minigame(event.mechanic,this.seed);
    let state:StageState={kind:event.actor,prop:event.prop,x:110,y:154,scale:1.8,rotation:0,opacity:1,propX:224,propY:154,propScale:1.35,propOpacity:1,count:1,blackout:0,frozen:false,resting:false,hidden:false,layout:'single'};
    this.states=this.timeline.map((beat,index)=>{
      const start={...state};
      const previous=this.timeline[index-1];
      // The true ending changes its cast explicitly. Ordinary beats retain the
      // same characters, including an intentional transformation, until reveal.
      if(index>0&&(beat.actor??event.actor)!==(previous.actor??event.actor)){
        Object.assign(start,{kind:beat.actor??event.actor,x:110,y:154,scale:1.8,rotation:0,opacity:1,frozen:false,resting:false,hidden:false});
      }
      if(index>0&&(beat.prop??event.prop)!==(previous.prop??event.prop)){
        Object.assign(start,{prop:beat.prop??event.prop,propX:224,propY:154,propScale:1.35,propOpacity:1,count:1,layout:'single'});
      }
      if(index===0&&beat.action==='enter')start.x=-24;
      state=this.pose(start,beat,1,index);
      return start;
    });
    this.advanceBeats();this.draw();this.report();this.schedule();
  }

  get progress(){return clamp(this.elapsed/this.effectiveDuration,0,1);}
  get currentBeatIndex(){return this.beatIndex;}
  get totalBeats(){return this.timeline.length;}
  get durationMs(){return this.effectiveDuration;}
  get isComplete(){return this.finished;}

  input(symbol:InputSymbol|'START'){
    if(this.disposed||this.finished||this.paused)return;
    this.game?.input(symbol);if(this.game)this.report();this.draw();
  }

  pause(value=true){
    if(this.disposed||this.finished)return;
    this.paused=value;this.previous=0;
    if(value){cancelAnimationFrame(this.frame);this.frame=0;}else this.schedule();
  }

  setReducedMotion(value:boolean){this.options.reducedMotion=value;if(!this.disposed)this.draw();}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.frame=0;}

  /** Explicit reading controls can skip a hold; minigame clocks are never seeked. */
  nextBeat(){
    if(this.disposed||this.game)return;
    if(this.beatIndex<this.timeline.length-1)this.seek(this.beatIndex+1);
    else if(!this.finished)this.complete();
  }

  previousBeat(){
    if(this.disposed||this.game||this.beatIndex<=0)return;
    this.seek(this.beatIndex-1);
  }

  private seek(index:number){
    this.beatIndex=index;
    // Completed stories can be reviewed as still frames without restarting work.
    this.elapsed=this.finished?(this.timeline[index+1]?.at??this.effectiveDuration)-1:this.timeline[index].at;
    this.previous=0;this.options.onBeat?.(this.timeline[index],index);this.draw();this.report();
  }

  private schedule(){if(!this.frame&&!this.disposed&&!this.finished&&!this.paused)this.frame=requestAnimationFrame(this.tick);}
  private report(){this.reportAt=this.elapsed;this.options.onProgress?.(this.progress,this.game?.detail??this.timeline[this.beatIndex]?.text??this.event.title);}
  private advanceBeats(){while(this.beatIndex+1<this.timeline.length&&this.timeline[this.beatIndex+1].at<=this.elapsed){this.beatIndex++;this.options.onBeat?.(this.timeline[this.beatIndex],this.beatIndex);}}

  private complete(){
    if(this.finished||this.disposed)return;
    cancelAnimationFrame(this.frame);this.frame=0;this.elapsed=this.effectiveDuration;
    this.advanceBeats();this.game?.finish();this.draw();this.report();this.finished=true;
    this.options.onComplete();
  }

  private tick=(now:number)=>{
    this.frame=0;if(this.disposed||this.finished||this.paused)return;
    const dt=this.previous?Math.min((now-this.previous)/1000,.1):0;this.previous=now;
    this.elapsed=Math.min(this.effectiveDuration,this.elapsed+dt*1000);
    this.advanceBeats();this.game?.update(this.elapsed/1000,dt);
    if(this.elapsed>=this.effectiveDuration){this.complete();return;}
    this.draw();if(this.elapsed-this.reportAt>=180)this.report();this.schedule();
  };

  /** Return a deterministic pose from this beat's retained starting state. */
  private pose(start:StageState,beat:TimelineBeat,q:number,index:number):StageState {
    const s={...start};const a=ease(q),cycle=Math.sin(q*Math.PI*2),hop=Math.sin(q*Math.PI);
    const quiet=this.options.reducedMotion;
    if(start.resting&&!['sleep','rain','orbit','blackout','spotlight','type','reveal'].includes(beat.action)){
      s.rotation=lerp(start.rotation,0,ease(Math.min(1,q*2)));s.resting=q<.5;
    }
    switch(beat.action){
      case 'enter':s.x=lerp(start.x,index===0?110:Math.min(170,start.x+25),a);break;
      case 'rise':s.y=lerp(start.y,94,a);break;
      case 'fall':s.y=lerp(index===0?40:start.y,154,a);break;
      case 'bounce':s.y-=hop*34;if(!quiet)s.propY-=hop*13;break;
      case 'spin':s.rotation+=quiet?0:q*Math.PI*2;break;
      case 'grow':s.scale=lerp(start.scale,2.9,a);if(start.hidden)s.opacity=lerp(start.opacity,1,a);break;
      case 'shrink':s.scale=lerp(start.scale,1.8,a);break;
      case 'shake':if(!quiet){s.x+=Math.sin(q*Math.PI*12)*4*hop;s.propX+=Math.sin(q*Math.PI*10)*4*hop;}break;
      case 'portal':s.x=q<.5?lerp(start.x,61,q*2):lerp(265,177,(q-.5)*2);s.opacity=(start.hidden?1:start.opacity)*(quiet?1:Math.min(1,Math.abs(q-.5)*4));s.hidden=false;break;
      case 'chase':{
        const end=start.x<160?205:100;s.x=lerp(start.x,end,a);s.propX=lerp(start.propX,end+52,a);
        if(!quiet){s.y-=Math.abs(Math.sin(q*Math.PI*6))*5;s.propY-=Math.abs(Math.sin(q*Math.PI*6))*5;}break;
      }
      case 'build':s.layout='tower';s.count=1+Math.floor(q*2);s.propY=lerp(start.propY,154,a);break;
      case 'stack':s.layout='tower';s.count=(start.layout==='tower'?Math.min(3,start.count):1)+Math.floor(q*(start.layout==='tower'?2:4));s.propY=lerp(start.propY,154,a);break;
      case 'dance':if(!quiet){s.y-=Math.abs(Math.sin(q*Math.PI*4))*9;s.rotation+=cycle*.18;s.propY-=Math.abs(Math.sin(q*Math.PI*4))*7;}break;
      case 'hide':s.x=lerp(start.x,start.propX,a);s.y=lerp(start.y,start.propY,a);s.opacity=start.opacity*(1-a);s.hidden=true;break;
      case 'float':s.y=lerp(start.y,Math.min(start.y,112),a);s.propY=lerp(start.propY,Math.min(start.propY,112),a);if(!quiet){s.y-=hop*5;s.propY+=hop*5;}break;
      case 'glitch':if(!quiet){s.x+=Math.sin(q*Math.PI*22)*3*hop;s.opacity=start.opacity*(Math.floor(q*18)%3===0?.45:1);}break;
      case 'walk':s.x=lerp(start.x,start.x<150?177:95,a);s.y=lerp(start.y,154,a);break;
      case 'jump':s.x=lerp(start.x,start.x<start.propX?Math.min(282,start.propX+45):Math.max(35,start.propX-45),a);s.y=lerp(start.y,154,a)-hop*65;break;
      case 'transform':s.kind=q<.5?start.kind:start.prop;s.propOpacity=1-a;break;
      case 'celebrate':if(!quiet)s.y-=Math.abs(Math.sin(q*Math.PI*4))*7;break;
      case 'sleep':s.rotation=lerp(start.rotation,-Math.PI/2,a);s.y=lerp(start.y,Math.min(start.y,150),a);s.resting=true;break;
      case 'pull':s.propX=lerp(start.propX,start.x+47,a);break;
      case 'swap':s.x=lerp(start.x,start.propX,a);s.propX=lerp(start.propX,start.x,a);s.y-=hop*22;break;
      case 'blackout':s.blackout=lerp(start.blackout,.84,a);break;
      case 'reveal':
        s.opacity=lerp(start.opacity,1,a);s.propOpacity=lerp(start.propOpacity,1,a);s.blackout=lerp(start.blackout,0,a);
        s.frozen=false;s.resting=false;s.hidden=false;s.rotation=lerp(start.rotation,0,a);
        if(start.hidden)s.x=lerp(start.x,clamp(start.propX-55,40,275),a);
        if(q>=.5)s.kind=beat.actor??this.event.actor;
        break;
      case 'spotlight':s.blackout=lerp(start.blackout,0,a);break;
      case 'freeze':s.frozen=q>.12;break;
      case 'rain':s.layout='gathered';s.count=9;s.propY=154;break;
      case 'orbit':s.layout='orbit';s.count=5;break;
      case 'fish':s.propX=lerp(start.propX,start.x+85,a);s.propY=lerp(start.propY,147,a);break;
      case 'train':s.layout='train';s.count=3;s.x=lerp(start.x,65,a);s.y=lerp(start.y,136,a);s.propX=lerp(start.propX,120,a);s.propY=lerp(start.propY,136,a);break;
    }
    // Whole rotations have the same endpoint, avoiding cumulative numerical drift.
    if(q===1&&beat.action==='spin')s.rotation=start.rotation;
    if(q===1&&beat.action==='glitch')s.opacity=start.opacity;
    return s;
  }

  private draw(){
    const ctx=this.ctx,p=this.palette,t=this.elapsed/1000;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
    background(ctx,p,t,this.options.reducedMotion,this.seed%17);
    const ending=this.event.assetIds.includes('endingWorld');const image=ending?loadWorldImage('endingWorld'):null;
    if(image)ctx.drawImage(image,0,0,320,200);
    if(this.game){this.game.draw(ctx,p,this.options.reducedMotion);bar(ctx,12,190,296,this.progress,p);return;}
    const beat=this.timeline[this.beatIndex];if(!beat)return;
    const next=this.timeline[this.beatIndex+1]?.at??this.effectiveDuration;
    // Actions settle early; their outcome remains visible while the caption is read.
    const q=clamp((this.elapsed-beat.at)/Math.min(1800,Math.max(1,next-beat.at)*.66),0,1);
    const s=this.pose(this.states[this.beatIndex],beat,q,this.beatIndex);
    this.drawScene(beat,q,s,t);
    if(ending){
      const cast:Actor[]=['cat','ghost','robot','plant','bird','slime','fish'];
      const count=Math.min(cast.length,Math.max(0,this.beatIndex));
      for(let i=0;i<count;i++)actor(ctx,cast[i],24+i*44,180,p,{scale:.65});
    }
    bar(ctx,12,190,296,this.progress,p);
  }

  private drawScene(beat:TimelineBeat,q:number,s:StageState,time:number){
    const ctx=this.ctx,p=this.palette,quiet=this.options.reducedMotion,start=this.states[this.beatIndex];
    const action=beat.action;const local=this.elapsed-beat.at;
    const drawActor=()=>actor(ctx,s.kind,s.x,s.y,p,{scale:s.scale,rotation:s.rotation,opacity:s.opacity,pose:quiet||s.frozen||s.rotation!==0?0:Math.floor(time*3)});
    const drawProp=(x=s.propX,y=s.propY,scale=s.propScale,opacity=s.propOpacity)=>actor(ctx,s.prop,x,y,p,{scale,opacity,signText:this.event.eventId==='ending-001'?'END':undefined});
    const portal=(x:number)=>{
      ctx.fillStyle=p.light;ctx.fillRect(x-17,82,34,73);ctx.fillStyle=p.mid;ctx.fillRect(x-14,85,28,67);ctx.fillStyle=p.bg;ctx.fillRect(x-11,88,22,61);
    };
    if(action==='spotlight'){
      ctx.fillStyle=p.bg;ctx.globalAlpha=.6;ctx.fillRect(0,0,320,181);ctx.globalAlpha=1;
      ctx.fillStyle=p.dark;ctx.beginPath();ctx.moveTo(s.x-7,25);ctx.lineTo(s.x-49,156);ctx.lineTo(s.x+49,156);ctx.lineTo(s.x+7,25);ctx.fill();
    }
    if(action==='portal'){portal(61);portal(265);}
    if(action==='fish'){
      ctx.fillStyle=p.deep;ctx.fillRect(170,132,150,24);ctx.fillStyle=p.ink;ctx.fillRect(170,132,150,1);
      ctx.strokeStyle=p.light;ctx.beginPath();ctx.moveTo(s.x+14,s.y-20);ctx.lineTo(s.x+35,s.y-61);ctx.lineTo(s.propX,s.propY-8);ctx.stroke();
    }
    if(action==='type'){
      ctx.fillStyle=p.mid;ctx.fillRect(137,27,172,78);ctx.fillStyle=p.bg;ctx.fillRect(140,30,166,72);
      actor(ctx,s.prop,152,49,p,{scale:.5});
      captionText(ctx,beat.text.slice(0,Math.ceil([...beat.text].length*Math.min(1,q*1.8))),148,54,p);
    }
    if(action==='mirror'){
      ctx.fillStyle=p.mid;ctx.fillRect(177,59,86,98);ctx.fillStyle=p.deep;ctx.fillRect(180,62,80,92);
      actor(ctx,s.kind,220,151,p,{scale:s.scale,rotation:-s.rotation,flip:true,opacity:.65});
    }
    if(action==='pull'){
      ctx.strokeStyle=p.light;ctx.beginPath();ctx.moveTo(s.x+12,s.y-15);ctx.lineTo(s.propX,s.propY-14);ctx.stroke();
    }
    if(s.layout==='train'){
      ctx.fillStyle=p.ink;ctx.fillRect(0,157,320,2);
      for(let i=0;i<4;i++){
        const x=s.propX-55+i*51;ctx.fillStyle=p.mid;ctx.fillRect(x-18,138,38,15);ctx.fillStyle=p.light;ctx.fillRect(x-18,138,38,2);ctx.fillStyle=p.bg;ctx.fillRect(x-12,153,7,5);ctx.fillRect(x+8,153,7,5);
        if(i>0)drawProp(x,138,.85);
      }
    }
    // Hidden actors are drawn behind the actual story prop, never a substituted box.
    if(s.hidden)drawActor();
    if(action==='rain'){
      for(let i=0;i<9;i++){
        const x=24+i*33;const y=quiet?lerp(35,142,q):lerp(-18-i*11,148,q);
        drawProp(x,y,.6,s.propOpacity);
      }
    }else if(action==='explode'){
      for(let i=0;i<7;i++){
        const angle=i/7*Math.PI*2;const r=Math.sin(q*Math.PI)*53;
        drawProp(start.propX+Math.cos(angle)*r,start.propY-15+Math.sin(angle)*r,.55,(1-q)*s.propOpacity);
      }
      if(q>=.99)drawProp();
    }else if(s.layout==='orbit'){
      for(let i=0;i<5;i++){
        const angle=(quiet?0:time*.7)+i*Math.PI*2/5;
        drawProp(s.x+Math.cos(angle)*65,s.y-28+Math.sin(angle)*28,.6);
      }
    }else if(s.layout==='gathered'){
      for(let i=0;i<s.count;i++)drawProp(24+i*33,154,.6);
    }else if(s.layout!=='train'){
      for(let i=0;i<s.count;i++)drawProp(s.propX,s.propY-i*20,Math.min(s.propScale,s.count>1?.85:1.35));
    }
    if(!s.hidden)drawActor();
    if(s.frozen){
      const h=31*s.scale,w=27*s.scale;ctx.fillStyle=p.ink;ctx.globalAlpha=.24;ctx.fillRect(s.x-w/2,s.y-h,w,h);ctx.globalAlpha=1;ctx.strokeStyle=p.light;ctx.strokeRect(s.x-w/2,s.y-h,w,h);ctx.fillStyle=p.pale;ctx.fillRect(s.x-w/2+4,s.y-h+5,2,12);
    }
    if(action==='wave'&&q<1){
      const handX=s.x+s.scale*10,handY=s.y-s.scale*12-(quiet?0:Math.sin(q*Math.PI*6)*4);
      ctx.fillStyle=p.light;ctx.fillRect(handX,handY,4,6);ctx.fillStyle=p.mid;ctx.fillRect(handX+7,handY-4,1,4);ctx.fillRect(handX+10,handY,3,1);
    }
    if(action==='sleep'){
      for(let i=0;i<3;i++)pixelText(ctx,'Z',s.x+19+i*11,s.y-34-i*12,p.ink);
    }
    if(action==='celebrate'){
      for(let i=0;i<25;i++){
        const x=15+seeded(this.seed+i*19)*290,y=quiet?26+i*23%103:24+(i*17+local*.018)%119;
        ctx.fillStyle=i%3?p.light:p.mid;ctx.fillRect(x,y,2,i%2+2);
      }
    }
    if(action==='reveal'){
      ctx.fillStyle=p.deep;const w=(1-ease(q))*160;ctx.fillRect(0,19,w,140);ctx.fillRect(320-w,19,w,140);
    }
    if(s.blackout>0){ctx.fillStyle=p.bg;ctx.globalAlpha=s.blackout;ctx.fillRect(0,0,320,182);ctx.globalAlpha=1;}
    // Keep labels below the stage, with clear roles when the cast is duplicated.
    const close=Math.abs(s.x-s.propX)<52;
    if(s.opacity>.2)actorLabel(ctx,s.kind,close?s.x-22:s.x,171,p);
    if(s.propOpacity>.2&&action!=='transform'&&s.layout!=='train')actorLabel(ctx,s.prop,close?s.propX+22:s.propX,171,p);
  }
}

export function drawTitle(canvas:HTMLCanvasElement,reducedMotion=false):()=>void {
  canvas.width=320;canvas.height=200;canvas.style.imageRendering='pixelated';
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return()=>{};
  ctx.imageSmoothingEnabled=false;let frame=0,disposed=false;const start=performance.now();
  const paint=(now:number)=>{
    titleFrame(ctx,(now-start)/1000,reducedMotion);
    const image=loadWorldImage('titleWorld');
    if(image){ctx.drawImage(image,0,0,320,200);const p=PALETTES.amber;actor(ctx,'hero',148,164,p,{scale:1.3});actor(ctx,'cat',177,166,p,{scale:.9});}
  };
  const tick=(now:number)=>{if(disposed)return;paint(now);if(!reducedMotion)frame=requestAnimationFrame(tick);};
  tick(start);const detachImage=onWorldImageReady('titleWorld',()=>{if(!disposed)paint(performance.now());});
  return()=>{disposed=true;cancelAnimationFrame(frame);detachImage();};
}
