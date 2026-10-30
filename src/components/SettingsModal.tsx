import React, { useEffect, useState } from 'react';
import {
  X,
  Globe,
  ShieldAlert,
  CheckCircle2,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type {
  SystemCapabilitiesStatus,
  UserAccount,
  VerifiedSessionInfo,
} from '../types/domain';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount;
  onUpdateAccountName: (name: string) => void;
  capabilities: SystemCapabilitiesStatus;
  isAuthenticated: boolean;
  verifiedSession: VerifiedSessionInfo | null;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  account,
  onUpdateAccountName,
  capabilities,
  isAuthenticated,
  verifiedSession,
  onSignInWithGoogle,
  onSignOut,
}: SettingsModalProps) {
  const { locale, setLocale, t } = useI18n();
  const [nameInput, setNameInput] = useState(account.displayName);

  useEffect(() => {
    setNameInput(account.displayName);
  }, [account.displayName]);

  if (!isOpen) return null;

  const handleSaveName = () => {
    onUpdateAccountName(nameInput);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-[540px] max-h-[86dvh] bg-[#141519] border border-white/[0.08] rounded-[24px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-white/[0.06]">
          <div>
            <h2
              id="settings-modal-title"
              className="text-lg font-semibold text-white tracking-tight"
            >
              {t('settings.title')}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {t('settings.subtitle')}
            </p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* 1. Interface Language & RTL */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>{t('settings.languageLabel')}</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {t('settings.languageDesc')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 p-1 bg-[#0E0F12] border border-white/[0.06] rounded-xl">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[40px] ${
                  locale === 'en'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('settings.langEn')}
              </button>
              <button
                type="button"
                onClick={() => setLocale('ar')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors min-h-[40px] ${
                  locale === 'ar'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('settings.langAr')}
              </button>
            </div>
          </div>

          {/* 2. Authenticated Google Profile */}
          <div className="pt-4 border-t border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">
              {t('settings.accountSection')}
            </h3>

            {isAuthenticated ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0E0F12] border border-white/[0.06]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white font-mono truncate">
                      {account.email}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                      UID: {verifiedSession?.uid ?? account.id}
                    </div>
                  </div>
                  {verifiedSession?.isAdmin && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t(account.accountTierKey)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                    }}
                    aria-label={t('settings.accountNameLabel')}
                    className="flex-1 bg-[#0E0F12] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white transition-colors shrink-0 min-h-[36px]"
                  >
                    {t('app.save')}
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-xs font-medium text-red-300 flex items-center gap-1.5 transition-colors shrink-0 min-h-[36px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('auth.signOut')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onSignInWithGoogle}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t('auth.signInWithGoogle')}</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Phase 3 Service Layer Status */}
          <div className="pt-4 border-t border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">
              {t('settings.servicesSection')}
            </h3>
            <div className="mt-3 divide-y divide-white/[0.06] bg-[#0E0F12] border border-white/[0.06] rounded-xl px-4">
              <div className="py-3 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-300">{t('settings.service.ui')}</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('settings.service.uiStatus')}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-300">
                  {t('settings.service.privateStorage')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('settings.service.privateStorageStatus')}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-300">
                  {t('settings.service.ffmpegWorker')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {capabilities.ffmpegWorkerConnected
                    ? t('settings.service.ffmpegWorkerStatus')
                    : t('app.disabledInPhase1')}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-300">
                  {t('settings.service.brain')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-400/90 font-medium whitespace-nowrap">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {capabilities.aiConnected
                    ? t('settings.service.uiStatus')
                    : t('settings.service.brainStatus')}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-300">
                  {t('settings.service.remotion')}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
                    capabilities.remotionConnected
                      ? 'text-emerald-400'
                      : 'text-amber-400/90'
                  }`}
                >
                  {capabilities.remotionConnected ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  {capabilities.remotionConnected
                    ? t('settings.service.remotionStatus')
                    : t('app.disabledInPhase1')}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-300">
                  {t('settings.service.storage')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-400/90 font-medium whitespace-nowrap">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {capabilities.paymentsConnected
                    ? t('settings.service.uiStatus')
                    : t('settings.service.storageStatus')}
                </span>
              </div>
            </div>
          </div>
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
