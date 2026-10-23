import type { Actor, InputSymbol } from '../data/types';

export interface Palette { bg: string; deep: string; dark: string; mid: string; ink: string; light: string; pale: string; accent: string }
export const PALETTES: Record<string, Palette> = {
  midnight: { bg:'#0d1423', deep:'#111e30', dark:'#20304a', mid:'#46617c', ink:'#7898ad', light:'#cfb78d', pale:'#fff0c1', accent:'#e9a961' },
  ocean: { bg:'#091c25', deep:'#0e2935', dark:'#164451', mid:'#296879', ink:'#65a4a5', light:'#a9d5ba', pale:'#e4f0c8', accent:'#e8ba71' },
  forest: { bg:'#101b19', deep:'#182b26', dark:'#274238', mid:'#486453', ink:'#86a172', light:'#c3c98c', pale:'#f4e6b4', accent:'#e5a567' },
  rose: { bg:'#211322', deep:'#311c30', dark:'#523146', mid:'#80516a', ink:'#b87d8b', light:'#e5b2a7', pale:'#ffe0b3', accent:'#e9ac70' },
  amber: { bg:'#15110e', deep:'#211910', dark:'#3a2919', mid:'#6c4c2d', ink:'#a47543', light:'#e2aa62', pale:'#ffe1a0', accent:'#f2c67b' },
  void: { bg:'#10101b', deep:'#181729', dark:'#2c2845', mid:'#51496e', ink:'#8c77a7', light:'#c8acd0', pale:'#f1dacf', accent:'#f1bb75' },
};

const glyphs: Record<string,string> = {
  A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01111100001000010000100001000001111',D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',G:'01111100001000010111100011000101111',H:'10001100011000111111100011000110001',I:'11111001000010000100001000010011111',J:'00111000100001000010100101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',M:'10001110111010110101100011000110001',N:'10001110011010110011100011000110001',O:'01110100011000110001100011000101110',P:'11110100011000111110100001000010000',Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110',V:'10001100011000110001100010101000100',W:'10001100011000110101101011010101010',X:'10001100010101000100010101000110001',Y:'10001100010101000100001000010000100',Z:'11111000010001000100010001000011111',
  '0':'01110100011001110101110011000101110','1':'00100011000010000100001000010001110','2':'01110100010000100010001000100011111','3':'11110000010000101110000010000111110','4':'00010001100101010010111110001000010','5':'11111100001000011110000010000111110','6':'01110100001000011110100011000101110','7':'11111000010001000100010000100001000','8':'01110100011000101110100011000101110','9':'01110100011000101111000010000101110',
  ':':'00000001000010000000001000010000000','.':'00000000000000000000000000010000100','-':'00000000000000011111000000000000000','/':'00001000100001000100010000100010000','!':'00100001000010000100001000000000100','?':'01110100010000100010001000000000100','+':'00000001000010011111001000010000000','>':'10000010000010000010001000100010000','<':'00001000100010001000001000001000001','=':'00000000001111100000111110000000000','^':'00100010101000100000000000000000000',
};

export function pixelText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,color:string,scale=1,align:'left'|'center'|'right'='left') {
  const width=Math.max(0,text.length*6-1)*scale;
  const start=Math.round(x-(align==='center'?width/2:align==='right'?width:0));
  ctx.fillStyle=color;
  [...text.toUpperCase()].forEach((char,i)=>{ const bits=glyphs[char]; if(!bits)return; for(let j=0;j<35;j++)if(bits[j]==='1')ctx.fillRect(start+(i*6+j%5)*scale,Math.round(y)+Math.floor(j/5)*scale,scale,scale); });
}

export function symbol(ctx:CanvasRenderingContext2D,value:InputSymbol,x:number,y:number,color:string,size=1) {
  if(value==='A'||value==='B'){pixelText(ctx,value,x,y,color,size,'center');return;}
  ctx.save();ctx.translate(Math.round(x),Math.round(y+3*size));
  ctx.rotate(({U:0,R:Math.PI/2,D:Math.PI,L:-Math.PI/2} as const)[value]);
  ctx.fillStyle=color;ctx.fillRect(-size,-3*size,2*size,7*size);ctx.fillRect(-3*size,-size,6*size,size);ctx.fillRect(-2*size,-2*size,4*size,size);ctx.restore();
}

export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export const ease=(t:number)=>1-(1-clamp(t,0,1))**3;
export function hash(text:string) { let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0; }
export function seeded(n:number) { n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967295; }

export function background(ctx:CanvasRenderingContext2D,p:Palette,time:number,reduced=false,variant=0) {
  ctx.fillStyle=p.bg;ctx.fillRect(0,0,320,200);
  for(let i=0;i<55;i++){
    const x=Math.floor(seeded(i*23+82)*320),y=Math.floor(seeded(i*71+7)*120);
    const faint=(i%4===0 && !reduced)?Math.sin(time*.65+i)*.2+.7:.65;
    ctx.globalAlpha=faint;ctx.fillStyle=i%6===0?p.light:p.mid;ctx.fillRect(x,y,i%13===0?2:1,1);
    if(i%13===0)ctx.fillRect(x,y-1,1,3);
  }
  ctx.globalAlpha=1;
  // The observatory moon and its engraved shadow.
  ctx.fillStyle=p.dark;ctx.fillRect(247,27,24,26);ctx.fillRect(242,32,34,16);ctx.fillRect(250,23,17,34);
  ctx.fillStyle=p.mid;ctx.fillRect(247,27,18,24);ctx.fillRect(244,32,24,14);
  ctx.fillStyle=p.dark;ctx.fillRect(260,27,10,24);ctx.fillRect(249,34,4,3);ctx.fillRect(253,44,5,2);
  ctx.fillStyle=p.deep;
  for(let i=0;i<17;i++){const h=10+Math.floor(seeded(i+variant*13)*35);ctx.fillRect(i*21-4,145-h,19,h);if(i%3===0)ctx.fillRect(i*21+3,137-h,5,8);}
  ctx.fillStyle=p.dark;
  for(let i=0;i<18;i++){const h=8+Math.floor(seeded(i*7+19)*26);ctx.fillRect(i*19-5,154-h,16,h);ctx.fillStyle=p.mid;for(let j=0;j<Math.floor(h/7);j++)if((i+j)%3===0)ctx.fillRect(i*19,151-h+j*7,2,2);ctx.fillStyle=p.dark;}
  ctx.fillStyle=p.deep;ctx.fillRect(0,154,320,46);ctx.fillStyle=p.mid;ctx.fillRect(0,154,320,1);ctx.fillStyle=p.dark;ctx.fillRect(0,156,320,2);
  for(let i=0;i<33;i++){ctx.fillStyle=i%3?p.dark:p.mid;ctx.fillRect(Math.floor(seeded(i*31+3)*320),160+Math.floor(seeded(i*47)*34),i%3+1,1);}
  // Perspective floor and brass corner markings.
  ctx.fillStyle=p.dark;for(let y=169;y<200;y+=12)ctx.fillRect(0,y,320,1);
  ctx.fillStyle=p.mid;ctx.fillRect(8,185,1,7);ctx.fillRect(8,191,7,1);ctx.fillRect(311,185,1,7);ctx.fillRect(305,191,7,1);
}

export const ACTOR_NAMES: Record<Actor, string> = {
  hero: '主人公', cat: '猫', ghost: 'おばけ', robot: 'ロボット', slime: 'スライム',
  bird: '鳥', star: '星', moon: '月', fish: '魚', box: '箱', title: '看板',
  crown: '王冠', plant: '植木', cake: 'ケーキ',
};

/** Small, readable labels connect the concrete sprites to the Japanese narration. */
export function actorLabel(ctx:CanvasRenderingContext2D,kind:Actor,x:number,y:number,p:Palette) {
  const label=ACTOR_NAMES[kind],width=label.length*10+10;
  const left=clamp(Math.round(x-width/2),3,317-width);
  ctx.save();ctx.fillStyle=p.bg;ctx.globalAlpha=.9;ctx.fillRect(left,y-10,width,14);
  ctx.globalAlpha=1;ctx.fillStyle=p.pale;ctx.font='10px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(label,left+width/2,y-8);ctx.restore();
}

/** The console prints the actual caption instead of unrelated English filler. */
export function captionText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,p:Palette,columns=15,lines=3) {
  ctx.save();ctx.font='10px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=p.pale;
  const characters=[...text];
  for(let row=0;row<lines;row++)ctx.fillText(characters.slice(row*columns,(row+1)*columns).join(''),x,y+row*14);
  ctx.restore();
}

type ActorOptions={scale?:number;flip?:boolean;rotation?:number;opacity?:number;pose?:number;tint?:string;signText?:string};
export function actor(ctx:CanvasRenderingContext2D,kind:Actor,x:number,y:number,p:Palette,options:ActorOptions={}) {
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale((options.flip?-1:1)*(options.scale??1),options.scale??1);ctx.rotate(options.rotation??0);ctx.globalAlpha=options.opacity??1;
  const dark=p.dark,mid=p.mid,light=options.tint??p.light,pale=p.pale,ink=p.bg;
  const box=(a:number,b:number,w:number,h:number,color=light)=>{ctx.fillStyle=color;ctx.fillRect(a,b,w,h);};
  const eye=(a:number,b:number)=>{box(a,b,2,2,pale);};
  switch(kind){
    case 'hero': {
      box(-7,-22,14,2,mid);box(-9,-20,18,14,mid);box(-7,-22,14,15,light);box(-10,-17,2,8,dark);box(8,-17,2,8,dark);
      box(-6,-19,12,8,ink);box(-5,-18,10,2,dark);eye(-4,-16);eye(2,-16);box(-2,-12,4,1,mid);
      box(-6,-7,12,5,light);box(-3,-7,6,3,mid);box(-9,-7,3,4,mid);box(6,-7,3,4,mid);box(-4,-6,2,2,pale);
      const walk=(options.pose??0)%2;box(-6,-2,5,2+(walk?0:1),dark);box(1,-2,5,2+(walk?1:0),dark);box(-9,-10,3,3,light);break;
    }
    case 'cat': box(-7,-13,14,9);box(-8,-20,4,8);box(4,-20,4,8);box(-6,-17,12,5);box(-6,-3,4,3,mid);box(3,-3,4,3,mid);box(7,-9,5,3,mid);box(10,-13,3,5,mid);eye(-4,-12);eye(2,-12);box(-1,-8,2,1,ink);box(-11,-9,4,1,mid);box(7,-9,4,1,mid);break;
    case 'ghost': box(-5,-22,10,2);box(-8,-20,16,17);box(-10,-16,20,10);box(-8,-4,4,4);box(-2,-4,4,3);box(4,-4,4,4);box(-5,-15,3,5,ink);box(3,-15,3,5,ink);box(-2,-7,4,2,mid);break;
    case 'robot': box(-7,-21,14,13,mid);box(-5,-23,10,2,light);box(-1,-27,2,5,mid);box(-2,-28,4,2,light);box(-5,-18,10,5,ink);eye(-4,-17);eye(2,-17);box(-6,-7,12,5,mid);box(-4,-6,8,2,light);box(-10,-7,3,5);box(7,-7,3,5);box(-5,-2,3,2);box(2,-2,3,2);break;
    case 'slime': box(-6,-13,12,3);box(-9,-10,18,8);box(-11,-6,22,4);box(-8,-2,16,2,mid);box(-6,-10,3,2,pale);box(-4,-7,2,2,ink);box(3,-7,2,2,ink);box(-1,-3,3,1,ink);break;
    case 'bird': box(-5,-13,12,8);box(-8,-9,14,6);box(7,-10,5,3,pale);box(-11,-9,5,3,mid);box(-5,-6,8,3,mid);box(-4,-2,2,2);box(2,-2,2,2);box(4,-12,2,2,ink);if((options.pose??0)%2)box(-6,-18,5,7,mid);break;
    case 'star': box(-2,-20,4,17);box(-8,-14,16,6);box(-6,-17,12,9);box(-8,-5,5,3);box(3,-5,5,3);box(-4,-13,2,2,pale);box(1,-12,2,2,ink);box(-3,-12,2,2,ink);break;
    case 'moon':box(-5,-23,12,2);box(-9,-21,17,17);box(-5,-4,12,2);box(-11,-16,21,8);box(0,-23,11,18,ink);box(-2,-13,3,3,mid);break;
    case 'fish':box(-8,-14,15,9);box(-11,-11,21,4);box(-13,-16,4,13,mid);box(-7,-17,7,3,mid);box(-7,-5,7,3,mid);box(5,-12,2,2,ink);box(-4,-12,3,3,pale);break;
    case 'box':box(-10,-21,20,21,dark);box(-9,-20,18,18,mid);box(-9,-20,18,3,light);box(-1,-20,3,18,light);box(-8,-15,5,1,dark);box(5,-9,2,5,dark);break;
    case 'title':box(-25,-19,50,17,dark);box(-24,-18,48,15,light);box(-21,-15,42,9,ink);ctx.fillStyle=pale;ctx.font='9px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(options.signText??'ひみつ',0,-15);break;
    case 'crown':box(-11,-18,4,14);box(-3,-16,6,12);box(7,-18,4,14);box(-10,-10,20,8);box(-9,-4,18,3,mid);box(-1,-8,3,3,pale);break;
    case 'plant':box(-6,-8,12,8,mid);box(-8,-10,16,3,light);box(-1,-23,2,14,mid);box(-9,-22,8,6);box(1,-27,8,7);box(-7,-26,6,5,mid);box(2,-21,7,4,mid);break;
    case 'cake':box(-11,-15,22,14,mid);box(-12,-17,24,6,pale);box(-10,-12,20,4,light);box(-9,-3,18,2,dark);box(-1,-24,2,7,light);box(-2,-27,4,3,pale);box(-9,-13,2,3,pale);box(4,-13,2,4,pale);break;
  }
  ctx.restore();
}

export function panel(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,p:Palette) {
  ctx.fillStyle=p.bg;ctx.fillRect(x,y,w,h);ctx.fillStyle=p.mid;ctx.fillRect(x,y,w,1);ctx.fillRect(x,y+h-1,w,1);ctx.fillRect(x,y,1,h);ctx.fillRect(x+w-1,y,1,h);
}
export function bar(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,progress:number,p:Palette) {
  ctx.fillStyle=p.dark;ctx.fillRect(x,y,w,4);ctx.fillStyle=p.light;ctx.fillRect(x,y,Math.round(w*clamp(progress,0,1)),3);
}

export function titleFrame(ctx:CanvasRenderingContext2D,time:number,reduced:boolean) {
  const p=PALETTES.amber;background(ctx,p,time,reduced,3);
  // A long, quiet shooting star and the illuminated secret observatory.
  if(!reduced){const x=(time*7)%420-50;ctx.fillStyle=p.mid;ctx.fillRect(Math.round(x),36,9,1);ctx.fillStyle=p.light;ctx.fillRect(Math.round(x+9),35,2,2);}
  ctx.fillStyle=p.dark;ctx.fillRect(22,92,55,62);ctx.fillRect(27,83,45,10);ctx.fillStyle=p.mid;ctx.fillRect(31,88,37,2);ctx.fillStyle=p.bg;ctx.fillRect(40,104,20,28);ctx.fillStyle=p.light;ctx.fillRect(43,108,14,1);ctx.fillRect(49,108,1,20);ctx.fillRect(43,118,14,1);ctx.fillStyle=p.mid;ctx.fillRect(30,142,38,3);
  ctx.fillStyle=p.mid;ctx.fillRect(270,114,3,40);ctx.fillRect(260,113,22,3);ctx.fillStyle=p.light;ctx.fillRect(266,118,11,5);ctx.fillStyle=p.deep;ctx.fillRect(268,120,7,3);
  // The accessible DOM overlay owns title typography.
  const bob=reduced?0:Math.sin(time*1.5)*1.6;
  actor(ctx,'hero',150,164+bob,p,{scale:1.25});actor(ctx,'cat',178,165,p,{pose:Math.floor(time)});
  actor(ctx,'star',204,143+(reduced?0:Math.sin(time+1)*3),p,{scale:.55});
  ctx.fillStyle=p.mid;ctx.fillRect(127,166,70,2);ctx.fillStyle=p.dark;ctx.fillRect(132,169,60,2);
}
