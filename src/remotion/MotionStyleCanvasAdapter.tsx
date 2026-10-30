import React, { useEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { MOTION_TEMPLATES_20 } from './motionTemplates20';

export interface MotionCanvasAdapterConfig {
  styleId: string;
  width: number;
  height: number;
  dur?: number;
  alpha?: boolean;
  text?: string;
  sub?: string;
  colors?: Record<string, string>;
}

export interface CompiledMotionCanvasRenderer {
  styleId: string;
  dur: number;
  draw: (
    targetCanvas: HTMLCanvasElement,
    targetCtx: CanvasRenderingContext2D,
    tSeconds: number
  ) => void;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

/**
 * Compiles any of the 20 `claude-motion-styles-20` HTML5 Canvas templates
 * into a deterministic, frame-exact renderer function `draw(t)` that preserves:
 * - Seeded LCG PRNG (`reseed`, `rnd`) — zero `Math.random()` or `Date.now()`
 * - Responsive unit scaling (`U = Math.min(W, H)`) for 9:16, 16:9, and 1:1
 * - Alpha transparency (`alpha: true` clears canvas instead of painting background)
 * - Connected Arabic RTL font shaping (`Noto Sans Arabic`, `Cairo`, `Aref Ruqaa`, `Plus Jakarta Sans`)
 */
export function compileMotionTemplateRenderer(
  config: MotionCanvasAdapterConfig
): CompiledMotionCanvasRenderer | null {
  const normalizedId = config.styleId.startsWith('motion-')
    ? config.styleId
    : `motion-${config.styleId}`;
  const def = MOTION_TEMPLATES_20[normalizedId];
  if (!def) return null;

  const W = Math.max(16, Math.round(config.width));
  const H = Math.max(16, Math.round(config.height));
  const DUR =
    config.dur && config.dur > 0 ? config.dur : Number(def.defaultDur || 6);
  const ALPHA = Boolean(config.alpha);
  const TEXT =
    config.text !== undefined && config.text !== null
      ? config.text
      : def.defaultText;
  const SUB =
    config.sub !== undefined && config.sub !== null
      ? config.sub
      : def.defaultSub;
  const COL: Record<string, string> = {
    ...def.defaultColors,
    ...(config.colors || {}),
  };

  let compiledDrawFn: ((t: number) => void) | null = null;
  let boundCanvas: HTMLCanvasElement | null = null;
  let boundCtx: CanvasRenderingContext2D | null = null;

  const ensureInitialized = (
    cv: HTMLCanvasElement,
    rawCtx: CanvasRenderingContext2D
  ) => {
    if (compiledDrawFn && boundCanvas === cv && boundCtx === rawCtx) {
      return;
    }
    boundCanvas = cv;
    boundCtx = rawCtx;

    // Wrap fillText & strokeText on a Proxy so Arabic text always sets direction='rtl'
    const ctx = new Proxy(rawCtx, {
      get(target, prop, receiver) {
        if (prop === 'fillText') {
          return (text: string, x: number, y: number, maxWidth?: number) => {
            const str = String(text ?? '');
            const prevDir = target.direction;
            if (ARABIC_CHAR_REGEX.test(str)) {
              target.direction = 'rtl';
            }
            if (maxWidth !== undefined) {
              target.fillText(str, x, y, maxWidth);
            } else {
              target.fillText(str, x, y);
            }
            target.direction = prevDir;
          };
        }
        if (prop === 'strokeText') {
          return (text: string, x: number, y: number, maxWidth?: number) => {
            const str = String(text ?? '');
            const prevDir = target.direction;
            if (ARABIC_CHAR_REGEX.test(str)) {
              target.direction = 'rtl';
            }
            if (maxWidth !== undefined) {
              target.strokeText(str, x, y, maxWidth);
            } else {
              target.strokeText(str, x, y);
            }
            target.direction = prevDir;
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, prop, value) {
        Reflect.set(target, prop, value);
        return true;
      },
    });

    const U = Math.min(W, H);
    const CX = W / 2;
    const CY = H / 2;
    const SANS =
      '"Plus Jakarta Sans","Noto Sans Arabic","Cairo","Inter","Helvetica Neue",Arial,sans-serif';
    const MONO =
      '"JetBrains Mono","DejaVu Sans Mono","Noto Sans Arabic",Menlo,Consolas,monospace';
    const SERIF =
      '"Aref Ruqaa","Playfair Display","Noto Naskh Arabic","Didot",Georgia,serif';

    let _s = 1;
    const reseed = (s: number) => {
      _s = (Math.floor(s) % 2147483646) + 1;
      if (_s <= 0) _s += 2147483646;
    };
    const rnd = () => {
      _s = (_s * 16807) % 2147483647;
      return (_s - 1) / 2147483646;
    };
    const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const prog = (t: number, a: number, b: number) =>
      clamp((t - a) / (b - a || 1e-6));
    const TAU = Math.PI * 2;
    const ease = {
      out: (t: number) => 1 - Math.pow(1 - t, 3),
      in: (t: number) => t * t * t,
      inOut: (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
      back: (t: number) => {
        const c = 1.9;
        return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      },
      elastic: (t: number) =>
        t === 0 || t === 1
          ? t
          : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1,
    };

    function bg(c: string) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.shadowBlur = 0;
      if (ALPHA) {
        ctx.clearRect(0, 0, W, H);
      } else {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, W, H);
      }
    }

    function font(wt: number | string, size: number, fam?: string) {
      const resolvedFam = fam
        ? `${fam},"Noto Sans Arabic","Plus Jakarta Sans",sans-serif`
        : SANS;
      ctx.font = `${wt} ${Math.max(8, Math.round(size))}px ${resolvedFam}`;
    }

    function rrect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, Math.max(0, r));
      } else {
        ctx.rect(x, y, w, h);
      }
    }

    function off(w: number, h: number) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, w | 0);
      c.height = Math.max(1, h | 0);
      const offCtx = c.getContext('2d');
      if (offCtx) {
        const origFillText = offCtx.fillText.bind(offCtx);
        offCtx.fillText = (
          text: string,
          x: number,
          y: number,
          maxW?: number
        ) => {
          const str = String(text ?? '');
          if (ARABIC_CHAR_REGEX.test(str)) {
            offCtx.direction = 'rtl';
            if (!offCtx.font.includes('Noto Sans Arabic')) {
              offCtx.font = offCtx.font.replace(
                /sans-serif|monospace|serif/,
                '"Noto Sans Arabic","Plus Jakarta Sans",sans-serif'
              );
            }
          }
          if (maxW !== undefined) origFillText(str, x, y, maxW);
          else origFillText(str, x, y);
        };
      }
      return c;
    }

    function hexA(hex: string, a: number) {
      const clean = (hex || '#000000').replace('#', '');
      const n = parseInt(clean, 16) || 0;
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }

    function hexRGB(hex: string): [number, number, number] {
      const clean = (hex || '#000000').replace('#', '');
      const n = parseInt(clean, 16) || 0;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function fitFont(
      txt: string,
      wt: number | string,
      maxSize: number,
      maxW: number,
      fam?: string
    ) {
      let s = maxSize;
      font(wt, s, fam);
      const m = ctx.measureText(txt).width;
      if (m > maxW && m > 0) s *= maxW / m;
      font(wt, s, fam);
      return s;
    }

    // Compile the exact template body and return its `draw` function
    const factory = new Function(
      'W',
      'H',
      'DUR',
      'ALPHA',
      'TEXT',
      'SUB',
      'COL',
      'cv',
      'ctx',
      'U',
      'CX',
      'CY',
      'SANS',
      'MONO',
      'SERIF',
      'reseed',
      'rnd',
      'clamp',
      'lerp',
      'prog',
      'TAU',
      'ease',
      'bg',
      'font',
      'rrect',
      'off',
      'hexA',
      'hexRGB',
      'fitFont',
      `${def.styleCode}\nreturn draw;`
    );

    compiledDrawFn = factory(
      W,
      H,
      DUR,
      ALPHA,
      TEXT,
      SUB,
      COL,
      cv,
      ctx,
      U,
      CX,
      CY,
      SANS,
      MONO,
      SERIF,
      reseed,
      rnd,
      clamp,
      lerp,
      prog,
      TAU,
      ease,
      bg,
      font,
      rrect,
      off,
      hexA,
      hexRGB,
      fitFont
    ) as (t: number) => void;
  };

  return {
    styleId: normalizedId,
    dur: DUR,
    draw: (
      targetCanvas: HTMLCanvasElement,
      targetCtx: CanvasRenderingContext2D,
      tSeconds: number
    ) => {
      ensureInitialized(targetCanvas, targetCtx);
      if (compiledDrawFn) {
        const loopedTime = ((tSeconds % DUR) + DUR) % DUR;
        compiledDrawFn(loopedTime);
      }
    },
  };
}

/**
 * Remotion Layer that renders any of the 20 `claude-motion-styles-20` templates
 * frame-accurately at `t = frame / fps` inside both `@remotion/player` and `@remotion/renderer`.
 */
export const MotionTemplateRemotionLayer: React.FC<{
  styleId: string;
  alpha?: boolean;
  text?: string;
  sub?: string;
  colors?: Record<string, string>;
  opacity?: number;
  scale?: number;
}> = ({
  styleId,
  alpha = false,
  text,
  sub,
  colors,
  opacity = 1,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const colorsKey = colors ? JSON.stringify(colors) : '';
  const renderer = useMemo(
    () =>
      compileMotionTemplateRenderer({
        styleId,
        width,
        height,
        alpha,
        text,
        sub,
        colors,
      }),
    [styleId, width, height, alpha, text, sub, colorsKey]
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !renderer) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const tSeconds = frame / fps;
    renderer.draw(cv, ctx, tSeconds);
  }, [frame, fps, renderer]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          transform:
            scale !== 1
              ? `translate3d(0, 0, 0) scale3d(${scale.toFixed(6)}, ${scale.toFixed(6)}, 1)`
              : undefined,
          transformOrigin: '50% 50%',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Standalone Live Interactive Preview Canvas for the Styles Menu & Admin Registry Inspector.
 */
export const MotionStyleLiveCanvasPreview: React.FC<{
  styleId: string;
  width?: number;
  height?: number;
  alpha?: boolean;
  text?: string;
  sub?: string;
  className?: string;
}> = ({
  styleId,
  width = 320,
  height = 180,
  alpha = false,
  text,
  sub,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderer = useMemo(
    () =>
      compileMotionTemplateRenderer({
        styleId,
        width,
        height,
        alpha,
        text,
        sub,
      }),
    [styleId, width, height, alpha, text, sub]
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !renderer) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsedSec = (now - t0) / 1000;
      renderer.draw(cv, ctx, elapsedSec);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [renderer]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
};
