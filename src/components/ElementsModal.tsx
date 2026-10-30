import React from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { ElementCapability, ElementCapabilityId } from '../types/domain';

interface ElementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: ElementCapability[];
  onToggleElement: (id: ElementCapabilityId) => void;
  onSetAllElements: (enabled: boolean) => void;
}

export function ElementsModal({
  isOpen,
  onClose,
  elements,
  onToggleElement,
  onSetAllElements,
}: ElementsModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  const enabledCount = elements.filter((el) => el.enabled).length;
  const totalCount = elements.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="elements-modal-title"
    >
      <div className="w-full max-w-[540px] max-h-[86dvh] bg-[#141519] border border-white/[0.08] rounded-[24px] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="elements-modal-title"
              className="text-lg font-semibold text-white tracking-tight"
            >
              {t('elements.title')}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">{t('elements.subtitle')}</p>
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

        {/* Summary & Enable/Disable All Bar */}
        <div className="px-6 py-2.5 border-y border-white/[0.06] flex items-center justify-between text-xs">
          <span className="text-zinc-400 tabular-nums">
            {enabledCount} / {totalCount} {t('app.enabled')}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSetAllElements(true)}
              className="text-white underline underline-offset-4 hover:text-blue-400 transition-colors font-medium whitespace-nowrap"
            >
              {t('elements.enableAll')}
            </button>
            <span className="text-zinc-600" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={() => onSetAllElements(false)}
              className="text-zinc-400 hover:text-white transition-colors whitespace-nowrap"
            >
              {t('elements.disableAll')}
            </button>
          </div>
        </div>

        {/* Scrollable 18 Capabilities List */}
        <div className="flex-1 overflow-y-auto px-6 divide-y divide-white/[0.06]">
          {elements.map((item) => (
            <div
              key={item.id}
              className="py-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">
                  {t(item.titleKey)}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  {t(item.descriptionKey)}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={item.enabled}
                aria-label={t(item.titleKey)}
                onClick={() => onToggleElement(item.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  item.enabled ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-150 ease-in-out ${
                    item.enabled
                      ? 'ltr:translate-x-5 rtl:-translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-[#141519] flex items-center justify-between gap-4">
          <p className="text-[11px] text-zinc-500 leading-snug max-w-[340px]">
            {t('elements.footerNote')}
          </p>
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
