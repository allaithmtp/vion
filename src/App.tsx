/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { onAuthStateChanged, type User } from 'firebase/auth';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { BrandModal } from './components/BrandModal';
import { ChatComposer } from './components/ChatComposer';
import { ElementsModal } from './components/ElementsModal';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { auth } from './firebase';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { accountService } from './services/accountService';
import { brainService } from './services/brainService';
import { processingService } from './services/processingService';
import { storageService } from './services/storageService';
import type {
  ActiveResumableUploadItem,
  AssetKind,
  BrainModelDTO,
  BrainModelId,
  BrandIdentity,
  ChatMessage,
  ElementCapability,
  ElementCapabilityId,
  MediaAsset,
  Project,
  StylePresetId,
  SystemCapabilitiesStatus,
  UserAccount,
  VerifiedSessionInfo,
  VideoStylePreset,
} from './types/domain';

function VionEditorApp() {
  const { locale, t } = useI18n();

  // Sidebar, Modals & Admin View State
  const [isSidebarOpenDesktop, setIsSidebarOpenDesktop] = useState(true);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [activeModal, setActiveModal] = useState<
    'elements' | 'brand' | 'settings' | null
  >(null);
  const [isAdminViewOpen, setIsAdminViewOpen] = useState(false);

  // Firebase Auth & Server-Verified Session State
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [verifiedSession, setVerifiedSession] =
    useState<VerifiedSessionInfo | null>(null);
  const [account, setAccount] = useState<UserAccount>(() =>
    accountService.getDefaultAccount()
  );

  // Brand & Elements State
  const [brand, setBrand] = useState<BrandIdentity>(() =>
    accountService.getBrandIdentity()
  );
  const [elements, setElements] = useState<ElementCapability[]>(() =>
    accountService.getElements()
  );

  // Server-Governed Brain Models & Styles Catalog
  const [models, setModels] = useState<BrainModelDTO[]>([]);
  const [styles, setStyles] = useState<VideoStylePreset[]>([]);
  const [capabilities, setCapabilities] = useState<SystemCapabilitiesStatus>({
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
  });

  // Default Model & Style when on Home / Empty Screen
  const [draftModelId, setDraftModelId] = useState<BrainModelId>('brain-1.8');
  const [draftStyleId, setDraftStyleId] =
    useState<StylePresetId>('clean-cut-studio');

  // Firestore Projects, Active Project Messages & Private Assets
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [activeAssets, setActiveAssets] = useState<MediaAsset[]>([]);

  // Active Resumable Upload State & AbortController
  const [activeUpload, setActiveUpload] =
    useState<ActiveResumableUploadItem | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // 1. Fetch Brain Catalog & Media Limits from Server
  const refreshCatalog = useCallback(async () => {
    const catalog = await brainService.fetchCatalog();
    setModels(catalog.models);
    setStyles(catalog.styles);
    setCapabilities(catalog.capabilities);
    const serverDefaultId =
      catalog.defaultModelId ??
      catalog.models.find((m) => m.isDefault && m.enabled)?.id ??
      catalog.models.find((m) => m.enabled)?.id ??
      'brain-1.8';
    setDraftModelId((prev) => {
      const stillEnabled = catalog.models.some(
        (m) => m.id === prev && m.enabled && !m.archived
      );
      return stillEnabled ? prev : serverDefaultId;
    });
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // 2. Refresh Server-Verified Session Helper
  const refreshVerifiedSession = useCallback(
    async (user: User | null) => {
      if (!user) {
        setVerifiedSession(null);
        setAccount(accountService.getDefaultAccount());
        setIsAdminViewOpen(false);
        return;
      }
      try {
        const synced = await accountService.syncAuthenticatedUserAndSession(
          user,
          locale
        );
        setAccount(synced.account);
        setVerifiedSession(synced.session);
        if (!synced.session.isAdmin) {
          setIsAdminViewOpen(false);
        }
      } catch (err) {
        console.error('Session verification error:', err);
      }
    },
    [locale]
  );

  // 3. Restore Session via Firebase Auth onAuthStateChanged
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshVerifiedSession(user);
      } else {
        setVerifiedSession(null);
        setAccount(accountService.getDefaultAccount());
        setProjects([]);
        setActiveProjectId(null);
        setActiveMessages([]);
        setActiveAssets([]);
        setActiveUpload(null);
        setIsAdminViewOpen(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [refreshVerifiedSession]);

  // 4. Subscribe to Authenticated User's Projects in Firestore
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setProjects([]);
      return;
    }
    const unsub = storageService.subscribeUserProjects(
      firebaseUser.uid,
      (userProjects) => {
        setProjects(userProjects);
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

  // 5. Subscribe to Active Project's Messages & Private Assets in Firestore
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeProjectId) {
      setActiveMessages([]);
      setActiveAssets([]);
      return;
    }

    const unsubMsgs = storageService.subscribeProjectMessages(
      activeProjectId,
      firebaseUser.uid,
      (msgs) => setActiveMessages(msgs)
    );
    const unsubAssets = storageService.subscribeProjectAssets(
      activeProjectId,
      firebaseUser.uid,
      (assets) => setActiveAssets(assets)
    );

    return () => {
      unsubMsgs();
      unsubAssets();
    };
  }, [authReady, firebaseUser, activeProjectId]);

  // 6. Automatic Renewal Policy for Temporary Signed Asset URLs
  const handleRenewSignedUrls = useCallback(async () => {
    if (!activeProjectId || activeAssets.length === 0) return;
    const ids = activeAssets.map((a) => a.id);
    const renewedMap = await storageService.renewProjectAssetSignedUrls(
      activeProjectId,
      ids
    );
    if (Object.keys(renewedMap).length === 0) return;

    setActiveAssets((prev) =>
      prev.map((asset) => {
        const fresh = renewedMap[asset.id];
        if (!fresh) return asset;
        return {
          ...asset,
          localObjectUrl: fresh.previewSignedUrl ?? fresh.originalSignedUrl,
          derivedFiles: fresh,
        };
      })
    );
  }, [activeProjectId, activeAssets]);

  useEffect(() => {
    if (!activeProjectId || activeAssets.length === 0) return;
    // Renew signed URLs every 10 minutes (before 15-minute TTL expires)
    const timer = window.setInterval(
      () => {
        handleRenewSignedUrls();
      },
      1000 * 60 * 10
    );
    return () => window.clearInterval(timer);
  }, [activeProjectId, activeAssets.length, handleRenewSignedUrls]);

  const baseActiveProject =
    projects.find((p) => p.id === activeProjectId) ?? null;

  const activeProject: Project | null = baseActiveProject
    ? {
        ...baseActiveProject,
        messages: activeMessages,
        assets: activeAssets,
      }
    : null;

  // Auth Actions
  const handleSignInWithGoogle = async () => {
    try {
      await accountService.signInWithGoogle();
    } catch (err) {
      console.error('Google Sign-In error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await accountService.signOut();
      setIsAdminViewOpen(false);
    } catch (err) {
      console.error('Sign-Out error:', err);
    }
  };

  // Project CRUD Operations (All Server-Verified + Firestore Persisted)
  const getDefaultEnabledModelId = () =>
    models.find((m) => m.isDefault && m.enabled && !m.archived)?.id ??
    models.find((m) => m.enabled && !m.archived)?.id ??
    draftModelId;

  const handleCreateNewProject = async () => {
    if (!firebaseUser) {
      await handleSignInWithGoogle();
      return;
    }
    const defaultModelForNew = getDefaultEnabledModelId();
    setDraftModelId(defaultModelForNew);
    const index = projects.length + 1;
    const created = await storageService.createProject({
      ownerUid: firebaseUser.uid,
      name: `${t('project.untitled')} ${index}`,
      selectedModelId: defaultModelForNew,
      selectedStyleId: draftStyleId,
    });
    setActiveProjectId(created.id);
    setIsAdminViewOpen(false);
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    if (!firebaseUser) return;
    await storageService.updateProjectFields(projectId, firebaseUser.uid, {
      name: newName,
    });
  };

  const handleToggleArchiveProject = async (
    projectId: string,
    nextArchived: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!firebaseUser) return;
    await storageService.updateProjectFields(projectId, firebaseUser.uid, {
      archived: nextArchived,
    });
  };

  const handleDeleteProject = async (
    projectId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!firebaseUser) return;
    if (activeUpload && activeUpload.projectId === projectId) {
      uploadAbortRef.current?.abort();
      setActiveUpload(null);
    }
    await storageService.deleteProject(projectId, firebaseUser.uid);
    if (activeProjectId === projectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      setActiveProjectId(remaining[0]?.id ?? null);
    }
  };

  const handleSelectModel = async (modelId: BrainModelId) => {
    setDraftModelId(modelId);
    if (!activeProject || !firebaseUser) return;
    await storageService.updateProjectFields(
      activeProject.id,
      firebaseUser.uid,
      { selectedModelId: modelId }
    );
  };

  const handleSelectStyle = async (styleId: StylePresetId) => {
    setDraftStyleId(styleId);
    if (!activeProject || !firebaseUser) return;
    await storageService.updateProjectFields(
      activeProject.id,
      firebaseUser.uid,
      { selectedStyleId: styleId }
    );
  };

  // Conversation Message Persistence
  const handleSendMessage = async (text: string) => {
    if (!firebaseUser) {
      await handleSignInWithGoogle();
      return;
    }

    let targetProject = activeProject;
    if (!targetProject) {
      const autoName = text.length > 28 ? `${text.slice(0, 28)}...` : text;
      targetProject = await storageService.createProject({
        ownerUid: firebaseUser.uid,
        name: autoName,
        selectedModelId: draftModelId,
        selectedStyleId: draftStyleId,
      });
      setActiveProjectId(targetProject.id);
    }

    await storageService.addMessageToProject({
      projectId: targetProject.id,
      ownerUid: firebaseUser.uid,
      role: 'user',
      content: text,
      selectedModelId: targetProject.selectedModelId,
      selectedStyleId: targetProject.selectedStyleId,
    });

    await storageService.addMessageToProject({
      projectId: targetProject.id,
      ownerUid: firebaseUser.uid,
      role: 'brain-system',
      content: '',
      systemNoticeKey: 'chat.phase1SystemReply',
      selectedModelId: targetProject.selectedModelId,
      selectedStyleId: targetProject.selectedStyleId,
    });
  };

  // Direct Resumable Media Upload Runner (Uploads Directly Without Passing File Through Chat or Starting Fake Editing)
  const runResumableUpload = async (params: {
    projectId: string;
    file: File;
    kind: AssetKind;
    durationSeconds?: number;
    existingUploadId?: string;
  }) => {
    if (!firebaseUser) return;

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    setActiveUpload({
      uploadId: params.existingUploadId ?? '',
      assetId: '',
      projectId: params.projectId,
      file: params.file,
      fileName: params.file.name,
      kind: params.kind,
      totalBytes: params.file.size,
      uploadedBytes: 0,
      progressPercent: 0,
      state: 'uploading',
      durationSeconds: params.durationSeconds,
    });

    try {
      const verifiedAsset = await storageService.executeResumableMediaUpload({
        projectId: params.projectId,
        ownerUid: firebaseUser.uid,
        file: params.file,
        kind: params.kind,
        existingUploadId: params.existingUploadId,
        abortSignal: controller.signal,
        onProgress: (upd) => {
          setActiveUpload((prev) =>
            prev
              ? {
                  ...prev,
                  uploadId: upd.uploadId,
                  assetId: upd.assetId,
                  uploadedBytes: upd.uploadedBytes,
                  totalBytes: upd.totalBytes,
                  progressPercent: upd.progressPercent,
                  state: upd.state,
                  processingStageLabel: upd.processingStageLabel,
                }
              : null
          );
        },
      });

      setActiveUpload((prev) =>
        prev
          ? {
              ...prev,
              state: 'ready',
              progressPercent: 100,
              durationSeconds:
                verifiedAsset.metadata.durationSeconds ?? prev.durationSeconds,
              warnings: verifiedAsset.warnings,
            }
          : null
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Media upload or verification failed.';
      setActiveUpload((prev) =>
        prev
          ? {
              ...prev,
              state: 'failed',
              errorMessage: message,
            }
          : null
      );
    }
  };

  const handleAttachLocalMedia = async (file: File, kind: AssetKind) => {
    if (!firebaseUser) {
      await handleSignInWithGoogle();
      return;
    }

    const inspected = await processingService.inspectFileMetadata(file, kind);
    const resolvedKind = inspected.kind;

    let targetProject = activeProject;
    const nextWorkflowMode =
      resolvedKind === 'voiceover-audio' ? 'voiceover-motion' : 'video-edit';
    const nextStyleId: StylePresetId =
      resolvedKind === 'voiceover-audio' ? 'kinetic-explainer' : draftStyleId;

    if (!targetProject) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '');
      targetProject = await storageService.createProject({
        ownerUid: firebaseUser.uid,
        name: cleanFileName || t('project.untitled'),
        workflowMode: nextWorkflowMode,
        selectedModelId: draftModelId,
        selectedStyleId: nextStyleId,
      });
      setActiveProjectId(targetProject.id);
    } else {
      await storageService.updateProjectFields(
        targetProject.id,
        firebaseUser.uid,
        {
          workflowMode: nextWorkflowMode,
          selectedStyleId: nextStyleId,
        }
      );
    }

    await runResumableUpload({
      projectId: targetProject.id,
      file,
      kind: resolvedKind,
      durationSeconds: inspected.metadata.durationSeconds,
    });
  };

  const handleCancelActiveUpload = async () => {
    if (!activeUpload) return;
    const uploadIdToCancel = activeUpload.uploadId;
    uploadAbortRef.current?.abort();
    setActiveUpload((prev) =>
      prev ? { ...prev, state: 'canceled', progressPercent: 0 } : null
    );
    if (uploadIdToCancel) {
      await storageService.cancelResumableUploadOnServer(uploadIdToCancel);
    }
  };

  const handleRetryActiveUpload = async () => {
    if (!activeUpload) return;
    await runResumableUpload({
      projectId: activeUpload.projectId,
      file: activeUpload.file,
      kind: activeUpload.kind,
      durationSeconds: activeUpload.durationSeconds,
      existingUploadId:
        activeUpload.state === 'canceled' ? undefined : activeUpload.uploadId,
    });
  };

  const handleDismissActiveUpload = () => {
    setActiveUpload(null);
  };

  // Elements & Brand Toggles
  const handleToggleElement = (id: ElementCapabilityId) => {
    const next = elements.map((el) =>
      el.id === id ? { ...el, enabled: !el.enabled } : el
    );
    setElements(next);
    accountService.saveElements(next);
  };

  const handleSetAllElements = (enabled: boolean) => {
    const next = elements.map((el) => ({ ...el, enabled }));
    setElements(next);
    accountService.saveElements(next);
  };

  const handleUpdateBrand = (nextBrand: BrandIdentity) => {
    setBrand(nextBrand);
    accountService.saveBrandIdentity(nextBrand);
  };

  const handleUpdateAccountName = async (name: string) => {
    const updated = await accountService.updateAccountName(account, name);
    setAccount(updated);
  };

  const enabledElementsCount = elements.filter((el) => el.enabled).length;
  const isAdminAuthorized = Boolean(verifiedSession?.isAdmin);

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden bg-[#0B0C0E] text-white">
      {/* Left / Start Sidebar */}
      <Sidebar
        isOpenDesktop={isSidebarOpenDesktop}
        isOpenMobile={isSidebarOpenMobile}
        onToggleDesktop={() => setIsSidebarOpenDesktop((prev) => !prev)}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          setIsAdminViewOpen(false);
        }}
        onCreateNewProject={handleCreateNewProject}
        onToggleArchiveProject={handleToggleArchiveProject}
        onDeleteProject={handleDeleteProject}
        enabledElementsCount={enabledElementsCount}
        totalElementsCount={elements.length}
        onOpenElements={() => setActiveModal('elements')}
        onOpenBrand={() => setActiveModal('brand')}
        onOpenSettings={() => setActiveModal('settings')}
        isAdmin={isAdminAuthorized}
        onOpenAdminPanel={() => {
          if (isAdminAuthorized) {
            setIsAdminViewOpen(true);
          }
        }}
        isAuthenticated={Boolean(firebaseUser)}
        onSignInWithGoogle={handleSignInWithGoogle}
        onSignOut={handleSignOut}
        account={account}
      />

      {/* Main Viewport Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <TopBar
          onToggleSidebarDesktop={() =>
            setIsSidebarOpenDesktop((prev) => !prev)
          }
          onOpenSidebarMobile={() => setIsSidebarOpenMobile(true)}
          onCreateNewProject={handleCreateNewProject}
          activeProject={isAdminViewOpen ? null : activeProject}
          onRenameProject={handleRenameProject}
        />

        {!authReady ? (
          <div className="flex-1 flex items-center justify-center p-6 text-xs text-zinc-400">
            {t('auth.restoringSession')}
          </div>
        ) : isAdminViewOpen && verifiedSession?.isAdmin ? (
          /* Server-Verified Admin Panel */
          <AdminPanel
            session={verifiedSession}
            onCloseAdmin={() => {
              setIsAdminViewOpen(false);
              refreshCatalog();
            }}
            onSessionRefreshNeeded={() => refreshVerifiedSession(firebaseUser)}
            onCatalogRefreshNeeded={refreshCatalog}
          />
        ) : !firebaseUser ? (
          /* Unauthenticated Prompt Banner + Main Workspace Preview */
          <>
            <div className="mx-4 sm:mx-6 mt-2 p-3.5 rounded-2xl bg-[#13151C] border border-blue-500/25 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">
                    {t('auth.requiredTitle')}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {t('auth.requiredDesc')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignInWithGoogle}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t('auth.signInWithGoogle')}</span>
              </button>
            </div>

            <ProjectWorkspace
              project={null}
              models={models}
              styles={styles}
              elements={elements}
              onQuickAttachMedia={handleAttachLocalMedia}
            />

            <ChatComposer
              models={models}
              styles={styles}
              selectedModelId={draftModelId}
              selectedStyleId={draftStyleId}
              onSelectModel={handleSelectModel}
              onSelectStyle={handleSelectStyle}
              onSendMessage={handleSendMessage}
              onSelectLocalMedia={handleAttachLocalMedia}
              activeUpload={activeUpload}
              onCancelActiveUpload={handleCancelActiveUpload}
              onRetryActiveUpload={handleRetryActiveUpload}
              onDismissActiveUpload={handleDismissActiveUpload}
              enabledElementsCount={enabledElementsCount}
              totalElementsCount={elements.length}
              onOpenElements={() => setActiveModal('elements')}
            />
          </>
        ) : (
          /* Authenticated Editor Workspace */
          <>
            <ProjectWorkspace
              project={activeProject}
              models={models}
              styles={styles}
              elements={elements}
              onQuickAttachMedia={handleAttachLocalMedia}
              onRenewSignedUrls={handleRenewSignedUrls}
            />

            <ChatComposer
              models={models}
              styles={styles}
              selectedModelId={activeProject?.selectedModelId ?? draftModelId}
              selectedStyleId={activeProject?.selectedStyleId ?? draftStyleId}
              onSelectModel={handleSelectModel}
              onSelectStyle={handleSelectStyle}
              onSendMessage={handleSendMessage}
              onSelectLocalMedia={handleAttachLocalMedia}
              activeUpload={activeUpload}
              onCancelActiveUpload={handleCancelActiveUpload}
              onRetryActiveUpload={handleRetryActiveUpload}
              onDismissActiveUpload={handleDismissActiveUpload}
              enabledElementsCount={enabledElementsCount}
              totalElementsCount={elements.length}
              onOpenElements={() => setActiveModal('elements')}
              hasActiveProject={Boolean(activeProject)}
            />
          </>
        )}
      </div>

      {/* Modals */}
      <ElementsModal
        isOpen={activeModal === 'elements'}
        onClose={() => setActiveModal(null)}
        elements={elements}
        onToggleElement={handleToggleElement}
        onSetAllElements={handleSetAllElements}
      />

      <BrandModal
        isOpen={activeModal === 'brand'}
        onClose={() => setActiveModal(null)}
        brand={brand}
        onUpdateBrand={handleUpdateBrand}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        account={account}
        onUpdateAccountName={handleUpdateAccountName}
        capabilities={capabilities}
        isAuthenticated={Boolean(firebaseUser)}
        verifiedSession={verifiedSession}
        onSignInWithGoogle={handleSignInWithGoogle}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <VionEditorApp />
    </I18nProvider>
  );
}
