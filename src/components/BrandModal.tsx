import React, { useRef, useState } from 'react';
import { Upload, X, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { BrandIdentity } from '../types/domain';

interface BrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: BrandIdentity;
  onUpdateBrand: (next: BrandIdentity) => void;
}

type EditableBrandKey =
  | 'logo'
  | 'secondaryLogo'
  | 'watermark'
  | 'colors'
  | 'fonts'
  | 'intro'
  | 'outro'
  | 'lowerThird';

export function BrandModal({
  isOpen,
  onClose,
  brand,
  onUpdateBrand,
}: BrandModalProps) {
  const { t } = useI18n();
  const [editingKey, setEditingKey] = useState<EditableBrandKey | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [uploadTarget, setUploadTarget] = useState<
    'logo' | 'secondaryLogo' | 'watermark' | 'intro' | 'outro' | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const triggerUpload = (
    target: 'logo' | 'secondaryLogo' | 'watermark' | 'intro' | 'outro'
  ) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    const updated: BrandIdentity = {
      ...brand,
      [uploadTarget]: {
        ...brand[uploadTarget],
        customFileName: file.name,
        updatedAt: new Date().toISOString(),
      },
    };
    onUpdateBrand(updated);
    e.target.value = '';
    setUploadTarget(null);
  };

  const startEditing = (key: EditableBrandKey, currentSummary: string) => {
    setEditingKey(key);
    setDraftValue(currentSummary);
  };

  const saveEdit = (key: EditableBrandKey) => {
    const trimmed = draftValue.trim();
    if (!trimmed) {
      setEditingKey(null);
      return;
    }

    const next = { ...brand };
    if (key === 'colors') {
      const parts = trimmed.split('·').map((s) => s.trim());
      next.colors = {
        primaryText: parts[0] || next.colors.primaryText,
        accentBlue: parts[1] || next.colors.accentBlue,
        canvasDark: parts[2] || next.colors.canvasDark,
      };
    } else if (key === 'fonts') {
      const parts = trimmed.split('·').map((s) => s.trim());
      next.fonts = {
        headingFont: parts[0] || next.fonts.headingFont,
        headingWeight: parts[1] || next.fonts.headingWeight,
        captionWeight: parts[2] || next.fonts.captionWeight,
      };
    } else if (key === 'lowerThird') {
      next.lowerThird = {
        ...next.lowerThird,
        styleSummaryKey: trimmed,
      };
    } else {
      next[key] = {
        ...next[key],
        customFileName: trimmed,
      };
    }

    onUpdateBrand(next);
    setEditingKey(null);
  };

  const colorsSummary = `${brand.colors.primaryText} · ${brand.colors.accentBlue} · ${brand.colors.canvasDark}`;
  const fontsSummary = `${brand.fonts.headingFont} · ${brand.fonts.headingWeight} · ${brand.fonts.captionWeight}`;

  const rows: {
    key: EditableBrandKey;
    label: string;
    summary: string;
    uploadTarget?: 'logo' | 'secondaryLogo' | 'watermark' | 'intro' | 'outro';
  }[] = [
    {
      key: 'logo',
      label: t('brand.logo.label'),
      summary: brand.logo.customFileName || t('brand.logo.summary'),
      uploadTarget: 'logo',
    },
    {
      key: 'secondaryLogo',
      label: t('brand.secondaryLogo.label'),
      summary:
        brand.secondaryLogo.customFileName || t('brand.secondaryLogo.summary'),
      uploadTarget: 'secondaryLogo',
    },
    {
      key: 'watermark',
      label: t('brand.watermark.label'),
      summary: brand.watermark.customFileName || t('brand.watermark.summary'),
      uploadTarget: 'watermark',
    },
    {
      key: 'colors',
      label: t('brand.colors.label'),
      summary: colorsSummary,
    },
    {
      key: 'fonts',
      label: t('brand.fonts.label'),
      summary: fontsSummary,
    },
    {
      key: 'intro',
      label: t('brand.intro.label'),
      summary: brand.intro.customFileName || t('brand.intro.summary'),
      uploadTarget: 'intro',
    },
    {
      key: 'outro',
      label: t('brand.outro.label'),
      summary: brand.outro.customFileName || t('brand.outro.summary'),
      uploadTarget: 'outro',
    },
    {
      key: 'lowerThird',
      label: t('brand.lowerThird.label'),
      summary:
        brand.lowerThird.styleSummaryKey === 'brand.lowerThird.summary'
          ? t('brand.lowerThird.summary')
          : brand.lowerThird.styleSummaryKey,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-modal-title"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="w-full max-w-[540px] max-h-[86dvh] bg-[#141519] border border-white/[0.08] rounded-[24px] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="brand-modal-title"
              className="text-lg font-semibold text-white tracking-tight"
            >
              {t('brand.title')}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">{t('brand.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('app.close')}
            className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Brand Rows */}
        <div className="flex-1 overflow-y-auto px-6 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {rows.map((row) => {
            const isEditing = editingKey === row.key;
            return (
              <div
                key={row.key}
                className="py-3.5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">
                    {row.label}
                  </div>
                  {isEditing ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(row.key);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                        autoFocus
                        className="w-full bg-[#1C1E24] border border-blue-500/50 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(row.key)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t('app.save')}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-400 mt-0.5 truncate">
                      {row.summary}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {row.uploadTarget && (
                    <button
                      type="button"
                      onClick={() => triggerUpload(row.uploadTarget!)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06] text-xs font-medium text-white flex items-center gap-1.5 transition-colors whitespace-nowrap min-h-[32px]"
                    >
                      <Upload className="w-3.5 h-3.5 text-zinc-300" />
                      {t('app.upload')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      isEditing
                        ? setEditingKey(null)
                        : startEditing(row.key, row.summary)
                    }
                    className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06] text-xs font-medium text-white transition-colors whitespace-nowrap min-h-[32px]"
                  >
                    {isEditing ? t('app.cancel') : t('app.edit')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-[#141519] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
          >
            {t('app.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
