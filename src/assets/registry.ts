import type { Actor } from '../data/types';

/** Procedural artwork and optional original generated landscapes share one inventory. */
const basePath = import.meta.env?.BASE_URL ?? '/';
export const ASSET_PATHS = {
  cartridgeLabel: `${basePath}assets/cartridge-label.svg`,
  titleWorld: `${basePath}assets/title-world.webp`,
  endingWorld: `${basePath}assets/ending-world.webp`,
} as const;

export interface AssetRecord {
  id: string;
  path: string | null;
  kind: 'procedural' | 'svg' | 'generated-raster';
  license: 'CC0-1.0' | 'OpenAI-output';
  author: string;
  status: 'ready';
  replacementSlot: string;
}

const actors: Actor[] = ['hero', 'cat', 'ghost', 'robot', 'slime', 'bird', 'star', 'moon', 'fish', 'box', 'title', 'crown', 'plant', 'cake'];
export const ASSET_REGISTRY: Readonly<Record<string, AssetRecord>> = Object.freeze(Object.fromEntries([
  ...actors.map(id => [id, { id, path: null, kind: 'procedural', license: 'CC0-1.0', author: 'SECRET START original code artwork', status: 'ready', replacementSlot: `actor:${id}; 24 × 24 logical pixels, bottom-center origin` }]),
  ['world', { id: 'world', path: null, kind: 'procedural', license: 'CC0-1.0', author: 'SECRET START original code artwork', status: 'ready', replacementSlot: 'background; 320 × 200 logical pixels' }],
  ['cartridge-label', { id: 'cartridge-label', path: ASSET_PATHS.cartridgeLabel, kind: 'svg', license: 'CC0-1.0', author: 'SECRET START original vector artwork', status: 'ready', replacementSlot: 'optional decorative cartridge emblem; 96 × 96 pixels' }],
  ['titleWorld', { id: 'titleWorld', path: ASSET_PATHS.titleWorld, kind: 'generated-raster', license: 'OpenAI-output', author: 'Original image generated for SECRET START with built-in image_gen', status: 'ready', replacementSlot: 'title landscape; 320 × 200 display pixels; procedural fallback available' }],
  ['endingWorld', { id: 'endingWorld', path: ASSET_PATHS.endingWorld, kind: 'generated-raster', license: 'OpenAI-output', author: 'Original image generated for SECRET START with built-in image_gen', status: 'ready', replacementSlot: 'true-ending landscape; 320 × 200 display pixels; procedural fallback available' }],
] as [string, AssetRecord][]));

/** Unknown IDs intentionally resolve to the built-in hero instead of a broken image. */
export const resolveAsset = (id: string): AssetRecord => ASSET_REGISTRY[id] ?? ASSET_REGISTRY.hero;

const imageCache=new Map<string,HTMLImageElement>();
/** Optional art is never needed for progression. Failed loads keep code art visible. */
export function loadWorldImage(id:'titleWorld'|'endingWorld'):HTMLImageElement|null {
  if(typeof Image==='undefined')return null;
  let img=imageCache.get(id);
  if(!img){img=new Image();img.decoding='async';img.src=ASSET_PATHS[id];imageCache.set(id,img);}
  return img.complete&&img.naturalWidth>0?img:null;
}

export function onWorldImageReady(id:'titleWorld'|'endingWorld',callback:()=>void):()=>void {
  loadWorldImage(id);const img=imageCache.get(id);if(!img||img.complete)return()=>{};
  img.addEventListener('load',callback,{once:true});
  return()=>img.removeEventListener('load',callback);
}
