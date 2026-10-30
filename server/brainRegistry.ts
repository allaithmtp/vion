import fs from 'fs';
import path from 'path';
import type {
  AdminAuditLogEntry,
  BrainJobModelSnapshot,
  BrainModelAdminRecord,
  BrainModelDTO,
  BrainModelId,
  BrainModelLimitsConfig,
  BrainModelVersionSnapshot,
  BrainRulesConfig,
  BrainStageProviderConfig,
  BrainTaskStageId,
  ElementCapabilityId,
  StylePresetId,
  SystemCapabilitiesStatus,
  VerifiedSessionInfo,
  VideoStylePreset,
} from '../src/types/domain.ts';
import { recordAdminAuditLog } from './authAndRbac.ts';
import {
  getServerMediaLimits,
  isFfmpegWorkerAvailable,
} from './mediaWorker.ts';
import {
  getAllRegisteredStyleIds,
  getPublishedStylePresets,
} from './vionSkillAndStyleRegistry.ts';

const DATA_DIR = path.resolve(process.cwd(), '.server_data');
const BRAIN_MODELS_FILE = path.join(DATA_DIR, 'brain_models.json');
const RENDER_JOBS_FILE = path.join(DATA_DIR, 'render_jobs.json');

export const ALL_ELEMENT_SKILL_IDS: ElementCapabilityId[] = [
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
];

export const ALL_STYLE_PRESET_IDS: StylePresetId[] = getAllRegisteredStyleIds();

const SERVER_STYLE_PRESETS: VideoStylePreset[] = [
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
];

interface PersistedBrainModelsState {
  models: BrainModelAdminRecord[];
  /**
   * Tracks projectId -> modelIds used historically so models used by any project or job can never be hard-deleted.
   */
  projectModelHistory: Record<string, string[]>;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Ensures `secretRefKey` is strictly an environment variable reference name (e.g. `GEMINI_API_KEY`)
 * and NEVER a raw API key or secret value.
 */
function sanitizeSecretRefKey(
  candidate: string | undefined,
  fallbackRefKey = 'GEMINI_API_KEY'
): string {
  const trimmed = (candidate ?? '').trim();
  if (!trimmed) return fallbackRefKey;
  // Block anything that looks like an actual API key value (e.g. AIza..., sk-...)
  if (
    trimmed.startsWith('AIza') ||
    trimmed.startsWith('sk-') ||
    trimmed.startsWith('ya29.') ||
    trimmed.length > 64 ||
    !/^[A-Z][A-Z0-9_]{1,63}$/.test(trimmed)
  ) {
    throw new Error(
      'INVALID_SECRET_REF_KEY: يجب إدخال اسم مرجع السر في الخادم فقط (مثل GEMINI_API_KEY) وليس قيمة المفتاح السري.'
    );
  }
  return trimmed;
}

function isEnvSecretPresentOnServer(secretRefKey: string): boolean {
  if (!secretRefKey) return false;
  const val = process.env[secretRefKey];
  return Boolean(
    val &&
      val.trim().length > 0 &&
      val.trim() !== 'MY_GEMINI_API_KEY' &&
      val.trim() !== 'YOUR_API_KEY'
  );
}

function buildInitialBrain18Record(): BrainModelAdminRecord {
  const now = '2026-01-01T00:00:00.000Z';
  const initialSnapshot: BrainModelVersionSnapshot = {
    modelVersion: 1,
    rulesVersion: 1,
    publishedAt: now,
    publishedByEmail: 'allaithmtp@gmail.com',
    changelog: 'الإصدار التأسيسي الافتراضي لمحرك Brain 1.8',
    name: 'Brain 1.8',
    description:
      'VION core multimodal planning engine. Understands video & voiceover, plans scenes, and targets Remotion compositions.',
    descriptionAr:
      'محرك التخطيط الأساسي في منصة VION. يفهم الفيديو والتعليق الصوتي ويخطط للمشاهد لتنفيذها عبر Remotion.',
    badgeText: 'Default Engine',
    iconUrl: '/assets/aistudio/Brain_1.8_Layered_Icon_4d8d3a8f.png',
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
    taskStages: {
      analysis: {
        enabled: true,
        provider: 'google-genai',
        modelId: 'gemini-3-flash-preview',
        secretRefKey: 'GEMINI_API_KEY',
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
      planning: {
        enabled: true,
        provider: 'google-genai',
        modelId: 'gemini-3.1-pro-preview',
        secretRefKey: 'GEMINI_API_KEY',
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
      codeGeneration: {
        enabled: true,
        provider: 'google-genai',
        modelId: 'gemini-3.1-pro-preview',
        secretRefKey: 'GEMINI_API_KEY',
        temperature: 0.15,
        maxOutputTokens: 8192,
      },
      review: {
        enabled: true,
        provider: 'google-genai',
        modelId: 'gemini-3-flash-preview',
        secretRefKey: 'GEMINI_API_KEY',
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    },
    rules: {
      analysisRules:
        'افحص محتوى الفيديو أو الصوت بدقة، وحدد فترات الصمت التي تتجاوز 450 ملي ثانية دون قطع الكلمات العربية أو الإنجليزية في منتصف النطق.',
      editingRules:
        'التزم بالمهارات (Elements) والأنماط (Styles) المسموحة للنموذج فقط. حافظ على إيقاع بصري متناسق وتجنب المبالغة في الانتقالات المتتالية.',
      motionRules:
        'استخدم حركة ناعمة بفيزياء Spring متوازنة، وحافظ على وضوح قراءة النصوص العربية (RTL) والإنجليزية (LTR) فوق الخلفيات الداكنة.',
    },
    allowedSkillIds: [...ALL_ELEMENT_SKILL_IDS],
    allowedStyleIds: [...ALL_STYLE_PRESET_IDS],
    allowNewComponentGeneration: false,
    limits: {
      maxCostUsdPerTask: 0.5,
      maxRetriesPerTask: 2,
      maxTokensPerTask: 32000,
    },
  };

  return {
    id: 'brain-1.8',
    enabled: true,
    isDefault: true,
    archived: false,
    usedHistorically: true,
    historicalUsageCount: 1,
    modelVersion: 1,
    rulesVersion: 1,
    publishedSnapshot: deepClone(initialSnapshot),
    draftSnapshot: deepClone(initialSnapshot),
    hasUnpublishedDraft: false,
    versionHistory: [deepClone(initialSnapshot)],
    aiQualityBenchmarkStatus: 'pending-brain-ai-phase',
    createdAt: now,
    updatedAt: now,
  };
}

function countRenderJobsUsingModel(modelId: string): number {
  if (!fs.existsSync(RENDER_JOBS_FILE)) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(RENDER_JOBS_FILE, 'utf8')) as {
      jobs?: Record<string, { modelId?: string; plan?: { modelId?: string } }>;
    };
    const jobs = Object.values(parsed.jobs ?? {});
    return jobs.filter(
      (j) =>
        j.modelId === modelId ||
        j.plan?.modelId === modelId ||
        (modelId === 'brain-1.8' && !j.modelId)
    ).length;
  } catch {
    return 0;
  }
}

function loadBrainModelsState(): PersistedBrainModelsState {
  ensureDataDir();
  if (!fs.existsSync(BRAIN_MODELS_FILE)) {
    const initial: PersistedBrainModelsState = {
      models: [buildInitialBrain18Record()],
      projectModelHistory: {},
    };
    saveBrainModelsState(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(BRAIN_MODELS_FILE, 'utf8')
    ) as PersistedBrainModelsState;
    if (!Array.isArray(parsed.models) || parsed.models.length === 0) {
      parsed.models = [buildInitialBrain18Record()];
    }
    if (!parsed.projectModelHistory) {
      parsed.projectModelHistory = {};
    }
    // Ensure Brain 1.8 always exists
    if (!parsed.models.some((m) => m.id === 'brain-1.8')) {
      parsed.models.unshift(buildInitialBrain18Record());
    }
    // Ensure at least one enabled model and one default model exist
    const enabledNonArchived = parsed.models.filter(
      (m) => m.enabled && !m.archived
    );
    if (enabledNonArchived.length === 0) {
      const b18 = parsed.models.find((m) => m.id === 'brain-1.8') ?? parsed.models[0];
      b18.enabled = true;
      b18.archived = false;
      b18.isDefault = true;
    } else if (!enabledNonArchived.some((m) => m.isDefault)) {
      for (const m of parsed.models) m.isDefault = false;
      enabledNonArchived[0].isDefault = true;
    }

    return parsed;
  } catch {
    const fallback: PersistedBrainModelsState = {
      models: [buildInitialBrain18Record()],
      projectModelHistory: {},
    };
    saveBrainModelsState(fallback);
    return fallback;
  }
}

function saveBrainModelsState(state: PersistedBrainModelsState): void {
  ensureDataDir();
  fs.writeFileSync(BRAIN_MODELS_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function enrichSnapshotWithSecretStatus(
  snapshot: BrainModelVersionSnapshot
): BrainModelVersionSnapshot {
  const copy = deepClone(snapshot);
  const stageKeys: BrainTaskStageId[] = [
    'analysis',
    'planning',
    'codeGeneration',
    'review',
  ];
  for (const stageKey of stageKeys) {
    const stage = copy.taskStages[stageKey];
    if (stage) {
      stage.secretRefKey = stage.secretRefKey || 'GEMINI_API_KEY';
      stage.hasSecretConfigured = isEnvSecretPresentOnServer(
        stage.secretRefKey
      );
    }
  }
  return copy;
}

function enrichModelRecordForBrowser(
  record: BrainModelAdminRecord,
  state: PersistedBrainModelsState
): BrainModelAdminRecord {
  const jobsCount = countRenderJobsUsingModel(record.id);
  const projectsCount = Object.values(state.projectModelHistory).filter((arr) =>
    arr.includes(record.id)
  ).length;
  const totalUsage = Math.max(
    record.historicalUsageCount || 0,
    jobsCount + projectsCount + (record.id === 'brain-1.8' ? 1 : 0)
  );
  const usedHistorically =
    record.usedHistorically || record.id === 'brain-1.8' || totalUsage > 0;

  return {
    ...deepClone(record),
    usedHistorically,
    historicalUsageCount: totalUsage,
    aiQualityBenchmarkStatus: 'pending-brain-ai-phase',
    publishedSnapshot: enrichSnapshotWithSecretStatus(record.publishedSnapshot),
    draftSnapshot: enrichSnapshotWithSecretStatus(record.draftSnapshot),
    versionHistory: (record.versionHistory ?? []).map(
      enrichSnapshotWithSecretStatus
    ),
  };
}

function toPublicBrainModelDTO(record: BrainModelAdminRecord): BrainModelDTO {
  const pub = record.publishedSnapshot;
  return {
    id: record.id,
    name: pub.name,
    version: `${record.modelVersion}.0`,
    modelVersion: record.modelVersion,
    rulesVersion: record.rulesVersion,
    badgeText: record.isDefault ? 'Default Engine' : pub.badgeText,
    iconUrl:
      pub.iconUrl || '/assets/aistudio/Brain_1.8_Layered_Icon_4d8d3a8f.png',
    descriptionKey:
      record.id === 'brain-1.8' ? 'models.brain18.description' : '',
    description: pub.description,
    descriptionAr: pub.descriptionAr,
    videoCapabilities: pub.videoCapabilities ?? [],
    audioCapabilities: pub.audioCapabilities ?? [],
    capabilities: pub.capabilities ?? [
      'video-editing',
      'voiceover-motion',
      'scene-planning',
      'remotion-codegen',
    ],
    allowedSkillIds: pub.allowedSkillIds ?? [...ALL_ELEMENT_SKILL_IDS],
    allowedStyleIds: pub.allowedStyleIds ?? [...ALL_STYLE_PRESET_IDS],
    allowNewComponentGeneration: Boolean(pub.allowNewComponentGeneration),
    limits: pub.limits ?? {
      maxCostUsdPerTask: 0.5,
      maxRetriesPerTask: 2,
      maxTokensPerTask: 32000,
    },
    enabled: record.enabled && !record.archived,
    isDefault: record.isDefault,
    archived: record.archived,
    executionEnabled: false,
    disabledReasonKey: 'models.phase1DisabledNotice',
  };
}

/**
 * Returns all non-archived models for `/api/catalog` so the client knows:
 * - Which models are `enabled: true` (for the chat bar Models selector)
 * - Which model is `isDefault: true` (for new conversations/projects)
 * - Whether an existing project's `selectedModelId` was disabled (`enabled: false`)
 */
export function getPublicBrainModels(): BrainModelDTO[] {
  const state = loadBrainModelsState();
  return state.models.map(toPublicBrainModelDTO);
}

export function getDefaultEnabledBrainModel(): BrainModelDTO {
  const models = getPublicBrainModels().filter((m) => m.enabled && !m.archived);
  return (
    models.find((m) => m.isDefault) ??
    models[0] ??
    toPublicBrainModelDTO(buildInitialBrain18Record())
  );
}

export function getPublicStylePresets(): VideoStylePreset[] {
  return getPublishedStylePresets();
}

export function getSystemCapabilitiesStatus(): SystemCapabilitiesStatus {
  return {
    phase: 'phase-4-remotion-pipeline',
    engineName: 'Brain',
    authConnected: true,
    firestoreConnected: true,
    privateStorageConnected: true,
    ffmpegWorkerConnected: isFfmpegWorkerAvailable(),
    aiConnected: false,
    remotionConnected: true,
    paymentsConnected: false,
    mediaLimits: getServerMediaLimits(),
    serverTimestamp: new Date().toISOString(),
  };
}

/**
 * Records that a project or job has used a specific `modelId` historically,
 * preventing hard deletion of that model in the future.
 */
export function recordModelHistoricalUsage(params: {
  modelId: string;
  projectId?: string;
}): void {
  if (!params.modelId) return;
  const state = loadBrainModelsState();
  const model = state.models.find((m) => m.id === params.modelId);
  let changed = false;

  if (params.projectId) {
    const existing = state.projectModelHistory[params.projectId] ?? [];
    if (!existing.includes(params.modelId)) {
      state.projectModelHistory[params.projectId] = [
        ...existing,
        params.modelId,
      ];
      changed = true;
    }
  }

  if (model) {
    if (!model.usedHistorically) {
      model.usedHistorically = true;
      changed = true;
    }
    model.historicalUsageCount = (model.historicalUsageCount || 0) + 1;
    changed = true;
  }

  if (changed) {
    saveBrainModelsState(state);
  }
}

/**
 * Validates that the requested `modelId` is currently enabled and not archived,
 * and captures an immutable `BrainJobModelSnapshot` for the new task/job.
 * If the model is later disabled while the task is running, the task continues
 * using this saved snapshot.
 */
export function capturePublishedModelSnapshotForNewTask(params: {
  modelId?: string;
  projectId?: string;
}): BrainJobModelSnapshot {
  const state = loadBrainModelsState();
  const targetId =
    params.modelId?.trim() ||
    state.models.find((m) => m.isDefault && m.enabled && !m.archived)?.id ||
    'brain-1.8';

  const record = state.models.find((m) => m.id === targetId);
  if (!record) {
    throw new Error(
      `MODEL_NOT_FOUND: النموذج المطلوب (${targetId}) غير موجود في النظام.`
    );
  }

  if (!record.enabled || record.archived) {
    throw new Error(
      `MODEL_DISABLED_SELECT_REPLACEMENT: النموذج (${record.publishedSnapshot.name}) معطّل أو مؤرشف حاليًا. يرجى اختيار نموذج مفعّل بديل للمتابعة مع الاحتفاظ بالنتائج السابقة.`
    );
  }

  recordModelHistoricalUsage({
    modelId: record.id,
    projectId: params.projectId,
  });

  const pub = record.publishedSnapshot;
  return {
    modelId: record.id,
    modelName: pub.name,
    modelVersion: record.modelVersion,
    rulesVersion: record.rulesVersion,
    allowNewComponentGeneration: Boolean(pub.allowNewComponentGeneration),
    limits: deepClone(pub.limits),
    rules: deepClone(pub.rules),
    allowedSkillIds: [...(pub.allowedSkillIds ?? ALL_ELEMENT_SKILL_IDS)],
    allowedStyleIds: [...(pub.allowedStyleIds ?? ALL_STYLE_PRESET_IDS)],
    capturedAt: new Date().toISOString(),
  };
}

// ============================================================================
// ADMIN BRAIN MODELS & RULES GOVERNANCE OPERATIONS
// ============================================================================

export function listAdminBrainModels(): BrainModelAdminRecord[] {
  const state = loadBrainModelsState();
  return state.models.map((m) => enrichModelRecordForBrowser(m, state));
}

function mergeStageConfigsPreservingSecrets(
  existingStages: Record<BrainTaskStageId, BrainStageProviderConfig>,
  incomingStages?: Partial<
    Record<BrainTaskStageId, Partial<BrainStageProviderConfig>>
  >
): Record<BrainTaskStageId, BrainStageProviderConfig> {
  const result = deepClone(existingStages);
  if (!incomingStages) return result;

  const stages: BrainTaskStageId[] = [
    'analysis',
    'planning',
    'codeGeneration',
    'review',
  ];

  for (const stageKey of stages) {
    const inc = incomingStages[stageKey];
    const prev = result[stageKey];
    if (!inc || !prev) continue;

    result[stageKey] = {
      enabled: typeof inc.enabled === 'boolean' ? inc.enabled : prev.enabled,
      provider: inc.provider ?? prev.provider,
      modelId:
        typeof inc.modelId === 'string' && inc.modelId.trim()
          ? inc.modelId.trim().slice(0, 120)
          : prev.modelId,
      // Preserve existing secret reference key if omitted; validate if provided
      secretRefKey:
        typeof inc.secretRefKey === 'string' && inc.secretRefKey.trim()
          ? sanitizeSecretRefKey(inc.secretRefKey, prev.secretRefKey)
          : prev.secretRefKey,
      temperature:
        typeof inc.temperature === 'number' &&
        Number.isFinite(inc.temperature)
          ? Math.max(0, Math.min(2, inc.temperature))
          : prev.temperature,
      maxOutputTokens:
        typeof inc.maxOutputTokens === 'number' &&
        Number.isFinite(inc.maxOutputTokens)
          ? Math.max(256, Math.min(65536, Math.round(inc.maxOutputTokens)))
          : prev.maxOutputTokens,
    };
  }

  return result;
}

export interface BrainModelDraftUpdateInput {
  name?: string;
  description?: string;
  descriptionAr?: string;
  badgeText?: string;
  videoCapabilities?: string[];
  audioCapabilities?: string[];
  capabilities?: (
    | 'video-editing'
    | 'voiceover-motion'
    | 'scene-planning'
    | 'remotion-codegen'
  )[];
  taskStages?: Partial<
    Record<BrainTaskStageId, Partial<BrainStageProviderConfig>>
  >;
  rules?: Partial<BrainRulesConfig>;
  allowedSkillIds?: ElementCapabilityId[];
  allowedStyleIds?: StylePresetId[];
  allowNewComponentGeneration?: boolean;
  limits?: Partial<BrainModelLimitsConfig>;
}

function applyDraftUpdatesToSnapshot(
  baseSnapshot: BrainModelVersionSnapshot,
  updates: BrainModelDraftUpdateInput
): BrainModelVersionSnapshot {
  const next = deepClone(baseSnapshot);

  if (typeof updates.name === 'string' && updates.name.trim()) {
    next.name = updates.name.trim().slice(0, 80);
  }
  if (typeof updates.description === 'string') {
    next.description = updates.description.trim().slice(0, 600);
  }
  if (typeof updates.descriptionAr === 'string') {
    next.descriptionAr = updates.descriptionAr.trim().slice(0, 600);
  }
  if (typeof updates.badgeText === 'string' && updates.badgeText.trim()) {
    next.badgeText = updates.badgeText.trim().slice(0, 48);
  }
  if (Array.isArray(updates.videoCapabilities)) {
    next.videoCapabilities = updates.videoCapabilities
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  if (Array.isArray(updates.audioCapabilities)) {
    next.audioCapabilities = updates.audioCapabilities
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  if (Array.isArray(updates.capabilities) && updates.capabilities.length > 0) {
    next.capabilities = updates.capabilities;
  }
  if (updates.taskStages) {
    next.taskStages = mergeStageConfigsPreservingSecrets(
      next.taskStages,
      updates.taskStages
    );
  }
  if (updates.rules) {
    if (typeof updates.rules.analysisRules === 'string') {
      next.rules.analysisRules = updates.rules.analysisRules
        .trim()
        .slice(0, 4000);
    }
    if (typeof updates.rules.editingRules === 'string') {
      next.rules.editingRules = updates.rules.editingRules
        .trim()
        .slice(0, 4000);
    }
    if (typeof updates.rules.motionRules === 'string') {
      next.rules.motionRules = updates.rules.motionRules.trim().slice(0, 4000);
    }
  }
  if (Array.isArray(updates.allowedSkillIds)) {
    next.allowedSkillIds = updates.allowedSkillIds.filter((id) =>
      ALL_ELEMENT_SKILL_IDS.includes(id)
    );
  }
  if (Array.isArray(updates.allowedStyleIds)) {
    const validStyles = updates.allowedStyleIds.filter((id) =>
      ALL_STYLE_PRESET_IDS.includes(id)
    );
    if (validStyles.length > 0) {
      next.allowedStyleIds = validStyles;
    }
  }
  if (typeof updates.allowNewComponentGeneration === 'boolean') {
    next.allowNewComponentGeneration = updates.allowNewComponentGeneration;
  }
  if (updates.limits) {
    if (
      typeof updates.limits.maxCostUsdPerTask === 'number' &&
      Number.isFinite(updates.limits.maxCostUsdPerTask)
    ) {
      next.limits.maxCostUsdPerTask = Math.max(
        0.01,
        Math.min(100, Number(updates.limits.maxCostUsdPerTask.toFixed(2)))
      );
    }
    if (
      typeof updates.limits.maxRetriesPerTask === 'number' &&
      Number.isFinite(updates.limits.maxRetriesPerTask)
    ) {
      next.limits.maxRetriesPerTask = Math.max(
        0,
        Math.min(10, Math.round(updates.limits.maxRetriesPerTask))
      );
    }
    if (
      typeof updates.limits.maxTokensPerTask === 'number' &&
      Number.isFinite(updates.limits.maxTokensPerTask)
    ) {
      next.limits.maxTokensPerTask = Math.max(
        1024,
        Math.min(500000, Math.round(updates.limits.maxTokensPerTask))
      );
    }
  }

  return next;
}

export function createBrainModelOnServer(params: {
  actorSession: VerifiedSessionInfo;
  id: string;
  name: string;
  description?: string;
  descriptionAr?: string;
  enabled?: boolean;
  draftUpdates?: BrainModelDraftUpdateInput;
}): { model: BrainModelAdminRecord; auditLog: AdminAuditLogEntry } {
  if (
    !params.actorSession.permissions.isPrimaryOwner &&
    !params.actorSession.permissions.canPublishModels
  ) {
    throw new Error('FORBIDDEN_PUBLISH_MODELS_REQUIRED');
  }

  const normalizedId = params.id.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(normalizedId)) {
    throw new Error(
      'INVALID_MODEL_ID: معرّف النموذج يجب أن يتكون من أحرف إنجليزية صغيرة أو أرقام أو شرطات (مثل brain-2.0).'
    );
  }

  const cleanName = params.name.trim().slice(0, 80);
  if (!cleanName) {
    throw new Error('INVALID_MODEL_NAME: اسم النموذج مطلوب.');
  }

  const state = loadBrainModelsState();
  if (state.models.some((m) => m.id === normalizedId)) {
    throw new Error(
      `DUPLICATE_MODEL_ID: يوجد نموذج آخر بنفس المعرّف الثابت (${normalizedId}).`
    );
  }

  const template = buildInitialBrain18Record();
  const now = new Date().toISOString();

  let initialSnapshot: BrainModelVersionSnapshot = {
    ...deepClone(template.publishedSnapshot),
    modelVersion: 1,
    rulesVersion: 1,
    publishedAt: now,
    publishedByEmail: params.actorSession.email,
    changelog: 'إنشاء النموذج بالإعدادات التأسيسية v1',
    name: cleanName,
    description:
      params.description?.trim() ||
      `${cleanName} — Custom VION Brain engine configuration.`,
    descriptionAr:
      params.descriptionAr?.trim() ||
      `${cleanName} — إعداد مخصص لمحرك Brain في منصة VION.`,
    badgeText: 'Custom Engine',
  };

  if (params.draftUpdates) {
    initialSnapshot = applyDraftUpdatesToSnapshot(
      initialSnapshot,
      params.draftUpdates
    );
  }

  const newRecord: BrainModelAdminRecord = {
    id: normalizedId,
    enabled: Boolean(params.enabled),
    isDefault: false,
    archived: false,
    usedHistorically: false,
    historicalUsageCount: 0,
    modelVersion: 1,
    rulesVersion: 1,
    publishedSnapshot: deepClone(initialSnapshot),
    draftSnapshot: deepClone(initialSnapshot),
    hasUnpublishedDraft: false,
    versionHistory: [deepClone(initialSnapshot)],
    aiQualityBenchmarkStatus: 'pending-brain-ai-phase',
    createdAt: now,
    updatedAt: now,
  };

  state.models.push(newRecord);
  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_CREATED',
    targetEmail: normalizedId,
    details: `Created Brain model "${cleanName}" (${normalizedId}) v1 · enabled=${newRecord.enabled}`,
  });

  return {
    model: enrichModelRecordForBrowser(newRecord, state),
    auditLog,
  };
}

/**
 * Clones an existing Brain model (settings, rules, capabilities, and server secret bindings)
 * into a new independent model ID without exposing secret values or affecting the original model.
 */
export function cloneBrainModelOnServer(params: {
  actorSession: VerifiedSessionInfo;
  sourceModelId: string;
  newId: string;
  newName: string;
}): { model: BrainModelAdminRecord; auditLog: AdminAuditLogEntry } {
  if (
    !params.actorSession.permissions.isPrimaryOwner &&
    !params.actorSession.permissions.canPublishModels
  ) {
    throw new Error('FORBIDDEN_PUBLISH_MODELS_REQUIRED');
  }

  const state = loadBrainModelsState();
  const source = state.models.find((m) => m.id === params.sourceModelId);
  if (!source) {
    throw new Error('SOURCE_MODEL_NOT_FOUND: النموذج الأصلي غير موجود.');
  }

  const normalizedId = params.newId.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(normalizedId)) {
    throw new Error(
      'INVALID_MODEL_ID: معرّف النسخة الجديدة غير صالح (استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات).'
    );
  }

  if (state.models.some((m) => m.id === normalizedId)) {
    throw new Error(
      `DUPLICATE_MODEL_ID: المعرّف (${normalizedId}) مستخدم بالفعل.`
    );
  }

  const cleanName =
    params.newName.trim().slice(0, 80) ||
    `${source.publishedSnapshot.name} (Copy)`;
  const now = new Date().toISOString();

  // Deep clone the source draft/published snapshot including secretRefKey bindings on the server
  const baseSourceSnapshot = deepClone(source.draftSnapshot);
  const clonedSnapshot: BrainModelVersionSnapshot = {
    ...baseSourceSnapshot,
    modelVersion: 1,
    rulesVersion: 1,
    publishedAt: now,
    publishedByEmail: params.actorSession.email,
    changelog: `نسخة مستقلة من النموذج ${source.id} (v${source.modelVersion} / Rules v${source.rulesVersion})`,
    name: cleanName,
    badgeText: 'Cloned Engine',
  };

  const clonedRecord: BrainModelAdminRecord = {
    id: normalizedId,
    enabled: false,
    isDefault: false,
    archived: false,
    usedHistorically: false,
    historicalUsageCount: 0,
    clonedFromModelId: source.id,
    modelVersion: 1,
    rulesVersion: 1,
    publishedSnapshot: deepClone(clonedSnapshot),
    draftSnapshot: deepClone(clonedSnapshot),
    hasUnpublishedDraft: false,
    versionHistory: [deepClone(clonedSnapshot)],
    aiQualityBenchmarkStatus: 'pending-brain-ai-phase',
    createdAt: now,
    updatedAt: now,
  };

  state.models.push(clonedRecord);
  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_CLONED',
    targetEmail: normalizedId,
    details: `Cloned Brain model "${source.id}" into independent model "${cleanName}" (${normalizedId}) preserving secret bindings without exposing values.`,
  });

  return {
    model: enrichModelRecordForBrowser(clonedRecord, state),
    auditLog,
  };
}

/**
 * Saves modifications to a model's draft configuration or rules without mutating
 * the currently published snapshot.
 */
export function saveBrainModelDraftOnServer(params: {
  actorSession: VerifiedSessionInfo;
  modelId: string;
  updates: BrainModelDraftUpdateInput;
}): { model: BrainModelAdminRecord; auditLog: AdminAuditLogEntry } {
  const perms = params.actorSession.permissions;
  if (
    !perms.isPrimaryOwner &&
    !perms.canEditRules &&
    !perms.canPublishModels
  ) {
    throw new Error('FORBIDDEN_EDIT_RULES_OR_MODELS_REQUIRED');
  }

  const state = loadBrainModelsState();
  const record = state.models.find((m) => m.id === params.modelId);
  if (!record) {
    throw new Error('MODEL_NOT_FOUND');
  }

  record.draftSnapshot = applyDraftUpdatesToSnapshot(
    record.draftSnapshot,
    params.updates
  );
  record.hasUnpublishedDraft = true;
  record.updatedAt = new Date().toISOString();

  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_DRAFT_SAVED',
    targetEmail: record.id,
    details: `Saved draft settings/rules for model "${record.draftSnapshot.name}" (${record.id}). Published version remains v${record.modelVersion}.`,
  });

  return {
    model: enrichModelRecordForBrowser(record, state),
    auditLog,
  };
}

/**
 * Publishes the current draft of a Brain model as a new immutable version snapshot.
 * Automatically increments `modelVersion`, and increments `rulesVersion` if rules/skills/styles changed.
 */
export function publishBrainModelDraftOnServer(params: {
  actorSession: VerifiedSessionInfo;
  modelId: string;
  changelog?: string;
}): { model: BrainModelAdminRecord; auditLog: AdminAuditLogEntry } {
  const perms = params.actorSession.permissions;
  if (!perms.isPrimaryOwner && !perms.canPublishModels && !perms.canEditRules) {
    throw new Error('FORBIDDEN_PUBLISH_PERMISSION_REQUIRED');
  }

  const state = loadBrainModelsState();
  const record = state.models.find((m) => m.id === params.modelId);
  if (!record) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const prevPub = record.publishedSnapshot;
  const draft = record.draftSnapshot;

  const rulesChanged =
    prevPub.rules.analysisRules !== draft.rules.analysisRules ||
    prevPub.rules.editingRules !== draft.rules.editingRules ||
    prevPub.rules.motionRules !== draft.rules.motionRules ||
    JSON.stringify(prevPub.allowedSkillIds) !==
      JSON.stringify(draft.allowedSkillIds) ||
    JSON.stringify(prevPub.allowedStyleIds) !==
      JSON.stringify(draft.allowedStyleIds);

  const nextModelVersion = record.modelVersion + 1;
  const nextRulesVersion = rulesChanged
    ? record.rulesVersion + 1
    : record.rulesVersion;
  const now = new Date().toISOString();

  const publishedSnapshot: BrainModelVersionSnapshot = {
    ...deepClone(draft),
    modelVersion: nextModelVersion,
    rulesVersion: nextRulesVersion,
    publishedAt: now,
    publishedByEmail: params.actorSession.email,
    changelog:
      params.changelog?.trim().slice(0, 240) ||
      `نشر الإصدار v${nextModelVersion} (Rules v${nextRulesVersion})`,
  };

  record.modelVersion = nextModelVersion;
  record.rulesVersion = nextRulesVersion;
  record.publishedSnapshot = deepClone(publishedSnapshot);
  record.draftSnapshot = deepClone(publishedSnapshot);
  record.hasUnpublishedDraft = false;
  record.versionHistory.unshift(deepClone(publishedSnapshot));
  if (record.versionHistory.length > 30) {
    record.versionHistory = record.versionHistory.slice(0, 30);
  }
  record.updatedAt = now;

  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_VERSION_PUBLISHED',
    targetEmail: record.id,
    details: `Published ${record.id} v${nextModelVersion} (Rules v${nextRulesVersion}): ${publishedSnapshot.changelog}`,
  });

  return {
    model: enrichModelRecordForBrowser(record, state),
    auditLog,
  };
}

/**
 * Rolls back a Brain model to a previous published version snapshot from `versionHistory`.
 */
export function rollbackBrainModelVersionOnServer(params: {
  actorSession: VerifiedSessionInfo;
  modelId: string;
  targetModelVersion: number;
}): { model: BrainModelAdminRecord; auditLog: AdminAuditLogEntry } {
  const perms = params.actorSession.permissions;
  if (!perms.isPrimaryOwner && !perms.canPublishModels) {
    throw new Error('FORBIDDEN_PUBLISH_MODELS_REQUIRED');
  }

  const state = loadBrainModelsState();
  const record = state.models.find((m) => m.id === params.modelId);
  if (!record) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const historical = record.versionHistory.find(
    (v) => v.modelVersion === params.targetModelVersion
  );
  if (!historical) {
    throw new Error(
      `VERSION_NOT_FOUND: الإصدار المطلوب (v${params.targetModelVersion}) غير موجود في سجل الإصدارات.`
    );
  }

  const now = new Date().toISOString();
  const restoredModelVersion = record.modelVersion + 1;
  const restoredRulesVersion = historical.rulesVersion;

  const restoredSnapshot: BrainModelVersionSnapshot = {
    ...deepClone(historical),
    modelVersion: restoredModelVersion,
    rulesVersion: restoredRulesVersion,
    publishedAt: now,
    publishedByEmail: params.actorSession.email,
    changelog: `تراجع استرجاعي (Rollback) إلى إعدادات وقواعد الإصدار v${historical.modelVersion} (Rules v${historical.rulesVersion})`,
  };

  record.modelVersion = restoredModelVersion;
  record.rulesVersion = restoredRulesVersion;
  record.publishedSnapshot = deepClone(restoredSnapshot);
  record.draftSnapshot = deepClone(restoredSnapshot);
  record.hasUnpublishedDraft = false;
  record.versionHistory.unshift(deepClone(restoredSnapshot));
  record.updatedAt = now;

  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_ROLLED_BACK',
    targetEmail: record.id,
    details: `Rolled back ${record.id} to snapshot v${historical.modelVersion} as new active version v${restoredModelVersion} (Rules v${restoredRulesVersion}).`,
  });

  return {
    model: enrichModelRecordForBrowser(record, state),
    auditLog,
  };
}

/**
 * Sets a Brain model as the system Default model.
 * Target model must be enabled and not archived.
 */
export function setDefaultBrainModelOnServer(params: {
  actorSession: VerifiedSessionInfo;
  modelId: string;
}): { models: BrainModelAdminRecord[]; auditLog: AdminAuditLogEntry } {
  if (
    !params.actorSession.permissions.isPrimaryOwner &&
    !params.actorSession.permissions.canPublishModels
  ) {
    throw new Error('FORBIDDEN_PUBLISH_MODELS_REQUIRED');
  }

  const state = loadBrainModelsState();
  const target = state.models.find((m) => m.id === params.modelId);
  if (!target) {
    throw new Error('MODEL_NOT_FOUND');
  }
  if (!target.enabled || target.archived) {
    throw new Error(
      'CANNOT_SET_DISABLED_AS_DEFAULT: لا يمكن تعيين نموذج معطّل أو مؤرشف كنموذج افتراضي. فعّل النموذج أولًا.'
    );
  }

  const now = new Date().toISOString();
  for (const m of state.models) {
    m.isDefault = m.id === target.id;
    if (m.id === target.id) {
      m.updatedAt = now;
    }
  }

  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_DEFAULT_MODEL_CHANGED',
    targetEmail: target.id,
    details: `Set "${target.publishedSnapshot.name}" (${target.id}) as the Default Brain model.`,
  });

  return {
    models: state.models.map((m) => enrichModelRecordForBrowser(m, state)),
    auditLog,
  };
}

/**
 * Enables or disables a Brain model with strict atomic invariants:
 * 1. Prevents disabling the last enabled model (`CANNOT_DISABLE_LAST_ENABLED_MODEL`).
 * 2. If disabling the currently Default model, requires `replacementDefaultModelId`
 *    pointing to another enabled model and switches default atomically in the same write.
 */
export function setBrainModelStatusOnServer(params: {
  actorSession: VerifiedSessionInfo;
  modelId: string;
  enabled: boolean;
  replacementDefaultModelId?: string;
}): { models: BrainModelAdminRecord[]; auditLog: AdminAuditLogEntry } {
  if (
    !params.actorSession.permissions.isPrimaryOwner &&
    !params.actorSession.permissions.canPublishModels
  ) {
    throw new Error('FORBIDDEN_PUBLISH_MODELS_REQUIRED');
  }

  const state = loadBrainModelsState();
  const target = state.models.find((m) => m.id === params.modelId);
  if (!target) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const now = new Date().toISOString();

  if (params.enabled) {
    target.enabled = true;
    target.archived = false;
    target.updatedAt = now;
    saveBrainModelsState(state);

    const auditLog = recordAdminAuditLog({
      actorUid: params.actorSession.uid,
      actorEmail: params.actorSession.email,
      action: 'BRAIN_MODEL_ENABLED',
      targetEmail: target.id,
      details: `Enabled Brain model "${target.publishedSnapshot.name}" (${target.id}).`,
    });

    return {
      models: state.models.map((m) => enrichModelRecordForBrowser(m, state)),
      auditLog,
    };
  }

  // Disabling target model: check active count invariant
  const otherEnabledModels = state.models.filter(
    (m) => m.id !== target.id && m.enabled && !m.archived
  );

  if (otherEnabledModels.length === 0) {
    throw new Error(
      'CANNOT_DISABLE_LAST_ENABLED_MODEL: لا يمكن تعطيل آخر نموذج مفعّل في النظام. يجب بقاء نموذج مفعّل واحد على الأقل.'
    );
  }

  // If target is currently Default, require an atomic replacement Default model in the same operation
  let replacementModel: BrainModelAdminRecord | undefined;
  if (target.isDefault) {
    const repId = params.replacementDefaultModelId?.trim();
    if (!repId) {
      throw new Error(
        'DEFAULT_MODEL_REQUIRES_REPLACEMENT: عند تعطيل النموذج الافتراضي، يجب تعيين نموذج بديل مفعّل في نفس العملية الذرية.'
      );
    }
    replacementModel = otherEnabledModels.find((m) => m.id === repId);
    if (!replacementModel) {
      throw new Error(
        'INVALID_REPLACEMENT_DEFAULT_MODEL: النموذج البديل المختار غير مفعّل أو غير صالح.'
      );
    }
  }

  // Execute atomic state transition
  target.enabled = false;
  target.updatedAt = now;
  if (target.isDefault && replacementModel) {
    target.isDefault = false;
    replacementModel.isDefault = true;
    replacementModel.updatedAt = now;
  }

  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_DISABLED',
    targetEmail: target.id,
    details: replacementModel
      ? `Disabled former default model "${target.id}" and atomically promoted "${replacementModel.id}" as new Default model.`
      : `Disabled Brain model "${target.id}". Running tasks continue with their saved snapshot.`,
  });

  return {
    models: state.models.map((m) => enrichModelRecordForBrowser(m, state)),
    auditLog,
  };
}

/**
 * Archives or unarchives a Brain model while preserving all historical relationships.
 * If archiving an enabled or default model, enforces the exact same atomic invariants.
 */
export function setBrainModelArchiveStateOnServer(params: {
  actorSession: VerifiedSessionInfo;
  modelId: string;
  archived: boolean;
  replacementDefaultModelId?: string;
}): { models: BrainModelAdminRecord[]; auditLog: AdminAuditLogEntry } {
  if (
    !params.actorSession.permissions.isPrimaryOwner &&
    !params.actorSession.permissions.canPublishModels
  ) {
    throw new Error('FORBIDDEN_PUBLISH_MODELS_REQUIRED');
  }

  const state = loadBrainModelsState();
  const target = state.models.find((m) => m.id === params.modelId);
  if (!target) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const now = new Date().toISOString();

  if (!params.archived) {
    target.archived = false;
    target.updatedAt = now;
    saveBrainModelsState(state);

    const auditLog = recordAdminAuditLog({
      actorUid: params.actorSession.uid,
      actorEmail: params.actorSession.email,
      action: 'BRAIN_MODEL_UNARCHIVED',
      targetEmail: target.id,
      details: `Restored Brain model "${target.id}" from archive.`,
    });

    return {
      models: state.models.map((m) => enrichModelRecordForBrowser(m, state)),
      auditLog,
    };
  }

  // Archiving a model also disables it if currently enabled
  let replacementModel: BrainModelAdminRecord | undefined;
  if (target.enabled) {
    const otherEnabledModels = state.models.filter(
      (m) => m.id !== target.id && m.enabled && !m.archived
    );
    if (otherEnabledModels.length === 0) {
      throw new Error(
        'CANNOT_DISABLE_LAST_ENABLED_MODEL: لا يمكن أرشفة آخر نموذج مفعّل في النظام دون تفعيل نموذج آخر أولًا.'
      );
    }

    if (target.isDefault) {
      const repId = params.replacementDefaultModelId?.trim();
      if (!repId) {
        throw new Error(
          'DEFAULT_MODEL_REQUIRES_REPLACEMENT: عند أرشفة النموذج الافتراضي، يجب تعيين نموذج بديل مفعّل في نفس العملية الذرية.'
        );
      }
      replacementModel = otherEnabledModels.find((m) => m.id === repId);
      if (!replacementModel) {
        throw new Error(
          'INVALID_REPLACEMENT_DEFAULT_MODEL: النموذج البديل المختار غير مفعّل أو غير صالح.'
        );
      }
    }
  }

  target.archived = true;
  target.enabled = false;
  target.updatedAt = now;
  if (target.isDefault && replacementModel) {
    target.isDefault = false;
    replacementModel.isDefault = true;
    replacementModel.updatedAt = now;
  }

  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_ARCHIVED',
    targetEmail: target.id,
    details: replacementModel
      ? `Archived former default model "${target.id}" and atomically promoted "${replacementModel.id}" as Default.`
      : `Archived Brain model "${target.id}" while preserving all historical project and job relations.`,
  });

  return {
    models: state.models.map((m) => enrichModelRecordForBrowser(m, state)),
    auditLog,
  };
}

/**
 * Deletes a Brain model ONLY if it has never been used historically.
 * Historically used models cannot be deleted and must be archived instead.
 */
export function deleteBrainModelOnServer(params: {
  actorSession: VerifiedSessionInfo;
  modelId: string;
}): { models: BrainModelAdminRecord[]; auditLog: AdminAuditLogEntry } {
  if (
    !params.actorSession.permissions.isPrimaryOwner &&
    !params.actorSession.permissions.canPublishModels
  ) {
    throw new Error('FORBIDDEN_PUBLISH_MODELS_REQUIRED');
  }

  const state = loadBrainModelsState();
  const target = state.models.find((m) => m.id === params.modelId);
  if (!target) {
    throw new Error('MODEL_NOT_FOUND');
  }

  const enriched = enrichModelRecordForBrowser(target, state);
  if (enriched.usedHistorically || target.id === 'brain-1.8') {
    throw new Error(
      'CANNOT_DELETE_HISTORICALLY_USED_MODEL: لا يمكن حذف نموذج مستخدم تاريخيًا في المشاريع أو المهام؛ استخدم الأرشفة للحفاظ على العلاقات والسجل التاريخي.'
    );
  }

  if (target.isDefault) {
    throw new Error(
      'CANNOT_DELETE_DEFAULT_MODEL: لا يمكن حذف النموذج الافتراضي الحالي.'
    );
  }

  const remainingEnabled = state.models.filter(
    (m) => m.id !== target.id && m.enabled && !m.archived
  );
  if (remainingEnabled.length === 0) {
    throw new Error(
      'CANNOT_DISABLE_LAST_ENABLED_MODEL: لا يمكن حذف آخر نموذج مفعّل في النظام.'
    );
  }

  state.models = state.models.filter((m) => m.id !== target.id);
  saveBrainModelsState(state);

  const auditLog = recordAdminAuditLog({
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'BRAIN_MODEL_DELETED',
    targetEmail: target.id,
    details: `Deleted unused draft model "${target.id}".`,
  });

  return {
    models: state.models.map((m) => enrichModelRecordForBrowser(m, state)),
    auditLog,
  };
}
