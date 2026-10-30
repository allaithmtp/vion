import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronUp,
  Plus,
  Video,
  Mic,
  Check,
  Sparkles,
  SlidersHorizontal,
  X,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { processingService } from '../services/processingService';
import type {
  ActiveResumableUploadItem,
  AssetKind,
  BrainModelDTO,
  BrainModelId,
  StylePresetId,
  VideoStylePreset,
} from '../types/domain';

interface ChatComposerProps {
  models: BrainModelDTO[];
  styles: VideoStylePreset[];
  selectedModelId: BrainModelId;
  selectedStyleId: StylePresetId;
  onSelectModel: (modelId: BrainModelId) => void;
  onSelectStyle: (styleId: StylePresetId) => void;
  onSendMessage: (text: string) => void;
  onSelectLocalMedia: (file: File, kind: AssetKind) => void;
  activeUpload: ActiveResumableUploadItem | null;
  onCancelActiveUpload: () => void;
  onRetryActiveUpload: () => void;
  onDismissActiveUpload: () => void;
  enabledElementsCount: number;
  totalElementsCount: number;
  onOpenElements: () => void;
  hasActiveProject?: boolean;
}

type OpenMenuType = 'models' | 'styles' | 'attach' | null;

export function ChatComposer({
  models,
  styles,
  selectedModelId,
  selectedStyleId,
  onSelectModel,
  onSelectStyle,
  onSendMessage,
  onSelectLocalMedia,
  activeUpload,
  onCancelActiveUpload,
  onRetryActiveUpload,
  onDismissActiveUpload,
  enabledElementsCount,
  totalElementsCount,
  onOpenElements,
  hasActiveProject = false,
}: ChatComposerProps) {
  const { locale, t } = useI18n();
  const [promptText, setPromptText] = useState('');
  const [openMenu, setOpenMenu] = useState<OpenMenuType>(null);
  const [disabledModelAlert, setDisabledModelAlert] = useState<string | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const enabledModels = models.filter((m) => m.enabled && !m.archived);
  const matchedSelectedModel = models.find((m) => m.id === selectedModelId);
  const isCurrentModelDisabled = Boolean(
    hasActiveProject &&
      selectedModelId &&
      (!matchedSelectedModel ||
        !matchedSelectedModel.enabled ||
        matchedSelectedModel.archived)
  );

  const activeModel =
    matchedSelectedModel ??
    enabledModels.find((m) => m.isDefault) ??
    enabledModels[0] ??
    models[0];
  const activeStyle =
    styles.find((s) => s.id === selectedStyleId) ?? styles[0];

  const canOpenModelsMenu =
    enabledModels.length > 1 ||
    (isCurrentModelDisabled && enabledModels.length >= 1);

  useEffect(() => {
    if (!isCurrentModelDisabled) {
      setDisabledModelAlert(null);
    }
  }, [isCurrentModelDisabled, selectedModelId]);

  // Close upward menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = promptText.trim();
    if (!trimmed) return;
    if (isCurrentModelDisabled) {
      setDisabledModelAlert(
        locale === 'ar'
          ? 'النموذج المحفوظ لهذا المشروع معطّل حاليًا. النتائج السابقة محفوظة؛ اختر نموذجًا مفعّلًا أولًا لإرسال طلب معالجة جديد.'
          : 'This project’s saved Brain model is currently disabled. Previous results are preserved; please select an enabled model first for new requests.'
      );
      if (enabledModels.length >= 1) {
        setOpenMenu('models');
      }
      return;
    }
    onSendMessage(trimmed);
    setPromptText('');
    setOpenMenu(null);
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: AssetKind
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectLocalMedia(file, kind);
    }
    e.target.value = '';
    setOpenMenu(null);
  };

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[760px] mx-auto px-3 sm:px-6 pb-safe pt-2 shrink-0 relative z-30"
    >
      {/* Hidden File Inputs for Direct Resumable Video & Voiceover Upload */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv,.m4v,.3gp,video/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'raw-video')}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'voiceover-audio')}
      />

      {/* Upward-Opening Menu (Drop-up) for MODELS (Only when >1 enabled model or replacing a disabled project model) */}
      {openMenu === 'models' && canOpenModelsMenu && (
        <div
          role="menu"
          className="absolute bottom-full mb-3 start-3 end-3 sm:start-6 sm:end-auto sm:w-[430px] max-h-[65dvh] overflow-y-auto bg-[#14151A] border border-white/[0.1] rounded-2xl shadow-2xl p-3.5 z-40"
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-white">
              {t('chat.modelsMenuTitle')}
            </span>
            <span className="text-[11px] text-zinc-400">
              {enabledModels.length}{' '}
              {locale === 'ar' ? 'نماذج مفعّلة' : 'Enabled'}
            </span>
          </div>

          <div className="space-y-2">
            {enabledModels.map((model) => {
              const isSelected = model.id === selectedModelId;
              const desc =
                locale === 'ar'
                  ? model.descriptionAr ||
                    model.description ||
                    t(model.descriptionKey)
                  : model.description || t(model.descriptionKey);
              const videoCaps = model.videoCapabilities ?? [];
              const audioCaps = model.audioCapabilities ?? [];

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(model.id);
                    setDisabledModelAlert(null);
                    setOpenMenu(null);
                  }}
                  className={`w-full text-start p-3 rounded-xl border transition-colors flex items-start gap-3 ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500/40'
                      : 'bg-[#191B22] border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  <img
                    src={model.iconUrl}
                    alt={model.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-contain shrink-0 bg-[#0B0C0E]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {model.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300">
                          v{model.modelVersion ?? 1}
                        </span>
                        {model.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">
                            {locale === 'ar' ? 'افتراضي' : 'Default'}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {desc}
                    </p>
                    {(videoCaps.length > 0 || audioCaps.length > 0) && (
                      <div className="mt-2 pt-2 border-t border-white/[0.05] space-y-1 text-[11px] text-zinc-400">
                        {videoCaps.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Video className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="text-zinc-300 font-medium">
                              {locale === 'ar' ? 'قدرات الفيديو:' : 'Video:'}
                            </span>
                            <span>{videoCaps.slice(0, 3).join(' · ')}</span>
                          </div>
                        )}
                        {audioCaps.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Mic className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="text-zinc-300 font-medium">
                              {locale === 'ar' ? 'قدرات الصوت:' : 'Audio:'}
                            </span>
                            <span>{audioCaps.slice(0, 3).join(' · ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upward-Opening Menu (Drop-up) for STYLES */}
      {openMenu === 'styles' && (
        <div
          role="menu"
          className="absolute bottom-full mb-3 start-3 end-3 sm:start-6 sm:end-auto sm:w-[420px] max-h-[60dvh] overflow-y-auto bg-[#14151A] border border-white/[0.1] rounded-2xl shadow-2xl p-3.5 z-40"
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-white">
              {t('chat.stylesMenuTitle')}
            </span>
          </div>

          <div className="space-y-2">
            {styles.map((style) => {
              const isSelected = style.id === selectedStyleId;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    onSelectStyle(style.id);
                    setOpenMenu(null);
                  }}
                  className={`w-full text-start p-3 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500/40'
                      : 'bg-[#191B22] border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">
                      {t(style.nameKey)}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {t(style.descriptionKey)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                    {style.previewTagsKeys.map((tagKey, idx) => (
                      <React.Fragment key={tagKey}>
                        {idx > 0 && <span aria-hidden="true">·</span>}
                        <span>{t(tagKey)}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upward-Opening Menu (Drop-up) for + MEDIA ATTACHMENT (Video & Voiceover) */}
      {openMenu === 'attach' && (
        <div
          role="menu"
          className="absolute bottom-full mb-3 start-3 end-3 sm:start-6 sm:end-auto sm:w-[400px] bg-[#14151A] border border-white/[0.1] rounded-2xl shadow-2xl p-3.5 z-40"
        >
          <div className="text-xs font-semibold text-white pb-2.5 mb-2.5 border-b border-white/[0.06]">
            {t('chat.attachTitle')}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="w-full text-start p-3 rounded-xl bg-[#191B22] hover:bg-[#20232C] border border-white/[0.06] flex items-start gap-3 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">
                  {t('chat.attachRawVideo')}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  {t('chat.attachRawVideoDesc')}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="w-full text-start p-3 rounded-xl bg-[#191B22] hover:bg-[#20232C] border border-white/[0.06] flex items-start gap-3 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">
                  {t('chat.attachVoiceover')}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  {t('chat.attachVoiceoverDesc')}
                </div>
              </div>
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 mt-2.5 leading-snug">
            {t('upload.limitsHint')}
          </p>
        </div>
      )}

      {/* Active Resumable Media Upload & FFprobe/FFmpeg Status Card (Allows Upload Without Typing a Message) */}
      {activeUpload && (
        <div className="mb-2.5 p-3 rounded-2xl bg-[#14161D] border border-white/[0.09] shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  activeUpload.state === 'failed'
                    ? 'bg-red-500/15 text-red-400'
                    : activeUpload.state === 'ready'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-blue-500/15 text-blue-400'
                }`}
              >
                {activeUpload.state === 'uploading' ||
                activeUpload.state === 'processing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : activeUpload.state === 'failed' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : activeUpload.state === 'ready' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : activeUpload.kind === 'voiceover-audio' ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-[320px]"
                    dir="auto"
                  >
                    {activeUpload.fileName}
                  </span>
                  {typeof activeUpload.durationSeconds === 'number' &&
                    activeUpload.durationSeconds > 0 && (
                      <span className="text-[11px] text-zinc-400 font-mono tabular-nums shrink-0">
                        ·{' '}
                        {processingService.formatDuration(
                          activeUpload.durationSeconds
                        )}
                      </span>
                    )}
                </div>

                <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    {activeUpload.state === 'uploading' &&
                      t('upload.state.uploading')}
                    {activeUpload.state === 'paused' &&
                      t('upload.state.paused')}
                    {activeUpload.state === 'canceled' &&
                      t('upload.state.canceled')}
                    {activeUpload.state === 'processing' &&
                      t('upload.state.processing')}
                    {activeUpload.state === 'ready' && t('upload.state.ready')}
                    {activeUpload.state === 'failed' &&
                      (activeUpload.errorMessage || t('upload.state.failed'))}
                  </span>
                  {(activeUpload.state === 'uploading' ||
                    activeUpload.state === 'paused') && (
                    <span className="font-mono tabular-nums text-zinc-300">
                      ({processingService.formatBytes(activeUpload.uploadedBytes)}{' '}
                      / {processingService.formatBytes(activeUpload.totalBytes)}{' '}
                      · {activeUpload.progressPercent}%)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Cancel, Resume/Retry, or Dismiss */}
            <div className="flex items-center gap-1.5 shrink-0">
              {activeUpload.state === 'uploading' && (
                <button
                  type="button"
                  onClick={onCancelActiveUpload}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-[11px] font-medium text-red-300 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('upload.cancelBtn')}</span>
                </button>
              )}

              {(activeUpload.state === 'paused' ||
                activeUpload.state === 'failed' ||
                activeUpload.state === 'canceled') && (
                <button
                  type="button"
                  onClick={onRetryActiveUpload}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/35 text-[11px] font-medium text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('upload.retryBtn')}</span>
                </button>
              )}

              {(activeUpload.state === 'ready' ||
                activeUpload.state === 'failed' ||
                activeUpload.state === 'canceled' ||
                activeUpload.state === 'paused') && (
                <button
                  type="button"
                  onClick={onDismissActiveUpload}
                  aria-label={t('upload.dismissBtn')}
                  className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {(activeUpload.state === 'uploading' ||
            activeUpload.state === 'processing' ||
            activeUpload.state === 'paused') && (
            <div className="mt-2.5 w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  activeUpload.state === 'processing'
                    ? 'bg-blue-400 animate-pulse w-full'
                    : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(2, activeUpload.progressPercent))}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Warning Banner when an Existing Project's Saved Model has been Disabled or Archived */}
      {(isCurrentModelDisabled || disabledModelAlert) && (
        <div className="mb-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-200">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              {disabledModelAlert ||
                (locale === 'ar'
                  ? `النموذج المرتبط بهذا المشروع (${selectedModelId}) معطّل حاليًا. جميع النتائج والمحادثات السابقة محفوظة؛ اختر نموذجًا مفعّلًا لأي معالجة جديدة.`
                  : `The model linked to this project (${selectedModelId}) is currently disabled. Previous results are preserved; please select an enabled model for any new processing.`)}
            </span>
          </div>
          {enabledModels.length >= 1 && (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {enabledModels.map((em) => (
                <button
                  key={em.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(em.id);
                    setDisabledModelAlert(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {locale === 'ar' ? `التبديل إلى ${em.name}` : `Switch to ${em.name}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Row Directly Above Chat Bar: Models (conditional drop-up vs static name) & Styles Drop-up Trigger */}
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {canOpenModelsMenu ? (
            /* Interactive Models Drop-up Button (>1 enabled model, or replacing disabled model) */
            <button
              type="button"
              onClick={() =>
                setOpenMenu((prev) => (prev === 'models' ? null : 'models'))
              }
              aria-expanded={openMenu === 'models'}
              className={`h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                isCurrentModelDisabled
                  ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                  : openMenu === 'models'
                    ? 'bg-[#1F222B] border-blue-500/50 text-white'
                    : 'bg-[#141519]/90 border-white/[0.08] text-zinc-300 hover:text-white hover:bg-[#1B1D23]'
              }`}
            >
              <span className="text-zinc-400">{t('chat.modelsButton')}:</span>
              <span className="text-white font-semibold">
                {activeModel?.name ?? selectedModelId}
              </span>
              {isCurrentModelDisabled && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {locale === 'ar' ? 'معطّل' : 'Disabled'}
                </span>
              )}
              <ChevronUp
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${
                  openMenu === 'models' ? 'rotate-180 text-blue-400' : ''
                }`}
              />
            </button>
          ) : (
            /* Single Enabled Model: Display Only Its Name Without Dropdown Menu */
            <div
              className="h-8 px-3 rounded-full bg-[#141519]/90 border border-white/[0.08] text-xs font-semibold text-white flex items-center whitespace-nowrap shrink-0 select-none"
              data-testid="single-enabled-model-badge"
            >
              <span>{enabledModels[0]?.name ?? activeModel?.name ?? 'Brain 1.8'}</span>
            </div>
          )}

          {/* Styles Drop-up Button */}
          <button
            type="button"
            onClick={() =>
              setOpenMenu((prev) => (prev === 'styles' ? null : 'styles'))
            }
            aria-expanded={openMenu === 'styles'}
            className={`h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              openMenu === 'styles'
                ? 'bg-[#1F222B] border-blue-500/50 text-white'
                : 'bg-[#141519]/90 border-white/[0.08] text-zinc-300 hover:text-white hover:bg-[#1B1D23]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-zinc-400">{t('chat.stylesButton')}:</span>
            <span className="text-white font-semibold">
              {activeStyle ? t(activeStyle.nameKey) : ''}
            </span>
            <ChevronUp
              className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${
                openMenu === 'styles' ? 'rotate-180 text-blue-400' : ''
              }`}
            />
          </button>
        </div>

        {/* Quick Elements Constraint Indicator */}
        <button
          type="button"
          onClick={onOpenElements}
          className="hidden sm:inline-flex h-8 px-3 rounded-full bg-[#141519]/90 hover:bg-[#1B1D23] border border-white/[0.08] text-xs text-zinc-400 hover:text-white items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums"
        >
          <SlidersHorizontal className="w-3 h-3 text-blue-400" />
          <span>
            {enabledElementsCount}/{totalElementsCount} {t('sidebar.elements')}
          </span>
        </button>
      </div>

      {/* Rounded Bottom Chat Bar (Matches UI.png & 1_101dd8d5.PNG) */}
      <form
        onSubmit={handleSubmit}
        className="w-full h-[60px] sm:h-[64px] rounded-full bg-[#15161A] border border-white/[0.09] px-2.5 flex items-center gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)] focus-within:border-white/[0.18] transition-colors"
      >
        {/* Left + Button (Accepts Video & Voiceover Audio) */}
        <button
          type="button"
          onClick={() =>
            setOpenMenu((prev) => (prev === 'attach' ? null : 'attach'))
          }
          aria-label={t('chat.attachAria')}
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            openMenu === 'attach'
              ? 'bg-blue-600 text-white'
              : 'bg-[#22242A] hover:bg-[#2B2E36] text-white'
          }`}
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Center Text Input (preserves user's typed direction and language) */}
        <input
          type="text"
          dir="auto"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={t('chat.placeholder')}
          className="flex-1 min-w-0 bg-transparent text-sm sm:text-[15px] text-white placeholder:text-zinc-500 focus:outline-none px-1"
        />

        {/* Right Blue Orbit Icon Button (Matches UI_9a98bec2.png) */}
        <button
          type="submit"
          aria-label={t('chat.sendAria')}
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <img
            src="/assets/aistudio/Blue_Orbit_Network_Icon_b24d9350.png"
            alt="Send"
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-contain select-none"
          />
        </button>
      </form>
    </div>
  );
}
