/**
 * Completion chime.
 *
 * Synthesised on the Web Audio API rather than shipping an audio file: the app
 * carries no extra asset, and the tone is free to follow whatever the theme is
 * doing. Built as a four-note major arpeggio over a low sine bloom, which reads
 * as "something finished" rather than an alert.
 */

type AudioContextCtor = new () => AudioContext;

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/** exponentialRampToValueAtTime can't reach 0, so fade to something tiny. */
const SILENT = 0.0001;

export function playCompletionChime(volume = 1) {
  const ctx = createContext();
  if (!ctx) return;

  // Autoplay policy can leave the context suspended until a gesture unlocks it.
  void ctx.resume();

  const start = ctx.currentTime + 0.02;

  // C5 · E5 · G5 · C6 — each note a soft swell, staggered so it cascades.
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    const at = start + index * 0.13;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, at);

    // Fast attack, long decay — bell-like rather than percussive.
    gain.gain.setValueAtTime(SILENT, at);
    gain.gain.exponentialRampToValueAtTime(0.22 * volume, at + 0.025);
    gain.gain.exponentialRampToValueAtTime(SILENT, at + 1.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 1.4);
  });

  // A low bloom underneath gives the chime some body on laptop speakers.
  const bloom = ctx.createOscillator();
  const bloomGain = ctx.createGain();
  bloom.type = "sine";
  bloom.frequency.setValueAtTime(196, start);
  bloomGain.gain.setValueAtTime(SILENT, start);
  bloomGain.gain.exponentialRampToValueAtTime(0.16 * volume, start + 0.06);
  bloomGain.gain.exponentialRampToValueAtTime(SILENT, start + 1.5);
  bloom.connect(bloomGain);
  bloomGain.connect(ctx.destination);
  bloom.start(start);
  bloom.stop(start + 1.6);

  // Release the hardware once it has rung out.
  window.setTimeout(() => void ctx.close(), 2200);
}