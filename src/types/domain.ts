/**
 * VION — AI Video Editor
 * Core Domain Data Types & Contracts
 *
 * Separates UI representation from Account, Storage, Resumable Ingest,
 * FFmpeg/FFprobe Media Processing, Unified EditPlan Schema, Remotion Rendering,
 * Skill & Style Registries, Scoped Rules, Preflight QA, and Admin RBAC.
 */

import type { UnifiedEditPlan } from '../remotion/editPlanSchema';

export type SupportedLocale = 'en' | 'ar';

// ============================================================================
// 1. MODELS (Brain Engine & Server-Managed AI Routing)
// ============================================================================

export type BrainModelId = string;

export type BrainTaskStageId =
  | 'analysis'
  | 'planning'
  | 'codeGeneration'
  | 'review';

export type BrainAiProviderId =
  | 'google-genai'
  | 'vertex-ai'
  | 'openai-compatible'
  | 'anthropic'
  | 'unconfigured';

export interface BrainStageProviderConfig {
  enabled: boolean;
  provider: BrainAiProviderId;
  modelId: string;
  /**
   * Server environment secret reference key (e.g. 'GEMINI_API_KEY').
   * The actual secret value is NEVER exposed or sent to the browser.
   */
  secretRefKey: string;
  /**
   * Computed server-side boolean indicating whether the referenced secret env var is present.
   */
  hasSecretConfigured?: boolean;
  temperature: number;
  maxOutputTokens: number;
}

export interface BrainRulesConfig {
  analysisRules: string;
  editingRules: string;
  motionRules: string;
}

export interface BrainModelLimitsConfig {
  maxCostUsdPerTask: number;
  maxRetriesPerTask: number;
  maxTokensPerTask: number;
}

export interface BrainModelVersionSnapshot {
  modelVersion: number;
  rulesVersion: number;
  publishedAt: string;
  publishedByEmail: string;
  changelog: string;
  name: string;
  description: string;
  descriptionAr: string;
  badgeText: string;
  iconUrl: string;
  videoCapabilities: string[];
  audioCapabilities: string[];
  capabilities: (
    | 'video-editing'
    | 'voiceover-motion'
    | 'scene-planning'
    | 'remotion-codegen'
  )[];
  taskStages: Record<BrainTaskStageId, BrainStageProviderConfig>;
  rules: BrainRulesConfig;
  allowedSkillIds: ElementCapabilityId[];
  allowedStyleIds: StylePresetId[];
  allowNewComponentGeneration: boolean;
  limits: BrainModelLimitsConfig;
}

export interface BrainModelAdminRecord {
  id: BrainModelId;
  enabled: boolean;
  isDefault: boolean;
  archived: boolean;
  usedHistorically: boolean;
  historicalUsageCount: number;
  clonedFromModelId?: BrainModelId;
  modelVersion: number;
  rulesVersion: number;
  publishedSnapshot: BrainModelVersionSnapshot;
  draftSnapshot: BrainModelVersionSnapshot;
  hasUnpublishedDraft: boolean;
  versionHistory: BrainModelVersionSnapshot[];
  /**
   * Honestly reports that AI quality testing is not completed until the Brain AI phase is wired.
   */
  aiQualityBenchmarkStatus: 'pending-brain-ai-phase';
  createdAt: string;
  updatedAt: string;
}

export interface BrainJobModelSnapshot {
  modelId: BrainModelId;
  modelName: string;
  modelVersion: number;
  rulesVersion: number;
  allowNewComponentGeneration: boolean;
  limits: BrainModelLimitsConfig;
  rules: BrainRulesConfig;
  allowedSkillIds: ElementCapabilityId[];
  allowedStyleIds: StylePresetId[];
  capturedAt: string;
}

export interface BrainModelDTO {
  id: BrainModelId;
  name: string;
  version: string;
  modelVersion: number;
  rulesVersion: number;
  badgeText: string;
  iconUrl: string;
  descriptionKey: string;
  description?: string;
  descriptionAr?: string;
  videoCapabilities: string[];
  audioCapabilities: string[];
  capabilities: (
    | 'video-editing'
    | 'voiceover-motion'
    | 'scene-planning'
    | 'remotion-codegen'
  )[];
  allowedSkillIds: ElementCapabilityId[];
  allowedStyleIds: StylePresetId[];
  allowNewComponentGeneration: boolean;
  limits: BrainModelLimitsConfig;
  enabled: boolean;
  isDefault: boolean;
  archived: boolean;
  executionEnabled: boolean;
  disabledReasonKey: string;
}

export interface ServerBrainModelConfig extends BrainModelDTO {
  provider: BrainAiProviderId;
  plannerModelEnvVar: string;
  multimodalModelEnvVar: string;
}

// ============================================================================
// 2. SKILL REGISTRY, STYLE REGISTRY, SCOPED RULES & PACKAGE INVENTORY
// ============================================================================

export type RegistryLifecycleStatus =
  | 'imported'
  | 'adapted'
  | 'tested'
  | 'published';

export type InventoryCategory =
  | 'instructions'
  | 'output-rules'
  | 'scripts'
  | 'components'
  | 'assets'
  | 'styles'
  | 'quality-checks';

export interface RegistryValidationTestReport {
  passed: boolean;
  testedAt: string;
  arabicFontVerified: boolean;
  alphaVerified: boolean;
  aspectRatiosVerified: ('9:16' | '16:9' | '1:1')[];
  timingDeterministic: boolean;
  visualComparisonScore: number;
  notes: string;
}

export interface SkillRegistryEntry {
  id: string;
  version: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  sourcePackage:
    | 'video-editor-bassam.zip'
    | 'claude-motion-styles-20.zip'
    | 'vion-core'
    | 'external-guide-discovery';
  category:
    | 'cutting-transcription'
    | 'captions-typography'
    | 'scene-stage-design'
    | 'face-guard-framing'
    | 'audio-sfx-mastering'
    | 'quality-preflight';
  inputs: string[];
  constraints: string[];
  requiredEngine: string;
  assets: string[];
  license: string;
  licenseNotes?: string;
  status: RegistryLifecycleStatus;
  testReport: RegistryValidationTestReport;
}

export type StyleCapabilityScope =
  | 'full-editing-style'
  | 'partial-scene-template';

export type StylePresetId = string;

export interface CaptionThemeSpec {
  fontFamily: string;
  fontWeight: 500 | 600 | 700 | 800 | 900;
  highlightColor: string;
  wordByWordSync: boolean;
  position: 'bottom-third' | 'center-dynamic';
}

export interface MotionRhythmSpec {
  cutDensity: 'tight' | 'balanced' | 'cinematic';
  zoomIntensity: 'subtle' | 'moderate' | 'dynamic';
  springDamping: number;
  springStiffness: number;
}

export interface VideoStylePreset {
  id: StylePresetId;
  version?: string;
  nameKey: string;
  name?: string;
  nameAr?: string;
  descriptionKey: string;
  description?: string;
  descriptionAr?: string;
  sourcePackage?:
    | 'video-editor-bassam.zip'
    | 'claude-motion-styles-20.zip'
    | 'vion-core';
  capabilityScope?: StyleCapabilityScope;
  status?: RegistryLifecycleStatus;
  targetWorkflow: 'both' | 'video-edit' | 'voiceover-motion';
  accentColor: string;
  previewImageUrl?: string;
  liveCanvasTemplateId?: string;
  inputs?: string[];
  constraints?: string[];
  requiredEngine?: string;
  assets?: string[];
  license?: string;
  testReport?: RegistryValidationTestReport;
  captionTheme: CaptionThemeSpec;
  motionRhythm: MotionRhythmSpec;
  previewTagsKeys: string[];
  previewTagsAr?: string[];
}

export interface ScopedRuleEntry {
  id: string;
  ruleNumber?: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  source: string;
  category: 'cutting' | 'captions' | 'scenes' | 'face-guard' | 'sfx' | 'motion' | 'color-voice';
  scope: {
    aspectRatios: ('9:16' | '16:9' | '1:1' | 'all')[];
    modes: ('quick' | 'light' | 'full' | 'motion-only' | 'all')[];
    styleIds: string[];
    mediaTypes: ('video' | 'audio' | 'both')[];
  };
  priority: 'critical' | 'high' | 'medium' | 'stylistic';
  priorityWeight: number;
  enabled: boolean;
  config: Record<string, string | number | boolean>;
}

export interface PackageInventoryMappingRow {
  id: string;
  sourceFile: string;
  sourcePackage:
    | 'video-editor-bassam.zip'
    | 'claude-motion-styles-20.zip'
    | 'دليل التثبيت والاستخدام (PDF)'
    | 'دليل أدوات الموشن (PDF)';
  category: InventoryCategory;
  functionAr: string;
  integrationMethodAr: string;
  targetModuleInVion: string;
  status: RegistryLifecycleStatus | 'discovery-only';
}

export interface DependencyGovernanceRow {
  id: string;
  name: string;
  sourceMentionedIn: string;
  purposeAr: string;
  installedInServer: boolean;
  licenseStatus: 'clear-open-source' | 'commercial-threshold' | 'requires-user-verification';
  decisionAr: string;
}

export interface VionPreflightCheckRow {
  checkId: string;
  ruleRef: string;
  titleAr: string;
  scopeNoteAr: string;
  passed: boolean;
  summaryAr: string;
  details?: string;
}

export interface VionPreflightQaReport {
  planId: string;
  projectId: string;
  aspectRatioLabel: string;
  mode: 'quick' | 'light' | 'full' | 'motion-only';
  styleId: string;
  overallPassed: boolean;
  executedAt: string;
  checks: VionPreflightCheckRow[];
}

export interface VionSilenceCutPlanResult {
  assetId: string;
  sourceDurationSec: number;
  keptDurationSec: number;
  removedSilenceSec: number;
  removedPercent: number;
  keepSegments: [number, number][];
  silenceRegions: { start: number; end: number; duration: number }[];
  noiseThresholdDb: string;
  minSilenceSec: number;
}

// ============================================================================
// 3. ELEMENTS (18 Hard Editing Capabilities Permitted for Brain 1.8)
// ============================================================================

export type ElementCapabilityId =
  | 'cuts-trimming'
  | 'zoom-reframe'
  | 'speed'
  | 'transitions'
  | 'captions'
  | 'titles'
  | 'text-animation'
  | 'b-roll'
  | 'motion-graphics'
  | 'sound-effects'
  | 'background-music'
  | 'audio-ducking'
  | 'color-grading'
  | 'split-screen'
  | 'callouts-highlights'
  | 'chapter-markers'
  | 'lower-thirds'
  | 'auto-framing';

export interface ElementCapability {
  id: ElementCapabilityId;
  titleKey: string;
  descriptionKey: string;
  enabled: boolean;
}

// ============================================================================
// 4. BRAND IDENTITY & ACCOUNT
// ============================================================================

export interface BrandAssetSlot {
  id: 'logo' | 'secondary-logo' | 'watermark' | 'intro' | 'outro';
  labelKey: string;
  summaryTextKey: string;
  customFileName?: string;
  localPreviewUrl?: string;
  updatedAt?: string;
}

export interface BrandIdentity {
  logo: BrandAssetSlot;
  secondaryLogo: BrandAssetSlot;
  watermark: BrandAssetSlot;
  colors: {
    primaryText: string;
    accentBlue: string;
    canvasDark: string;
  };
  fonts: {
    headingFont: string;
    headingWeight: string;
    captionWeight: string;
  };
  intro: BrandAssetSlot;
  outro: BrandAssetSlot;
  lowerThird: {
    styleSummaryKey: string;
    enabled: boolean;
  };
}

export interface UserAccount {
  id: string;
  email?: string;
  photoURL?: string;
  displayName: string;
  accountTierKey: string;
  avatarInitial: string;
  avatarColor: string;
  preferredLocale: SupportedLocale;
}

// ============================================================================
// 5. ASSETS, RESUMABLE UPLOAD & FFMPEG/FFPROBE PROCESSING
// ============================================================================

export type AssetKind =
  | 'raw-video'
  | 'voiceover-audio'
  | 'b-roll'
  | 'brand-graphic';

export type AssetProcessingState =
  | 'uploading'
  | 'paused'
  | 'canceled'
  | 'queued'
  | 'probing'
  | 'generating-thumbnail'
  | 'normalizing-proxy'
  | 'ready'
  | 'failed';

export type MediaWarningCode =
  | 'VIDEO_HAS_NO_AUDIO_TRACK'
  | 'VFR_NORMALIZED_TO_CFR'
  | 'ROTATION_NORMALIZED';

export interface AudioTrackMetadata {
  streamIndex: number;
  codec: string;
  sampleRate: number;
  channels: number;
  channelLayout?: string;
  language?: string;
  durationSeconds?: number;
}

export interface TimingLinkSpec {
  sourceDurationSec: number;
  normalizedDurationSec: number;
  targetCfrFps?: number;
  rotationAppliedDegrees: number;
  timeScaleRatio: number;
}

export interface DerivedAssetFiles {
  thumbnailPath?: string;
  previewProxyPath?: string;
  normalizedAudioPath?: string;
  thumbnailSignedUrl?: string;
  previewSignedUrl?: string;
  originalSignedUrl?: string;
  signedUrlExpiresAt?: string;
}

export interface AssetTechnicalMetadata {
  fileSizeBytes: number;
  mimeType: string;
  containerFormat?: string;
  videoCodec?: string;
  audioCodec?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  aspectRatioLabel?: string;
  orientation?: 'landscape' | 'portrait' | 'square';
  rotationDegrees?: number;
  fps?: number;
  isVariableFrameRate?: boolean;
  hasAudioTrack?: boolean;
  audioTracks?: AudioTrackMetadata[];
}

export interface MediaAsset {
  id: string;
  projectId: string;
  ownerUid: string;
  kind: AssetKind;
  fileName: string;
  storagePath: string;
  localObjectUrl?: string;
  storageStatus: 'local-session-only' | 'uploading' | 'uploaded' | 'failed';
  processingState?: AssetProcessingState;
  uploadProgress?: number;
  uploadedBytes?: number;
  failureCode?: string;
  failureMessage?: string;
  warnings?: MediaWarningCode[];
  timingLink?: TimingLinkSpec;
  derivedFiles?: DerivedAssetFiles;
  metadata: AssetTechnicalMetadata;
  createdAt: string;
  updatedAt?: string;
}

export interface ServerMediaLimitsConfig {
  maxFileSizeBytes: number;
  maxDurationSeconds: number;
  supportedVideoContainers: string[];
  supportedVideoCodecs: string[];
  supportedAudioContainers: string[];
  supportedAudioCodecs: string[];
  chunkSizeBytes: number;
  signedUrlTtlSeconds: number;
}

export interface ActiveResumableUploadItem {
  uploadId: string;
  assetId: string;
  projectId: string;
  file: File;
  fileName: string;
  kind: AssetKind;
  totalBytes: number;
  uploadedBytes: number;
  progressPercent: number;
  state:
    | 'uploading'
    | 'paused'
    | 'canceled'
    | 'processing'
    | 'ready'
    | 'failed';
  processingStageLabel?: string;
  durationSeconds?: number;
  errorMessage?: string;
  warnings?: MediaWarningCode[];
}

export interface ProjectDeletionJob {
  id: string;
  projectId: string;
  ownerUid: string;
  state: 'running' | 'completed' | 'failed';
  removedFilesCount: number;
  freedBytes: number;
  steps: {
    step:
      | 'abort_active_uploads'
      | 'remove_original_files'
      | 'remove_derived_proxies_and_thumbnails'
      | 'purge_ownership_index';
    status: 'completed' | 'failed';
  }[];
  startedAt: string;
  completedAt?: string;
}

// ============================================================================
// 6. ANALYSIS (Speech, Silence, Visual Cues — Schema Prepared for Brain)
// ============================================================================

export interface TranscriptSegment {
  id: string;
  startTimeSec: number;
  endTimeSec: number;
  text: string;
  speakerId?: string;
  confidence: number;
}

export interface SilenceRegion {
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  recommendCut: boolean;
}

export interface ContentAnalysis {
  id: string;
  projectId: string;
  sourceAssetId: string;
  status:
    | 'not-started'
    | 'disabled-phase-1'
    | 'analyzing'
    | 'completed'
    | 'failed';
  detectedLanguage?: string;
  transcriptSegments: TranscriptSegment[];
  silenceRegions: SilenceRegion[];
  keyTakeaways: string[];
  createdAt: string;
}

// ============================================================================
// 7. SCENES, UNIFIED EDIT PLANS & REMOTION RENDER JOBS
// ============================================================================

export type RemotionLayerType =
  | 'video-clip'
  | 'voiceover-track'
  | 'kinetic-typography'
  | 'diagram-explainer'
  | 'callout-card'
  | 'b-roll-overlay'
  | 'lower-third'
  | 'caption-layer';

export interface RemotionLayerSpec {
  id: string;
  type: RemotionLayerType;
  label: string;
  startFrame: number;
  durationInFrames: number;
  props: Record<string, string | number | boolean>;
}

export interface SceneDefinition {
  id: string;
  index: number;
  title: string;
  intentSummary: string;
  startTimeSec: number;
  durationSec: number;
  transitionIn: 'cut' | 'whip-pan' | 'dissolve' | 'zoom-punch';
  layers: RemotionLayerSpec[];
}

export interface EditPlan {
  id: string;
  projectId: string;
  versionNumber: number;
  brainModelId: BrainModelId;
  modelVersion: number;
  rulesVersion: number;
  stylePresetId: StylePresetId;
  enabledElementIds: ElementCapabilityId[];
  status: 'draft-unexecuted' | 'disabled-phase-1' | 'planned' | 'applied';
  fps: 30 | 60;
  width: number;
  height: number;
  scenes: SceneDefinition[];
  unifiedPlan?: UnifiedEditPlan;
  preflightReport?: VionPreflightQaReport;
  createdAt: string;
}

export interface RenderedMp4ProbeReport {
  containerFormat: string;
  videoCodec: string;
  audioCodec?: string;
  hasAudioTrack: boolean;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  fileSizeBytes: number;
  verifiedAt: string;
}

export type RemotionRenderJobState =
  | 'queued'
  | 'bundling'
  | 'rendering'
  | 'probing-output'
  | 'uploading-storage'
  | 'completed'
  | 'failed';

export interface RemotionRenderJob {
  id: string;
  projectId: string;
  ownerUid: string;
  modelId: BrainModelId;
  modelVersion: number;
  rulesVersion: number;
  modelSnapshot?: BrainJobModelSnapshot;
  planId: string;
  planTitle: string;
  planMode: UnifiedEditPlan['planMode'];
  state: RemotionRenderJobState;
  progressPercent: number;
  renderedFrames: number;
  totalFrames: number;
  outputStoragePath?: string;
  downloadSignedUrl?: string;
  signedUrlExpiresAt?: string;
  ffprobeReport?: RenderedMp4ProbeReport;
  preflightReport?: VionPreflightQaReport;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ============================================================================
// 8. TASKS & JOBS (Server Pipeline State)
// ============================================================================

export type TaskStage =
  | 'asset-ingest'
  | 'brain-analysis'
  | 'scene-planning'
  | 'remotion-composition'
  | 'mp4-render';

export type TaskExecutionState =
  | 'disabled-phase-1'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export interface ProcessingTask {
  id: string;
  projectId: string;
  modelId: BrainModelId;
  modelVersion: number;
  rulesVersion: number;
  modelSnapshot?: BrainJobModelSnapshot;
  stage: TaskStage;
  state: TaskExecutionState;
  statusMessageKey: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 9. OUTPUT VERSIONS (Rendered MP4 Artifacts & Revision History)
// ============================================================================

export interface OutputVersion {
  id: string;
  projectId: string;
  editPlanId: string;
  renderJobId?: string;
  versionLabel: string;
  status: 'not-rendered' | 'disabled-phase-1' | 'ready' | 'failed';
  format: 'mp4';
  codec: 'h264';
  resolutionLabel: '1080p' | '720p' | '4K' | '9:16 Vertical';
  downloadUrl?: string;
  ffprobeReport?: RenderedMp4ProbeReport;
  createdAt: string;
}

// ============================================================================
// 10. MESSAGES & CONVERSATION
// ============================================================================

export type MessageRole = 'user' | 'brain-system';

export interface MessageAttachment {
  assetId: string;
  fileName: string;
  kind: AssetKind;
  fileSizeBytes: number;
  durationSeconds?: number;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  ownerUid: string;
  role: MessageRole;
  content: string;
  systemNoticeKey?: string;
  attachments: MessageAttachment[];
  selectedModelId: BrainModelId;
  modelVersion?: number;
  rulesVersion?: number;
  selectedStyleId: StylePresetId;
  createdAt: string;
}

// ============================================================================
// 11. PROJECTS (Aggregate Root)
// ============================================================================

export type ProjectWorkflowMode =
  | 'unselected'
  | 'video-edit'
  | 'voiceover-motion';

export interface Project {
  id: string;
  ownerUid: string;
  name: string;
  workflowMode: ProjectWorkflowMode;
  selectedModelId: BrainModelId;
  selectedStyleId: StylePresetId;
  archived: boolean;
  assets: MediaAsset[];
  messages: ChatMessage[];
  analysis: ContentAnalysis | null;
  editPlans: EditPlan[];
  tasks: ProcessingTask[];
  outputVersions: OutputVersion[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 12. ADMIN RBAC, PERMISSIONS & AUDIT LOGS
// ============================================================================

export type AdminSectionId =
  | 'models'
  | 'rules'
  | 'skills'
  | 'styles'
  | 'references'
  | 'jobs'
  | 'usage'
  | 'access';

export interface AdminPermissions {
  isPrimaryOwner: boolean;
  canEditRules: boolean;
  canPublishModels: boolean;
  canMonitorOperations: boolean;
  canManageAccess: boolean;
}

export interface VerifiedSessionInfo {
  uid: string;
  email: string;
  emailVerified: boolean;
  signInProvider: string;
  isAdmin: boolean;
  permissions: AdminPermissions;
  pendingInviteToClaim?: {
    inviteId: string;
    canEditRules: boolean;
    canPublishModels: boolean;
    canMonitorOperations: boolean;
    canManageAccess: boolean;
  };
}

export interface AdminGrantEntry {
  id: string;
  email: string;
  boundUid?: string;
  isPrimaryOwner: boolean;
  canEditRules: boolean;
  canPublishModels: boolean;
  canMonitorOperations: boolean;
  canManageAccess: boolean;
  createdByUid: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetEmail: string;
  details: string;
  createdAt: string;
}

// ============================================================================
// 13. SYSTEM CAPABILITIES STATUS (Server -> Client Contract)
// ============================================================================

export interface SystemCapabilitiesStatus {
  phase: 'phase-4-remotion-pipeline';
  engineName: 'Brain';
  authConnected: boolean;
  firestoreConnected: boolean;
  privateStorageConnected: boolean;
  ffmpegWorkerConnected: boolean;
  remotionConnected: boolean;
  aiConnected: boolean;
  paymentsConnected: boolean;
  mediaLimits: ServerMediaLimitsConfig;
  serverTimestamp: string;
}
