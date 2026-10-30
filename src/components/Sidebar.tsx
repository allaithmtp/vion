import React, { useState } from 'react';
import {
  Palette,
  PanelLeft,
  Settings,
  SlidersHorizontal,
  Trash2,
  Video,
  Mic,
  FileText,
  Archive,
  ArchiveRestore,
  ShieldCheck,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { Project, UserAccount } from '../types/domain';

interface SidebarProps {
  isOpenDesktop: boolean;
  isOpenMobile: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateNewProject: () => void;
  onToggleArchiveProject: (
    projectId: string,
    nextArchived: boolean,
    e: React.MouseEvent
  ) => void;
  onDeleteProject: (projectId: string, e: React.MouseEvent) => void;
  enabledElementsCount: number;
  totalElementsCount: number;
  onOpenElements: () => void;
  onOpenBrand: () => void;
  onOpenSettings: () => void;
  isAdmin: boolean;
  onOpenAdminPanel: () => void;
  isAuthenticated: boolean;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
  account: UserAccount;
}

export function Sidebar({
  isOpenDesktop,
  isOpenMobile,
  onToggleDesktop,
  onCloseMobile,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateNewProject,
  onToggleArchiveProject,
  onDeleteProject,
  enabledElementsCount,
  totalElementsCount,
  onOpenElements,
  onOpenBrand,
  onOpenSettings,
  isAdmin,
  onOpenAdminPanel,
  isAuthenticated,
  onSignInWithGoogle,
  onSignOut,
  account,
}: SidebarProps) {
  const { t } = useI18n();
  const [showArchived, setShowArchived] = useState(false);

  const visibleProjects = projects.filter((p) =>
    showArchived ? p.archived : !p.archived
  );

  const renderSidebarContent = (isMobileDrawer: boolean) => (
    <div className="flex flex-col h-full w-[268px] bg-[#0E0F12] border-e border-white/[0.06] text-white select-none shrink-0">
      {/* Top Row: Glossy V Icon + Collapse Button */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onCreateNewProject();
            if (isMobileDrawer) onCloseMobile();
          }}
          className="flex items-center gap-2.5 focus:outline-none group"
          title="VION"
        >
          <img
            src="/assets/aistudio/Glossy_V_Icon_with_Blue_Dot_73929391.png"
            alt="VION Icon"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-contain bg-white shrink-0"
          />
        </button>

        <button
          type="button"
          onClick={isMobileDrawer ? onCloseMobile : onToggleDesktop}
          aria-label={t('sidebar.toggleSidebar')}
          className="w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] flex items-center justify-center transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* + New Project Pill Button */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            onCreateNewProject();
            if (isMobileDrawer) onCloseMobile();
          }}
          className="w-full h-11 px-4 rounded-xl bg-[#18191E] hover:bg-[#202229] border border-white/[0.06] text-xs font-semibold text-white flex items-center justify-start transition-colors whitespace-nowrap"
        >
          {t('sidebar.newProject')}
        </button>
      </div>

      {/* Primary Config Navigation: Elements, Brand, Settings, and Server-Gated Admin Panel */}
      <nav className="px-3 space-y-1">
        <button
          type="button"
          onClick={() => {
            onOpenElements();
            if (isMobileDrawer) onCloseMobile();
          }}
          className="w-full h-10 px-3 rounded-xl hover:bg-white/[0.05] flex items-center justify-between text-xs font-medium text-zinc-200 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-3 whitespace-nowrap">
            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
            <span>{t('sidebar.elements')}</span>
          </span>
          <span className="text-[11px] text-zinc-500 tabular-nums">
            {enabledElementsCount}/{totalElementsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenBrand();
            if (isMobileDrawer) onCloseMobile();
          }}
          className="w-full h-10 px-3 rounded-xl hover:bg-white/[0.05] flex items-center justify-between text-xs font-medium text-zinc-200 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-3 whitespace-nowrap">
            <Palette className="w-4 h-4 text-zinc-400" />
            <span>{t('sidebar.brand')}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenSettings();
            if (isMobileDrawer) onCloseMobile();
          }}
          className="w-full h-10 px-3 rounded-xl hover:bg-white/[0.05] flex items-center justify-between text-xs font-medium text-zinc-200 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-3 whitespace-nowrap">
            <Settings className="w-4 h-4 text-zinc-400" />
            <span>{t('sidebar.settings')}</span>
          </span>
        </button>

        {/* Admin Panel Entry: Strictly rendered ONLY when server verifies isAdmin */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              onOpenAdminPanel();
              if (isMobileDrawer) onCloseMobile();
            }}
            className="w-full h-10 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/25 flex items-center justify-between text-xs font-semibold text-blue-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-3 whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>{t('sidebar.adminPanel')}</span>
            </span>
          </button>
        )}
      </nav>

      {/* Projects Section with Active / Archived Filter */}
      <div className="mt-5 px-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            {t('sidebar.projectsHeader')}
          </span>

          <div className="flex items-center gap-1 bg-[#15161B] p-0.5 rounded-lg border border-white/[0.05]">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                !showArchived
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('sidebar.activeFilter')}
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                showArchived
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('sidebar.archivedFilter')}
            </button>
          </div>
        </div>

        {visibleProjects.length === 0 ? (
          <div className="px-1 py-2 text-xs text-zinc-500">
            {showArchived
              ? t('sidebar.noArchivedProjects')
              : t('sidebar.noProjects')}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
            {visibleProjects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              const ModeIcon =
                proj.workflowMode === 'video-edit'
                  ? Video
                  : proj.workflowMode === 'voiceover-motion'
                    ? Mic
                    : FileText;

              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    onSelectProject(proj.id);
                    if (isMobileDrawer) onCloseMobile();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectProject(proj.id);
                      if (isMobileDrawer) onCloseMobile();
                    }
                  }}
                  className={`group w-full h-10 px-2.5 rounded-xl flex items-center justify-between gap-1.5 text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-600/15 text-white border border-blue-500/30 font-medium'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <ModeIcon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-blue-400' : 'text-zinc-500'
                      }`}
                    />
                    <span className="truncate" dir="auto">
                      {proj.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) =>
                        onToggleArchiveProject(proj.id, !proj.archived, e)
                      }
                      title={
                        proj.archived
                          ? t('sidebar.unarchiveProject')
                          : t('sidebar.archiveProject')
                      }
                      aria-label={
                        proj.archived
                          ? t('sidebar.unarchiveProject')
                          : t('sidebar.archiveProject')
                      }
                      className="p-1 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-white/[0.06]"
                    >
                      {proj.archived ? (
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => onDeleteProject(proj.id, e)}
                      title={t('sidebar.deleteProjectConfirm')}
                      aria-label={t('sidebar.deleteProjectConfirm')}
                      className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-white/[0.06]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Creator Account / Auth Footer */}
      <div className="p-3 border-t border-white/[0.06]">
        {isAuthenticated ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                if (isMobileDrawer) onCloseMobile();
              }}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] flex items-center gap-2.5 text-start transition-colors"
            >
              {account.photoURL ? (
                <img
                  src={account.photoURL}
                  alt={account.displayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                  style={{ backgroundColor: account.avatarColor }}
                >
                  {account.avatarInitial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">
                  {account.displayName}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {t(account.accountTierKey)}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              title={t('auth.signOut')}
              aria-label={t('auth.signOut')}
              className="w-8 h-8 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/[0.05] flex items-center justify-center shrink-0 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignInWithGoogle}
            className="w-full h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('auth.signInWithGoogle')}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isOpenDesktop && (
        <aside className="hidden lg:block h-full shrink-0">
          {renderSidebarContent(false)}
        </aside>
      )}

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
