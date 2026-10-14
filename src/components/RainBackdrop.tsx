import { useEffect, useRef } from "react";
import { cn } from "../lib/utils";

/**
 * Rain for the focus timer.
 *
 * Canvas rather than DOM drops: a few hundred absolutely-positioned elements
 * animating transform would cost real frames, and canvas gets us per-drop streak
 * length, wind slant and depth layering for almost nothing.
 *
 * Drops are grouped into three depth layers. Far drops are short, slow and faint;
 * near ones are long, fast and brighter — that spread is what reads as depth.
 * Every drop in a layer shares one stroke style, so a frame is three `stroke()`
 * calls no matter how many drops are on screen.
 *
 * Pausing doesn't cut the rain. A single `speed` multiplier eases down to nothing
 * over a couple of seconds while the canvas fades with it, so the storm settles
 * instead of blinking out — and eases back up briskly on resume, because weather
 * doesn't take that long to arrive.
 *
 * The colour is sampled from `--text-primary`, so it stays legible whether the
 * app is in light or dark mode instead of hard-coding a grey that vanishes in
 * one of them.
 */

interface Layer {
  /** Drops per 100,000 px² of viewport. */
  density: number;
  /** Vertical speed range, px/s. */
  speed: [number, number];
  /** Streak length range, px. Longer reads as faster and closer. */
  len: [number, number];
  width: number;
  alpha: number;
  /** Only close drops visibly hit the frame. */
  splash: boolean;
}

const LAYERS: Layer[] = [
  { density: 7, speed: [380, 520], len: [7, 13], width: 1, alpha: 0.1, splash: false },
  { density: 5, speed: [620, 780], len: [13, 22], width: 1.2, alpha: 0.15, splash: false },
  { density: 3, speed: [950, 1250], len: [24, 40], width: 1.6, alpha: 0.2, splash: true },
];

/** Horizontal drift per pixel of fall — the wind that gives the slant. */
const WIND = 0.17;

/** Exponential rates for the wind-down and the spin-up. Asymmetric on purpose. */
const SLOW_DOWN = 2.2;
const SPEED_UP = 6;
const STOPPED = 0.012;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Drop {
  layer: number;
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface Ripple {
  x: number;
  radius: number;
  life: number;
}

export function RainBackdrop({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The loop must outlive a pause, so `active` is read through a ref instead of
  // re-keying the effect and restarting the storm from nothing.
  const activeRef = useRef(active);
  const reducedRef = useRef(false);
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    activeRef.current = active;
    if (active) startRef.current();
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedRef.current = reduced;

    let width = 0;
    let height = 0;
    let drops: Drop[] = [];
    let ripples: Ripple[] = [];
    let colour = "#f4f4f4";

    const readColour = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--text-primary")
        .trim();
      if (value) colour = value;
    };

    const spawn = (layer: Layer, index: number): Drop => ({
      layer: index,
      // Start above the frame and spread wider than it, so drops drift in.
      x: Math.random() * (width + 240) - 120,
      y: rand(-0.75, -0.05) * height,
      len: rand(layer.len[0], layer.len[1]),
      speed: rand(layer.speed[0], layer.speed[1]),
    });

    const seed = () => {
      drops = [];
      ripples = [];
      LAYERS.forEach((layer, index) => {
        const count = Math.round(((width * height) / 100_000) * layer.density);
        for (let i = 0; i < count; i += 1) drops.push(spawn(layer, index));
      });
    };

    const resize = () => {
      // Cap the device pixel ratio: beyond 2× the rain gains no visible
      // fidelity and costs a lot of fill rate.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const paint = (dt: number) => {
      ctx.clearRect(0, 0, width, height);
      if (dt <= 0) {
        // Static frame: place the drops once so the weather is visible.
        drops.forEach((drop) => {
          drop.y = rand(0, height);
        });
      }

      ctx.lineCap = "round";
      ctx.strokeStyle = colour;

      // Ripples first, underneath the streaks.
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const ripple = ripples[i];
        ripple.radius += 90 * dt;
        ripple.life -= dt;
        if (ripple.life <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 0.18 * ripple.life;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ripple.x, height - 2, ripple.radius, ripple.radius * 0.24, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      LAYERS.forEach((layer, index) => {
        ctx.globalAlpha = layer.alpha;
        ctx.lineWidth = layer.width;
        ctx.beginPath();

        for (const drop of drops) {
          if (drop.layer !== index) continue;

          drop.y += drop.speed * dt;
          drop.x += drop.speed * dt * WIND;

          if (drop.y > height + drop.len) {
            if (layer.splash && Math.random() < 0.45) {
              ripples.push({ x: drop.x, radius: 1, life: rand(0.3, 0.5) });
            }
            Object.assign(drop, spawn(layer, index));
            continue;
          }

          ctx.moveTo(drop.x - drop.len * WIND, drop.y - drop.len);
          ctx.lineTo(drop.x, drop.y);
        }

        ctx.stroke();
      });

      ctx.globalAlpha = 1;
    };

    readColour();
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;
    let frameCount = 0;
    /** 0 = settled, 1 = full storm. Also drives the canvas opacity. */
    let speed = activeRef.current ? 1 : 0;

    const loop = (now: number) => {
      // Clear the handle up front: this loop owns the schedule from here on, and
      // `raf` must read as "nothing pending" while a frame is being processed.
      raf = 0;

      // Clamp dt so a backgrounded tab doesn't teleport every drop on return.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const rate = activeRef.current ? SPEED_UP : SLOW_DOWN;
      speed += (activeRef.current ? 1 - speed : -speed) * Math.min(1, rate * dt);
      if (speed < STOPPED) speed = 0;

      // Re-sample the theme colour now and then; light/dark can flip live.
      if (++frameCount % 45 === 0) readColour();

      canvas.style.opacity = String(speed);
      paint(dt * speed);

      if (speed === 0 && !activeRef.current) {
        // Fully settled — clear the frame and stop. Scheduling the *next* frame
        // before deciding to stop would leave it queued: the loop would never
        // actually park, and every resume would start another one alongside it,
        // advancing the drops N times per frame and making the rain look faster.
        ctx.clearRect(0, 0, width, height);
        return;
      }

      raf = requestAnimationFrame(loop);
    };

    startRef.current = () => {
      if (reducedRef.current) {
        canvas.style.opacity = activeRef.current ? "1" : "0";
        paint(0);
        return;
      }
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };

    const stopRef = () => {
      canvas.style.opacity = "0";
      ctx.clearRect(0, 0, width, height);
    };

    if (reduced) {
      // No animation at all: the weather is there, frozen, or it isn't.
      if (activeRef.current) paint(0);
    } else if (activeRef.current) {
      startRef.current();
    } else {
      stopRef();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 h-full w-full opacity-0",
        // No CSS transition — opacity is driven per-frame from `speed` so it
        // tracks the wind-down exactly instead of racing it.
      )}
    />
  );
}