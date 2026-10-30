import type {
  BrainModelDTO,
  SystemCapabilitiesStatus,
  VideoStylePreset,
} from '../types/domain';

export interface BrainCatalogResponse {
  engine: 'Brain';
  defaultModelId?: string;
  models: BrainModelDTO[];
  styles: VideoStylePreset[];
  capabilities: SystemCapabilitiesStatus;
}

const FALLBACK_CATALOG: BrainCatalogResponse = {
  engine: 'Brain',
  defaultModelId: 'brain-1.8',
  models: [
    {
      id: 'brain-1.8',
      name: 'Brain 1.8',
      version: '1.0',
      modelVersion: 1,
      rulesVersion: 1,
      badgeText: 'Default Engine',
      iconUrl: '/assets/aistudio/Brain_1.8_Layered_Icon_4d8d3a8f.png',
      descriptionKey: 'models.brain18.description',
      description:
        'VION core multimodal planning engine. Understands video & voiceover, plans scenes, and targets Remotion compositions.',
      descriptionAr:
        'محرك التخطيط الأساسي في منصة VION. يفهم الفيديو والتعليق الصوتي ويخطط للمشاهد لتنفيذها عبر Remotion.',
      videoCapabilities: [
        'تحليل الفيديو الخام واكتشاف اللقطات ومواضع الصمت',
        'التقريب البصري المتزن وإعادة التأطير الذكي (16:9 / 9:16)',
        'توليد العناوين والنصوص المتزامنة بالعربية والإنجليزية',
        'بناء مخطط UnifiedEditPlan وتصدير MP4 عبر Remotion',
      ],
      audioCapabilities: [
        'تحليل التعليق الصوتي واستخراج الإيقاع والفواصل',
        'تحويل الكلام إلى مشاهد موشن جرافيك توضيحية',
        'موازنة الصوت وخفض الموسيقى الخلفية تلقائيًا (Audio Ducking)',
      ],
      capabilities: [
        'video-editing',
        'voiceover-motion',
        'scene-planning',
        'remotion-codegen',
      ],
      allowedSkillIds: [
        'cuts-trimming',
        'zoom-reframe',
        'speed',
        'transitions',
        'captions',
        'titles',
        'text-animation',
        'b-roll',
        'motion-graphics',
        'sound-effects',
        'background-music',
        'audio-ducking',
        'color-grading',
        'split-screen',
        'callouts-highlights',
        'chapter-markers',
        'lower-thirds',
        'auto-framing',
      ],
      allowedStyleIds: [
        'clean-cut-studio',
        'kinetic-explainer',
        'minimal-documentary',
        'high-retention-social',
      ],
      allowNewComponentGeneration: false,
      limits: {
        maxCostUsdPerTask: 0.5,
        maxRetriesPerTask: 2,
        maxTokensPerTask: 32000,
      },
      enabled: true,
      isDefault: true,
      archived: false,
      executionEnabled: false,
      disabledReasonKey: 'models.phase1DisabledNotice',
    },
  ],
  styles: [
    {
      id: 'clean-cut-studio',
      nameKey: 'styles.cleanCutStudio.name',
      descriptionKey: 'styles.cleanCutStudio.description',
      targetWorkflow: 'video-edit',
      accentColor: '#3B82F6',
      captionTheme: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 600,
        highlightColor: '#3B82F6',
        wordByWordSync: true,
        position: 'bottom-third',
      },
      motionRhythm: {
        cutDensity: 'tight',
        zoomIntensity: 'subtle',
        springDamping: 18,
        springStiffness: 140,
      },
      previewTagsKeys: [
        'styles.tags.silenceRemoval',
        'styles.tags.dynamicZoom',
        'styles.tags.wordCaptions',
      ],
    },
    {
      id: 'kinetic-explainer',
      nameKey: 'styles.kineticExplainer.name',
      descriptionKey: 'styles.kineticExplainer.description',
      targetWorkflow: 'voiceover-motion',
      accentColor: '#2563EB',
      captionTheme: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 700,
        highlightColor: '#60A5FA',
        wordByWordSync: true,
        position: 'center-dynamic',
      },
      motionRhythm: {
        cutDensity: 'tight',
        zoomIntensity: 'dynamic',
        springDamping: 14,
        springStiffness: 180,
      },
      previewTagsKeys: [
        'styles.tags.voiceoverToMotion',
        'styles.tags.kineticType',
        'styles.tags.visualDiagrams',
      ],
    },
    {
      id: 'minimal-documentary',
      nameKey: 'styles.minimalDocumentary.name',
      descriptionKey: 'styles.minimalDocumentary.description',
      targetWorkflow: 'both',
      accentColor: '#94A3B8',
      captionTheme: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 500,
        highlightColor: '#FFFFFF',
        wordByWordSync: false,
        position: 'bottom-third',
      },
      motionRhythm: {
        cutDensity: 'cinematic',
        zoomIntensity: 'subtle',
        springDamping: 24,
        springStiffness: 100,
      },
      previewTagsKeys: [
        'styles.tags.chapterHeaders',
        'styles.tags.lowerThirds',
        'styles.tags.smoothTransitions',
      ],
    },
    {
      id: 'high-retention-social',
      nameKey: 'styles.highRetentionSocial.name',
      descriptionKey: 'styles.highRetentionSocial.description',
      targetWorkflow: 'both',
      accentColor: '#3B82F6',
      captionTheme: {
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 700,
        highlightColor: '#3B82F6',
        wordByWordSync: true,
        position: 'center-dynamic',
      },
      motionRhythm: {
        cutDensity: 'tight',
        zoomIntensity: 'dynamic',
        springDamping: 15,
        springStiffness: 200,
      },
      previewTagsKeys: [
        'styles.tags.fastPacing',
        'styles.tags.punchZooms',
        'styles.tags.callouts',
      ],
    },
  ],
  capabilities: {
    phase: 'phase-4-remotion-pipeline',
    engineName: 'Brain',
    authConnected: true,
    firestoreConnected: true,
    privateStorageConnected: true,
    ffmpegWorkerConnected: true,
    aiConnected: false,
    remotionConnected: true,
    paymentsConnected: false,
    mediaLimits: {
      maxFileSizeBytes: 1024 * 1024 * 1024,
      maxDurationSeconds: 600,
      supportedVideoContainers: ['mp4', 'mov', 'webm', 'matroska', 'm4v', '3gp'],
      supportedVideoCodecs: ['h264', 'hevc', 'vp8', 'vp9', 'av1', 'mpeg4'],
      supportedAudioContainers: [
        'mp3',
        'wav',
        'ogg',
        'flac',
        'aac',
        'm4a',
        'mp4',
        'mov',
        'webm',
        'matroska',
      ],
      supportedAudioCodecs: [
        'aac',
        'mp3',
        'pcm_s16le',
        'pcm_s24le',
        'pcm_f32le',
        'pcm_u8',
        'opus',
        'vorbis',
        'flac',
      ],
      chunkSizeBytes: 2 * 1024 * 1024,
      signedUrlTtlSeconds: 900,
    },
    serverTimestamp: new Date().toISOString(),
  },
};

export const brainService = {
  async fetchCatalog(): Promise<BrainCatalogResponse> {
    try {
      const response = await fetch('/api/catalog', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        return FALLBACK_CATALOG;
      }
      return (await response.json()) as BrainCatalogResponse;
    } catch {
      return FALLBACK_CATALOG;
    }
  },
};
