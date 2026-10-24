import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS, TRUE_ENDING } from '../src/data/catalog';
import { ScenePlayer } from '../src/events/player';
import { PALETTES } from '../src/events/art';

function virtualBrowser(){
  const request=globalThis.requestAnimationFrame,cancel=globalThis.cancelAnimationFrame;
  let next=0,now=0;
  const frames=new Map<number,FrameRequestCallback>();
  const ctx=new Proxy({}, {
    get:(_target,name)=>name==='measureText'?(text:string)=>({width:text.length*6}):(...args:unknown[])=>{
      for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${String(name)} finite coordinate`);
      return {addColorStop:()=>{}};
    },
    set:(_target,_name,value)=>{if(typeof value==='number')assert.ok(Number.isFinite(value));return true;},
  });
  const canvas={width:0,height:0,style:{},dataset:{},getContext:()=>ctx} as unknown as HTMLCanvasElement;
  globalThis.requestAnimationFrame=callback=>{const id=++next;frames.set(id,callback);return id;};
  globalThis.cancelAnimationFrame=id=>{frames.delete(id);};
  return {canvas,pending:()=>frames.size,step:(ms=100)=>{now+=ms;const batch=[...frames.values()];frames.clear();for(const callback of batch)callback(now);},restore:()=>{globalThis.requestAnimationFrame=request;globalThis.cancelAnimationFrame=cancel;}};
}

test('all 173 sessions and the completion remix render, allow explicit finish, and freeze once',()=>{
  const browser=virtualBrowser();
  try{for(const [i,event] of [...EVENTS,TRUE_ENDING].entries()){
    assert.ok(PALETTES[event.palette]);let completed=0,reported=0;
    const scene=new ScenePlayer(browser.canvas,event,{reducedMotion:i%2===0,onProgress:p=>{assert.ok(p>=reported&&p<=1);reported=p;},onComplete:()=>{completed++;}});
    assert.equal(scene.snapshot.phase,'ready');scene.input('START');
    for(let frame=0;frame<60&&!scene.isComplete;frame++){
      if(frame%7===0)scene.input((['L','R','A','D','B','U'] as const)[frame%6]);
      browser.step();
    }
    if(!scene.isComplete)scene.reveal();
    assert.equal(completed,1,event.eventId);assert.equal(reported,1);assert.equal(browser.pending(),0);
    const result=scene.snapshot;scene.input('A');browser.step();assert.deepEqual(scene.snapshot,result);
    assert.equal(completed,1);scene.dispose();assert.equal(browser.pending(),0);
  }}finally{browser.restore();}
});

test('a modal pause stops preparation and simulation without losing the game',()=>{
  const browser=virtualBrowser();
  try{
    const scene=new ScenePlayer(browser.canvas,EVENTS[0],{reducedMotion:false,onComplete:()=>{}});
    scene.pause();const ready=scene.snapshot;for(let i=0;i<25;i++)browser.step();assert.deepEqual(scene.snapshot,ready);assert.equal(browser.pending(),0);
    scene.pause(false);scene.input('START');browser.step();browser.step();const playing=scene.snapshot;
    scene.pause();for(let i=0;i<25;i++)browser.step();assert.deepEqual(scene.snapshot,playing);
    scene.pause(false);assert.equal(browser.pending(),1);scene.dispose();assert.equal(browser.pending(),0);
  }finally{browser.restore();}
});

test('ending early produces a frozen result and cannot be used to seek the game clock',()=>{
  const browser=virtualBrowser();
  try{let completed=0;const scene=new ScenePlayer(browser.canvas,EVENTS[0],{reducedMotion:true,onComplete:()=>{completed++;}});
    scene.nextBeat();scene.previousBeat();assert.equal(scene.progress,0);scene.input('START');scene.reveal();
    assert.equal(scene.isComplete,true);assert.ok(scene.result);assert.equal(scene.progress,1);assert.equal(completed,1);assert.equal(browser.pending(),0);
    scene.reveal();scene.pause(false);browser.step();assert.equal(completed,1);assert.equal(browser.pending(),0);scene.dispose();
  }finally{browser.restore();}
});


test('an untimed scene stays playable past a minute and reports elapsed time rather than a deadline',()=>{
  const browser=virtualBrowser();
  try{const event=EVENTS.find(e=>e.game.family==='fishing'&&e.game.variant===1)!;
    assert.equal(event.durationMs,0);let completed=0;
    const scene=new ScenePlayer(browser.canvas,event,{reducedMotion:true,onComplete:()=>{completed++;}});
    scene.input('START');for(let i=0;i<620;i++)browser.step();
    assert.equal(scene.isComplete,false);assert.equal(completed,0);assert.equal(scene.progress,0);
    assert.ok(Number(browser.canvas.dataset.elapsed)>=60000);assert.equal(browser.canvas.dataset.playMode,'endless');
    scene.reveal();assert.equal(scene.result?.status,'stopped');assert.equal(completed,1);scene.dispose();
  }finally{browser.restore();}
});
