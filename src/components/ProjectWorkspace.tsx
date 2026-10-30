import { Player } from '@remotion/player';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video,
  Mic,
  Download,
  Film,
  Layers,
  MessageSquare,
  MonitorPlay,
  Columns2,
  Clock,
  HardDrive,
  Volume2,
  VolumeX,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Compass,
  Link2,
  Sparkles,
  Loader2,
  FileCode2,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { VionMasterComposition } from '../remotion/VionComposition';
import type { UnifiedEditPlan } from '../remotion/editPlanSchema';
import { processingService } from '../services/processingService';
import { renderService } from '../services/renderService';
import type {
  AssetKind,
  BrainModelDTO,
  ElementCapability,
  MediaAsset,
  Project,
  RemotionRenderJob,
  VideoStylePreset,
} from '../types/domain';
import { PixelMountainArtwork } from './PixelMountainArtwork';

interface ProjectWorkspaceProps {
  project: Project | null;
  models: BrainModelDTO[];
  styles: VideoStylePreset[];
  elements: ElementCapability[];
  onQuickAttachMedia: (file: File, kind: AssetKind) => void;
  onRenewSignedUrls?: () => Promise<void>;
}

export type WorkspaceViewMode = 'split' | 'chat' | 'preview';

function VoiceoverAudioPlayer({
  asset,
  srcUrl,
  onTokenExpiredError,
}: {
  asset: MediaAsset;
  srcUrl: string;
  onTokenExpiredError?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    asset.metadata.durationSeconds ?? 0
  );
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const nextTime = Number(e.target.value);
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const effectiveDuration =
    duration > 0 ? duration : (asset.metadata.durationSeconds ?? 1);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0E121D] to-[#090A0E]">
      <audio
        ref={audioRef}
        key={srcUrl}
        src={srcUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setDuration(d);
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onError={() => onTokenExpiredError?.()}
      />

      <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
        <Mic className="w-6 h-6" />
      </div>

      <div
        className="text-xs sm:text-sm font-semibold text-white max-w-md truncate"
        dir="auto"
      >
        {asset.fileName}
      </div>

      <div className="text-[11px] text-zinc-400 mt-1 tabular-nums flex items-center gap-2">
        <span>{processingService.formatBytes(asset.metadata.fileSizeBytes)}</span>
        {asset.metadata.audioCodec && (
          <span>· {asset.metadata.audioCodec.toUpperCase()}</span>
        )}
        {asset.metadata.durationSeconds && (
          <span>
            · {processingService.formatDuration(asset.metadata.durationSeconds)}
          </span>
        )}
      </div>

      {/* Custom Interactive Audio Player Controls */}
      <div className="mt-5 w-full max-w-md p-3.5 rounded-2xl bg-[#131620] border border-white/[0.08] flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ms-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={effectiveDuration}
            step={0.05}
            value={Math.min(currentTime, effectiveDuration)}
            onChange={handleSeek}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-white/[0.1] rounded-lg"
          />
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
            <span>{processingService.formatDuration(currentTime)}</span>
            <span>{processingService.formatDuration(effectiveDuration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 flex items-center justify-center shrink-0 transition-colors"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-zinc-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-blue-400" />
          )}
        </button>
      </div>
    </div>
  );
}

export function ProjectWorkspace({
  project,
  models,
  styles,
  elements,
  onQuickAttachMedia,
  onRenewSignedUrls,
}: ProjectWorkspaceProps) {
  const { t } = useI18n();
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');
  const [desktopView, setDesktopView] = useState<WorkspaceViewMode>('split');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isRenewingUrls, setIsRenewingUrls] = useState(false);

  // Remotion EditPlan & Player State
  const [stageMode, setStageMode] = useState<'remotion' | 'raw'>('remotion');
  const [activeEditPlan, setActiveEditPlan] = useState<UnifiedEditPlan | null>(
    null
  );
  const [isBuildingPlan, setIsBuildingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showPlanJson, setShowPlanJson] = useState(false);

  // Customizable Bilingual Titles for Test 1 / Test 2
  const [arabicTitleInput, setArabicTitleInput] = useState(
    'منصة VION — محرر الفيديو الذكي'
  );
  const [englishTitleInput, setEnglishTitleInput] = useState(
    'VION Studio — 10s Bilingual Motion Test'
  );

  // Independent Background Render Jobs State
  const [renderJobs, setRenderJobs] = useState<RemotionRenderJob[]>([]);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [downloadErrorByJobId, setDownloadErrorByJobId] = useState<
    Record<string, string>
  >({});

  const rawVideoInputRef = React.useRef<HTMLInputElement | null>(null);
  const voiceoverInputRef = React.useRef<HTMLInputElement | null>(null);

  const primaryAsset =
    project?.assets.find((a) => a.id === selectedAssetId) ??
    project?.assets[project.assets.length - 1] ??
    null;

  // Load persisted background render jobs when project opens
  const refreshProjectRenderJobs = useCallback(async () => {
    if (!project?.id) {
      setRenderJobs([]);
      return;
    }
    try {
      const jobs = await renderService.listProjectRenderJobs(project.id);
      setRenderJobs(jobs);
    } catch {
      // Ignore if unauthenticated
    }
  }, [project?.id]);

  const autoInitAssetIdRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveEditPlan(null);
    setPlanError(null);
    autoInitAssetIdRef.current = null;
    refreshProjectRenderJobs();
  }, [project?.id, refreshProjectRenderJobs]);

  // Build deterministic non-AI test plan using the project's selected model
  const handleBuildTestPreset = useCallback(
    async (
      asset: MediaAsset,
      modeOverride?: 'video-10s-bilingual-test' | 'audio-10s-motion-test'
    ) => {
      if (!project) return;
      const resolvedMode =
        modeOverride ??
        (asset.kind === 'voiceover-audio'
          ? 'audio-10s-motion-test'
          : 'video-10s-bilingual-test');

      setIsBuildingPlan(true);
      setPlanError(null);
      try {
        const verifiedPlan = await renderService.createTestEditPlan({
          projectId: project.id,
          assetId: asset.id,
          testMode: resolvedMode,
          modelId: project.selectedModelId,
          arabicTitle: arabicTitleInput.trim() || undefined,
          englishTitle: englishTitleInput.trim() || undefined,
        });
        setActiveEditPlan(verifiedPlan);
        setStageMode('remotion');
      } catch (err) {
        setPlanError(
          err instanceof Error ? err.message : 'Failed to build EditPlan.'
        );
      } finally {
        setIsBuildingPlan(false);
      }
    },
    [project, arabicTitleInput, englishTitleInput]
  );

  // Auto-initialize EditPlan once when an asset first loads (never re-runs when switching modelId)
  useEffect(() => {
    if (!project || !primaryAsset) return;
    if (autoInitAssetIdRef.current === primaryAsset.id) return;

    const currentModelDto = models.find(
      (m) => m.id === project.selectedModelId
    );
    const isModelCurrentlyEnabled = Boolean(
      currentModelDto && currentModelDto.enabled && !currentModelDto.archived
    );
    if (!isModelCurrentlyEnabled) {
      return;
    }

    if (!activeEditPlan && !isBuildingPlan && !planError) {
      autoInitAssetIdRef.current = primaryAsset.id;
      handleBuildTestPreset(primaryAsset);
    }
  }, [
    project?.id,
    primaryAsset?.id,
    models,
    activeEditPlan,
    isBuildingPlan,
    planError,
    handleBuildTestPreset,
    project,
    primaryAsset,
  ]);

  // Poll any active background render jobs (`queued`, `bundling`, `rendering`, `probing-output`, `uploading-storage`)
  const hasRunningRenderJob = renderJobs.some(
    (j) => j.state !== 'completed' && j.state !== 'failed'
  );

  useEffect(() => {
    if (!project?.id || !hasRunningRenderJob) return;
    const interval = window.setInterval(() => {
      refreshProjectRenderJobs();
    }, 1500);
    return () => window.clearInterval(interval);
  }, [project?.id, hasRunningRenderJob, refreshProjectRenderJobs]);

  const handleStartBackgroundRender = async () => {
    if (!project || !activeEditPlan || isStartingRender) return;
    setIsStartingRender(true);
    setPlanError(null);
    try {
      const createdJob = await renderService.startBackgroundRenderJob({
        projectId: project.id,
        plan: activeEditPlan,
        modelId: project.selectedModelId,
      });
      setRenderJobs((prev) => [
        createdJob,
        ...prev.filter((j) => j.id !== createdJob.id),
      ]);
    } catch (err) {
      setPlanError(
        err instanceof Error ? err.message : 'Failed to start render job.'
      );
    } finally {
      setIsStartingRender(false);
    }
  };

  const handleDownloadVerifiedMp4 = async (job: RemotionRenderJob) => {
    if (downloadingJobId === job.id) return;
    setDownloadingJobId(job.id);
    setDownloadErrorByJobId((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });
    try {
      await renderService.downloadRenderedMp4(job);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to download verified MP4.';
      setDownloadErrorByJobId((prev) => ({
        ...prev,
        [job.id]: msg,
      }));
    } finally {
      setDownloadingJobId(null);
    }
  };

  const handleQuickFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: AssetKind
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      onQuickAttachMedia(file, kind);
      setMobileTab('preview');
    }
    e.target.value = '';
  };

  const handleManualRenewUrls = async () => {
    if (!onRenewSignedUrls || isRenewingUrls) return;
    setIsRenewingUrls(true);
    try {
      await onRenewSignedUrls();
      if (primaryAsset) {
        await handleBuildTestPreset(primaryAsset);
      }
    } finally {
      setIsRenewingUrls(false);
    }
  };

  // ==========================================================================
  // 1. EMPTY STATE (No active project opened yet — matches UI.png & 1_101dd8d5.PNG)
  // ==========================================================================
  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto min-h-0">
        <input
          ref={rawVideoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv,video/*"
          className="hidden"
          onChange={(e) => handleQuickFile(e, 'raw-video')}
        />
        <input
          ref={voiceoverInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*"
          className="hidden"
          onChange={(e) => handleQuickFile(e, 'voiceover-audio')}
        />

        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <PixelMountainArtwork className="w-40 sm:w-48 h-auto mb-5 opacity-95" />
          <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">
            {t('home.subtitle')}
          </h1>
          <p className="text-xs text-zinc-500 mt-2 max-w-sm leading-relaxed">
            {t('home.workflowHint')}
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
            <button
              type="button"
              onClick={() => rawVideoInputRef.current?.click()}
              className="p-3.5 rounded-2xl bg-[#131419] hover:bg-[#191B22] border border-white/[0.07] text-start transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  {t('home.action.rawVideo')}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                  {t('home.action.rawVideoSub')}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => voiceoverInputRef.current?.click()}
              className="p-3.5 rounded-2xl bg-[#131419] hover:bg-[#191B22] border border-white/[0.07] text-start transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  {t('home.action.voiceover')}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                  {t('home.action.voiceoverSub')}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 2. ACTIVE PROJECT STATE (Conversation + Remotion Player & Render Worker Stage)
  // ==========================================================================

  const activeModel =
    models.find((m) => m.id === project.selectedModelId) ?? models[0];
  const activeStyle =
    styles.find((s) => s.id === project.selectedStyleId) ?? styles[0];
  const enabledElementsCount = elements.filter((e) => e.enabled).length;

  const playbackUrl =
    primaryAsset?.derivedFiles?.previewSignedUrl ??
    primaryAsset?.derivedFiles?.originalSignedUrl ??
    primaryAsset?.localObjectUrl;

  const thumbnailUrl = primaryAsset?.derivedFiles?.thumbnailSignedUrl;
  const completedRenderJobsCount = renderJobs.filter(
    (j) => j.state === 'completed'
  ).length;

  const renderConversationPane = () => (
    <div className="flex flex-col h-full min-h-0 bg-[#0B0C0E]">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {project.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-400 mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              {t('project.chat.emptyTitle')}
            </h3>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-sm leading-relaxed">
              {t('project.chat.emptyDesc')}
            </p>
          </div>
        ) : (
          project.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#1D202A] text-white border border-white/[0.08]'
                      : 'bg-[#12141C] text-zinc-300 border border-blue-500/20'
                  }`}
                >
                  {msg.attachments.length > 0 && (
                    <div className="mb-2.5 space-y-1.5">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.assetId}
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs"
                        >
                          {att.kind === 'voiceover-audio' ? (
                            <Mic className="w-4 h-4 text-blue-400 shrink-0" />
                          ) : (
                            <Video className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                          <span
                            className="font-medium text-white truncate"
                            dir="auto"
                          >
                            {att.fileName}
                          </span>
                          <span className="text-zinc-500 tabular-nums shrink-0">
                            {processingService.formatBytes(att.fileSizeBytes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p dir="auto" className="whitespace-pre-wrap">
                    {msg.systemNoticeKey ? t(msg.systemNoticeKey) : msg.content}
                  </p>
                  <div className="mt-1.5 pt-1.5 border-t border-white/[0.05] flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500">
                    <span>{msg.selectedModelId}</span>
                    <span>
                      · v{msg.modelVersion ?? 1} · Rules v{msg.rulesVersion ?? 1}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderPreviewPane = () => (
    <div className="flex flex-col h-full min-h-0 bg-[#0E0F13] border-s border-white/[0.06] overflow-y-auto">
      {/* Preview Top Subbar */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate">
            {t('project.preview.title')}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Switch between Remotion Player and Raw Source Player */}
          {primaryAsset && activeEditPlan && (
            <div className="flex items-center p-0.5 rounded-lg bg-[#14161E] border border-white/[0.08] text-[11px]">
              <button
                type="button"
                onClick={() => setStageMode('remotion')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  stageMode === 'remotion'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('project.preview.modeRemotion')}
              </button>
              <button
                type="button"
                onClick={() => setStageMode('raw')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  stageMode === 'raw'
                    ? 'bg-white/[0.12] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('project.preview.modeSource')}
              </button>
            </div>
          )}

          {primaryAsset && onRenewSignedUrls && (
            <button
              type="button"
              onClick={handleManualRenewUrls}
              disabled={isRenewingUrls}
              className="h-8 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw
                className={`w-3 h-3 text-blue-400 ${
                  isRenewingUrls ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline">
                {t('project.preview.renewUrlsBtn')}
              </span>
            </button>
          )}

          {/* Real Background Remotion MP4 Render Trigger Button */}
          <button
            type="button"
            disabled={!activeEditPlan || isStartingRender || hasRunningRenderJob}
            onClick={handleStartBackgroundRender}
            title={
              !activeEditPlan ? t('project.preview.exportDisabledHint') : ''
            }
            className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeEditPlan && !isStartingRender && !hasRunningRenderJob
                ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                : 'bg-white/[0.05] border border-white/[0.08] text-zinc-400 cursor-not-allowed'
            }`}
          >
            {isStartingRender || hasRunningRenderJob ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>
              {hasRunningRenderJob
                ? t('project.preview.renderingInProgress')
                : t('project.preview.exportMp4')}
            </span>
          </button>
        </div>
      </div>

      {/* Main Stage Content */}
      <div className="p-5 space-y-5 flex-1">
        {/* Multi-Asset Switcher if project has multiple uploaded assets */}
        {project.assets.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {project.assets.map((asset) => {
              const isSelected = asset.id === primaryAsset?.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    handleBuildTestPreset(asset);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/40 text-white'
                      : 'bg-[#14161D] border-white/[0.06] text-zinc-400 hover:text-white'
                  }`}
                >
                  {asset.kind === 'voiceover-audio' ? (
                    <Mic className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Video className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span className="max-w-[140px] truncate" dir="auto">
                    {asset.fileName}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 16:9 Remotion Player / Raw Media Stage Box */}
        <div className="w-full aspect-video rounded-2xl bg-[#08090C] border border-white/[0.08] overflow-hidden flex flex-col items-center justify-center relative">
          {primaryAsset && stageMode === 'remotion' && activeEditPlan ? (
            <Player
              key={`${activeEditPlan.id}_${activeEditPlan.createdAt}`}
              component={VionMasterComposition}
              inputProps={{ plan: activeEditPlan }}
              durationInFrames={activeEditPlan.durationInFrames}
              fps={activeEditPlan.fps}
              compositionWidth={activeEditPlan.width}
              compositionHeight={activeEditPlan.height}
              controls
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          ) : primaryAsset && playbackUrl ? (
            primaryAsset.kind === 'raw-video' ||
            primaryAsset.kind === 'b-roll' ? (
              <video
                key={playbackUrl}
                src={playbackUrl}
                poster={thumbnailUrl}
                controls
                playsInline
                onError={() => handleManualRenewUrls()}
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <VoiceoverAudioPlayer
                asset={primaryAsset}
                srcUrl={playbackUrl}
                onTokenExpiredError={handleManualRenewUrls}
              />
            )
          ) : (
            <div className="p-6 text-center max-w-sm">
              <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-500 mx-auto mb-3">
                <MonitorPlay className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-white">
                {t('project.preview.emptyTitle')}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                {t('project.preview.emptyDesc')}
              </p>
            </div>
          )}
        </div>

        {/* Deterministic Non-AI Remotion Test Controls & Unified EditPlan Blueprint */}
        <div className="p-4 rounded-2xl bg-[#13151C] border border-white/[0.06] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              {t('project.preview.scenePlanHeader')}
            </span>
            <div className="flex items-center gap-2">
              {activeEditPlan && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-medium text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  {t('project.preview.schemaValidatedBadge')}
                </span>
              )}
              <span className="text-[11px] text-zinc-500 font-mono">
                {t('project.preview.remotionBadge')}
              </span>
            </div>
          </div>

          {primaryAsset ? (
            <div className="space-y-3">
              {/* Editable Arabic & English Titles for the Non-AI Test Composition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">
                    العنوان العربي (Arabic Title — Cairo / Noto Sans Arabic)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={arabicTitleInput}
                    onChange={(e) => setArabicTitleInput(e.target.value)}
                    className="w-full bg-[#0B0C10] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">
                    English Title (Plus Jakarta Sans)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={englishTitleInput}
                    onChange={(e) => setEnglishTitleInput(e.target.value)}
                    className="w-full bg-[#0B0C10] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons: Build Test 1 / Test 2 & Render Real MP4 */}
              <div className="flex flex-wrap items-center gap-2.5">
                {primaryAsset.kind !== 'voiceover-audio' ? (
                  <button
                    type="button"
                    disabled={isBuildingPlan}
                    onClick={() =>
                      handleBuildTestPreset(
                        primaryAsset,
                        'video-10s-bilingual-test'
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/35 text-xs font-semibold text-blue-200 flex items-center gap-2 transition-colors"
                  >
                    {isBuildingPlan ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>{t('project.preview.loadTest1VideoBtn')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBuildingPlan}
                    onClick={() =>
                      handleBuildTestPreset(
                        primaryAsset,
                        'audio-10s-motion-test'
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/35 text-xs font-semibold text-blue-200 flex items-center gap-2 transition-colors"
                  >
                    {isBuildingPlan ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>{t('project.preview.loadTest2AudioBtn')}</span>
                  </button>
                )}

                {activeEditPlan && (
                  <button
                    type="button"
                    disabled={isStartingRender || hasRunningRenderJob}
                    onClick={handleStartBackgroundRender}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
                  >
                    {isStartingRender || hasRunningRenderJob ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {hasRunningRenderJob
                        ? t('project.preview.renderingInProgress')
                        : t('project.preview.renderMp4Btn')}
                    </span>
                  </button>
                )}

                {activeEditPlan && (
                  <button
                    type="button"
                    onClick={() => setShowPlanJson((prev) => !prev)}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[11px] font-medium text-zinc-300 flex items-center gap-1.5 transition-colors ms-auto"
                  >
                    <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>{showPlanJson ? 'Hide Schema JSON' : 'Inspect EditPlan JSON'}</span>
                  </button>
                )}
              </div>

              {planError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300">
                  {planError}
                </div>
              )}

              {/* Active UnifiedEditPlan Summary */}
              {activeEditPlan && (
                <div className="p-3 rounded-xl bg-[#0B0C10] border border-white/[0.06] space-y-2 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-300">
                    <span className="font-semibold text-white">
                      {activeEditPlan.title}
                    </span>
                    <span className="font-mono text-zinc-400">
                      {activeEditPlan.width}×{activeEditPlan.height} ·{' '}
                      {activeEditPlan.fps}fps ·{' '}
                      {activeEditPlan.durationSeconds}s (
                      {activeEditPlan.durationInFrames} frames)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-zinc-400">
                    <span>
                      Clips / Scenes:{' '}
                      <strong className="text-zinc-200">
                        {activeEditPlan.clips.length}
                      </strong>
                    </span>
                    <span>
                      Mode:{' '}
                      <strong className="text-zinc-200">
                        {activeEditPlan.planMode}
                      </strong>
                    </span>
                    <span>
                      Text Overlays (AR+EN):{' '}
                      <strong className="text-zinc-200">
                        {activeEditPlan.textOverlays.length}
                      </strong>
                    </span>
                    <span>
                      Audio Tracks:{' '}
                      <strong className="text-zinc-200">
                        {activeEditPlan.audioTracks.length}
                      </strong>
                    </span>
                    <span className="font-mono text-blue-300">
                      Engine: {activeEditPlan.modelId} (v
                      {activeEditPlan.modelVersion} · Rules v
                      {activeEditPlan.rulesVersion})
                    </span>
                  </div>

                  {showPlanJson && (
                    <pre
                      dir="ltr"
                      className="mt-2 p-3 rounded-lg bg-black/70 border border-white/[0.06] text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-56"
                    >
                      {JSON.stringify(activeEditPlan, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 leading-relaxed">
              {t('project.preview.noScenesYet')}
            </p>
          )}
        </div>

        {/* Independent Background Render Jobs & FFprobe MP4 Verification Section */}
        <div className="p-4 rounded-2xl bg-[#13151C] border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-blue-400" />
              {t('project.preview.renderJobsHeader')}
            </span>
            <button
              type="button"
              onClick={refreshProjectRenderJobs}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {renderJobs.length === 0 ? (
            <p className="text-xs text-zinc-500">
              {t('project.preview.noRenderJobs')}
            </p>
          ) : (
            <div className="space-y-2.5">
              {renderJobs.map((job) => {
                const isCompleted = job.state === 'completed';
                const isFailed = job.state === 'failed';
                return (
                  <div
                    key={job.id}
                    className="p-3.5 rounded-xl bg-[#0B0C10] border border-white/[0.07] space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-blue-400 font-semibold">
                          {job.id}
                        </span>
                        <span className="text-zinc-300 font-medium truncate">
                          · {job.planTitle}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] font-mono text-[10px] text-zinc-300">
                          {job.modelId} · v{job.modelVersion} · Rules v
                          {job.rulesVersion}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                            isCompleted
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isFailed
                                ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {job.state} ({job.progressPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {!isCompleted && !isFailed && (
                      <div className="space-y-1">
                        <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${job.progressPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                          <span>
                            Frames: {job.renderedFrames} / {job.totalFrames}
                          </span>
                          <span>Decoupled Background Worker</span>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {isFailed && job.errorMessage && (
                      <div className="text-[11px] text-red-300 bg-red-500/10 p-2 rounded-lg">
                        {job.errorMessage}
                      </div>
                    )}

                    {/* Completed FFprobe Verification Report & Authorized Download Button */}
                    {isCompleted && job.ffprobeReport && (
                      <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('project.preview.ffprobeVerifiedBadge')}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono flex flex-wrap items-center gap-2">
                            <span>
                              Video:{' '}
                              <strong className="text-zinc-200 uppercase">
                                {job.ffprobeReport.videoCodec}
                              </strong>
                            </span>
                            <span>
                              · Audio:{' '}
                              <strong className="text-zinc-200 uppercase">
                                {job.ffprobeReport.audioCodec}
                              </strong>
                            </span>
                            <span>
                              · {job.ffprobeReport.width}×
                              {job.ffprobeReport.height} @{' '}
                              {job.ffprobeReport.fps}fps
                            </span>
                            <span>
                              · {job.ffprobeReport.durationSeconds}s
                            </span>
                            <span>
                              ·{' '}
                              {processingService.formatBytes(
                                job.ffprobeReport.fileSizeBytes
                              )}
                            </span>
                          </div>
                        </div>

                        {job.downloadSignedUrl && (
                          <button
                            type="button"
                            disabled={downloadingJobId === job.id}
                            onClick={() => handleDownloadVerifiedMp4(job)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                          >
                            {downloadingJobId === job.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>{t('project.preview.downloadMp4Btn')}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {downloadErrorByJobId[job.id] && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                        <span>{downloadErrorByJobId[job.id]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Probed Source Technical Metadata, Thumbnail & Warnings Card */}
        {primaryAsset && (
          <div className="p-4 rounded-2xl bg-[#13151C] border border-white/[0.06] space-y-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={primaryAsset.fileName}
                    className="w-14 h-9 rounded-lg object-cover border border-white/[0.1] bg-black shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                    {primaryAsset.kind === 'voiceover-audio' ? (
                      <Mic className="w-4 h-4" />
                    ) : (
                      <Video className="w-4 h-4" />
                    )}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-semibold text-white truncate"
                      dir="auto"
                    >
                      {primaryAsset.fileName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {primaryAsset.processingState ?? 'ready'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2">
                    {primaryAsset.metadata.containerFormat && (
                      <span>
                        Format:{' '}
                        <strong className="text-zinc-200 uppercase">
                          {primaryAsset.metadata.containerFormat}
                        </strong>
                      </span>
                    )}
                    {primaryAsset.metadata.videoCodec && (
                      <span>
                        · Video:{' '}
                        <strong className="text-zinc-200 uppercase">
                          {primaryAsset.metadata.videoCodec}
                        </strong>
                      </span>
                    )}
                    {primaryAsset.metadata.audioCodec && (
                      <span>
                        · Audio:{' '}
                        <strong className="text-zinc-200 uppercase">
                          {primaryAsset.metadata.audioCodec}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-zinc-300 tabular-nums text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                  {processingService.formatBytes(
                    primaryAsset.metadata.fileSizeBytes
                  )}
                </span>

                {typeof primaryAsset.metadata.durationSeconds === 'number' && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    {processingService.formatDuration(
                      primaryAsset.metadata.durationSeconds
                    )}
                  </span>
                )}

                {primaryAsset.metadata.width &&
                  primaryAsset.metadata.height && (
                    <span className="inline-flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-zinc-500" />
                      {primaryAsset.metadata.width}×
                      {primaryAsset.metadata.height}
                      {primaryAsset.metadata.orientation
                        ? ` (${primaryAsset.metadata.orientation})`
                        : ''}
                    </span>
                  )}

                {typeof primaryAsset.metadata.fps === 'number' && (
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-zinc-500" />
                    {primaryAsset.metadata.fps} fps
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
              <div className="flex flex-wrap items-center gap-3">
                {primaryAsset.kind !== 'voiceover-audio' && (
                  <span>
                    {t('project.preview.audioTracksLabel')}:{' '}
                    <strong className="text-zinc-200">
                      {primaryAsset.metadata.hasAudioTrack === false
                        ? t('project.preview.silentVideoBadge')
                        : `${primaryAsset.metadata.audioTracks?.length ?? 1} (${primaryAsset.metadata.audioCodec?.toUpperCase() ?? 'AAC'})`}
                    </strong>
                  </span>
                )}

                {primaryAsset.timingLink && (
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Link2 className="w-3.5 h-3.5 text-blue-400" />
                    {t('project.preview.timingLinkLabel')}:{' '}
                    <span className="font-mono">
                      {primaryAsset.timingLink.sourceDurationSec}s →{' '}
                      {primaryAsset.timingLink.normalizedDurationSec}s (ratio{' '}
                      {primaryAsset.timingLink.timeScaleRatio})
                    </span>
                  </span>
                )}
              </div>

              {primaryAsset.derivedFiles?.previewSignedUrl && (
                <span className="text-blue-400 font-medium">
                  {t('project.preview.proxyBadge')}
                </span>
              )}
            </div>

            {primaryAsset.warnings && primaryAsset.warnings.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {primaryAsset.warnings.includes('VIDEO_HAS_NO_AUDIO_TRACK') && (
                  <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('upload.warning.noAudio')}</span>
                  </div>
                )}
                {primaryAsset.warnings.includes('VFR_NORMALIZED_TO_CFR') && (
                  <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('upload.warning.vfrNormalized')}</span>
                  </div>
                )}
                {primaryAsset.warnings.includes('ROTATION_NORMALIZED') && (
                  <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('upload.warning.rotationNormalized')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Active Project Configuration Summary */}
        <div className="p-4 rounded-2xl bg-[#13151C] border border-white/[0.06] space-y-3">
          <div className="text-xs font-semibold text-white">
            {t('project.preview.activeConfig')}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div>
              <div className="text-[11px] text-zinc-500">
                {t('project.preview.engineLabel')}
              </div>
              <div className="text-white font-medium mt-0.5">
                {activeModel?.name ?? 'Brain 1.8'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">
                {t('project.preview.styleLabel')}
              </div>
              <div className="text-white font-medium mt-0.5 truncate">
                {activeStyle ? t(activeStyle.nameKey) : '-'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">
                {t('project.preview.elementsLabel')}
              </div>
              <div className="text-white font-medium mt-0.5 tabular-nums">
                {enabledElementsCount} / {elements.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">
                {t('project.preview.versionsLabel')}
              </div>
              <div className="text-zinc-300 font-medium mt-0.5 tabular-nums">
                {completedRenderJobsCount > 0
                  ? `${completedRenderJobsCount} MP4 (${t('project.preview.ffprobeVerifiedBadge')})`
                  : t('project.preview.noVersions')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Sub-navigation bar for Mobile Tabs & Desktop View Mode */}
      <div className="px-4 sm:px-6 py-2 border-b border-white/[0.06] bg-[#0B0C0E] flex items-center justify-between gap-3 shrink-0">
        <div className="flex lg:hidden items-center gap-1 p-1 bg-[#141519] border border-white/[0.06] rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMobileTab('chat')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              mobileTab === 'chat'
                ? 'bg-[#2563EB] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('project.tab.chat')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              mobileTab === 'preview'
                ? 'bg-[#2563EB] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>{t('project.tab.preview')}</span>
            {project.assets.length > 0 && (
              <span className="text-[10px] opacity-80 tabular-nums">
                ({project.assets.length})
              </span>
            )}
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-1 p-1 bg-[#141519] border border-white/[0.06] rounded-xl">
          <button
            type="button"
            onClick={() => setDesktopView('split')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              desktopView === 'split'
                ? 'bg-white/[0.1] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{t('project.tab.split')}</span>
          </button>
          <button
            type="button"
            onClick={() => setDesktopView('chat')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              desktopView === 'chat'
                ? 'bg-white/[0.1] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('project.tab.chat')}</span>
          </button>
          <button
            type="button"
            onClick={() => setDesktopView('preview')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              desktopView === 'preview'
                ? 'bg-white/[0.1] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>{t('project.tab.preview')}</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
          <span>
            {project.workflowMode === 'video-edit'
              ? t('project.mode.videoEdit')
              : project.workflowMode === 'voiceover-motion'
                ? t('project.mode.voiceoverMotion')
                : t('project.mode.unselected')}
          </span>
        </div>
      </div>

      {/* Mobile View (< lg) */}
      <div className="flex-1 lg:hidden min-h-0 overflow-hidden">
        {mobileTab === 'chat' ? renderConversationPane() : renderPreviewPane()}
      </div>

      {/* Desktop View (lg+) */}
      <div className="hidden lg:grid flex-1 min-h-0 overflow-hidden grid-cols-12">
        {desktopView === 'split' && (
          <>
            <div className="col-span-5 h-full min-h-0 overflow-hidden">
              {renderConversationPane()}
            </div>
            <div className="col-span-7 h-full min-h-0 overflow-hidden">
              {renderPreviewPane()}
            </div>
          </>
        )}
        {desktopView === 'chat' && (
          <div className="col-span-12 h-full min-h-0 overflow-hidden">
            {renderConversationPane()}
          </div>
        )}
        {desktopView === 'preview' && (
          <div className="col-span-12 h-full min-h-0 overflow-hidden">
            {renderPreviewPane()}
          </div>
        )}
      </div>
    </div>
  );
}
