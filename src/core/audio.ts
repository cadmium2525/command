export class AudioEngine {
  private context: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();
  muted = false;
  /** Called only inside a deliberate pointer/keyboard action. */
  unlock() {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* The game remains fully usable without audio. */ }
  }
  play(kind: 'input' | 'start' | 'new' | 'miss' | 'back', pitch = 0) {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const notes = kind === 'new' ? [523, 659, 784, 1046] : kind === 'start' ? [220, 440, 880] : kind === 'miss' ? [180, 120] : [kind === 'back' ? 150 : 330 + pitch * 55];
    notes.forEach((frequency, i) => {
      const ctx = this.context!;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * .065;
      oscillator.type = 'square'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.025, start); gain.gain.exponentialRampToValueAtTime(.001, start + .09);
      oscillator.connect(gain); gain.connect(ctx.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
      oscillator.start(start); oscillator.stop(start + .1);
    });
  }
  stop() { for (const oscillator of this.voices) { try { oscillator.stop(); } catch { /* already ended */ } } this.voices.clear(); }
  dispose() { this.stop(); void this.context?.close().catch(() => {}); this.context = null; }
}
