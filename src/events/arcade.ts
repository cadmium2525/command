import type { InputSymbol } from '../data/types';
import type { ArcadeDefinition, ArcadeEngine, ArcadeOutcome } from './arcade-types';
import { ARCADE_FAMILIES } from './arcade-types';
import { createPhysicalGame, PHYSICAL_DEFINITIONS } from './arcade-physical';
import { createSkillGame, SKILL_DEFINITIONS } from './arcade-skill';
import type { Palette } from './art';

export const ARCADE_DEFINITIONS = [...PHYSICAL_DEFINITIONS, ...SKILL_DEFINITIONS];
export const SUPPORTED_MECHANICS = ARCADE_FAMILIES;
export class ArcadeGame {
  readonly engine: ArcadeEngine;
  private elapsed = 0;
  private result: ArcadeOutcome|null = null;
  constructor(readonly definition: ArcadeDefinition, seed: number, readonly durationMs = definition.durationMs) {
    this.engine = PHYSICAL_DEFINITIONS.some(d => d.family === definition.family)
      ? createPhysicalGame(definition,seed) : createSkillGame(definition,seed);
  }
  get score(){return this.engine.score;}
  get outcome(){return this.result ?? this.engine.outcome;}
  get snapshot():Record<string,unknown>&{score:number;outcome:ArcadeOutcome|null}{return {...this.engine.snapshot, score:this.score, outcome:this.outcome};}
  input(key: InputSymbol){if(!this.outcome)this.engine.input(key);}
  update(dt:number){
    if(this.outcome)return;
    this.elapsed+=dt;
    this.engine.update(dt);
    if(!this.engine.outcome&&this.elapsed*1000>=this.durationMs)this.result={status:'time',reason:'制限時間に到達しました。'};
  }
  finish(){if(!this.outcome)this.result={status:'time',reason:'ここまでの記録です。'};}
  draw(ctx:CanvasRenderingContext2D,palette:Palette,reducedMotion:boolean){this.engine.draw(ctx,palette,reducedMotion);}
}
