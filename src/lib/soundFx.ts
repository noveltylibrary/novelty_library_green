/**
 * Tiny UI sound engine (Web Audio, no audio files). `soundFx.play('click')` is safe to call anywhere: it does nothing on the
 * server, when the browser has not yet allowed audio, or when the visitor has muted sound (remembered in localStorage).
 */
export type SoundName = 'click' | 'key' | 'correct' | 'wrong' | 'win' | 'lose' | 'ping' | 'chime';
/** Which switch in Account & settings → Sound controls a sound. */
export type SoundCategory = 'games' | 'reviews' | 'notifications';
export const SOUND_CATEGORIES: Array<{ key: SoundCategory; label: string; hint: string; sample: SoundName }> = [
  { key: 'games', label: 'Enigma GameSpace', hint: 'Tab clicks, key taps, right and wrong answers, wins and losses in LexiWord and HangLex.', sample: 'correct' },
  { key: 'reviews', label: 'Reviews', hint: 'A soft chime when Review Helper finishes polishing or a review is posted.', sample: 'chime' },
  { key: 'notifications', label: 'Notifications', hint: 'A short ping when a new notification arrives while you are on the site.', sample: 'ping' },
];
const DEFAULT_CATEGORY: Record<SoundName, SoundCategory> = { click: 'games', key: 'games', correct: 'games', wrong: 'games', win: 'games', lose: 'games', ping: 'notifications', chime: 'reviews' };

const STORE = 'nl_sound_muted';
const PREFS = 'nl_sound_prefs';
export interface SoundPrefs { master: boolean; volume: number; games: boolean; reviews: boolean; notifications: boolean }
const DEFAULT_PREFS: SoundPrefs = { master: true, volume: 0.8, games: true, reviews: true, notifications: true };
/** [frequency Hz, start s, length s, wave, peak gain] */
type Note = [number, number, number, OscillatorType, number];

const SOUNDS: Record<SoundName, Note[]> = {
  click: [[620, 0, 0.06, 'triangle', 0.07], [930, 0.035, 0.07, 'sine', 0.05]],
  key: [[420, 0, 0.04, 'triangle', 0.05]],
  correct: [[523, 0, 0.09, 'sine', 0.08], [784, 0.08, 0.14, 'sine', 0.07]],
  wrong: [[220, 0, 0.14, 'sawtooth', 0.045], [165, 0.1, 0.18, 'sawtooth', 0.04]],
  win: [[523, 0, 0.11, 'triangle', 0.08], [659, 0.1, 0.11, 'triangle', 0.08], [784, 0.2, 0.11, 'triangle', 0.08], [1047, 0.3, 0.28, 'sine', 0.08]],
  ping: [[880, 0, 0.08, 'sine', 0.07], [1175, 0.09, 0.16, 'sine', 0.06]],
  chime: [[659, 0, 0.1, 'triangle', 0.06], [988, 0.09, 0.2, 'sine', 0.06]],
  lose: [[392, 0, 0.16, 'triangle', 0.07], [330, 0.15, 0.16, 'triangle', 0.07], [262, 0.3, 0.3, 'triangle', 0.07]],
};

let ctx: AudioContext | null = null;
let prefs: SoundPrefs = { ...DEFAULT_PREFS };
try {
  const raw = localStorage.getItem(PREFS);
  if (raw) { const p = JSON.parse(raw) as Partial<SoundPrefs>; prefs = { ...DEFAULT_PREFS, ...p, volume: Math.min(1, Math.max(0, Number(p.volume ?? 0.8))) }; }
  else if (localStorage.getItem(STORE) === '1') prefs.master = false; // the old single mute switch
} catch { /* storage blocked */ }
const listeners = new Set<() => void>();
const save = () => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); localStorage.setItem(STORE, prefs.master ? '0' : '1'); } catch { /* storage blocked */ } listeners.forEach((f) => f()); };

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
};

export const soundFx = {
  play(name: SoundName, category: SoundCategory = DEFAULT_CATEGORY[name], force = false) {
    if (!force && (!prefs.master || !prefs[category])) return;
    try {
      const c = getCtx();
      if (!c) return;
      const t0 = c.currentTime;
      for (const [freq, start, len, wave, peak] of SOUNDS[name]) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * prefs.volume * 1.25), t0 + start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
        osc.connect(gain).connect(c.destination);
        osc.start(t0 + start);
        osc.stop(t0 + start + len + 0.03);
      }
    } catch { /* audio is a nicety, never an error */ }
  },
  /** Legacy single switch used by the Enigma hub speaker button: it flips the games sounds. */
  isMuted: () => !prefs.master || !prefs.games,
  setMuted(value: boolean) { prefs = { ...prefs, ...(value ? { games: false } : { games: true, master: true }) }; save(); },
  getPrefs: (): SoundPrefs => prefs,
  setPrefs(patch: Partial<SoundPrefs>) { prefs = { ...prefs, ...patch }; save(); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
