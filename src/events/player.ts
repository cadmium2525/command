import type { Actor, GameEvent, InputSymbol, TimelineBeat } from '../data/types';
import { loadWorldImage, onWorldImageReady, resolveAsset } from '../assets/registry';
import { actor, background, bar, clamp, ease, hash, lerp, PALETTES, pixelText, seeded, titleFrame, type Palette } from './art';
import { Minigame } from './minigames';

export const SUPPORTED_ACTIONS = ['enter','rise','fall','bounce','spin','grow','shrink','mirror','rain','shake','explode','portal','chase','stack','dance','hide','spotlight','build','float','type','glitch','walk','jump','transform','celebrate','sleep','pull','swap','blackout','reveal','wave','freeze','orbit','fish','train'] as const;

export interface SceneOptions {
  reducedMotion:boolean;
  onBeat?:(beat:TimelineBeat,index:number)=>void;
  onProgress?:(progress:number,detail:string)=>void;
  onComplete:()=>void;
}

/** A disposable 320 × 200 scene. It owns exactly one animation frame and no listeners. */
export class ScenePlayer {
  private readonly ctx:CanvasRenderingContext2D;
  private readonly palette:Palette;
  private readonly seed:number;
  private readonly game?:Minigame;
  private frame=0;
  private disposed=false;
  private finished=false;
  private previous=0;
  private elapsed=0;
  private beatIndex=-1;
  private reportAt=-1;
  private paused=false;
  private pulse=0;
  private readonly timeline:TimelineBeat[];

  constructor(private readonly canvas:HTMLCanvasElement,private readonly event:GameEvent,private readonly options:SceneOptions){
    canvas.width=320;canvas.height=200;canvas.style.imageRendering='pixelated';
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('Canvas 2D を初期化できませんでした。');
    this.ctx=context;this.ctx.imageSmoothingEnabled=false;
    this.palette=PALETTES[event.palette]??PALETTES.amber;this.seed=hash(event.eventId);
    this.timeline=[...event.timeline].sort((a,b)=>a.at-b.at);
    // Validate through the centralized registry; code-art fallbacks always exist.
    event.assetIds.forEach(resolveAsset);
    if(event.mechanic)this.game=new Minigame(event.mechanic,this.seed);
    this.advanceBeats();this.draw();this.options.onProgress?.(0,this.game?.detail??this.timeline[0]?.text??event.title);
    this.frame=requestAnimationFrame(this.tick);
  }

  input(symbol:InputSymbol|'START'){
    if(this.disposed||this.finished||this.paused)return;
    this.pulse=this.elapsed;
    this.game?.input(symbol);
    if(this.game)this.options.onProgress?.(clamp(this.elapsed/this.event.durationMs,0,1),this.game.detail);
    this.draw();
  }

  pause(value=true){this.paused=value;this.previous=0;}

  setReducedMotion(value:boolean){this.options.reducedMotion=value;if(!this.disposed)this.draw();}

  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.frame=0;}

  private advanceBeats(){
    while(this.beatIndex+1<this.timeline.length&&this.timeline[this.beatIndex+1].at<=this.elapsed){this.beatIndex++;this.options.onBeat?.(this.timeline[this.beatIndex],this.beatIndex);}
  }

  private tick=(now:number)=>{
    if(this.disposed||this.finished)return;
    if(this.paused){this.previous=now;this.frame=requestAnimationFrame(this.tick);return;}
    const dt=this.previous?Math.min((now-this.previous)/1000,.1):0;this.previous=now;
    this.elapsed=Math.min(this.event.durationMs,this.elapsed+dt*1000);
    this.advanceBeats();
    this.game?.update(this.elapsed/1000,dt);
    if(this.elapsed>=this.event.durationMs)this.game?.finish();
    this.draw();
    if(this.elapsed-this.reportAt>=180||this.elapsed>=this.event.durationMs){this.reportAt=this.elapsed;this.options.onProgress?.(clamp(this.elapsed/this.event.durationMs,0,1),this.game?.detail??this.timeline[this.beatIndex]?.text??this.event.title);}
    if(this.elapsed>=this.event.durationMs){this.finished=true;this.frame=0;this.options.onComplete();return;}
    this.frame=requestAnimationFrame(this.tick);
  };

  private draw(){
    const ctx=this.ctx,p=this.palette,t=this.elapsed/1000;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
    background(ctx,p,t,this.options.reducedMotion,this.seed%17);
    const isTrueEnding=this.event.assetIds.includes('endingWorld')||/true[-_]?ending/i.test(this.event.sceneType)||/^true[-_]?ending$/i.test(this.event.eventId);
    const endingImage=isTrueEnding?loadWorldImage('endingWorld'):null;
    if(endingImage)ctx.drawImage(endingImage,0,0,320,200);
    if(this.game){this.game.draw(ctx,p,this.options.reducedMotion);bar(ctx,12,196,296,this.elapsed/this.event.durationMs,p);return;}
    const beat=this.timeline[this.beatIndex]??{at:0,text:this.event.title,action:'enter'};
    const next=this.timeline[this.beatIndex+1]?.at??this.event.durationMs;
    const q=clamp((this.elapsed-beat.at)/Math.max(1,next-beat.at),0,1);
    if(endingImage)this.drawEnding(beat,q,t);
    else this.drawScene(beat,q,(this.elapsed-beat.at)/1000,t);
    // Quiet index marks give every scene the feeling of a recovered cartridge.
    pixelText(ctx,'SECRET ARCHIVE',12,10,p.ink);pixelText(ctx,this.event.eventId.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(-12),307,10,p.ink,1,'right');
    bar(ctx,12,185,296,this.elapsed/this.event.durationMs,p);
    if(this.elapsed-this.pulse<250&&this.pulse>0){ctx.fillStyle=p.light;ctx.fillRect(306,172,2,2);}
  }

  private drawEnding(beat:TimelineBeat,q:number,time:number){
    const ctx=this.ctx,p=this.palette,quiet=this.options.reducedMotion;
    // Keep the generated world's central gateway visible. The cast gathers along its edge.
    const cast:Actor[]=['hero','cat','ghost','robot','plant','bird','slime','fish'];
    const positions=[37,65,92,116,207,231,257,283];
    const count=Math.min(cast.length,2+this.beatIndex);
    for(let i=0;i<count;i++)actor(ctx,cast[i],positions[i],179+(quiet?0:Math.sin(time*.8+i)*1.2),p,{scale:i===0?.95:.7,flip:i>3,pose:quiet?0:Math.floor(time*2)});
    actor(ctx,beat.prop??'star',274,58,p,{scale:.6});
    if(beat.action==='blackout'){
      ctx.fillStyle=p.bg;ctx.globalAlpha=lerp(.8,.12,ease(q));ctx.fillRect(0,22,320,156);ctx.globalAlpha=1;
    }
    if(beat.action==='celebrate'||beat.action==='wave'){
      for(let i=0;i<17;i++){const side=i%2===0?28:267;const x=side+seeded(i+this.seed)*27,y=35+(quiet?i*7%95:(i*23+time*12)%95);ctx.fillStyle=i%3?p.light:p.pale;ctx.fillRect(x,y,2,2);}
    }
    if(beat.action==='type')pixelText(ctx,'173 ENCOUNTERS. ONE WORLD.',160,27,p.pale,1,'center');
    if(beat.action==='rise')actor(ctx,'star',160,lerp(145,53,ease(q)),p,{scale:.5});
  }

  private drawScene(beat:TimelineBeat,q:number,local:number,time:number){
    const ctx=this.ctx,p=this.palette,quiet=this.options.reducedMotion;
    const who:Actor=beat.actor??this.event.actor,prop:Actor=beat.prop??this.event.prop;
    const action=beat.action;
    const a=ease(q),wave=quiet?0:Math.sin(local*5),slow=quiet?0:Math.sin(local*2);
    let x=160,y=150,scale=1.8,rotation=0,flip=false,opacity=1;
    let actorKind=who,propX=213,propY=151,showProp=true,propScale=1;
    const burst=(cx:number,cy:number,count:number,spread:number)=>{
      for(let i=0;i<count;i++){const angle=i/count*Math.PI*2+seeded(i+this.seed)*.5;const r=spread*(.25+seeded(i*31+this.seed)*.75);ctx.fillStyle=i%3?p.light:p.pale;ctx.fillRect(Math.round(cx+Math.cos(angle)*r),Math.round(cy+Math.sin(angle)*r),i%3===0?3:2,2);}
    };
    const portal=(cx:number,cy:number,size:number)=>{
      ctx.fillStyle=p.mid;ctx.fillRect(cx-size/3,cy-size,size*2/3,size*2);ctx.fillRect(cx-size/2,cy-size*.7,size,size*1.4);ctx.fillStyle=p.deep;ctx.fillRect(cx-size/3+3,cy-size+3,size*2/3-6,size*2-6);ctx.fillRect(cx-size/2+3,cy-size*.7+3,size-6,size*1.4-6);ctx.fillStyle=p.light;ctx.fillRect(cx-size/3,cy-size,3,size*.7);
    };
    switch(action){
      case 'enter':x=lerp(-30,150,a);propX=220;break;
      case 'rise':y=lerp(194,101,a);propY=lerp(165,142,a);break;
      case 'fall':y=lerp(40,151,Math.min(1,q*1.5));if(q>.7)y-=quiet?0:Math.abs(Math.sin((q-.7)*15))*7;break;
      case 'bounce':y-=Math.abs(quiet?Math.sin(q*Math.PI):Math.sin(local*4))*36;propY-=Math.abs(quiet?Math.sin(q*Math.PI):Math.sin(local*4+1.5))*22;break;
      case 'spin':rotation=quiet?0:local*2.6;scale=1.5;ctx.fillStyle=p.dark;ctx.fillRect(125,150,70,3);break;
      case 'grow':scale=lerp(.4,2.9,a);x=139;break;
      case 'shrink':scale=lerp(2.8,.5,a);x=139;break;
      case 'mirror': {
        ctx.fillStyle=p.mid;ctx.fillRect(179,57,3,98);ctx.fillStyle=p.deep;ctx.fillRect(182,57,70,98);x=137;showProp=false;actor(ctx,who,222,150,p,{scale:1.8,flip:true,opacity:.64});ctx.fillStyle=p.light;ctx.fillRect(179,57,73,2);break;
      }
      case 'rain':
        for(let i=0;i<13;i++){const px=13+seeded(this.seed+i*17)*294;const py=quiet?49+(i%4)*26:((local*43+i*37)%162)-10;actor(ctx,prop,px,py,p,{scale:.5,rotation:quiet?0:i*.4});}showProp=false;x=160;break;
      case 'shake':x+=quiet?0:Math.sin(local*35)*4;y+=quiet?0:Math.cos(local*29)*2;propX+=quiet?0:Math.sin(local*25)*6;break;
      case 'explode':
        burst(160,109,25,quiet?48:20+a*88);scale=lerp(2,.7,a);y=120+a*34;propY=90;propScale=.9;break;
      case 'portal':
        portal(75,112,29);portal(247,112,29);x=q<.5?lerp(118,75,q*2):lerp(247,210,(q-.5)*2);opacity=quiet?1:Math.abs(q-.5)*2;showProp=false;break;
      case 'chase':
        x=lerp(25,244,q);propX=x+48;propY=147-(quiet?0:Math.abs(Math.sin(local*8))*5);scale=1.3;propScale=.85;flip=false;break;
      case 'stack':
        x=99;for(let i=0;i<Math.min(5,Math.floor(q*5)+1);i++)actor(ctx,prop,208,151-i*20,p,{scale:1});showProp=false;break;
      case 'dance':
        x+=slow*15;rotation=quiet?0:wave*.15;propX=222-slow*8;propY=151-Math.abs(wave)*9;break;
      case 'hide':
        x=147;y=152;scale=1.4;showProp=false;actor(ctx,who,x,y,p,{scale,opacity:1});actor(ctx,'box',147,155,p,{scale:2});if(q>.6)actor(ctx,who,177,148,p,{scale:.8});return;
      case 'spotlight':
        ctx.fillStyle=p.bg;ctx.fillRect(0,23,320,132);ctx.fillStyle=p.deep;ctx.beginPath();ctx.moveTo(149,24);ctx.lineTo(81,154);ctx.lineTo(236,154);ctx.lineTo(171,24);ctx.fill();ctx.fillStyle=p.mid;ctx.fillRect(139,22,42,4);showProp=false;break;
      case 'build':
        x=87;for(let i=0;i<Math.min(12,Math.floor(q*12)+1);i++){const col=i%4,row=Math.floor(i/4);actor(ctx,'box',181+col*21,152-row*20,p,{scale:1});}showProp=false;break;
      case 'float':y=107+slow*8;propY=94-slow*9;ctx.fillStyle=p.dark;ctx.fillRect(125,155,70,2);break;
      case 'type':
        x=87;scale=1.3;showProp=false;ctx.fillStyle=p.dark;ctx.fillRect(121,64,171,65);ctx.fillStyle=p.bg;ctx.fillRect(125,68,163,57);pixelText(ctx,'> '+('HELLO, SECRET WORLD!').slice(0,Math.floor(q*21)),136,88,p.light);ctx.fillStyle=p.light;ctx.fillRect(136+Math.min(20,Math.floor(q*21))*6,104,4,2);break;
      case 'glitch':
        x=142;propX=220;
        for(let i=0;i<7;i++){ctx.fillStyle=i%2?p.dark:p.mid;ctx.fillRect(61+(i*29)%170,42+i*17,quiet?9:12+(Math.floor(local*9+i)%4)*8,1);}
        if(!quiet)x+=Math.floor(local*8)%3===0?3:0;break;
      case 'walk':x=lerp(55,245,q);scale=1.3;propX=260;break;
      case 'jump':x=lerp(74,230,q);y=151-Math.sin(q*Math.PI)*71;scale=1.4;propX=160;propY=154;propScale=1.4;break;
      case 'transform':
        actorKind=q<.5?who:prop;showProp=false;scale=1.9;burst(160,113,12,quiet?39:30+Math.sin(q*Math.PI)*15);break;
      case 'celebrate':
        for(let i=0;i<30;i++){const px=seeded(this.seed+i*19)*320,py=quiet?30+(i*23)%100:(i*31+local*(22+seeded(i)*20))%155;ctx.fillStyle=i%3?p.light:p.mid;ctx.fillRect(px,py,2,i%2+2);}y-=quiet?0:Math.abs(wave)*6;propY=115;break;
      case 'sleep':
        rotation=-Math.PI/2;scale=1.35;y=142;x=141;propX=208;actor(ctx,'moon',231,64,p,{scale:.7});for(let i=0;i<3;i++)pixelText(ctx,'Z',172+i*15,95-i*16,p.mid,1);break;
      case 'pull':
        x=lerp(113,85,a);propX=lerp(247,177,a);propScale=1.5;scale=1.4;flip=true;ctx.fillStyle=p.light;ctx.fillRect(x+7,134,propX-x,1);break;
      case 'swap':
        x=lerp(110,222,a);propX=lerp(222,110,a);y=151-Math.sin(q*Math.PI)*30;propY=151;scale=1.5;propScale=1.5;break;
      case 'blackout':
        x=137;opacity=.35;actor(ctx,who,x,y,p,{scale,opacity});actor(ctx,prop,220,151,p,{scale:1,opacity:.2});ctx.fillStyle=p.light;ctx.fillRect(x-7,123,3,3);ctx.fillRect(x+4,123,3,3);pixelText(ctx,'IS ANYONE THERE?',160,67,p.mid,1,'center');return;
      case 'reveal':
        x=137;actor(ctx,who,x,y,p,{scale});actor(ctx,prop,221,151,p);ctx.fillStyle=p.deep;ctx.fillRect(0,26,160*(1-a),129);ctx.fillRect(160+160*a,26,160*(1-a),129);ctx.fillStyle=p.mid;ctx.fillRect(160*(1-a)-2,26,2,129);ctx.fillRect(160+160*a,26,2,129);return;
      case 'wave':
        x=125;propX=226;for(let i=0;i<6;i++){const r=quiet?i*13+9:((local*28+i*13)%95)+9;ctx.strokeStyle=i%2?p.dark:p.mid;ctx.strokeRect(x-r,111-r/2,r*2,r);}break;
      case 'freeze':
        x=142;ctx.fillStyle=p.dark;ctx.fillRect(110,91,63,64);ctx.strokeStyle=p.ink;ctx.strokeRect(109.5,90.5,64,65);ctx.fillStyle=p.mid;ctx.fillRect(114,95,8,2);ctx.fillRect(114,97,2,20);ctx.fillRect(156,130,8,2);propX=231;break;
      case 'orbit':
        showProp=false;x=160;scale=1.5;for(let i=0;i<5;i++){const angle=(quiet?q*2:local*.8)+i*Math.PI*2/5;actor(ctx,prop,160+Math.cos(angle)*82,108+Math.sin(angle)*39,p,{scale:.65});}break;
      case 'fish':
        ctx.fillStyle=p.deep;ctx.fillRect(166,108,154,48);ctx.fillStyle=p.mid;for(let i=0;i<5;i++)ctx.fillRect(171+i*29,121+i%2*13,14,1);x=122;scale=1.3;propX=234+slow*20;propY=142;ctx.strokeStyle=p.light;ctx.beginPath();ctx.moveTo(132,126);ctx.lineTo(157,76);ctx.lineTo(231,119);ctx.stroke();break;
      case 'train':
        showProp=false;scale=1.1;x=lerp(20,139,a);for(let i=0;i<4;i++){const tx=x+i*38;ctx.fillStyle=p.mid;ctx.fillRect(tx-13,136,33,16);ctx.fillStyle=p.light;ctx.fillRect(tx-11,137,29,2);ctx.fillStyle=p.bg;ctx.fillRect(tx-6,141,6,6);ctx.fillRect(tx+5,141,6,6);ctx.fillStyle=p.dark;ctx.fillRect(tx-9,152,7,4);ctx.fillRect(tx+10,152,7,4);if(i>0)actor(ctx,prop,tx+4,137,p,{scale:.55});}y=136;ctx.fillStyle=p.ink;ctx.fillRect(0,157,320,1);break;
      default:x=145;y=151;
    }
    if(showProp)actor(ctx,prop,propX,propY,p,{scale:propScale,pose:Math.floor(time*3),flip:action==='chase'});
    actor(ctx,actorKind,x,y,p,{scale,rotation,flip,opacity,pose:quiet?0:Math.floor(local*(action==='walk'||action==='chase'?8:3))});
    if(action==='freeze'){ctx.globalAlpha=.3;ctx.fillStyle=p.ink;ctx.fillRect(110,91,63,64);ctx.globalAlpha=1;}
  }
}

export function drawTitle(canvas:HTMLCanvasElement,reducedMotion=false):()=>void {
  canvas.width=320;canvas.height=200;canvas.style.imageRendering='pixelated';
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return()=>{};
  ctx.imageSmoothingEnabled=false;let frame=0,disposed=false;const start=performance.now();
  const paint=(now:number)=>{
    titleFrame(ctx,(now-start)/1000,reducedMotion);
    const image=loadWorldImage('titleWorld');
    if(image){
      ctx.drawImage(image,0,0,320,200);const p=PALETTES.amber;
      // The accessible DOM overlay owns typography; code sprites inhabit its stage.
      actor(ctx,'hero',148,164,p,{scale:1.3});actor(ctx,'cat',177,166,p,{scale:.9});
    }
  };
  const tick=(now:number)=>{if(disposed)return;paint(now);if(!reducedMotion)frame=requestAnimationFrame(tick);};
  tick(start);
  const detachImage=onWorldImageReady('titleWorld',()=>{if(!disposed)paint(performance.now());});
  return()=>{disposed=true;cancelAnimationFrame(frame);detachImage();};
}
