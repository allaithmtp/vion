import React, { useEffect, useState } from 'react';
import { Menu, Pencil, Check, Globe } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { Project } from '../types/domain';

interface TopBarProps {
  onToggleSidebarDesktop: () => void;
  onOpenSidebarMobile: () => void;
  onCreateNewProject: () => void;
  activeProject: Project | null;
  onRenameProject: (projectId: string, newName: string) => void;
}

export function TopBar({
  onToggleSidebarDesktop,
  onOpenSidebarMobile,
  onCreateNewProject,
  activeProject,
  onRenameProject,
}: TopBarProps) {
  const { locale, toggleLocale, t } = useI18n();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    setIsEditingName(false);
    setDraftName(activeProject?.name ?? '');
  }, [activeProject?.id, activeProject?.name]);

  const handleSaveName = () => {
    if (!activeProject) return;
    const trimmed = draftName.trim() || t('project.untitled');
    onRenameProject(activeProject.id, trimmed);
    setIsEditingName(false);
  };

  return (
    <header
      dir="ltr"
      className="w-full px-4 sm:px-6 pt-safe py-3 flex items-center justify-between gap-3 bg-[#0B0C0E] shrink-0 z-20"
    >
      {/* Top-Left Zone: Menu Button + New Project Pill Button (Matches UI.png & 1_101dd8d5.PNG) */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Mobile Menu Trigger */}
        <button
          type="button"
          onClick={onOpenSidebarMobile}
          aria-label={t('sidebar.toggleSidebar')}
          className="lg:hidden w-11 h-11 rounded-full bg-[#15161A] hover:bg-[#1D1F26] border border-white/[0.08] flex items-center justify-center text-white transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Toggle */}
        <button
          type="button"
          onClick={onToggleSidebarDesktop}
          aria-label={t('sidebar.toggleSidebar')}
          className="hidden lg:flex w-10 h-10 rounded-full bg-[#15161A] hover:bg-[#1D1F26] border border-white/[0.08] items-center justify-center text-white transition-colors shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* New Project Pill Button */}
        <button
          type="button"
          onClick={onCreateNewProject}
          className="h-11 lg:h-10 px-4 sm:px-5 rounded-full bg-[#15161A] hover:bg-[#1D1F26] border border-white/[0.08] text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
        >
          {t('app.newProject')}
        </button>
      </div>

      {/* Center Zone: Visible Active Project Name when a project is open */}
      <div className="min-w-0 flex-1 flex items-center justify-center px-2">
        {activeProject && (
          <div className="max-w-full flex items-center gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 bg-[#15161A] border border-blue-500/60 rounded-full px-3 py-1">
                <input
                  type="text"
                  dir="auto"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  onBlur={handleSaveName}
                  autoFocus
                  className="bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none w-32 sm:w-52"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="text-blue-400 hover:text-blue-300 p-0.5"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraftName(activeProject.name);
                  setIsEditingName(true);
                }}
                title={t('project.renameTooltip')}
                className="group max-w-[180px] sm:max-w-[320px] px-3.5 py-1.5 rounded-full bg-[#14151A] hover:bg-[#1B1D24] border border-white/[0.07] flex items-center gap-2 transition-colors"
              >
                <span
                  dir="auto"
                  className="text-xs sm:text-sm font-semibold text-white truncate"
                >
                  {activeProject.name}
                </span>
                <Pencil className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 shrink-0 transition-colors" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top-Right Zone: Instant Language Switcher + Official VION Wordmark Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={toggleLocale}
          aria-label={t('settings.languageLabel')}
          className="h-9 px-3 rounded-full bg-[#15161A] hover:bg-[#1D1F26] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>{locale === 'en' ? 'العربية' : 'EN'}</span>
        </button>

        <img
          src="/assets/aistudio/VION_Logo_with_Blue_Dot__2__836e8d4c.png"
          alt="VION"
          referrerPolicy="no-referrer"
          className="h-5 sm:h-6 w-auto object-contain select-none shrink-0"
        />
      </div>
    </header>
  );
}
