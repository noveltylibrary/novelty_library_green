/**
 * Particle layer for the cinematic splash intro (v1.129, brand teal / cyan).
 *
 * Everything is drawn in the *image space* of the library plate (1600 x 748), so the canvas sits inside
 * the same camera stage as the picture and stays locked to it at every screen size.
 *
 * - dust motes drift through the window light
 * - soft out-of-focus bokeh discs float up in the foreground (depth)
 * - sparks stream off the open book along the two magic swirls and rise into the hall
 * - a few letters lift off the pages and dissolve ("every book opens a world")
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
  /** Fewer particles on small / low-power screens. */
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
const GLYPHS = 'NOVELTYLIBRARYabelnorstv';

interface Dust { x: number; y: number; r: number; vx: number; vy: number; ph: number; sp: number; a: number; teal: boolean }
interface Bokeh { x: number; y: number; r: number; vx: number; vy: number; ph: number; a: number }
interface Spark {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; size: number; ph: number;
  /** -1 = free flying, otherwise index into SWIRLS */
  path: number; off: number; drag: number;
}
interface Glyph { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; ph: number; rot: number; spin: number; g: number }

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

function glyphSprite(ch: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.font = '600 34px Fraunces, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(92,225,230,.95)';
    g.shadowBlur = 12;
    g.fillStyle = '#eafdff';
    g.fillText(ch, 32, 34);
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

  // Backing store is kept modest: everything here is a soft glow, so extra resolution buys nothing.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(1.25, Math.max(1, ((canvas.clientWidth || PLATE_W) * dpr) / PLATE_W));
  canvas.width = Math.round(PLATE_W * scale);
  canvas.height = Math.round(PLATE_H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Brand palette: cyan #5ce1e6, teal #35d3d9, teal-dark #0097b2, near-white #eafdff
  const glow = sprite(64, [
    [0, 'rgba(234,253,255,1)'],
    [0.2, 'rgba(120,236,242,.88)'],
    [0.5, 'rgba(53,211,217,.26)'],
    [1, 'rgba(0,151,178,0)'],
  ]);
  const paleDust = sprite(32, [[0, 'rgba(234,253,255,.95)'], [0.4, 'rgba(150,240,246,.35)'], [1, 'rgba(120,236,242,0)']]);
  const tealDust = sprite(32, [[0, 'rgba(120,236,242,.9)'], [0.4, 'rgba(53,211,217,.3)'], [1, 'rgba(0,151,178,0)']]);
  const bokehSprite = sprite(128, [
    [0, 'rgba(160,245,250,.16)'],
    [0.6, 'rgba(92,225,230,.2)'],
    [0.88, 'rgba(150,242,248,.55)'],
    [1, 'rgba(92,225,230,0)'],
  ]);
  const glyphs = Array.from(GLYPHS).map(glyphSprite);

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
      teal: Math.random() < 0.3,
    });
  }

  const bokeh: Bokeh[] = [];
  const bokehCount = opts.lite ? 7 : 14;
  for (let i = 0; i < bokehCount; i += 1) {
    bokeh.push({
      x: rand(0, PLATE_W), y: rand(120, PLATE_H + 40),
      r: rand(16, 46), vx: rand(-7, 7), vy: -rand(5, 16), ph: rand(0, 6.28), a: rand(0.35, 0.9),
    });
  }

  const sparks: Spark[] = [];
  const MAX_SPARKS = opts.lite ? 150 : 260;
  const floating: Glyph[] = [];
  const MAX_GLYPHS = opts.lite ? 12 : 24;

  const spawnFree = () => {
    if (sparks.length >= MAX_SPARKS) return;
    sparks.push({
      x: BOOK_X + rand(-210, 210), y: BOOK_Y + rand(-14, 16),
      vx: rand(-22, 22), vy: -rand(28, 90),
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
  const spawnGlyph = () => {
    if (floating.length >= MAX_GLYPHS) return;
    floating.push({
      x: BOOK_X + rand(-190, 190), y: BOOK_Y + rand(-20, 10),
      vx: rand(-10, 10), vy: -rand(22, 54),
      age: 0, life: rand(3.6, 5.8), size: rand(13, 26), ph: rand(0, 6.28),
      rot: rand(-0.4, 0.4), spin: rand(-0.35, 0.35), g: Math.floor(Math.random() * glyphs.length),
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
    for (let i = 0; i < (opts.lite ? 4 : 8); i += 1) spawnGlyph();
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
  let accGlyph = 0;

  const frame = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - t0) / 1000;
    if (!ignited && now - t0 >= opts.igniteAt) ignite();

    // --- emission (the book is already alive on the first frame: no black, no waiting) ---
    const lift = clamp01((t + 0.2) / 2.2);
    const boost = ignited ? 1 : 0;
    accFree += dt * (lift * 16 + boost * 9);
    accPath += dt * (lift * 15 + boost * 12);
    accGlyph += dt * (clamp01((t - 0.6) / 1.6) * 2.6 + boost * 1.6);
    while (accFree >= 1) { spawnFree(); accFree -= 1; }
    while (accPath >= 1) { spawnPath(); accPath -= 1; }
    while (accGlyph >= 1) { spawnGlyph(); accGlyph -= 1; }

    ctx.clearRect(0, 0, PLATE_W, PLATE_H);
    ctx.globalCompositeOperation = 'lighter';

    // --- bokeh (soft foreground discs) ---
    const bokehFade = clamp01((t + 0.1) / 1.8) * (exiting ? 0.6 : 1);
    for (const b of bokeh) {
      b.x += (b.vx + Math.sin(t * 0.22 + b.ph) * 5) * dt;
      b.y += b.vy * dt;
      if (b.y < -60) { b.y = PLATE_H + 60; b.x = rand(0, PLATE_W); }
      const tw = 0.55 + 0.45 * Math.sin(t * 0.7 + b.ph * 2);
      ctx.globalAlpha = b.a * tw * bokehFade * 0.55;
      const s = b.r * 2;
      ctx.drawImage(bokehSprite, b.x - s / 2, b.y - s / 2, s, s);
    }

    // --- dust motes ---
    const dustFade = clamp01((t + 0.1) / 1.2) * (exiting ? 0.5 : 1);
    for (const d of dust) {
      d.x += (d.vx + Math.sin(t * 0.35 + d.ph) * 7) * dt;
      d.y += (d.vy + Math.cos(t * 0.28 + d.ph) * 4) * dt;
      if (d.x < -20) d.x = PLATE_W + 20;
      if (d.y > PLATE_H + 20) d.y = -20;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * d.sp * 2 + d.ph));
      ctx.globalAlpha = d.a * tw * dustFade;
      const s = d.r * 7;
      ctx.drawImage(d.teal ? tealDust : paleDust, d.x - s / 2, d.y - s / 2, s, s);
    }

    // --- sparks ---
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
      ctx.drawImage(glow, p.x - s / 2, p.y - s / 2, s, s);
    }

    // --- letters lifting off the pages ---
    for (let i = floating.length - 1; i >= 0; i -= 1) {
      const gl = floating[i];
      gl.age += dt;
      if (gl.age >= gl.life) { floating.splice(i, 1); continue; }
      const k = gl.age / gl.life;
      gl.x += (gl.vx + Math.sin(gl.age * 1.6 + gl.ph) * 16) * dt;
      gl.y += gl.vy * dt;
      gl.rot += gl.spin * dt;
      const a = clamp01(k / 0.12) * clamp01((1 - k) / 0.45) * 0.78;
      const s = gl.size * (1 + k * 0.35);
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(gl.x, gl.y);
      ctx.rotate(gl.rot);
      ctx.drawImage(glyphs[gl.g], -s / 2, -s / 2, s, s);
      ctx.restore();
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
