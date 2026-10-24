import { SYMBOLS, type CommandEntry, type GameEvent } from './types';
import { PHYSICAL_DEFINITIONS } from '../events/arcade-physical';
import { SKILL_DEFINITIONS } from '../events/arcade-skill';
import type { ArcadeDefinition } from '../events/arcade-types';

/** The engine owns every title, rule, control scheme and time limit. */
export const ARCADE_DEFINITIONS: readonly ArcadeDefinition[] = [...PHYSICAL_DEFINITIONS, ...SKILL_DEFINITIONS];

/** Old identifiers remain addresses for existing saves, not content categories. */
const legacyGroups = [['remix', 90], ['gag', 45], ['story', 20], ['minigame', 13], ['ending', 5]] as const;
const legacyEventIds = legacyGroups.flatMap(([prefix, count]) => Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`));

/** Keep the original permutation and reserved addresses byte-for-byte compatible. */
const allCommands = SYMBOLS.flatMap(a => SYMBOLS.flatMap(b => SYMBOLS.map(c => `${a}${b}${c}`)));
const commandRank = (command: string) => (allCommands.indexOf(command) * 137 + 59) % 216;
const reserved = new Map<string, string>([
  ['remix-001', 'UUU'], ['remix-002', 'AAA'], ['story-001', 'DDD'], ['ending-001', 'BBB'],
]);
const availableCommands = allCommands.filter(command => ![...reserved.values()].includes(command)).sort((a, b) => commandRank(a) - commandRank(b));
const palettes = ['midnight', 'ocean', 'forest', 'rose', 'amber', 'void'] as const;
let nextCommand = 0;

function makeArcadeEvent(eventId: string, command: string, game: ArcadeDefinition, index: number): GameEvent {
  return {
    eventId,
    command,
    title: game.title,
    category: 'minigame',
    durationClass: 'minigame',
    durationMs: game.durationMs,
    sceneType: `arcade-${game.family}`,
    timeline: [{ at: 0, action: 'play', text: `${game.rule} ${game.controls}` }],
    assetIds: ['world'],
    skippable: true,
    tags: ['arcade', game.family, `variant-${game.variant + 1}`],
    palette: palettes[index % palettes.length],
    actor: 'hero',
    prop: 'star',
    mechanic: game.family,
    game,
  };
}

if (ARCADE_DEFINITIONS.length !== legacyEventIds.length || ARCADE_DEFINITIONS.length !== 173) {
  throw new Error(`SECRET START requires 173 authored arcade definitions, received ${ARCADE_DEFINITIONS.length}`);
}

export const EVENTS: GameEvent[] = legacyEventIds.map((eventId, index) => makeArcadeEvent(
  eventId,
  reserved.get(eventId) ?? availableCommands[nextCommand++],
  ARCADE_DEFINITIONS[index],
  index,
));
export const EVENT_BY_ID = new Map<string, GameEvent>(EVENTS.map(event => [event.eventId, event]));
export const EVENT_BY_COMMAND = new Map<string, GameEvent>(EVENTS.map(event => [event.command, event]));
export const COMMANDS: CommandEntry[] = allCommands.map(command => ({ command, eventId: EVENT_BY_COMMAND.get(command)?.eventId ?? null }));

/** A short playable completion bonus; it never consumes a collection address. */
const completionGame = SKILL_DEFINITIONS.find(game => game.family === 'reaction' && game.variant === 0);
if (!completionGame) throw new Error('SECRET START completion bonus requires reaction variant 0');
export const TRUE_ENDING: GameEvent = {
  ...makeArcadeEvent('true-ending', '', completionGame, 0),
  title: '173のひみつ、全部見つけた！',
  tags: ['completion', 'true-ending', 'reaction'],
};

if (EVENTS.length !== 173 || COMMANDS.length !== 216 || EVENT_BY_COMMAND.size !== 173 || COMMANDS.filter(entry => entry.eventId === null).length !== 43) {
  throw new Error('SECRET START catalogue integrity check failed');
}
