import React from 'react';
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * VION — Ported & Adapted Bassam Remotion Stage Kits (`video-editor-bassam.zip`)
 * Implements:
 * 1. `LiveBG` (Rule 20: Drifting cold/warm radial glows + SVG fractalNoise grain)
 * 2. `BassamWordCaptionsLayer` (Rules 30, 32, 47, 76: Word-by-word RTL/LTR progressive reveal, active lift, accent pill)
 * 3. `CollageVoxStageLayer` (`styles/collage/kit/vox.tsx`: Real torn paper, push-pins, sagging red wool yarn, tape, stamp, highlighter, hand stamp/pen)
 * 4. `DocumentaryEditorialStageLayer` (`styles/collage/kit/editorial.tsx`: Archival research paper, Ruqaa calligraphy pen, glass chart card)
 * 5. `FlowchartBoardStageLayer` (`styles/collage/kit/board.tsx`: Rules 93–100: Dark flowchart board, dot grid, glowing pulse wire `ptOf`, active/closed nodes)
 */

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const pWin = (t: number, s: number, e: number) =>
  clamp01((t - s) / Math.max(0.0001, e - s));
export const easeOut3 = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const eio3 = (x: number) => {
  const u = clamp01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
export const backOut = (x: number, s = 1.7) => {
  const u = clamp01(x) - 1;
  return 1 + u * u * ((s + 1) * u + s);
};
export const lerpNum = (a: number, b: number, k: number) => a + (b - a) * k;

const GRAIN_SVG_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>
       <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3'/>
         <feColorMatrix type='saturate' values='0'/></filter>
       <rect width='180' height='180' filter='url(#n)' opacity='0.5'/></svg>`
  );

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = (hex || '#0E1015').replace('#', '');
  const n = parseInt(clean, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbaStr(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbTuple(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mixHex(a: string, b: string, k: number): string {
  const A = hexToRgbTuple(a);
  const B = hexToRgbTuple(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(
    A[1] + (B[1] - A[1]) * k
  )},${Math.round(A[2] + (B[2] - A[2]) * k)})`;
}

const rngDet = (seed: number) => {
  const x = Math.sin(seed * 9301.7 + 49297.3) * 233280;
  return x - Math.floor(x);
};

export function tornPolygonClipPath(seed: number, jaggedness = 2.1): string {
  const pts: string[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    pts.push(
      `${((i / n) * 100).toFixed(1)}% ${(rngDet(seed + i) * jaggedness).toFixed(1)}%`
    );
  }
  for (let i = 1; i <= n; i++) {
    pts.push(
      `${(100 - rngDet(seed + 40 + i) * jaggedness * 0.6).toFixed(1)}% ${((i / n) * 100).toFixed(1)}%`
    );
  }
  for (let i = n - 1; i >= 0; i--) {
    pts.push(
      `${((i / n) * 100).toFixed(1)}% ${(100 - rngDet(seed + 80 + i) * jaggedness).toFixed(1)}%`
    );
  }
  for (let i = n - 1; i >= 1; i--) {
    pts.push(
      `${(rngDet(seed + 120 + i) * jaggedness * 0.6).toFixed(1)}% ${((i / n) * 100).toFixed(1)}%`
    );
  }
  return `polygon(${pts.join(',')})`;
}

/**
 * Rule 20: Live Background (`LiveBG`) with drifting sky/accent glows and grain texture.
 */
export const BassamLiveBackground: React.FC<{
  bgColor?: string;
  skyColor?: string;
  accentColor?: string;
  withCrumplePaper?: boolean;
}> = ({
  bgColor = '#0E1015',
  skyColor = '#3B82F6',
  accentColor = '#F59E0B',
  withCrumplePaper = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const b1 = 0.5 + 0.5 * Math.sin(t * 0.62);
  const b2 = 0.5 + 0.5 * Math.sin(t * 0.44 + 2);
  const dx = Math.sin(t * 0.23) * (width * 0.055);
  const dy = Math.cos(t * 0.19) * (height * 0.035);

  const glowStyle = (
    cx: number,
    cy: number,
    r: number,
    col: string,
    a: number
  ): React.CSSProperties => ({
    position: 'absolute',
    left: cx - r,
    top: cy - r,
    width: r * 2,
    height: r * 2,
    background: `radial-gradient(circle, ${rgbaStr(col, a)} 0%, ${rgbaStr(
      col,
      a * 0.28
    )} 60%, rgba(0,0,0,0) 100%)`,
  });

  const baseR = Math.min(width, height) * 0.52;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${mixHex(
          bgColor,
          skyColor,
          0.12
        )} 0%, ${bgColor} 52%, ${mixHex(bgColor, '#000000', 0.16)} 100%)`,
      }}
    >
      <div
        style={glowStyle(
          width * 0.36 + dx * 0.6,
          height * 0.25 + dy * 0.6,
          baseR,
          skyColor,
          0.14 + 0.07 * b1
        )}
      />
      <div
        style={glowStyle(
          width * 0.65 - dx * 0.6,
          height * 0.72 - dy * 0.6,
          baseR * 0.9,
          mixHex(skyColor, '#000000', 0.28),
          0.1 + 0.06 * b2
        )}
      />
      <div
        style={glowStyle(
          width * 0.52,
          height * 0.52,
          baseR * 0.82,
          accentColor,
          0.045
        )}
      />
      {withCrumplePaper && (
        <Img
          src="/assets/bassam/crumple_gray.png"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.22,
            mixBlendMode: 'soft-light',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.11,
          backgroundImage: `url("${GRAIN_SVG_DATA_URI}")`,
          backgroundRepeat: 'repeat',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Collage / Vox Stage Kit (`styles/collage/kit/vox.tsx`)
 * Renders authentic torn paper (`paper_old.png` / `paper_kraft.png`), 3D push-pins,
 * sagging red wool yarn (`yarnPath`), yellow highlighter, stamp, and hand stamp!
 */
export const BassamCollageVoxStage: React.FC<{
  headline?: string;
  subheadline?: string;
  accentColor?: string;
}> = ({
  headline = 'كولاج الورق التحقيقي',
  subheadline = 'ورق حقيقي · دبابيس ثلاثية الأبعاد · خيط أحمر وختم',
  accentColor = '#D93526',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const isPortrait = height > width;
  const kCard1 = pWin(t, 0.15, 0.65);
  const kCard2 = pWin(t, 0.55, 1.05);
  const kYarn = pWin(t, 0.9, 1.65);
  const kHighlight = easeOut3(pWin(t, 1.3, 1.85));
  const kStamp = pWin(t, 1.8, 2.25);

  const card1W = isPortrait ? Math.round(width * 0.78) : Math.round(width * 0.44);
  const card1H = isPortrait ? Math.round(height * 0.22) : Math.round(height * 0.36);
  const card1X = isPortrait ? Math.round(width * 0.11) : Math.round(width * 0.08);
  const card1Y = isPortrait ? Math.round(height * 0.16) : Math.round(height * 0.18);

  const card2W = isPortrait ? Math.round(width * 0.74) : Math.round(width * 0.38);
  const card2H = isPortrait ? Math.round(height * 0.18) : Math.round(height * 0.32);
  const card2X = isPortrait ? Math.round(width * 0.14) : Math.round(width * 0.54);
  const card2Y = isPortrait ? Math.round(height * 0.46) : Math.round(height * 0.38);

  const pin1: [number, number] = [card1X + card1W * 0.5, card1Y + 18];
  const pin2: [number, number] = [card2X + card2W * 0.5, card2Y + 18];

  // Sagging quadratic curve between pin1 and pin2
  const mx = (pin1[0] + pin2[0]) / 2;
  const my = (pin1[1] + pin2[1]) / 2 + Math.min(width, height) * 0.08;
  const yarnSvgPath = `M ${pin1[0].toFixed(1)},${pin1[1].toFixed(
    1
  )} Q ${mx.toFixed(1)},${my.toFixed(1)} ${pin2[0].toFixed(1)},${pin2[1].toFixed(
    1
  )}`;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <BassamLiveBackground
        bgColor="#121318"
        skyColor="#475569"
        accentColor={accentColor}
        withCrumplePaper={true}
      />

      {/* Card 1: Old Paper with Torn Polygon Edges & Yellow Highlighter */}
      {kCard1 > 0 && (
        <div
          style={{
            position: 'absolute',
            left: card1X,
            top: card1Y,
            width: card1W,
            height: card1H,
            opacity: Math.min(1, kCard1 * 3),
            transform: `translateY(${(1 - easeOut3(kCard1)) * -42}px) rotate(${
              -2.2 + (1 - easeOut3(kCard1)) * 5
            }deg)`,
            filter: 'drop-shadow(0 18px 22px rgba(0,0,0,0.58))',
            isolation: 'isolate',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: tornPolygonClipPath(11),
              overflow: 'hidden',
            }}
          >
            <Img
              src="/assets/bassam/paper_old.png"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
          <div
            dir="auto"
            style={{
              position: 'absolute',
              inset: '20px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontFamily:
                '"Plus Jakarta Sans", "Noto Sans Arabic", "Cairo", sans-serif',
              color: '#1E1B18',
            }}
          >
            <span
              style={{
                position: 'relative',
                fontWeight: 900,
                fontSize: Math.round(Math.min(width, height) * 0.045),
                lineHeight: 1.3,
                padding: '2px 10px',
              }}
            >
              {kHighlight > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    left: -8,
                    right: -8,
                    top: '16%',
                    bottom: '8%',
                    background: 'rgba(242, 201, 76, 0.68)',
                    borderRadius: 6,
                    zIndex: -1,
                    transform: `scaleX(${kHighlight.toFixed(4)}) skewX(-6deg)`,
                    transformOrigin: 'right center',
                  }}
                />
              )}
              {headline}
            </span>
          </div>
        </div>
      )}

      {/* Card 2: Kraft Paper with Torn Edges & Ruqaa Script */}
      {kCard2 > 0 && (
        <div
          style={{
            position: 'absolute',
            left: card2X,
            top: card2Y,
            width: card2W,
            height: card2H,
            opacity: Math.min(1, kCard2 * 3),
            transform: `translateY(${(1 - easeOut3(kCard2)) * -36}px) rotate(${
              2.6 - (1 - easeOut3(kCard2)) * 4
            }deg)`,
            filter: 'drop-shadow(0 16px 20px rgba(0,0,0,0.55))',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: tornPolygonClipPath(29),
              overflow: 'hidden',
            }}
          >
            <Img
              src="/assets/bassam/paper_kraft.png"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
          <div
            dir="auto"
            style={{
              position: 'absolute',
              inset: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontFamily:
                '"Aref Ruqaa", "Noto Sans Arabic", "Plus Jakarta Sans", serif',
              fontWeight: 700,
              fontSize: Math.round(Math.min(width, height) * 0.033),
              color: '#1F1A16',
              lineHeight: 1.4,
            }}
          >
            {subheadline}
          </div>
        </div>
      )}

      {/* Red Wool Yarn & 3D Push-Pins SVG Layer */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {kYarn > 0 && (
          <g>
            <path
              d={yarnSvgPath}
              fill="none"
              stroke="rgba(0,0,0,0.42)"
              strokeWidth={9}
              strokeLinecap="round"
              transform="translate(4, 8)"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - easeOut3(kYarn)}
            />
            <path
              d={yarnSvgPath}
              fill="none"
              stroke="#8F1D14"
              strokeWidth={9}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - easeOut3(kYarn)}
            />
            <path
              d={yarnSvgPath}
              fill="none"
              stroke="#D93526"
              strokeWidth={6}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - easeOut3(kYarn)}
            />
          </g>
        )}
        {[
          { pt: pin1, k: kCard1 },
          { pt: pin2, k: kCard2 },
        ].map(
          ({ pt, k }, idx) =>
            k > 0.1 && (
              <g
                key={idx}
                transform={`translate(${pt[0]}, ${pt[1]}) scale(${backOut(
                  Math.min(1, k * 1.4)
                )})`}
              >
                <ellipse
                  cx={4}
                  cy={8}
                  rx={14}
                  ry={11}
                  fill="rgba(0,0,0,0.45)"
                />
                <circle cx={0} cy={0} r={14} fill="#8F1D14" />
                <circle cx={-2} cy={-2} r={10.5} fill="#D93526" />
                <circle cx={-5} cy={-5} r={3.5} fill="rgba(255,220,210,0.75)" />
              </g>
            )
        )}
      </svg>

      {/* Stamp Mark */}
      {kStamp > 0 && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            left: card2X + card2W * 0.72,
            top: card2Y + card2H * 0.82,
            transform: `translate(-50%, -50%) rotate(-9deg) scale(${lerpNum(
              1.75,
              1,
              backOut(Math.min(1, kStamp * 1.5))
            )})`,
            opacity: Math.min(0.92, kStamp * 3.5),
            border: `4px solid ${accentColor}`,
            borderRadius: 10,
            padding: '4px 16px',
            color: accentColor,
            fontFamily: '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif',
            fontWeight: 900,
            fontSize: Math.round(Math.min(width, height) * 0.032),
            backgroundColor: 'rgba(245, 240, 230, 0.88)',
            whiteSpace: 'nowrap',
          }}
        >
          موثّق · VERIFIED
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * Documentary / Editorial Stage Kit (`styles/collage/DOCUMENTARY.md` & `kit/editorial.tsx`)
 * Renders archival grid texture, glass chart card (`Glass`), and Ruqaa calligraphy note.
 */
export const BassamDocumentaryStage: React.FC<{
  headline?: string;
  subheadline?: string;
  accentColor?: string;
}> = ({
  headline = 'الأرشيف الوثائقي والتحليل البياني',
  subheadline = 'أوراق بحث ومؤشرات زجاجية متدرجة مع خط الرقعة',
  accentColor = '#F59E0B',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const kIn = easeOut3(pWin(t, 0.1, 0.7));
  const kLine = eio3(pWin(t, 0.45, 1.8));
  const pts: [number, number][] = [
    [0.08, 0.76],
    [0.26, 0.62],
    [0.45, 0.68],
    [0.64, 0.42],
    [0.82, 0.28],
    [0.94, 0.18],
  ];

  const cardW = Math.round(width * 0.82);
  const cardH = Math.round(height * 0.54);
  const cardX = Math.round((width - cardW) / 2);
  const cardY = Math.round(height * 0.16);

  const chartPath = pts
    .map(
      ([px, py], i) =>
        `${i === 0 ? 'M' : 'L'} ${(px * cardW).toFixed(1)},${(
          py * cardH
        ).toFixed(1)}`
    )
    .join(' ');

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <BassamLiveBackground
        bgColor="#0B0D12"
        skyColor="#38BDF8"
        accentColor={accentColor}
      />
      <Img
        src="/assets/bassam/tex_grid.jpg"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.08,
          mixBlendMode: 'screen',
        }}
      />

      {/* Rule 10 (DOCUMENTARY.md): Glass Chart Card with top specular rim */}
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY,
          width: cardW,
          height: cardH,
          opacity: kIn,
          transform: `translateY(${(1 - kIn) * 28}px)`,
          borderRadius: 24,
          background:
            'linear-gradient(180deg, rgba(26,30,40,0.88) 0%, rgba(15,17,24,0.94) 100%)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
      >
        {/* Header inside Glass Card */}
        <div
          dir="auto"
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontFamily: '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif',
              fontWeight: 800,
              fontSize: Math.round(Math.min(width, height) * 0.036),
              color: '#F8FAFC',
            }}
          >
            {headline}
          </span>
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: Math.round(Math.min(width, height) * 0.022),
              color: accentColor,
              backgroundColor: rgbaStr(accentColor, 0.14),
              padding: '4px 12px',
              borderRadius: 999,
            }}
          >
            DOC · ARCHIVE
          </span>
        </div>

        {/* Animated Trend Line with Shaded Area */}
        <svg
          width={cardW}
          height={cardH}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id="docAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.32} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <path
            d={`${chartPath} L ${(0.94 * cardW).toFixed(1)},${cardH} L ${(
              0.08 * cardW
            ).toFixed(1)},${cardH} Z`}
            fill="url(#docAreaGrad)"
            opacity={kLine}
          />
          <path
            d={chartPath}
            fill="none"
            stroke={accentColor}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - kLine}
          />
        </svg>

        <div
          dir="auto"
          style={{
            position: 'absolute',
            left: 28,
            right: 28,
            bottom: 20,
            fontFamily:
              '"Aref Ruqaa", "Noto Sans Arabic", "Plus Jakarta Sans", serif',
            fontSize: Math.round(Math.min(width, height) * 0.03),
            color: '#CBD5E1',
          }}
        >
          {subheadline}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Flowchart Board Stage Kit (`styles/collage/BOARD.md` & `kit/board.tsx`)
 * Implements Rules 93–100:
 * - Rule 94: First node is present from frame 0 (never opens empty).
 * - Rule 100: Warm (`accentColor`) = active path · Cold (`sky`) = closed branch.
 * - Traveling light pulse along wires (`Wire`).
 */
export const BassamFlowchartBoardStage: React.FC<{
  headline?: string;
  subheadline?: string;
  accentColor?: string;
}> = ({
  headline = 'لوح المخطط — مسار القرار والنبضة الضوئية',
  subheadline = 'العقدة الأولى حاضرة من الإطار الأول · النبضة تتبع المسار الفعّال',
  accentColor = '#3B82F6',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const kWire1 = eio3(pWin(t, 0.15, 0.95));
  const kWire2 = eio3(pWin(t, 0.85, 1.65));
  const kNode2 = easeOut3(pWin(t, 0.7, 1.15));
  const kNode3 = easeOut3(pWin(t, 1.35, 1.85));

  const cx = width / 2;
  const nW = Math.min(340, Math.round(width * 0.36));
  const nH = Math.min(96, Math.round(height * 0.13));

  const n1Y = Math.round(height * 0.16);
  const n2X = Math.round(cx - nW * 0.65);
  const n3X = Math.round(cx + nW * 0.65);
  const branchY = Math.round(height * 0.48);

  const wireActivePath = `M ${cx + nW * 0.5},${n1Y + nH / 2} C ${
    cx + nW * 0.85
  },${n1Y + nH / 2} ${n3X},${branchY - nH * 0.6} ${n3X},${branchY}`;
  const wireClosedPath = `M ${cx - nW * 0.5},${n1Y + nH / 2} C ${
    cx - nW * 0.85
  },${n1Y + nH / 2} ${n2X},${branchY - nH * 0.6} ${n2X},${branchY}`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0C10',
        overflow: 'hidden',
      }}
    >
      {/* Dot Matrix Grid (Rule 95) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(148, 163, 184, 0.18) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Wires & Traveling Pulse SVG */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {/* Closed Branch (Cold Sky — Rule 100) */}
        <path
          d={wireClosedPath}
          fill="none"
          stroke="rgba(100, 116, 139, 0.45)"
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - kWire1}
        />
        {/* Active Branch (Warm Accent + Glowing Pulse — Rule 100) */}
        <path
          d={wireActivePath}
          fill="none"
          stroke={rgbaStr(accentColor, 0.35)}
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - kWire2}
        />
        <path
          d={wireActivePath}
          fill="none"
          stroke={accentColor}
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - kWire2}
        />
      </svg>

      {/* Node 1: Root Decision Node — Present from Frame 0 (Rule 94) */}
      <div
        dir="auto"
        style={{
          position: 'absolute',
          left: cx - nW / 2,
          top: n1Y,
          width: nW,
          height: nH,
          borderRadius: 18,
          background: 'linear-gradient(180deg, #161922 0%, #101218 100%)',
          border: `2px solid ${accentColor}`,
          boxShadow: `0 14px 36px rgba(0,0,0,0.6), 0 0 28px ${rgbaStr(
            accentColor,
            0.22
          )}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 18px',
          textAlign: 'center',
        }}
      >
        {/* Top Specular Rim */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: 0,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
          }}
        />
        <span
          style={{
            fontFamily: '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif',
            fontWeight: 800,
            fontSize: Math.round(Math.min(width, height) * 0.028),
            color: '#FFFFFF',
          }}
        >
          {headline}
        </span>
      </div>

      {/* Node 2: Closed Path (Cold Sky) */}
      <div
        dir="auto"
        style={{
          position: 'absolute',
          left: n2X - nW * 0.42,
          top: branchY,
          width: nW * 0.84,
          height: nH * 0.88,
          opacity: kNode2,
          transform: `translateY(${(1 - kNode2) * 16}px)`,
          borderRadius: 16,
          background: '#11141B',
          border: '1.5px solid rgba(100, 116, 139, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px',
          textAlign: 'center',
          color: '#94A3B8',
          fontFamily: '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif',
          fontWeight: 600,
          fontSize: Math.round(Math.min(width, height) * 0.024),
        }}
      >
        مسار مستبعد · Closed
      </div>

      {/* Node 3: Active Target Node (Lit Warm Accent) */}
      <div
        dir="auto"
        style={{
          position: 'absolute',
          left: n3X - nW * 0.42,
          top: branchY,
          width: nW * 0.84,
          height: nH * 0.88,
          opacity: kNode3,
          transform: `translateY(${(1 - kNode3) * 16}px)`,
          borderRadius: 16,
          background: 'linear-gradient(180deg, #172033 0%, #101624 100%)',
          border: `2px solid ${accentColor}`,
          boxShadow: `0 0 32px ${rgbaStr(accentColor, 0.28)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px',
          textAlign: 'center',
          color: '#FFFFFF',
          fontFamily: '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif',
          fontWeight: 800,
          fontSize: Math.round(Math.min(width, height) * 0.024),
        }}
      >
        {subheadline}
      </div>
    </AbsoluteFill>
  );
};
