import { z } from 'zod';

/**
 * VION — Unified Versioned Edit Plan Schema (v1.0.0)
 * Shared across Client Remotion Player Preview, Server Validation, and Node.js Remotion Render Worker.
 */

export const EDIT_PLAN_SCHEMA_VERSION = '1.0.0' as const;

export const EditPlanAssetRefSchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(['raw-video', 'voiceover-audio', 'b-roll', 'brand-graphic']),
  fileName: z.string().min(1).max(255),
  /**
   * URL accessible to both Remotion Player in browser and headless Chromium in the render worker.
   */
  playbackUrl: z.string().min(1).max(2048),
  durationSeconds: z.number().positive().max(3600),
  width: z.number().int().positive().max(7680).optional(),
  height: z.number().int().positive().max(7680).optional(),
  hasAudioTrack: z.boolean().default(true),
});

export const EditPlanVideoClipSchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(['source-video', 'motion-background']),
  assetId: z.string().min(1).max(128).optional(),
  startFrame: z.number().int().min(0),
  durationInFrames: z.number().int().min(1).max(36000),
  trimBeforeFrames: z.number().int().min(0).default(0),
  zoomStart: z.number().min(0.5).max(2.5).default(1.0),
  zoomEnd: z.number().min(0.5).max(2.5).default(1.08),
  fadeInFrames: z.number().int().min(0).max(300).default(15),
  fadeOutFrames: z.number().int().min(0).max(300).default(15),
  includeClipAudio: z.boolean().default(true),
  motionTheme: z.string().min(1).max(80).default('obsidian-orbit'),
  motionStyleId: z.string().min(1).max(80).optional(),
  motionAlpha: z.boolean().default(false),
  motionText: z.string().max(240).optional(),
  motionSub: z.string().max(240).optional(),
  stageWindowMode: z
    .enum(['FULL', 'CARD', 'SIDE', 'OUTRO'])
    .default('FULL')
    .optional(),
  faceAnchor: z.number().min(0).max(1).default(0.3).optional(),
});

export const EditPlanWordTimingSchema = z.object({
  t: z.string().min(1).max(120),
  s: z.number().min(0),
  e: z.number().min(0),
  hot: z.boolean().optional(),
});

export const EditPlanTextOverlaySchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string().min(1).max(500),
  direction: z.enum(['rtl', 'ltr', 'auto']).default('auto'),
  languageTag: z.enum(['ar', 'en']).default('en'),
  fontFamily: z.string().min(1).max(160),
  fontSizePx: z.number().int().min(14).max(140).default(44),
  fontWeight: z.enum(['500', '600', '700', '800', '900']).default('700'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  position: z.enum(['top-title', 'center-hero', 'bottom-caption']),
  captionStyle: z.enum(['card', 'slim']).default('card').optional(),
  words: z.array(EditPlanWordTimingSchema).optional(),
  startFrame: z.number().int().min(0),
  durationInFrames: z.number().int().min(1).max(36000),
  fadeInFrames: z.number().int().min(0).max(180).default(12),
  fadeOutFrames: z.number().int().min(0).max(180).default(12),
});

export const EditPlanAudioTrackSchema = z.object({
  id: z.string().min(1).max(128),
  assetId: z.string().min(1).max(128),
  startFrame: z.number().int().min(0),
  durationInFrames: z.number().int().min(1).max(36000),
  trimBeforeFrames: z.number().int().min(0).default(0),
  volume: z.number().min(0).max(2).default(1.0),
  fadeInFrames: z.number().int().min(0).max(300).default(10),
  fadeOutFrames: z.number().int().min(0).max(300).default(15),
});

export const UnifiedEditPlanSchema = z
  .object({
    schemaVersion: z.literal(EDIT_PLAN_SCHEMA_VERSION),
    id: z.string().min(1).max(128),
    projectId: z.string().min(1).max(128),
    modelId: z.string().min(1).max(64).default('brain-1.8'),
    modelVersion: z.number().int().min(1).default(1),
    rulesVersion: z.number().int().min(1).default(1),
    styleId: z.string().min(1).max(80).optional(),
    planMode: z.enum([
      'video-10s-bilingual-test',
      'audio-10s-motion-test',
      'custom',
    ]),
    title: z.string().min(1).max(200),
    fps: z.union([z.literal(30), z.literal(60)]).default(30),
    width: z.number().int().min(320).max(3840).default(1280),
    height: z.number().int().min(320).max(3840).default(720),
    durationInFrames: z.number().int().min(15).max(36000),
    durationSeconds: z.number().positive().max(600),
    backgroundColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .default('#0B0C0E'),
    assets: z.array(EditPlanAssetRefSchema).min(1),
    clips: z.array(EditPlanVideoClipSchema).min(1),
    textOverlays: z.array(EditPlanTextOverlaySchema),
    audioTracks: z.array(EditPlanAudioTrackSchema),
    createdAt: z.string(),
  })
  .superRefine((plan, ctx) => {
    const assetIds = new Set(plan.assets.map((a) => a.id));

    for (const clip of plan.clips) {
      if (clip.kind === 'source-video') {
        if (!clip.assetId || !assetIds.has(clip.assetId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Video clip "${clip.id}" references missing assetId "${clip.assetId ?? ''}".`,
            path: ['clips'],
          });
        }
      }
      if (clip.startFrame + clip.durationInFrames > plan.durationInFrames + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Clip "${clip.id}" exceeds plan total durationInFrames (${plan.durationInFrames}).`,
          path: ['clips'],
        });
      }
    }

    for (const track of plan.audioTracks) {
      if (!assetIds.has(track.assetId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Audio track "${track.id}" references missing assetId "${track.assetId}".`,
          path: ['audioTracks'],
        });
      }
    }
  });

export type EditPlanAssetRef = z.infer<typeof EditPlanAssetRefSchema>;
export type EditPlanVideoClip = z.infer<typeof EditPlanVideoClipSchema>;
export type EditPlanWordTiming = z.infer<typeof EditPlanWordTimingSchema>;
export type EditPlanTextOverlay = z.infer<typeof EditPlanTextOverlaySchema>;
export type EditPlanAudioTrack = z.infer<typeof EditPlanAudioTrackSchema>;
export type UnifiedEditPlan = z.infer<typeof UnifiedEditPlanSchema>;

export function validateUnifiedEditPlan(input: unknown): {
  valid: boolean;
  plan?: UnifiedEditPlan;
  errors?: string[];
} {
  const parsed = UnifiedEditPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (iss) => `${iss.path.join('.') || 'root'}: ${iss.message}`
      ),
    };
  }
  return {
    valid: true,
    plan: parsed.data,
  };
}

/**
 * Generates deterministic word-by-word timings (`s`, `e`, `t`, `hot`) for a sentence
 * across `[startSec, endSec]` following Bassam's `02_captions.py` & `Captions.tsx` format.
 */
export function buildWordTimingsForSentence(
  sentence: string,
  startSec: number,
  endSec: number,
  hotWords: string[] = []
): EditPlanWordTiming[] {
  const tokens = sentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (tokens.length === 0) return [];
  const totalSec = Math.max(0.5, endSec - startSec - 0.25);
  const step = totalSec / tokens.length;
  const hotSet = new Set(hotWords);

  return tokens.map((token, idx) => {
    const s = Number((startSec + idx * step).toFixed(3));
    const e = Number(Math.max(s + 0.12, startSec + (idx + 1) * step).toFixed(3));
    const isHot =
      hotSet.has(token) ||
      token === 'VION' ||
      token === 'Remotion' ||
      token === 'مباشر' ||
      token === 'موشن';
    return {
      t: token,
      s,
      e,
      hot: isHot,
    };
  });
}

/**
 * Deterministic Non-AI Test 1 Builder:
 * Uploaded Video -> First 10 seconds (or source duration if shorter),
 * with an Arabic title, an English title, subtle zoom (1.0 -> 1.08), fade in/out,
 * word-by-word Arabic caption synchronization, and optional partial motion overlay.
 */
export function buildVideo10sBilingualTestPlan(params: {
  projectId: string;
  asset: EditPlanAssetRef;
  modelId?: string;
  modelVersion?: number;
  rulesVersion?: number;
  styleId?: string;
  arabicTitle?: string;
  englishTitle?: string;
}): UnifiedEditPlan {
  const fps = 30 as const;
  const clipDurationSec = Math.min(
    10,
    Math.max(1, Number(params.asset.durationSeconds) || 5)
  );
  const durationInFrames = Math.max(30, Math.round(clipDurationSec * fps));
  const fadeFrames = Math.min(18, Math.floor(durationInFrames / 4));

  const isPortrait =
    params.asset.width &&
    params.asset.height &&
    params.asset.height > params.asset.width;
  const width = isPortrait ? 720 : 1280;
  const height = isPortrait ? 1280 : 720;

  const arTitle =
    params.arabicTitle?.trim() ||
    'اختبار محرك VION — معالجة ورندر الفيديو المباشر';
  const enTitle =
    params.englishTitle?.trim() ||
    'VION Engine Test — 10s Bilingual Zoom & Fade';

  const activeStyleId = params.styleId || 'clean-cut-studio';
  const isMotionOverlayStyle = activeStyleId.startsWith('motion-');

  const clips: EditPlanVideoClip[] = [
    {
      id: 'clip_main_video_10s',
      kind: 'source-video',
      assetId: params.asset.id,
      startFrame: 0,
      durationInFrames,
      trimBeforeFrames: 0,
      zoomStart: 1.0,
      zoomEnd: 1.08,
      fadeInFrames: fadeFrames,
      fadeOutFrames: fadeFrames,
      includeClipAudio: Boolean(params.asset.hasAudioTrack),
      motionTheme: activeStyleId,
      stageWindowMode:
        activeStyleId === 'bassam-collage-vox' ||
        activeStyleId === 'bassam-documentary' ||
        activeStyleId === 'bassam-board-flowchart'
          ? 'CARD'
          : 'FULL',
      faceAnchor: 0.3,
    },
  ];

  // If the user selected one of the 20 partial motion styles for a video edit,
  // composite it as a transparent Alpha overlay layer above the source video!
  if (isMotionOverlayStyle) {
    clips.push({
      id: 'clip_motion_alpha_overlay_10s',
      kind: 'motion-background',
      startFrame: 0,
      durationInFrames,
      trimBeforeFrames: 0,
      zoomStart: 1.0,
      zoomEnd: 1.02,
      fadeInFrames: fadeFrames,
      fadeOutFrames: fadeFrames,
      includeClipAudio: false,
      motionTheme: activeStyleId,
      motionStyleId: activeStyleId,
      motionAlpha: true,
      motionText: 'VION',
      motionSub: arTitle,
    });
  }

  return {
    schemaVersion: EDIT_PLAN_SCHEMA_VERSION,
    id: `plan_vid10s_${Date.now()}`,
    projectId: params.projectId,
    modelId: params.modelId || 'brain-1.8',
    modelVersion: params.modelVersion ?? 1,
    rulesVersion: params.rulesVersion ?? 1,
    styleId: activeStyleId,
    planMode: 'video-10s-bilingual-test',
    title: 'Test 1 · 10s Video + AR/EN Titles + Subtle Zoom & Fade',
    fps,
    width,
    height,
    durationInFrames,
    durationSeconds: Math.round((durationInFrames / fps) * 100) / 100,
    backgroundColor: '#0B0C0E',
    assets: [params.asset],
    clips,
    textOverlays: [
      {
        id: 'txt_arabic_headline',
        text: arTitle,
        direction: 'rtl',
        languageTag: 'ar',
        fontFamily: '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif',
        fontSizePx: isPortrait ? 34 : 40,
        fontWeight: '700',
        color: '#FFFFFF',
        accentColor: '#3B82F6',
        position: 'top-title',
        words: buildWordTimingsForSentence(arTitle, 0.15, clipDurationSec),
        startFrame: 0,
        durationInFrames,
        fadeInFrames: fadeFrames,
        fadeOutFrames: fadeFrames,
      },
      {
        id: 'txt_english_subtitle',
        text: enTitle,
        direction: 'ltr',
        languageTag: 'en',
        fontFamily: '"Plus Jakarta Sans", "Noto Sans Display", sans-serif',
        fontSizePx: isPortrait ? 26 : 30,
        fontWeight: '600',
        color: '#E4E4E7',
        accentColor: '#2563EB',
        position: 'bottom-caption',
        captionStyle: isPortrait ? 'slim' : 'card',
        startFrame: 0,
        durationInFrames,
        fadeInFrames: fadeFrames,
        fadeOutFrames: fadeFrames,
      },
    ],
    audioTracks: params.asset.hasAudioTrack
      ? [
          {
            id: 'aud_from_video_source',
            assetId: params.asset.id,
            startFrame: 0,
            durationInFrames,
            trimBeforeFrames: 0,
            volume: 1.0,
            fadeInFrames: Math.min(12, fadeFrames),
            fadeOutFrames: Math.min(15, fadeFrames),
          },
        ]
      : [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Deterministic Non-AI Test 2 Builder:
 * Uploaded Audio File -> First 10 seconds (or duration if shorter),
 * over an animated motion graphics background (supporting all 20 Claude motion styles & 4 Bassam stage styles)
 * and synchronized word-timed title overlay.
 */
export function buildAudio10sMotionTestPlan(params: {
  projectId: string;
  asset: EditPlanAssetRef;
  modelId?: string;
  modelVersion?: number;
  rulesVersion?: number;
  styleId?: string;
  headlineText?: string;
  subheadlineText?: string;
}): UnifiedEditPlan {
  const fps = 30 as const;
  const clipDurationSec = Math.min(
    10,
    Math.max(1, Number(params.asset.durationSeconds) || 5)
  );
  const durationInFrames = Math.max(30, Math.round(clipDurationSec * fps));
  const fadeFrames = Math.min(18, Math.floor(durationInFrames / 4));

  const headline =
    params.headlineText?.trim() ||
    'تحويل التعليق الصوتي إلى موشن جرافيك · Voiceover Motion Stage';
  const subheadline =
    params.subheadlineText?.trim() ||
    `Source Audio: ${params.asset.fileName} (${clipDurationSec.toFixed(1)}s)`;

  const activeStyleId = params.styleId || 'motion-particles';

  return {
    schemaVersion: EDIT_PLAN_SCHEMA_VERSION,
    id: `plan_aud10s_${Date.now()}`,
    projectId: params.projectId,
    modelId: params.modelId || 'brain-1.8',
    modelVersion: params.modelVersion ?? 1,
    rulesVersion: params.rulesVersion ?? 1,
    styleId: activeStyleId,
    planMode: 'audio-10s-motion-test',
    title: `Test 2 · 10s Audio + Motion Stage (${activeStyleId})`,
    fps,
    width: 1280,
    height: 720,
    durationInFrames,
    durationSeconds: Math.round((durationInFrames / fps) * 100) / 100,
    backgroundColor: '#0B0C0E',
    assets: [params.asset],
    clips: [
      {
        id: 'clip_motion_canvas_10s',
        kind: 'motion-background',
        startFrame: 0,
        durationInFrames,
        trimBeforeFrames: 0,
        zoomStart: 1.0,
        zoomEnd: 1.06,
        fadeInFrames: fadeFrames,
        fadeOutFrames: fadeFrames,
        includeClipAudio: false,
        motionTheme: activeStyleId,
        motionStyleId: activeStyleId,
        motionAlpha: false,
        motionText: 'VION',
        motionSub: 'تحويل الصوت إلى موشن',
      },
    ],
    textOverlays: [
      {
        id: 'txt_motion_hero_title',
        text: headline,
        direction: 'auto',
        languageTag: 'ar',
        fontFamily: '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif',
        fontSizePx: 40,
        fontWeight: '700',
        color: '#FFFFFF',
        accentColor: '#3B82F6',
        position: 'top-title',
        words: buildWordTimingsForSentence(headline, 0.15, clipDurationSec),
        startFrame: 0,
        durationInFrames,
        fadeInFrames: fadeFrames,
        fadeOutFrames: fadeFrames,
      },
      {
        id: 'txt_motion_bottom_meta',
        text: subheadline,
        direction: 'ltr',
        languageTag: 'en',
        fontFamily: '"Plus Jakarta Sans", "Noto Sans Display", sans-serif',
        fontSizePx: 24,
        fontWeight: '600',
        color: '#93C5FD',
        accentColor: '#2563EB',
        position: 'bottom-caption',
        startFrame: 0,
        durationInFrames,
        fadeInFrames: fadeFrames,
        fadeOutFrames: fadeFrames,
      },
    ],
    audioTracks: [
      {
        id: 'aud_voiceover_main_10s',
        assetId: params.asset.id,
        startFrame: 0,
        durationInFrames,
        trimBeforeFrames: 0,
        volume: 1.0,
        fadeInFrames: Math.min(10, fadeFrames),
        fadeOutFrames: Math.min(15, fadeFrames),
      },
    ],
    createdAt: new Date().toISOString(),
  };
}
