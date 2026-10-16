/**
 * Particle layer for the cinematic splash intro.
 *
 * Everything is drawn in the *image space* of the library plate (1600 × 748), so the canvas can sit
 * inside the same camera stage as the picture and stay locked to it at every screen size.
 *
 * - dust motes drift slowly through the window light
 * - golden sparks stream off the open book along the two magic swirls and rise into the hall
 * - `ignite()` fires a burst when the logo appears, `exit()` fires a bigger one as the intro ends
 */

export const PLATE_W = 1600;
export const PLATE_H = 748;

export interface SplashFx {
  /** Burst of sparks from the book (called automatically at `igniteAt`). */
  ignite: () => void;
  /** Final, faster burst used while the intro flies out. */
  exit: () => void;
  /** Stop the loop and clear the canvas. */
  stop: () => void;
}

interface Options {
  /** Milliseconds after start at which the first burst fires. */
  igniteAt: number;
  /** Fewer motes on small / low-power screens. */
  lite?: boolean;
}

type Pt = readonly [number, number];

/** Swirl centre-lines, traced on the plate (image px). Sparks ride these. */
const SWIRLS: readonly (readonly Pt[])[] = [
  [[690, 632], [630, 580], [570, 540], [500, 515], [440, 480], [405, 445], [395, 430]],
  [[870, 625], [960, 590], [1070, 560], [1140, 535], [1125, 502], [1200, 470], [1245, 420], [1250, 385], [1220, 368], [1160, 367], [1105, 382]],
];

const BOOK_X = 800;
const BOOK_Y = 662;

interface Dust { x: number; y: number; r: number; vx: number; vy: number; ph: number; sp: number; a: number; cool: boolean }
interface Spark {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; size: number; ph: number;
  /** -1 = free flying, otherwise index into SWIRLS */
  path: number; off: number; drag: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function sprite(size: number, stops: ReadonlyArray<readonly [number, string]>): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => grad.addColorStop(o, col));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

function pointOnPath(path: readonly Pt[], u: number): Pt {
  const f = clamp01(u) * (path.length - 1);
  const i = Math.min(Math.floor(f), path.length - 2);
  const t = f - i;
  const a = path[i];
  const b = path[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function startSplashParticles(canvas: HTMLCanvasElement, opts: Options): SplashFx {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ignite: () => {}, exit: () => {}, stop: () => {} };

  // Backing store is kept modest: the sprites are soft glows, so extra resolution buys nothing.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(1.25, Math.max(1, ((canvas.clientWidth || PLATE_W) * dpr) / PLATE_W));
  canvas.width = Math.round(PLATE_W * scale);
  canvas.height = Math.round(PLATE_H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const gold = sprite(64, [
    [0, 'rgba(255,248,222,1)'],
    [0.2, 'rgba(255,214,122,.85)'],
    [0.5, 'rgba(255,170,64,.24)'],
    [1, 'rgba(255,150,40,0)'],
  ]);
  const warmDust = sprite(32, [[0, 'rgba(255,240,205,.95)'], [0.4, 'rgba(255,226,160,.35)'], [1, 'rgba(255,220,150,0)']]);
  const coolDust = sprite(32, [[0, 'rgba(190,246,250,.9)'], [0.4, 'rgba(120,224,236,.3)'], [1, 'rgba(100,220,235,0)']]);

  const dust: Dust[] = [];
  const dustCount = opts.lite ? 70 : 110;
  for (let i = 0; i < dustCount; i += 1) {
    // Most motes live in the window light on the right, the rest fill the hall.
    const inBeam = Math.random() < 0.58;
    dust.push({
      x: inBeam ? rand(820, 1500) : rand(0, PLATE_W),
      y: inBeam ? rand(0, 700) : rand(0, PLATE_H),
      r: rand(0.7, 2.6),
      vx: rand(-9, -2),
      vy: rand(1, 7),
      ph: rand(0, Math.PI * 2),
      sp: rand(0.5, 1.8),
      a: rand(0.35, 0.95),
      cool: Math.random() < 0.22,
    });
  }

  const sparks: Spark[] = [];
  const MAX_SPARKS = opts.lite ? 150 : 260;

  const spawnFree = (speed = 1) => {
    if (sparks.length >= MAX_SPARKS) return;
    sparks.push({
      x: BOOK_X + rand(-210, 210), y: BOOK_Y + rand(-14, 16),
      vx: rand(-22, 22) * speed, vy: -rand(28, 90) * speed,
      age: 0, life: rand(3, 6), size: rand(0.9, 2.5), ph: rand(0, 6.28), path: -1, off: 0, drag: 0.15,
    });
  };
  const spawnPath = () => {
    if (sparks.length >= MAX_SPARKS) return;
    const p = Math.random() < 0.5 ? 0 : 1;
    sparks.push({
      x: 0, y: 0, vx: 0, vy: -rand(6, 22),
      age: 0, life: rand(2.2, 3.8), size: rand(1, 2.8), ph: rand(0, 6.28), path: p, off: rand(-14, 14), drag: 0,
    });
  };
  const burst = (count: number, minSpeed: number, maxSpeed: number, minLife: number, maxLife: number) => {
    for (let i = 0; i < count && sparks.length < MAX_SPARKS + 140; i += 1) {
      const ang = -Math.PI / 2 + rand(-1.25, 1.25);
      const sp = rand(minSpeed, maxSpeed);
      sparks.push({
        x: BOOK_X + rand(-150, 150), y: BOOK_Y + rand(-10, 10),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        age: 0, life: rand(minLife, maxLife), size: rand(1.1, 3.4), ph: rand(0, 6.28), path: -1, off: 0, drag: 1.6,
      });
    }
  };

  let ignited = false;
  let exiting = false;
  const ignite = () => {
    if (ignited) return;
    ignited = true;
    burst(opts.lite ? 40 : 70, 90, 280, 1.6, 3.4);
  };
  const exit = () => {
    if (exiting) return;
    exiting = true;
    burst(opts.lite ? 60 : 110, 220, 560, 0.55, 1.15);
  };

  let raf = 0;
  let stopped = false;
  const t0 = performance.now();
  let last = t0;
  let accFree = 0;
  let accPath = 0;

  const frame = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - t0) / 1000;
    if (!ignited && now - t0 >= opts.igniteAt) ignite();

    // --- emission -------------------------------------------------------
    const warm = clamp01((t - 0.9) / 2.6);
    const boost = ignited ? 1 : 0;
    accFree += dt * (warm * 16 + boost * 9);
    accPath += dt * (warm * 15 + boost * 12);
    while (accFree >= 1) { spawnFree(); accFree -= 1; }
    while (accPath >= 1) { spawnPath(); accPath -= 1; }

    ctx.clearRect(0, 0, PLATE_W, PLATE_H);
    ctx.globalCompositeOperation = 'lighter';

    // --- dust motes -----------------------------------------------------
    const dustFade = clamp01((t - 0.3) / 1.6) * (exiting ? 0.5 : 1);
    for (const d of dust) {
      d.x += (d.vx + Math.sin(t * 0.35 + d.ph) * 7) * dt;
      d.y += (d.vy + Math.cos(t * 0.28 + d.ph) * 4) * dt;
      if (d.x < -20) d.x = PLATE_W + 20;
      if (d.y > PLATE_H + 20) d.y = -20;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * d.sp * 2 + d.ph));
      ctx.globalAlpha = d.a * tw * dustFade;
      const s = d.r * 7;
      ctx.drawImage(d.cool ? coolDust : warmDust, d.x - s / 2, d.y - s / 2, s, s);
    }

    // --- sparks ---------------------------------------------------------
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      const k = p.age / p.life;

      if (p.path >= 0) {
        // ride the swirl, then drift off the end
        const u = k * 1.35;
        if (u <= 1) {
          const [px, py] = pointOnPath(SWIRLS[p.path], u);
          const wob = Math.sin(p.age * 5 + p.ph) * p.off * (0.35 + u);
          p.x = px + wob * 0.6;
          p.y = py + wob * 0.8;
        } else {
          p.y += p.vy * dt;
          p.x += Math.sin(p.age * 3 + p.ph) * 10 * dt;
        }
      } else {
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += (p.vx + Math.sin(p.age * 2.2 + p.ph) * 14) * dt;
        p.y += p.vy * dt;
      }

      const fadeIn = clamp01(k / 0.1);
      const fadeOut = clamp01((1 - k) / 0.4);
      const flicker = 0.72 + 0.28 * Math.sin(p.age * 14 + p.ph);
      ctx.globalAlpha = fadeIn * fadeOut * flicker;
      const s = p.size * 9 * (0.7 + 0.3 * fadeOut);
      ctx.drawImage(gold, p.x - s / 2, p.y - s / 2, s, s);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  raf = requestAnimationFrame(frame);

  return {
    ignite,
    exit,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, PLATE_W, PLATE_H);
    },
  };
}
