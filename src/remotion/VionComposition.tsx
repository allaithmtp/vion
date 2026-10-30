import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  useCurrentFrame,
  getRemotionEnvironment,
  useVideoConfig,
  Video,
} from 'remotion';
import type {
  EditPlanAssetRef,
  EditPlanAudioTrack,
  EditPlanTextOverlay,
  EditPlanVideoClip,
  UnifiedEditPlan,
} from './editPlanSchema';
import { MotionTemplateRemotionLayer } from './MotionStyleCanvasAdapter';
import { MOTION_TEMPLATES_20 } from './motionTemplates20';
import {
  BassamCollageVoxStage,
  BassamDocumentaryStage,
  BassamFlowchartBoardStage,
  BassamLiveBackground,
  easeOut3,
  pWin,
} from './BassamStageKits';

export interface VionCompositionProps {
  plan: UnifiedEditPlan;
}

function computeFadeEnvelope(
  localFrame: number,
  durationInFrames: number,
  fadeInFrames: number,
  fadeOutFrames: number
): number {
  const safeDuration = Math.max(2, durationInFrames);
  const fadeIn =
    fadeInFrames > 0
      ? interpolate(localFrame, [0, fadeInFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  const fadeOutStart = Math.max(0, safeDuration - Math.max(1, fadeOutFrames));
  const fadeOut =
    fadeOutFrames > 0
      ? interpolate(localFrame, [fadeOutStart, safeDuration - 1], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  return Math.min(fadeIn, fadeOut);
}

const MotionGraphicsStageLayer: React.FC<{
  clip: EditPlanVideoClip;
}> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const opacity = computeFadeEnvelope(
    frame,
    clip.durationInFrames,
    clip.fadeInFrames,
    clip.fadeOutFrames
  );

  // Deterministic frame-based subtle zoom using smooth cubic easing
  const scale = interpolate(
    frame,
    [0, Math.max(1, clip.durationInFrames - 1)],
    [clip.zoomStart, clip.zoomEnd],
    {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const candidateStyleId = clip.motionStyleId || clip.motionTheme || '';
  const normalizedMotionId = candidateStyleId.startsWith('motion-')
    ? candidateStyleId
    : `motion-${candidateStyleId}`;

  // 1. Check if this clip targets one of the 20 deterministic HTML5 Canvas motion templates
  if (MOTION_TEMPLATES_20[normalizedMotionId]) {
    return (
      <MotionTemplateRemotionLayer
        styleId={normalizedMotionId}
        alpha={Boolean(clip.motionAlpha)}
        text={clip.motionText}
        sub={clip.motionSub}
        opacity={opacity}
        scale={scale}
      />
    );
  }

  // 2. Check if this clip targets one of the 4 Bassam Remotion Stage Kits
  if (candidateStyleId === 'bassam-collage-vox') {
    return (
      <AbsoluteFill style={{ opacity }}>
        <BassamCollageVoxStage
          headline={clip.motionText}
          subheadline={clip.motionSub}
        />
      </AbsoluteFill>
    );
  }

  if (
    candidateStyleId === 'bassam-documentary' ||
    candidateStyleId === 'minimal-documentary'
  ) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <BassamDocumentaryStage
          headline={clip.motionText}
          subheadline={clip.motionSub}
        />
      </AbsoluteFill>
    );
  }

  if (candidateStyleId === 'bassam-board-flowchart') {
    return (
      <AbsoluteFill style={{ opacity }}>
        <BassamFlowchartBoardStage
          headline={clip.motionText}
          subheadline={clip.motionSub}
        />
      </AbsoluteFill>
    );
  }

  if (candidateStyleId === 'bassam-simple') {
    return (
      <AbsoluteFill style={{ opacity }}>
        <BassamLiveBackground />
      </AbsoluteFill>
    );
  }

  const orbitAngle = (frame / fps) * 36;
  const pulse = Math.sin((frame / fps) * Math.PI * 2) * 0.5 + 0.5;
  const barCount = 28;

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: '#090B10',
        overflow: 'hidden',
      }}
    >
      {/* Subtle Radial Glow & Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate3d(0, 0, 0) scale3d(${scale.toFixed(6)}, ${scale.toFixed(6)}, 1)`,
          transformOrigin: '50% 50%',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          background:
            'radial-gradient(circle at 50% 42%, rgba(37, 99, 235, 0.28) 0%, rgba(14, 18, 28, 0.92) 56%, #090B10 100%)',
        }}
      />

      {/* Animated Geometric Grid Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          transform: `translate3d(0, ${((frame * 0.6) % 64).toFixed(3)}px, 0)`,
        }}
      />

      {/* Orbiting Blue Rings */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - 220,
          top: height / 2 - 220,
          width: 440,
          height: 440,
          borderRadius: '9999px',
          border: '1.5px solid rgba(59, 130, 246, 0.28)',
          transform: `rotate(${orbitAngle.toFixed(3)}deg) scale(${(0.96 + pulse * 0.06).toFixed(5)})`,
          boxShadow: '0 0 80px rgba(37, 99, 235, 0.22)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: width / 2 - 150,
          top: height / 2 - 150,
          width: 300,
          height: 300,
          borderRadius: '9999px',
          border: '1px dashed rgba(96, 165, 250, 0.35)',
          transform: `rotate(${(-orbitAngle * 1.3).toFixed(3)}deg)`,
        }}
      />

      {/* Deterministic Frame-Driven Waveform Bars at Bottom Third */}
      <div
        style={{
          position: 'absolute',
          left: '12%',
          right: '12%',
          bottom: Math.round(height * 0.19),
          height: 84,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {Array.from({ length: barCount }).map((_, idx) => {
          const phase = (frame / fps) * 6 + idx * 0.45;
          const wave = Math.abs(Math.sin(phase) * Math.cos(phase * 0.65));
          const barHeight = Math.round(14 + wave * 64);
          return (
            <div
              key={idx}
              style={{
                width: 8,
                height: barHeight,
                borderRadius: 999,
                background:
                  idx % 3 === 0
                    ? '#60A5FA'
                    : idx % 2 === 0
                      ? '#3B82F6'
                      : '#1D4ED8',
                opacity: 0.85,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SourceVideoClipLayer: React.FC<{
  clip: EditPlanVideoClip;
  asset: EditPlanAssetRef;
  linkedAudioTrack?: EditPlanAudioTrack;
}> = ({ clip, asset, linkedAudioTrack }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const env = getRemotionEnvironment();

  const opacity = computeFadeEnvelope(
    frame,
    clip.durationInFrames,
    clip.fadeInFrames,
    clip.fadeOutFrames
  );

  // Deterministic frame-based subtle zoom without flexbox integer pixel snapping
  const scale = interpolate(
    frame,
    [0, Math.max(1, clip.durationInFrames - 1)],
    [clip.zoomStart, clip.zoomEnd],
    {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const shouldPlayEmbeddedAudio =
    clip.includeClipAudio && Boolean(asset.hasAudioTrack);

  const volumeCallback = (f: number) => {
    if (!shouldPlayEmbeddedAudio) return 0;
    const fadeIn = linkedAudioTrack?.fadeInFrames ?? clip.fadeInFrames;
    const fadeOut = linkedAudioTrack?.fadeOutFrames ?? clip.fadeOutFrames;
    const baseVol = linkedAudioTrack?.volume ?? 1;
    return (
      computeFadeEnvelope(f, clip.durationInFrames, fadeIn, fadeOut) * baseVol
    );
  };

  // Support Bassam Stage Window Framing (FULL, CARD, SIDE, OUTRO) & Face Guard Anchor (Rule 18 & 77)
  const windowMode = clip.stageWindowMode || 'FULL';
  const faceAnchor =
    typeof clip.faceAnchor === 'number' ? clip.faceAnchor : 0.3;

  const isCardWindow = windowMode === 'CARD';
  const isSideWindow = windowMode === 'SIDE';

  const frameRectStyle: React.CSSProperties = isCardWindow
    ? {
        position: 'absolute',
        left: Math.round(width * 0.08),
        top: Math.round(height * 0.16),
        width: Math.round(width * 0.84),
        height: Math.round(height * 0.56),
        borderRadius: 28,
        overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.12)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
      }
    : isSideWindow
      ? {
          position: 'absolute',
          right: Math.round(width * 0.05),
          top: Math.round(height * 0.14),
          width: Math.round(width * 0.42),
          height: Math.round(height * 0.68),
          borderRadius: 24,
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
        }
      : {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        };

  const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: isCardWindow || isSideWindow ? 'cover' : 'contain',
    objectPosition: `50% ${(faceAnchor * 100).toFixed(1)}%`,
    display: 'block',
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity,
        overflow: 'hidden',
      }}
    >
      {(isCardWindow || isSideWindow) && (
        <BassamLiveBackground
          withCrumplePaper={clip.motionTheme === 'bassam-collage-vox'}
        />
      )}
      <div style={frameRectStyle}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: `translate3d(0, 0, 0) scale3d(${scale.toFixed(6)}, ${scale.toFixed(6)}, 1)`,
            transformOrigin: `50% ${(faceAnchor * 100).toFixed(1)}%`,
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        >
          {env.isRendering ? (
            <OffthreadVideo
              src={asset.playbackUrl}
              startFrom={clip.trimBeforeFrames}
              muted={!shouldPlayEmbeddedAudio}
              volume={volumeCallback}
              style={videoStyle}
            />
          ) : (
            <Video
              src={asset.playbackUrl}
              startFrom={clip.trimBeforeFrames}
              muted={!shouldPlayEmbeddedAudio}
              volume={volumeCallback}
              style={videoStyle}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TextOverlayLayer: React.FC<{
  overlay: EditPlanTextOverlay;
}> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tSec = frame / fps;

  const opacity = computeFadeEnvelope(
    frame,
    overlay.durationInFrames,
    overlay.fadeInFrames,
    overlay.fadeOutFrames
  );

  const entranceSpring = spring({
    frame,
    fps,
    config: {
      damping: 18,
      stiffness: 140,
      mass: 0.8,
    },
  });

  const translateY = interpolate(entranceSpring, [0, 1], [18, 0]);

  const alignItems = 'center';
  const justifyContent =
    overlay.position === 'top-title'
      ? 'flex-start'
      : overlay.position === 'center-hero'
        ? 'center'
        : 'flex-end';

  const paddingTop = overlay.position === 'top-title' ? 48 : 0;
  const paddingBottom = overlay.position === 'bottom-caption' ? 48 : 0;
  const isSlim = overlay.captionStyle === 'slim';
  const hasWordSync = Array.isArray(overlay.words) && overlay.words.length > 0;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems,
        justifyContent,
        paddingTop,
        paddingBottom,
        paddingLeft: 48,
        paddingRight: 48,
        opacity,
      }}
    >
      <div
        dir={overlay.direction}
        style={{
          transform: `translate3d(0, ${translateY.toFixed(3)}px, 0)`,
          willChange: 'transform',
          backgroundColor: isSlim
            ? 'rgba(11, 12, 16, 0.56)'
            : 'rgba(11, 12, 16, 0.84)',
          backdropFilter: isSlim ? 'blur(12px)' : undefined,
          border: isSlim
            ? '1px solid rgba(255,255,255,0.14)'
            : `1.5px solid ${overlay.accentColor}`,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
          borderRadius: isSlim ? 999 : 20,
          padding: isSlim ? '12px 26px' : '16px 28px',
          maxWidth: '88%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: overlay.fontFamily,
            fontSize: overlay.fontSizePx,
            fontWeight: overlay.fontWeight,
            color: overlay.color,
            lineHeight: 1.38,
            letterSpacing: overlay.languageTag === 'ar' ? '0px' : '-0.01em',
          }}
        >
          {hasWordSync ? (
            <span
              style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.28em',
              }}
            >
              {overlay.words!.map((w, i) => {
                // Bassam Captions.tsx Rule: words appear progressively as spoken, active word lifts by -4px, hot words get an accent pill
                const spoken = tSec >= w.s - 0.05;
                const active = tSec >= w.s - 0.03 && tSec <= w.e + 0.08;
                const lift = active
                  ? -4 * easeOut3(pWin(tSec, w.s - 0.03, w.s + 0.09))
                  : 0;
                const pillGrow = w.hot
                  ? easeOut3(pWin(tSec, w.s - 0.04, w.s + 0.14))
                  : 0;

                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      position: 'relative',
                      opacity: spoken ? 1 : 0.28,
                      transform: `translate3d(0, ${lift.toFixed(2)}px, 0)`,
                      color:
                        w.hot && spoken
                          ? '#FFFFFF'
                          : active
                            ? overlay.accentColor
                            : overlay.color,
                      padding: w.hot ? '0 8px' : undefined,
                      zIndex: 1,
                    }}
                  >
                    {w.hot && spoken && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: '-2px -4px',
                          backgroundColor: overlay.accentColor,
                          borderRadius: 10,
                          transform: `scaleX(${pillGrow.toFixed(4)})`,
                          transformOrigin:
                            overlay.languageTag === 'ar'
                              ? 'right center'
                              : 'left center',
                          zIndex: -1,
                        }}
                      />
                    )}
                    {w.t}
                  </span>
                );
              })}
            </span>
          ) : (
            overlay.text
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const AudioTrackSequenceLayer: React.FC<{
  track: EditPlanAudioTrack;
  asset: EditPlanAssetRef;
}> = ({ track, asset }) => {
  return (
    <Audio
      src={asset.playbackUrl}
      startFrom={track.trimBeforeFrames}
      volume={(f) => {
        const env = computeFadeEnvelope(
          f,
          track.durationInFrames,
          track.fadeInFrames,
          track.fadeOutFrames
        );
        return env * track.volume;
      }}
    />
  );
};

/**
 * Shared Master Remotion Composition used identically in:
 * 1. Client `@remotion/player` interactive preview
 * 2. Server `@remotion/renderer` headless MP4 export
 */
export const VionMasterComposition: React.FC<VionCompositionProps> = ({
  plan,
}) => {
  const assetMap = new Map<string, EditPlanAssetRef>(
    plan.assets.map((a) => [a.id, a])
  );

  // Track which audio tracks are already handled directly by a source-video clip
  // so we never mount two media elements decoding the same video file simultaneously.
  const handledAudioTrackIds = new Set<string>();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: plan.backgroundColor || '#0B0C0E',
        fontFamily:
          '"Plus Jakarta Sans", "Noto Sans Arabic", "Noto Sans Display", sans-serif',
      }}
    >
      <style>
        {`@font-face {
          font-family: 'Aref Ruqaa';
          src: url('/assets/bassam/ArefRuqaa-Bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
          font-display: block;
        }`}
      </style>

      {/* 1. Video & Motion Graphics Clips */}
      {plan.clips.map((clip) => {
        const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
        let linkedAudioTrack: EditPlanAudioTrack | undefined;
        if (clip.kind === 'source-video' && clip.includeClipAudio && asset) {
          linkedAudioTrack = plan.audioTracks.find(
            (t) =>
              t.assetId === asset.id &&
              t.startFrame === clip.startFrame &&
              t.trimBeforeFrames === clip.trimBeforeFrames
          );
          if (linkedAudioTrack) {
            handledAudioTrackIds.add(linkedAudioTrack.id);
          }
        }

        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
          >
            {clip.kind === 'source-video' && asset ? (
              <SourceVideoClipLayer
                clip={clip}
                asset={asset}
                linkedAudioTrack={linkedAudioTrack}
              />
            ) : (
              <MotionGraphicsStageLayer clip={clip} />
            )}
          </Sequence>
        );
      })}

      {/* 2. Bilingual Text Overlays & Word-Timed Captions (AR RTL & EN LTR) */}
      {plan.textOverlays.map((overlay) => (
        <Sequence
          key={overlay.id}
          from={overlay.startFrame}
          durationInFrames={overlay.durationInFrames}
        >
          <TextOverlayLayer overlay={overlay} />
        </Sequence>
      ))}

      {/* 3. Standalone Audio Tracks (e.g., Voiceover Audio in Test 2) */}
      {plan.audioTracks.map((track) => {
        if (handledAudioTrackIds.has(track.id)) {
          return null;
        }
        const asset = assetMap.get(track.assetId);
        if (!asset) return null;
        return (
          <Sequence
            key={track.id}
            from={track.startFrame}
            durationInFrames={track.durationInFrames}
          >
            <AudioTrackSequenceLayer track={track} asset={asset} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
