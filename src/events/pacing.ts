import type { GameEvent, TimelineBeat } from '../data/types';

/** Leave enough time for a complete Japanese caption, including a short pause. */
export function readingDuration(text: string): number {
  const characters = [...text.replace(/\s/g, '')].length;
  return Math.max(3000, Math.min(10000, 1000 + characters * 110));
}

export interface PlaybackTimeline {
  timeline: TimelineBeat[];
  durationMs: number;
}

/** Playback timing is derived separately so catalogue duration metadata stays intact. */
export function createPlaybackTimeline(event: GameEvent): PlaybackTimeline {
  const original = [...event.timeline].sort((a, b) => a.at - b.at);
  if (event.mechanic || original.length === 0) {
    return { timeline: original.map(beat => ({ ...beat })), durationMs: event.durationMs };
  }
  let cursor = Math.max(0, original[0].at);
  const timeline = original.map((beat, index) => {
    const effective = { ...beat, at: cursor };
    const end = original[index + 1]?.at ?? event.durationMs;
    cursor += Math.max(end - beat.at, readingDuration(beat.text));
    return effective;
  });
  return { timeline, durationMs: cursor };
}
