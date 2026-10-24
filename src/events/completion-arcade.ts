import type { InputSymbol } from '../data/types';
import { clamp, pixelText, type Palette } from './art';
import { createPhysicalGame, PHYSICAL_DEFINITIONS } from './arcade-physical';
import { FAMILY_LABELS, type ArcadeDefinition, type ArcadeEngine, type ArcadeFamily, type ArcadeOutcome } from './arcade-types';

/** A reward outside the 173 collectible cartridge addresses. */
export const COMPLETION_DEFINITION: ArcadeDefinition = {
  family: 'invaders',
  variant: 173,
  title: '173の先のアーケード',
  rule: '全173種類、発見おめでとう！ 5つのゲームを交代で遊ぶボーナス。共通ライフ3で、何周できるか挑戦しよう。',
  controls: '方向キーとA/B。交代すると操作も変わります。画面の案内を確認しよう。',
  playMode: 'endless',
  durationMs: 0,
};

export const COMPLETION_FAMILIES = ['blocks', 'invaders', 'snake', 'breakout', 'runner'] as const;
const CARTRIDGES: readonly ArcadeDefinition[] = COMPLETION_FAMILIES.map(family => {
  const definition = PHYSICAL_DEFINITIONS.find(game => game.family === family && game.variant === 0);
  if (!definition) throw new Error(`Completion remix requires the basic ${family} cartridge`);
  return definition;
});
const SHORT_CONTROLS: Partial<Record<ArcadeFamily, string>> = {
  blocks: 'L/R MOVE   A ROTATE   B DROP',
  invaders: 'L/R MOVE   A SHOOT   B SHIELD',
  snake: 'ARROWS TURN   A STEP   B SLOW',
  breakout: 'L/R MOVE   A SERVE   B SLOW',
  runner: 'UP/A JUMP   DOWN/B DUCK',
};
type EngineFactory = (definition: ArcadeDefinition, seed: number) => ArcadeEngine;

/** Five real engines share score and lives; a section clock only changes the game. */
export class CompletionArcade implements ArcadeEngine {
  outcome: ArcadeOutcome | null = null;
  private engine: ArcadeEngine;
  private round = 0;
  private lives = 3;
  private bankedScore = 0;
  private sectionTime = 0;
  private totalTime = 0;
  private readyTime = 0;
  private phase: 'playing' | 'ready' | 'result' = 'playing';
  private previousLives: number | null = null;
  private transitionMessage = '';
  private lastSection: { family: ArcadeFamily; score: number; reason: string } | null = null;

  constructor(private readonly seed: number, private readonly engineFactory: EngineFactory = createPhysicalGame) {
    this.engine = this.engineFactory(this.definition, seed);
    this.previousLives = this.readEngineLives();
  }

  private get definition() { return CARTRIDGES[this.round % CARTRIDGES.length]; }
  private get cycle() { return Math.floor(this.round / CARTRIDGES.length); }
  private get speed() { return 1 + Math.min(1, this.cycle * .1); }
  private get sectionDuration() { return Math.max(8, 14 - this.cycle * .75); }
  get score() { return this.bankedScore + Math.max(0, Math.floor(this.engine.score)); }

  get instruction(): string {
    if (this.outcome) return `共通ライフがなくなりました。${this.round + 1}ゲーム目まで到達。SCORE ${this.score}`;
    const game = this.definition;
    const shared = `共通ライフ ${this.lives} / ${this.cycle + 1}周目`;
    if (this.phase === 'ready') return `${this.transitionMessage}　次は${FAMILY_LABELS[game.family]}。${game.controls}　準備後はAで開始できます。${shared}`;
    return `${FAMILY_LABELS[game.family]}：${game.rule}　${game.controls}　交代まで${Math.ceil(Math.max(0, this.sectionDuration - this.sectionTime))}秒。${shared}`;
  }

  input(key: InputSymbol): void {
    if (this.outcome) return;
    if (this.phase === 'ready') {
      // Give the changed controls time to appear before a held fire button resumes play.
      if (key === 'A' && this.readyTime >= .65) this.startSection();
      return;
    }
    this.engine.input(key);
    this.checkSectionResult();
  }

  update(dt: number): void {
    if (this.outcome) return;
    let remaining = Math.max(0, Math.min(1, dt));
    while (remaining > 1e-9 && !this.outcome) {
      const step = Math.min(remaining, 1 / 120);
      remaining -= step;
      this.totalTime += step;
      if (this.phase === 'ready') {
        this.readyTime += step;
        if (this.readyTime >= 2) this.startSection();
        continue;
      }
      this.sectionTime += step;
      this.engine.update(step * this.speed);
      this.checkSectionResult();
      if (this.phase === 'playing' && this.sectionTime >= this.sectionDuration) this.nextSection('交代時間まで生き残った！', 10);
    }
  }

  private readEngineLives(): number | null {
    const value = this.engine.snapshot.lives;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private checkSectionResult(): void {
    const lives = this.readEngineLives(), lostLife = this.previousLives !== null && lives !== null && lives < this.previousLives;
    this.previousLives = lives;
    const result = this.engine.outcome;
    if (lostLife || result?.status === 'lose') {
      this.lives--;
      if (this.lives === 0) {
        this.phase = 'result';
        this.outcome = { status: 'lose', reason: `${this.round + 1}ゲームをつないだ！ 共通ライフを使い切りました。` };
      } else this.nextSection(`ミス！ 共通ライフはあと${this.lives}。`, 0);
    } else if (result?.status === 'win') this.nextSection('クリア！ ボーナス50点。', 50);
    else if (result?.status === 'time' || result?.status === 'stopped') this.nextSection('次のゲームへ交代！', 10);
  }

  private nextSection(reason: string, bonus: number): void {
    this.lastSection = { family: this.definition.family, score: Math.max(0, Math.floor(this.engine.score)), reason };
    this.bankedScore += this.lastSection.score + bonus;
    this.round++;
    this.sectionTime = 0;
    this.readyTime = 0;
    this.phase = 'ready';
    this.transitionMessage = reason;
    this.engine = this.engineFactory(this.definition, this.seed + this.round * 997);
    this.previousLives = this.readEngineLives();
  }

  private startSection(): void { this.phase = 'playing'; this.readyTime = 0; }

  draw(ctx: CanvasRenderingContext2D, palette: Palette, reducedMotion: boolean): void {
    this.engine.draw(ctx, palette, reducedMotion);
    // One shared HUD replaces the per-cartridge score and lives. The player owns the central elapsed clock.
    ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, 320, 28);
    pixelText(ctx, `SCORE ${this.score}`, 8, 6, palette.pale);
    pixelText(ctx, `LIFE ${this.lives}`, 310, 6, palette.pale, 1, 'right');
    pixelText(ctx, `${this.round + 1} ${this.definition.family.toUpperCase()}`, 8, 20, palette.light);
    pixelText(ctx, `X${this.speed.toFixed(1)}`, 173, 20, palette.ink, 1, 'center');
    pixelText(ctx, `${Math.ceil(Math.max(0, this.sectionDuration - this.sectionTime))}S`, 310, 20, palette.light, 1, 'right');
    if (this.phase === 'ready') {
      ctx.fillStyle = '#080e12e8'; ctx.fillRect(13, 43, 294, 125);
      pixelText(ctx, this.transitionMessage.startsWith('ミス') ? 'ONE LIFE LOST' : 'NICE PLAY!', 160, 55, palette.light, 1, 'center');
      pixelText(ctx, `NEXT: ${this.definition.family.toUpperCase()}`, 160, 76, palette.pale, 2, 'center');
      pixelText(ctx, SHORT_CONTROLS[this.definition.family] ?? '', 160, 105, palette.light, 1, 'center');
      pixelText(ctx, 'READY... A TO START', 160, 128, palette.pale, 1, 'center');
      ctx.fillStyle = palette.dark; ctx.fillRect(55, 149, 210, 3);
      ctx.fillStyle = palette.light; ctx.fillRect(55, 149, 210 * clamp(this.readyTime / 2, 0, 1), 3);
    }
  }

  get snapshot(): Record<string, unknown> {
    return {
      family: 'completion-remix', phase: this.phase, activeFamily: this.definition.family, round: this.round,
      cycle: this.cycle, lives: this.lives, score: this.score, speed: this.speed, sectionTime: this.sectionTime,
      sectionDuration: this.sectionDuration, totalTime: this.totalTime, readyTime: this.readyTime,
      lastSection: this.lastSection ? { ...this.lastSection } : null, engine: this.engine.snapshot,
      instruction: this.instruction, outcome: this.outcome,
    };
  }
}

export const createCompletionGame = (seed: number): ArcadeEngine => new CompletionArcade(seed);
