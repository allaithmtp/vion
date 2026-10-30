import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  UserPlus,
  Trash2,
  Clock,
  Cpu,
  Scale,
  Wrench,
  Sparkles,
  BookOpen,
  Activity,
  BarChart3,
  KeyRound,
  AlertCircle,
  Plus,
  Copy,
  CheckCircle2,
  RotateCcw,
  Archive,
  Star,
  Power,
  Save,
  Send,
  History,
  Sliders,
  Video,
  Mic,
  AlertTriangle,
  FlaskConical,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import {
  adminService,
  type AdminOverviewResponse,
} from '../services/adminService';
import type {
  AdminGrantEntry,
  AdminPermissions,
  AdminSectionId,
  BrainAiProviderId,
  BrainModelAdminRecord,
  BrainModelLimitsConfig,
  BrainRulesConfig,
  BrainStageProviderConfig,
  BrainTaskStageId,
  ElementCapabilityId,
  StylePresetId,
  VerifiedSessionInfo,
} from '../types/domain';

interface AdminPanelProps {
  session: VerifiedSessionInfo;
  onCloseAdmin: () => void;
  onSessionRefreshNeeded: () => Promise<void>;
  onCatalogRefreshNeeded?: () => Promise<void>;
}

const SECTIONS: {
  id: AdminSectionId;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermKey: keyof AdminPermissions;
}[] = [
  {
    id: 'models',
    labelKey: 'admin.sec.models',
    icon: Cpu,
    requiredPermKey: 'canPublishModels',
  },
  {
    id: 'rules',
    labelKey: 'admin.sec.rules',
    icon: Scale,
    requiredPermKey: 'canEditRules',
  },
  {
    id: 'skills',
    labelKey: 'admin.sec.skills',
    icon: Wrench,
    requiredPermKey: 'canEditRules',
  },
  {
    id: 'styles',
    labelKey: 'admin.sec.styles',
    icon: Sparkles,
    requiredPermKey: 'canEditRules',
  },
  {
    id: 'references',
    labelKey: 'admin.sec.references',
    icon: BookOpen,
    requiredPermKey: 'canEditRules',
  },
  {
    id: 'jobs',
    labelKey: 'admin.sec.jobs',
    icon: Activity,
    requiredPermKey: 'canMonitorOperations',
  },
  {
    id: 'usage',
    labelKey: 'admin.sec.usage',
    icon: BarChart3,
    requiredPermKey: 'canMonitorOperations',
  },
  {
    id: 'access',
    labelKey: 'admin.sec.access',
    icon: KeyRound,
    requiredPermKey: 'canManageAccess',
  },
];

const ALL_SKILLS: { id: ElementCapabilityId; label: string }[] = [
  { id: 'cuts-trimming', label: 'Cuts & Trimming' },
  { id: 'zoom-reframe', label: 'Zoom & Reframe' },
  { id: 'speed', label: 'Speed Ramps' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'captions', label: 'Captions' },
  { id: 'titles', label: 'Titles' },
  { id: 'text-animation', label: 'Text Animation' },
  { id: 'b-roll', label: 'B-Roll' },
  { id: 'motion-graphics', label: 'Motion Graphics' },
  { id: 'sound-effects', label: 'Sound Effects' },
  { id: 'background-music', label: 'Background Music' },
  { id: 'audio-ducking', label: 'Audio Ducking' },
  { id: 'color-grading', label: 'Color Grading' },
  { id: 'split-screen', label: 'Split Screen' },
  { id: 'callouts-highlights', label: 'Callouts & Highlights' },
  { id: 'chapter-markers', label: 'Chapter Markers' },
  { id: 'lower-thirds', label: 'Lower Thirds' },
  { id: 'auto-framing', label: 'Auto Framing' },
];

const ALL_STYLES: { id: StylePresetId; label: string }[] = [
  { id: 'clean-cut-studio', label: 'Clean Cut Studio' },
  { id: 'kinetic-explainer', label: 'Kinetic Explainer' },
  { id: 'minimal-documentary', label: 'Minimal Documentary' },
  { id: 'high-retention-social', label: 'High-Retention Pacing' },
];

const STAGE_ORDER: {
  id: BrainTaskStageId;
  titleAr: string;
  titleEn: string;
}[] = [
  {
    id: 'analysis',
    titleAr: '1. مهمة التحليل وفهم المحتوى (Analysis)',
    titleEn: '1. Multimodal Analysis Stage',
  },
  {
    id: 'planning',
    titleAr: '2. مهمة الإخراج وتخطيط المشاهد (Planning & Directing)',
    titleEn: '2. Scene Planning & Output Stage',
  },
  {
    id: 'codeGeneration',
    titleAr: '3. مهمة توليد الكود والمكونات (Code Generation)',
    titleEn: '3. Remotion Code Generation Stage',
  },
  {
    id: 'review',
    titleAr: '4. مهمة المراجعة وضبط الجودة (Review & QA)',
    titleEn: '4. Quality Review Stage',
  },
];

export function AdminPanel({
  session,
  onCloseAdmin,
  onSessionRefreshNeeded,
  onCatalogRefreshNeeded,
}: AdminPanelProps) {
  const { locale, t } = useI18n();
  const isAr = locale === 'ar';

  const [activeSection, setActiveSection] = useState<AdminSectionId>(() => {
    if (session.permissions.canPublishModels) return 'models';
    if (session.permissions.canEditRules) return 'rules';
    if (session.permissions.canManageAccess) return 'access';
    return 'jobs';
  });

  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [brainModels, setBrainModels] = useState<BrainModelAdminRecord[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('brain-1.8');
  const [showArchivedModels, setShowArchivedModels] = useState<boolean>(false);

  const [sectionVerified, setSectionVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<boolean>(false);

  // Draft Editor Form State (isolated to the selected model's draftSnapshot)
  const [draftName, setDraftName] = useState('');
  const [draftDescEn, setDraftDescEn] = useState('');
  const [draftDescAr, setDraftDescAr] = useState('');
  const [draftVideoCapsText, setDraftVideoCapsText] = useState('');
  const [draftAudioCapsText, setDraftAudioCapsText] = useState('');
  const [draftStageConfigs, setDraftStageConfigs] = useState<
    Record<BrainTaskStageId, BrainStageProviderConfig>
  >({} as Record<BrainTaskStageId, BrainStageProviderConfig>);
  const [draftRules, setDraftRules] = useState<BrainRulesConfig>({
    analysisRules: '',
    editingRules: '',
    motionRules: '',
  });
  const [draftAllowedSkills, setDraftAllowedSkills] = useState<
    ElementCapabilityId[]
  >([]);
  const [draftAllowedStyles, setDraftAllowedStyles] = useState<StylePresetId[]>(
    []
  );
  const [draftAllowNewComponents, setDraftAllowNewComponents] =
    useState<boolean>(false);
  const [draftLimits, setDraftLimits] = useState<BrainModelLimitsConfig>({
    maxCostUsdPerTask: 1.5,
    maxRetriesPerTask: 2,
    maxTokensPerTask: 64000,
  });
  const [publishChangelog, setPublishChangelog] = useState('');

  // Create & Clone Modal State
  const [createModalMode, setCreateModalMode] = useState<
    'create' | 'clone' | null
  >(null);
  const [newModelIdInput, setNewModelIdInput] = useState('');
  const [newModelNameInput, setNewModelNameInput] = useState('');
  const [newModelDescArInput, setNewModelDescArInput] = useState('');
  const [newModelDescEnInput, setNewModelDescEnInput] = useState('');

  // Atomic Default Replacement Modal State (when disabling or archiving the currently Default model)
  const [atomicDefaultPrompt, setAtomicDefaultPrompt] = useState<{
    targetModel: BrainModelAdminRecord;
    operation: 'disable' | 'archive';
    replacementModelId: string;
  } | null>(null);

  // Invite form state (Access tab)
  const [inviteEmail, setInviteEmail] = useState('');
  const [permEditRules, setPermEditRules] = useState(false);
  const [permPublishModels, setPermPublishModels] = useState(false);
  const [permMonitorOps, setPermMonitorOps] = useState(true);
  const [permManageAccess, setPermManageAccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hydrateDraftEditorFromModel = (model: BrainModelAdminRecord) => {
    const snap = model.draftSnapshot ?? model.publishedSnapshot;
    setDraftName(snap.name);
    setDraftDescEn(snap.description);
    setDraftDescAr(snap.descriptionAr);
    setDraftVideoCapsText((snap.videoCapabilities ?? []).join('\n'));
    setDraftAudioCapsText((snap.audioCapabilities ?? []).join('\n'));
    setDraftStageConfigs(structuredClone(snap.taskStages));
    setDraftRules(structuredClone(snap.rules));
    setDraftAllowedSkills([...snap.allowedSkillIds]);
    setDraftAllowedStyles([...snap.allowedStyleIds]);
    setDraftAllowNewComponents(Boolean(snap.allowNewComponentGeneration));
    setDraftLimits(structuredClone(snap.limits));
  };

  const syncModelsList = (
    models: BrainModelAdminRecord[],
    preferredModelId?: string
  ) => {
    setBrainModels(models);
    const targetId =
      preferredModelId && models.some((m) => m.id === preferredModelId)
        ? preferredModelId
        : models.some((m) => m.id === selectedModelId)
          ? selectedModelId
          : (models.find((m) => m.isDefault)?.id ?? models[0]?.id ?? 'brain-1.8');
    setSelectedModelId(targetId);
    const found = models.find((m) => m.id === targetId);
    if (found) {
      hydrateDraftEditorFromModel(found);
    }
  };

  const loadAdminState = async (
    targetSec: AdminSectionId,
    preferredModelId?: string
  ) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [ov, secOk, fetchedModels] = await Promise.all([
        adminService.fetchAdminOverview(),
        adminService.verifySectionAccess(targetSec),
        adminService.fetchBrainModels().catch(() => null),
      ]);
      setOverview(ov);
      setSectionVerified(secOk);
      const list = fetchedModels ?? ov.brainModels ?? [];
      syncModelsList(list, preferredModelId);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Admin verification failed.'
      );
      await onSessionRefreshNeeded();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminState(activeSection);
  }, [activeSection]);

  const selectedModel =
    brainModels.find((m) => m.id === selectedModelId) ?? brainModels[0] ?? null;

  const handleSelectModelCard = (model: BrainModelAdminRecord) => {
    setSelectedModelId(model.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    hydrateDraftEditorFromModel(model);
  };

  const enabledUnarchivedModels = brainModels.filter(
    (m) => m.enabled && !m.archived
  );

  // =========================================================================
  // Brain Model & Rules Actions
  // =========================================================================

  const handleSaveDraft = async () => {
    if (!selectedModel || busyAction) return;
    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const videoCapabilities = draftVideoCapsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const audioCapabilities = draftAudioCapsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await adminService.saveBrainModelDraft({
        modelId: selectedModel.id,
        updates: {
          name: draftName.trim() || selectedModel.publishedSnapshot.name,
          description: draftDescEn.trim(),
          descriptionAr: draftDescAr.trim(),
          videoCapabilities,
          audioCapabilities,
          taskStages: draftStageConfigs,
          rules: draftRules,
          allowedSkillIds: draftAllowedSkills,
          allowedStyleIds: draftAllowedStyles,
          allowNewComponentGeneration: draftAllowNewComponents,
          limits: draftLimits,
        },
      });
      syncModelsList(res.models, selectedModel.id);
      setSuccessMsg(
        isAr
          ? `تم حفظ مسودة النموذج (${selectedModel.publishedSnapshot.name}) بنجاح دون التأثير على الإصدار المنشور.`
          : `Saved draft for ${selectedModel.publishedSnapshot.name} without affecting the published version.`
      );
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save model draft.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!selectedModel || busyAction) return;
    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      // Save current editor state into draft first so publishing captures latest edits
      const videoCapabilities = draftVideoCapsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const audioCapabilities = draftAudioCapsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await adminService.saveBrainModelDraft({
        modelId: selectedModel.id,
        updates: {
          name: draftName.trim() || selectedModel.publishedSnapshot.name,
          description: draftDescEn.trim(),
          descriptionAr: draftDescAr.trim(),
          videoCapabilities,
          audioCapabilities,
          taskStages: draftStageConfigs,
          rules: draftRules,
          allowedSkillIds: draftAllowedSkills,
          allowedStyleIds: draftAllowedStyles,
          allowNewComponentGeneration: draftAllowNewComponents,
          limits: draftLimits,
        },
      });

      const res = await adminService.publishBrainModelDraft({
        modelId: selectedModel.id,
        changelog: publishChangelog.trim() || undefined,
      });
      setPublishChangelog('');
      syncModelsList(res.models, selectedModel.id);
      setSuccessMsg(
        isAr
          ? `تم نشر الإصدار v${res.model.publishedSnapshot.modelVersion} (القواعد v${res.model.publishedSnapshot.rulesVersion}) للنموذج ${res.model.publishedSnapshot.name}.`
          : `Published v${res.model.publishedSnapshot.modelVersion} (Rules v${res.model.publishedSnapshot.rulesVersion}) for ${res.model.publishedSnapshot.name}.`
      );
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to publish model version.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleRollbackVersion = async (targetModelVersion: number) => {
    if (!selectedModel || busyAction) return;
    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await adminService.rollbackBrainModelVersion({
        modelId: selectedModel.id,
        targetModelVersion,
      });
      syncModelsList(res.models, selectedModel.id);
      setSuccessMsg(
        isAr
          ? `تم التراجع بنجاح إلى نسخة الإصدار v${targetModelVersion} كإصدار منشور جديد (v${res.model.publishedSnapshot.modelVersion}).`
          : `Rolled back to v${targetModelVersion} as new published version v${res.model.publishedSnapshot.modelVersion}.`
      );
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Rollback failed.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCreateOrCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createModalMode || busyAction) return;
    const cleanId = newModelIdInput.trim().toLowerCase();
    const cleanName = newModelNameInput.trim();
    if (!cleanId || !cleanName) return;

    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (createModalMode === 'clone' && selectedModel) {
        const res = await adminService.cloneBrainModel({
          sourceModelId: selectedModel.id,
          newId: cleanId,
          newName: cleanName,
        });
        syncModelsList(res.models, res.model.id);
        setSuccessMsg(
          isAr
            ? `تم نسخ النموذج "${selectedModel.publishedSnapshot.name}" إلى "${res.model.publishedSnapshot.name}" مع الاحتفاظ بارتباطات الأسرار خادميًا دون كشف قيمها.`
            : `Cloned "${selectedModel.publishedSnapshot.name}" to "${res.model.publishedSnapshot.name}" with server-bound secret references preserved.`
        );
      } else {
        const res = await adminService.createBrainModel({
          id: cleanId,
          name: cleanName,
          description: newModelDescEnInput.trim() || undefined,
          descriptionAr: newModelDescArInput.trim() || undefined,
        });
        syncModelsList(res.models, res.model.id);
        setSuccessMsg(
          isAr
            ? `تم إنشاء النموذج الجديد "${res.model.publishedSnapshot.name}" (${res.model.id}).`
            : `Created new Brain model "${res.model.publishedSnapshot.name}" (${res.model.id}).`
        );
      }
      setCreateModalMode(null);
      setNewModelIdInput('');
      setNewModelNameInput('');
      setNewModelDescArInput('');
      setNewModelDescEnInput('');
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Model creation/clone failed.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleSetDefaultModel = async (model: BrainModelAdminRecord) => {
    if (busyAction || model.isDefault) return;
    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await adminService.setDefaultBrainModel(model.id);
      syncModelsList(res.models, model.id);
      setSuccessMsg(
        isAr
          ? `تم تعيين "${model.publishedSnapshot.name}" كنموذج افتراضي للمحادثات والمشاريع الجديدة.`
          : `"${model.publishedSnapshot.name}" is now the default model for new conversations.`
      );
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to change default model.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleModelEnabled = async (model: BrainModelAdminRecord) => {
    if (busyAction) return;
    const nextEnabled = !model.enabled;

    // If disabling the currently Default model, check if there is another enabled model and open Atomic Replacement prompt
    if (!nextEnabled && model.isDefault) {
      const candidates = brainModels.filter(
        (m) => m.id !== model.id && m.enabled && !m.archived
      );
      if (candidates.length === 0) {
        setErrorMsg(
          isAr
            ? 'لا يمكن تعطيل آخر نموذج مفعّل في المنصة. يجب تفعيل نموذج بديل أولًا.'
            : 'Cannot disable the last enabled Brain model. Enable another model first.'
        );
        return;
      }
      setAtomicDefaultPrompt({
        targetModel: model,
        operation: 'disable',
        replacementModelId: candidates[0].id,
      });
      return;
    }

    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await adminService.setBrainModelStatus({
        modelId: model.id,
        enabled: nextEnabled,
      });
      syncModelsList(res.models, model.id);
      setSuccessMsg(
        nextEnabled
          ? isAr
            ? `تم تفعيل النموذج "${model.publishedSnapshot.name}".`
            : `Enabled model "${model.publishedSnapshot.name}".`
          : isAr
            ? `تم تعطيل النموذج "${model.publishedSnapshot.name}". المهام الجارية ستكتمل بإعداداتها المحفوظة وتُمنع المهام الجديدة من استخدامه.`
            : `Disabled model "${model.publishedSnapshot.name}". Running tasks will finish with their saved snapshot while new tasks are blocked.`
      );
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update model status.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleArchiveModel = async (model: BrainModelAdminRecord) => {
    if (busyAction) return;
    const nextArchived = !model.archived;

    if (nextArchived && model.isDefault) {
      const candidates = brainModels.filter(
        (m) => m.id !== model.id && m.enabled && !m.archived
      );
      if (candidates.length === 0) {
        setErrorMsg(
          isAr
            ? 'لا يمكن أرشفة النموذج الافتراضي الوحيد المفعّل دون وجود بديل مفعّل.'
            : 'Cannot archive the only enabled default model without an enabled replacement.'
        );
        return;
      }
      setAtomicDefaultPrompt({
        targetModel: model,
        operation: 'archive',
        replacementModelId: candidates[0].id,
      });
      return;
    }

    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await adminService.setBrainModelArchiveState({
        modelId: model.id,
        archived: nextArchived,
      });
      syncModelsList(res.models, model.id);
      setSuccessMsg(
        nextArchived
          ? isAr
            ? `تمت أرشفة النموذج "${model.publishedSnapshot.name}" مع الحفاظ الكامل على العلاقات والسجلات التاريخية.`
            : `Archived "${model.publishedSnapshot.name}" while preserving all historical relationships.`
          : isAr
            ? `تمت استعادة النموذج "${model.publishedSnapshot.name}" من الأرشيف.`
            : `Restored "${model.publishedSnapshot.name}" from archive.`
      );
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to change archive state.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmAtomicDefaultReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atomicDefaultPrompt || busyAction) return;
    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { targetModel, operation, replacementModelId } =
        atomicDefaultPrompt;
      if (operation === 'disable') {
        const res = await adminService.setBrainModelStatus({
          modelId: targetModel.id,
          enabled: false,
          replacementDefaultModelId: replacementModelId,
        });
        syncModelsList(res.models, targetModel.id);
        setSuccessMsg(
          isAr
            ? `تم تعطيل "${targetModel.publishedSnapshot.name}" وتعيين "${replacementModelId}" افتراضيًا في نفس العملية الذرية.`
            : `Atomically disabled "${targetModel.publishedSnapshot.name}" and assigned "${replacementModelId}" as the new default.`
        );
      } else {
        const res = await adminService.setBrainModelArchiveState({
          modelId: targetModel.id,
          archived: true,
          replacementDefaultModelId: replacementModelId,
        });
        syncModelsList(res.models, replacementModelId);
        setSuccessMsg(
          isAr
            ? `تمت أرشفة "${targetModel.publishedSnapshot.name}" وتعيين "${replacementModelId}" افتراضيًا في نفس العملية الذرية.`
            : `Atomically archived "${targetModel.publishedSnapshot.name}" and assigned "${replacementModelId}" as the new default.`
        );
      }
      setAtomicDefaultPrompt(null);
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Atomic default replacement failed.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteUnusedModel = async (model: BrainModelAdminRecord) => {
    if (busyAction) return;
    setBusyAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await adminService.deleteBrainModel(model.id);
      syncModelsList(res.models);
      setSuccessMsg(
        isAr
          ? `تم حذف النموذج غير المستخدم تاريخيًا (${model.publishedSnapshot.name}).`
          : `Deleted unused model (${model.publishedSnapshot.name}).`
      );
      await onCatalogRefreshNeeded?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete model failed.');
    } finally {
      setBusyAction(false);
    }
  };

  // =========================================================================
  // Access Section Handlers
  // =========================================================================

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await adminService.upsertGrant({
        email: trimmed,
        permissions: {
          canEditRules: permEditRules,
          canPublishModels: permPublishModels,
          canMonitorOperations: permMonitorOps,
          canManageAccess: permManageAccess,
        },
      });
      setInviteEmail('');
      await loadAdminState(activeSection);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleExistingPermission = async (
    grant: AdminGrantEntry,
    field:
      | 'canEditRules'
      | 'canPublishModels'
      | 'canMonitorOperations'
      | 'canManageAccess'
  ) => {
    if (grant.isPrimaryOwner || grant.email === 'allaithmtp@gmail.com') return;
    setErrorMsg(null);
    try {
      await adminService.upsertGrant({
        email: grant.email,
        permissions: {
          canEditRules:
            field === 'canEditRules' ? !grant.canEditRules : grant.canEditRules,
          canPublishModels:
            field === 'canPublishModels'
              ? !grant.canPublishModels
              : grant.canPublishModels,
          canMonitorOperations:
            field === 'canMonitorOperations'
              ? !grant.canMonitorOperations
              : grant.canMonitorOperations,
          canManageAccess:
            field === 'canManageAccess'
              ? !grant.canManageAccess
              : grant.canManageAccess,
        },
      });
      await loadAdminState(activeSection);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleRevoke = async (grant: AdminGrantEntry) => {
    if (grant.isPrimaryOwner || grant.email === 'allaithmtp@gmail.com') return;
    setErrorMsg(null);
    try {
      await adminService.revokeGrant(grant.id);
      await loadAdminState(activeSection);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Revoke failed.');
    }
  };

  const livePermissions = overview?.session.permissions ?? session.permissions;
  const visibleModels = brainModels.filter(
    (m) => showArchivedModels || !m.archived
  );

  const updateStageField = <K extends keyof BrainStageProviderConfig>(
    stageId: BrainTaskStageId,
    field: K,
    value: BrainStageProviderConfig[K]
  ) => {
    setDraftStageConfigs((prev) => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        [field]: value,
      },
    }));
  };

  const toggleSkillInDraft = (skillId: ElementCapabilityId) => {
    setDraftAllowedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const toggleStyleInDraft = (styleId: StylePresetId) => {
    setDraftAllowedStyles((prev) =>
      prev.includes(styleId)
        ? prev.filter((id) => id !== styleId)
        : [...prev, styleId]
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0C0E] text-white overflow-hidden">
      {/* Top Admin Header */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-white/[0.07] bg-[#0E0F13] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onCloseAdmin}
            className="h-9 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-medium text-white flex items-center gap-2 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>{t('admin.backToEditor')}</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <h1 className="text-sm sm:text-base font-semibold text-white truncate">
                {t('admin.title')}
              </h1>
            </div>
            <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
              {t('admin.subtitle')}
            </p>
          </div>
        </div>

        <div className="text-xs text-zinc-400 flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] text-zinc-300">
            {session.email}
          </span>
        </div>
      </div>

      {/* Main Body: Left Section Navigation + Right Module Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* 8 Sections Navigation Bar */}
        <nav className="lg:w-60 bg-[#0E0F12] border-b lg:border-b-0 lg:border-e border-white/[0.06] p-3 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto shrink-0">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isSelected = activeSection === sec.id;
            const isPermitted =
              livePermissions.isPrimaryOwner ||
              Boolean(livePermissions[sec.requiredPermKey]);

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setActiveSection(sec.id);
                }}
                className={`h-10 px-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2.5 transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{t(sec.labelKey)}</span>
                </span>
                {!isPermitted && (
                  <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Section Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="h-24 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
              <div className="h-48 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            </div>
          ) : !sectionVerified ? (
            /* Server-Enforced Permission Denied State */
            <div className="p-8 rounded-2xl bg-[#13151C] border border-white/[0.07] max-w-lg mx-auto text-center my-8">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">
                {t('admin.sectionLocked.title')}
              </h2>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                {t('admin.sectionLocked.desc')}
              </p>
            </div>
          ) : activeSection === 'models' || activeSection === 'rules' ? (
            /* ================================================================
               BRAIN MODELS & RULES MANAGEMENT (Phase 5)
               ================================================================ */
            <div className="space-y-6 max-w-6xl">
              {/* Top Bar: Create Model, Clone Model, Show Archived Toggle, & AI Quality Test Status */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#13151C] border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <h2 className="text-sm sm:text-base font-semibold text-white">
                      {activeSection === 'models'
                        ? isAr
                          ? 'إدارة نماذج محرك Brain والإصدارات'
                          : 'Brain Engine Models & Version Governance'
                        : isAr
                          ? 'محرر قواعد التحليل والتحرير والموشن جرافيك (المسودات والمنشور)'
                          : 'Brain Analysis, Editing & Motion Rules Editor'}
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isAr
                      ? 'نموذج Brain هو إعداد متكامل لمحرك VION (المزودات، القواعد، المهارات، الاستايلات، والحدود). تُحفظ الأسرار خادميًا دون كشف قيمها.'
                      : 'A Brain Model is a complete server-governed configuration profile for the VION engine. Secret values never leave the server.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <label className="px-3 py-2 rounded-xl bg-[#0B0C0E] border border-white/[0.08] text-xs text-zinc-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showArchivedModels}
                      onChange={(e) => setShowArchivedModels(e.target.checked)}
                      className="rounded border-zinc-600 text-blue-600"
                    />
                    <span>
                      {isAr ? 'إظهار المؤرشفة' : 'Show Archived'}
                    </span>
                  </label>

                  {(livePermissions.isPrimaryOwner ||
                    livePermissions.canPublishModels) && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateModalMode('create');
                          setNewModelIdInput('');
                          setNewModelNameInput('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إنشاء نموذج جديد' : 'New Model'}</span>
                      </button>

                      {selectedModel && (
                        <button
                          type="button"
                          onClick={() => {
                            setCreateModalMode('clone');
                            setNewModelIdInput(`${selectedModel.id}-copy`);
                            setNewModelNameInput(
                              `${selectedModel.publishedSnapshot.name} Copy`
                            );
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {isAr
                              ? `نسخ (${selectedModel.publishedSnapshot.name})`
                              : `Clone (${selectedModel.publishedSnapshot.name})`}
                          </span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* AI Quality Evaluation Honesty Banner (Never marked completed before Brain AI phase) */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-amber-200">
                      {isAr
                        ? 'اختبار جودة الذكاء الاصطناعي للقواعد: غير مكتمل (بانتظار ربط التحليل والتنفيذ)'
                        : 'AI Rule Quality Evaluation: Pending (Awaiting AI Analysis & Execution Wiring)'}
                    </div>
                    <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                      {isAr
                        ? 'يتم حفظ القواعد والإعدادات كمسودة ونشرها بإصدارات مرقّمة في الخادم، لكن لا يُعرض اختبار جودة الذكاء الاصطناعي كمكتمل قبل ربط التحليل والتنفيذ الفعلي في المرحلة القادمة.'
                        : 'Rules and stage configurations are saved as drafts and versioned on the server. AI quality evaluation is not marked complete until live AI analysis & execution are connected.'}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/35 text-[11px] font-mono text-amber-200 shrink-0">
                  {isAr ? 'حالة فحص AI: غير مربوط بعد' : 'AI QA: Not Connected Yet'}
                </span>
              </div>

              {/* Models Registry Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {visibleModels.map((model) => {
                  const isSelected = model.id === selectedModel?.id;
                  const isLastEnabled =
                    model.enabled &&
                    !model.archived &&
                    enabledUnarchivedModels.length <= 1;

                  return (
                    <div
                      key={model.id}
                      onClick={() => handleSelectModelCard(model)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#171B26] border-blue-500/50 shadow-lg'
                          : 'bg-[#12141B] border-white/[0.07] hover:border-white/[0.15]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={model.publishedSnapshot.iconUrl}
                              alt={model.publishedSnapshot.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl object-contain bg-[#0B0C0E] border border-white/[0.06] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">
                                {model.publishedSnapshot.name}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-400 truncate">
                                {model.id}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1 shrink-0">
                            {model.isDefault && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-[10px] font-semibold text-blue-300 flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-blue-400" />
                                {isAr ? 'افتراضي' : 'Default'}
                              </span>
                            )}
                            {model.archived ? (
                              <span className="px-2 py-0.5 rounded-md bg-zinc-500/20 border border-zinc-500/30 text-[10px] font-semibold text-zinc-300">
                                {isAr ? 'مؤرشف' : 'Archived'}
                              </span>
                            ) : model.enabled ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                                {isAr ? 'مفعّل' : 'Enabled'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-300">
                                {isAr ? 'معطّل' : 'Disabled'}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {isAr
                            ? model.publishedSnapshot.descriptionAr ||
                              model.publishedSnapshot.description
                            : model.publishedSnapshot.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono text-zinc-400">
                          <span className="px-2 py-0.5 rounded bg-white/[0.05] text-zinc-200">
                            v{model.publishedSnapshot.modelVersion} · Rules v
                            {model.publishedSnapshot.rulesVersion}
                          </span>
                          {model.hasUnpublishedDraft && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {isAr ? 'مسودة غير منشورة' : 'Draft Modified'}
                            </span>
                          )}
                          {model.usedHistorically && (
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
                              {isAr
                                ? `مستخدم تاريخيًا (${model.historicalUsageCount})`
                                : `Used (${model.historicalUsageCount})`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Governance Actions on Card */}
                      {(livePermissions.isPrimaryOwner ||
                        livePermissions.canPublishModels) && (
                        <div
                          className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Enable / Disable Toggle */}
                          {!model.archived && (
                            <button
                              type="button"
                              disabled={busyAction || isLastEnabled}
                              title={
                                isLastEnabled
                                  ? isAr
                                    ? 'لا يمكن تعطيل آخر نموذج مفعّل'
                                    : 'Cannot disable the last enabled model'
                                  : ''
                              }
                              onClick={() => handleToggleModelEnabled(model)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                                isLastEnabled
                                  ? 'bg-white/[0.03] border-white/[0.06] text-zinc-500 cursor-not-allowed'
                                  : model.enabled
                                    ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/25 text-amber-300 cursor-pointer'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300 cursor-pointer'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              <span>
                                {model.enabled
                                  ? isAr
                                    ? 'تعطيل'
                                    : 'Disable'
                                  : isAr
                                    ? 'تفعيل'
                                    : 'Enable'}
                              </span>
                            </button>
                          )}

                          {/* Set as Default */}
                          {model.enabled && !model.archived && !model.isDefault && (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => handleSetDefaultModel(model)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-[11px] font-medium text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Star className="w-3 h-3" />
                              <span>
                                {isAr ? 'تعيين كافتراضي' : 'Set Default'}
                              </span>
                            </button>
                          )}

                          {/* Archive / Unarchive */}
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => handleToggleArchiveModel(model)}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-medium text-zinc-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Archive className="w-3 h-3" />
                            <span>
                              {model.archived
                                ? isAr
                                  ? 'استعادة'
                                  : 'Unarchive'
                                : isAr
                                  ? 'أرشفة'
                                  : 'Archive'}
                            </span>
                          </button>

                          {/* Delete (Blocked if usedHistorically or isDefault) */}
                          {!model.usedHistorically && !model.isDefault ? (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => handleDeleteUnusedModel(model)}
                              className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-[11px] text-red-300 flex items-center gap-1 ms-auto cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{isAr ? 'حذف' : 'Delete'}</span>
                            </button>
                          ) : (
                            <span
                              className="text-[10px] text-zinc-500 ms-auto"
                              title={
                                isAr
                                  ? 'لا يُسمح بحذف نموذج مستخدم تاريخيًا؛ استخدم الأرشفة للحفاظ على العلاقات.'
                                  : 'Historically used models cannot be deleted; use Archive instead.'
                              }
                            >
                              {isAr ? 'محمي من الحذف' : 'History Protected'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Atomic Replacement Default Modal (When Disabling or Archiving the Default Model) */}
              {atomicDefaultPrompt && (
                <form
                  onSubmit={handleConfirmAtomicDefaultReplacement}
                  className="p-5 rounded-2xl bg-[#161924] border-2 border-amber-500/40 space-y-4 shadow-2xl"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {isAr
                          ? `تعيين نموذج افتراضي بديل في نفس العملية الذرية (${atomicDefaultPrompt.targetModel.publishedSnapshot.name})`
                          : `Assign Replacement Default Model Atomically (${atomicDefaultPrompt.targetModel.publishedSnapshot.name})`}
                      </h3>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        {isAr
                          ? 'النموذج المراد تعطيله أو أرشفته هو النموذج الافتراضي الحالي. يجب اختيار نموذج بديل مفعّل ليصبح الافتراضي في العملية الذرية نفسها.'
                          : 'You are disabling/archiving the current Default model. Select an enabled replacement model to become Default in the same atomic transaction.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <select
                      value={atomicDefaultPrompt.replacementModelId}
                      onChange={(e) =>
                        setAtomicDefaultPrompt((prev) =>
                          prev
                            ? { ...prev, replacementModelId: e.target.value }
                            : null
                        )
                      }
                      className="flex-1 bg-[#0B0C0E] border border-white/[0.15] rounded-xl px-3.5 py-2.5 text-xs text-white"
                    >
                      {brainModels
                        .filter(
                          (m) =>
                            m.id !== atomicDefaultPrompt.targetModel.id &&
                            m.enabled &&
                            !m.archived
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.publishedSnapshot.name} ({m.id} · v
                            {m.publishedSnapshot.modelVersion})
                          </option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={busyAction}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs cursor-pointer"
                      >
                        {isAr
                          ? 'تأكيد التبديل الذري والتنفيذ'
                          : 'Confirm Atomic Switch'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAtomicDefaultPrompt(null)}
                        className="px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-xs text-zinc-300"
                      >
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Create / Clone Modal Form */}
              {createModalMode && (
                <form
                  onSubmit={handleCreateOrCloneSubmit}
                  className="p-5 rounded-2xl bg-[#151822] border border-blue-500/40 space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {createModalMode === 'clone' ? (
                        <Copy className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Plus className="w-4 h-4 text-blue-400" />
                      )}
                      <span>
                        {createModalMode === 'clone'
                          ? isAr
                            ? `نسخ النموذج "${selectedModel?.publishedSnapshot.name}" إلى نموذج مستقل`
                            : `Clone "${selectedModel?.publishedSnapshot.name}" to New Independent Model`
                          : isAr
                            ? 'إنشاء نموذج Brain جديد'
                            : 'Create New Brain Model'}
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCreateModalMode(null)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400">
                    {createModalMode === 'clone'
                      ? isAr
                        ? 'يتم نسخ جميع إعدادات المزودات والقواعد والمهارات والاستايلات مع الاحتفاظ بارتباطات الأسرار في الخادم دون كشف قيمها أو التأثير على النموذج الأصلي.'
                        : 'Copies all stage provider settings, rules, allowed skills, and styles while retaining server-side secret bindings without exposing secret values.'
                      : isAr
                        ? 'أدخل معرّفًا ثابتًا (ID) واسمًا للنموذج الجديد.'
                        : 'Specify an immutable ID and display name for the new Brain model.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        {isAr
                          ? 'المعرّف الثابت (Immutable Model ID)'
                          : 'Immutable Model ID'}
                      </label>
                      <input
                        type="text"
                        required
                        pattern="^[a-zA-Z0-9_\-\.]+$"
                        placeholder="brain-1.9-pro"
                        value={newModelIdInput}
                        onChange={(e) => setNewModelIdInput(e.target.value)}
                        className="w-full bg-[#0B0C0E] border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        {isAr ? 'اسم النموذج (Model Name)' : 'Model Name'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Brain 1.9 Pro"
                        value={newModelNameInput}
                        onChange={(e) => setNewModelNameInput(e.target.value)}
                        className="w-full bg-[#0B0C0E] border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {createModalMode === 'create' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          {isAr ? 'الوصف بالعربية' : 'Arabic Description'}
                        </label>
                        <input
                          type="text"
                          value={newModelDescArInput}
                          onChange={(e) =>
                            setNewModelDescArInput(e.target.value)
                          }
                          className="w-full bg-[#0B0C0E] border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          {isAr ? 'الوصف بالإنجليزية' : 'English Description'}
                        </label>
                        <input
                          type="text"
                          value={newModelDescEnInput}
                          onChange={(e) =>
                            setNewModelDescEnInput(e.target.value)
                          }
                          className="w-full bg-[#0B0C0E] border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateModalMode(null)}
                      className="px-4 py-2 rounded-xl bg-white/[0.06] text-xs text-zinc-300"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={busyAction}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      {createModalMode === 'clone'
                        ? isAr
                          ? 'تأكيد نسخ النموذج'
                          : 'Create Clone'
                        : isAr
                          ? 'إنشاء النموذج'
                          : 'Create Model'}
                    </button>
                  </div>
                </form>
              )}

              {/* Selected Model Detailed Draft & Published Configuration Editor */}
              {selectedModel && (
                <div className="p-5 rounded-2xl bg-[#13151C] border border-white/[0.08] space-y-6">
                  {/* Editor Header with Save Draft & Publish Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-white">
                          {selectedModel.publishedSnapshot.name}
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/[0.06] text-blue-300">
                          ID: {selectedModel.id}
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                          {isAr ? 'المنشور:' : 'Published:'} v
                          {selectedModel.publishedSnapshot.modelVersion} · Rules
                          v{selectedModel.publishedSnapshot.rulesVersion}
                        </span>
                        {selectedModel.hasUnpublishedDraft && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {isAr
                              ? 'تعديلات مسودة جاهزة للنشر'
                              : 'Unpublished Draft Changes'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {isAr
                          ? 'التعديلات أدناه تُحفظ في مسودة النموذج (Draft) ولا تؤثر على المهام أو الإصدار المنشور إلا عند الضغط على "نشر إصدار جديد".'
                          : 'Edits below are saved to the model’s Draft and only take effect for new tasks when you click "Publish New Version".'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={handleSaveDraft}
                        className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          {isAr ? 'حفظ كمسودة (Save Draft)' : 'Save Draft'}
                        </span>
                      </button>

                      {(livePermissions.isPrimaryOwner ||
                        livePermissions.canPublishModels) && (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={handlePublishDraft}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {isAr
                              ? 'نشر إصدار جديد (Publish)'
                              : 'Publish New Version'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. Identity & Video/Audio Capabilities */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                      {isAr
                        ? '1. الهوية والوصف وقدرات الفيديو والصوت'
                        : '1. Identity, Description & Video/Audio Capabilities'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          {isAr ? 'اسم النموذج' : 'Display Name'}
                        </label>
                        <input
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          {isAr
                            ? 'الوصف بالعربية (يظهر للمستخدم في قائمة النماذج)'
                            : 'Description (Arabic)'}
                        </label>
                        <input
                          type="text"
                          dir="rtl"
                          value={draftDescAr}
                          onChange={(e) => setDraftDescAr(e.target.value)}
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          {isAr
                            ? 'الوصف بالإنجليزية'
                            : 'Description (English)'}
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={draftDescEn}
                          onChange={(e) => setDraftDescEn(e.target.value)}
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {isAr
                              ? 'قدرات الفيديو (سطر لكل قدرة)'
                              : 'Video Capabilities (one per line)'}
                          </span>
                        </label>
                        <textarea
                          rows={3}
                          value={draftVideoCapsText}
                          onChange={(e) =>
                            setDraftVideoCapsText(e.target.value)
                          }
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl p-3 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {isAr
                              ? 'قدرات الصوت والموشن (سطر لكل قدرة)'
                              : 'Audio & Voiceover Capabilities (one per line)'}
                          </span>
                        </label>
                        <textarea
                          rows={3}
                          value={draftAudioCapsText}
                          onChange={(e) =>
                            setDraftAudioCapsText(e.target.value)
                          }
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl p-3 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Per-Task AI Provider & Model Routing (Analysis, Planning, CodeGen, Review) */}
                  <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                        {isAr
                          ? '2. إعدادات مزود ونموذج الذكاء الاصطناعي لكل مهمة (مع حماية الأسرار خادميًا)'
                          : '2. Per-Stage AI Provider & Model Routing (Server-Bound Secrets)'}
                      </h3>
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>
                          {isAr
                            ? 'لا يتم إرسال قيم المفاتيح السرية للمتصفح أبدًا'
                            : 'Secret values are never transmitted to the browser'}
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {STAGE_ORDER.map((st) => {
                        const cfg = draftStageConfigs[st.id];
                        if (!cfg) return null;
                        return (
                          <div
                            key={st.id}
                            className="p-3.5 rounded-xl bg-[#0B0C0E] border border-white/[0.07] space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white">
                                {isAr ? st.titleAr : st.titleEn}
                              </span>
                              <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cfg.enabled}
                                  onChange={(e) =>
                                    updateStageField(
                                      st.id,
                                      'enabled',
                                      e.target.checked
                                    )
                                  }
                                  className="rounded border-zinc-600 text-blue-600"
                                />
                                <span>{isAr ? 'مفعّل' : 'Active'}</span>
                              </label>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 text-xs">
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">
                                  {isAr ? 'المزود (Provider)' : 'AI Provider'}
                                </label>
                                <select
                                  value={cfg.provider}
                                  onChange={(e) =>
                                    updateStageField(
                                      st.id,
                                      'provider',
                                      e.target.value as BrainAiProviderId
                                    )
                                  }
                                  className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-white"
                                >
                                  <option value="google-genai">
                                    Google GenAI (Gemini)
                                  </option>
                                  <option value="vertex-ai">
                                    Google Vertex AI
                                  </option>
                                  <option value="openai-compatible">
                                    OpenAI Compatible
                                  </option>
                                  <option value="anthropic">Anthropic</option>
                                  <option value="unconfigured">
                                    Unconfigured
                                  </option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">
                                  {isAr
                                    ? 'معرّف النموذج (Model ID)'
                                    : 'Underlying Model ID'}
                                </label>
                                <input
                                  type="text"
                                  value={cfg.modelId}
                                  onChange={(e) =>
                                    updateStageField(
                                      st.id,
                                      'modelId',
                                      e.target.value
                                    )
                                  }
                                  className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">
                                  {isAr
                                    ? 'مرجع متغير السر في الخادم (Secret Ref)'
                                    : 'Server Secret Env Reference'}
                                </label>
                                <input
                                  type="text"
                                  value={cfg.secretRefKey}
                                  onChange={(e) =>
                                    updateStageField(
                                      st.id,
                                      'secretRefKey',
                                      e.target.value
                                    )
                                  }
                                  className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-blue-300"
                                />
                              </div>

                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="block text-[10px] text-zinc-400 mb-1">
                                    Temp
                                  </label>
                                  <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    max="2"
                                    value={cfg.temperature}
                                    onChange={(e) =>
                                      updateStageField(
                                        st.id,
                                        'temperature',
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] text-zinc-400 mb-1">
                                    Max Tokens
                                  </label>
                                  <input
                                    type="number"
                                    step="512"
                                    min="256"
                                    value={cfg.maxOutputTokens}
                                    onChange={(e) =>
                                      updateStageField(
                                        st.id,
                                        'maxOutputTokens',
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="text-[10px] flex items-center justify-between text-zinc-400 pt-1">
                              <span>
                                {isAr
                                  ? `ارتباط السر (${cfg.secretRefKey}):`
                                  : `Secret Binding (${cfg.secretRefKey}):`}
                              </span>
                              <span
                                className={
                                  cfg.hasSecretConfigured
                                    ? 'text-emerald-400 font-medium'
                                    : 'text-amber-400 font-medium'
                                }
                              >
                                {cfg.hasSecretConfigured
                                  ? isAr
                                    ? 'مربوط في الخادم (القيمة مخفية)'
                                    : 'Bound on Server (Value Hidden)'
                                  : isAr
                                    ? 'مرجع محفوظ (بانتظار ضبط المفتاح)'
                                    : 'Reference Saved (Env Key Unset)'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Analysis, Editing & Motion Rules Editor */}
                  <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                      {isAr
                        ? '3. قواعد التحليل والتحرير والموشن جرافيك (تُحفظ كمسودة وتُنشر بإصدار مستقل)'
                        : '3. Analysis, Editing & Motion Rules (Saved as Draft & Versioned)'}
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                          {isAr
                            ? 'قواعد التحليل وفهم المحتوى (Analysis Rules)'
                            : 'Analysis Rules'}
                        </label>
                        <textarea
                          rows={5}
                          value={draftRules.analysisRules}
                          onChange={(e) =>
                            setDraftRules((prev) => ({
                              ...prev,
                              analysisRules: e.target.value,
                            }))
                          }
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl p-3 text-xs text-white leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                          {isAr
                            ? 'قواعد التحرير والمونتاج (Editing Rules)'
                            : 'Video Editing Rules'}
                        </label>
                        <textarea
                          rows={5}
                          value={draftRules.editingRules}
                          onChange={(e) =>
                            setDraftRules((prev) => ({
                              ...prev,
                              editingRules: e.target.value,
                            }))
                          }
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl p-3 text-xs text-white leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                          {isAr
                            ? 'قواعد الموشن جرافيك والتحريك (Motion Rules)'
                            : 'Motion Graphics Rules'}
                        </label>
                        <textarea
                          rows={5}
                          value={draftRules.motionRules}
                          onChange={(e) =>
                            setDraftRules((prev) => ({
                              ...prev,
                              motionRules: e.target.value,
                            }))
                          }
                          className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl p-3 text-xs text-white leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Permitted Skills, Permitted Styles, Component Generation & Limits */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
                    {/* Allowed Skills & Styles */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-blue-400">
                        {isAr
                          ? '4. المهارات (Skills) والاستايلات (Styles) المسموحة لهذا النموذج'
                          : '4. Permitted Skills & Styles for This Model'}
                      </h4>

                      <div className="p-3 rounded-xl bg-[#0B0C0E] border border-white/[0.07] space-y-2">
                        <div className="text-[11px] font-medium text-zinc-300">
                          {isAr ? 'الاستايلات المسموحة:' : 'Allowed Styles:'}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {ALL_STYLES.map((st) => (
                            <label
                              key={st.id}
                              className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={draftAllowedStyles.includes(st.id)}
                                onChange={() => toggleStyleInDraft(st.id)}
                                className="rounded border-zinc-600 text-blue-600"
                              />
                              <span>{st.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[#0B0C0E] border border-white/[0.07] space-y-2">
                        <div className="text-[11px] font-medium text-zinc-300">
                          {isAr
                            ? `المهارات والعناصر المسموحة (${draftAllowedSkills.length}/${ALL_SKILLS.length}):`
                            : `Allowed Skills (${draftAllowedSkills.length}/${ALL_SKILLS.length}):`}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {ALL_SKILLS.map((sk) => (
                            <label
                              key={sk.id}
                              className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={draftAllowedSkills.includes(sk.id)}
                                onChange={() => toggleSkillInDraft(sk.id)}
                                className="rounded border-zinc-600 text-blue-600"
                              />
                              <span className="truncate">{sk.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Component Generation Permission & Cost/Retry Limits */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>
                          {isAr
                            ? '5. السماح بتوليد مكونات جديدة وحدود التكلفة والمحاولات'
                            : '5. New Component Generation & Cost/Retry Limits'}
                        </span>
                      </h4>

                      <label className="p-3.5 rounded-xl bg-[#0B0C0E] border border-white/[0.07] flex items-start justify-between gap-3 cursor-pointer">
                        <div>
                          <div className="text-xs font-semibold text-white">
                            {isAr
                              ? 'السماح بتوليد مكونات Remotion جديدة عند الحاجة'
                              : 'Allow Generating New Remotion Components'}
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {isAr
                              ? 'عند التفعيل، يُسمح لمهمة توليد الكود بإنشاء مكونات مشهد مخصصة ضمن القواعد المحددة.'
                              : 'When enabled, the codeGeneration stage may synthesize custom scene components within sandbox rules.'}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draftAllowNewComponents}
                          onChange={(e) =>
                            setDraftAllowNewComponents(e.target.checked)
                          }
                          className="mt-1 rounded border-zinc-600 text-blue-600"
                        />
                      </label>

                      <div className="p-3.5 rounded-xl bg-[#0B0C0E] border border-white/[0.07] grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            {isAr
                              ? 'أقصى تكلفة للمهمة (USD)'
                              : 'Max Cost / Task (USD)'}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.05"
                            value={draftLimits.maxCostUsdPerTask}
                            onChange={(e) =>
                              setDraftLimits((prev) => ({
                                ...prev,
                                maxCostUsdPerTask: Number(e.target.value),
                              }))
                            }
                            className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            {isAr
                              ? 'أقصى عدد محاولات (Retries)'
                              : 'Max Retries / Task'}
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="10"
                            value={draftLimits.maxRetriesPerTask}
                            onChange={(e) =>
                              setDraftLimits((prev) => ({
                                ...prev,
                                maxRetriesPerTask: Number(e.target.value),
                              }))
                            }
                            className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            {isAr
                              ? 'أقصى عدد Tokens للمهمة'
                              : 'Max Tokens / Task'}
                          </label>
                          <input
                            type="number"
                            step="1000"
                            min="1000"
                            value={draftLimits.maxTokensPerTask}
                            onChange={(e) =>
                              setDraftLimits((prev) => ({
                                ...prev,
                                maxTokensPerTask: Number(e.target.value),
                              }))
                            }
                            className="w-full bg-[#13151C] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                      </div>

                      {/* Optional Changelog note before Publishing */}
                      {(livePermissions.isPrimaryOwner ||
                        livePermissions.canPublishModels) && (
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">
                            {isAr
                              ? 'ملاحظات الإصدار الجديد عند النشر (Changelog)'
                              : 'Release Changelog Note (for Publish)'}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              isAr
                                ? 'مثال: تحديث قواعد الموشن جرافيك ورفع دقة التحليل...'
                                : 'e.g., Updated motion rules and stage token limits...'
                            }
                            value={publishChangelog}
                            onChange={(e) =>
                              setPublishChangelog(e.target.value)
                            }
                            className="w-full bg-[#0B0C0E] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5. Published Version History & One-Click Rollback */}
                  <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                      <History className="w-4 h-4" />
                      <span>
                        {isAr
                          ? `سجل الإصدارات المنشورة والتراجع (${selectedModel.versionHistory.length})`
                          : `Published Version History & Rollback (${selectedModel.versionHistory.length})`}
                      </span>
                    </div>

                    <div className="divide-y divide-white/[0.06] bg-[#0B0C0E] rounded-xl border border-white/[0.07] max-h-60 overflow-y-auto">
                      {[...selectedModel.versionHistory]
                        .reverse()
                        .map((ver) => {
                          const isCurrentPublished =
                            ver.modelVersion ===
                            selectedModel.publishedSnapshot.modelVersion;
                          return (
                            <div
                              key={ver.modelVersion}
                              className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white">
                                    v{ver.modelVersion}
                                  </span>
                                  <span className="font-mono text-[11px] text-blue-300">
                                    Rules v{ver.rulesVersion}
                                  </span>
                                  {isCurrentPublished && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                                      {isAr
                                        ? 'الإصدار المنشور الحالي'
                                        : 'Active Published'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400">
                                  {ver.changelog} ·{' '}
                                  <span className="font-mono text-zinc-500">
                                    {ver.publishedByEmail} (
                                    {new Date(ver.publishedAt).toLocaleString()}
                                    )
                                  </span>
                                </div>
                              </div>

                              {!isCurrentPublished &&
                                (livePermissions.isPrimaryOwner ||
                                  livePermissions.canPublishModels) && (
                                  <button
                                    type="button"
                                    disabled={busyAction}
                                    onClick={() =>
                                      handleRollbackVersion(ver.modelVersion)
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-[11px] font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3 text-blue-400" />
                                    <span>
                                      {isAr
                                        ? `التراجع إلى v${ver.modelVersion}`
                                        : `Rollback to v${ver.modelVersion}`}
                                    </span>
                                  </button>
                                )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeSection === 'access' ? (
            /* ================================================================
               ACCESS SECTION: Primary Owner Card, Granular Invites & Audit Log
               ================================================================ */
            <div className="space-y-6 max-w-4xl">
              {/* 1. Primary Owner Authority Card */}
              <div className="p-5 rounded-2xl bg-[#13151C] border border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-blue-400">
                    {t('admin.primaryOwnerLabel')}
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5 font-mono">
                    {overview?.primaryOwnerEmail ?? 'allaithmtp@gmail.com'}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {t('admin.boundUidLabel')}:{' '}
                    <span className="font-mono text-zinc-200">
                      {overview?.primaryOwnerUid ?? t('admin.notBoundYet')}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('admin.access.primaryProtected')}</span>
                </div>
              </div>

              {/* 2. Add / Update Admin by Verified Google Email */}
              <form
                onSubmit={handleGrantSubmit}
                className="p-5 rounded-2xl bg-[#13151C] border border-white/[0.07] space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <span>{t('admin.access.inviteTitle')}</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t('admin.access.emailPlaceholder')}
                    className="flex-1 bg-[#0B0C0E] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    {t('admin.access.grantBtn')}
                  </button>
                </div>

                {/* 4 Separated Granular Permissions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0B0C0E] border border-white/[0.06] cursor-pointer text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={permEditRules}
                      onChange={(e) => setPermEditRules(e.target.checked)}
                      className="rounded border-zinc-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t('admin.perm.editRules')}</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0B0C0E] border border-white/[0.06] cursor-pointer text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={permPublishModels}
                      onChange={(e) => setPermPublishModels(e.target.checked)}
                      className="rounded border-zinc-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t('admin.perm.publishModels')}</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0B0C0E] border border-white/[0.06] cursor-pointer text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={permMonitorOps}
                      onChange={(e) => setPermMonitorOps(e.target.checked)}
                      className="rounded border-zinc-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t('admin.perm.monitorOperations')}</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0B0C0E] border border-white/[0.06] cursor-pointer text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={permManageAccess}
                      onChange={(e) => setPermManageAccess(e.target.checked)}
                      className="rounded border-zinc-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t('admin.perm.manageAccess')}</span>
                  </label>
                </div>
              </form>

              {/* 3. Active Grants & Separated Permission Toggles */}
              <div className="p-5 rounded-2xl bg-[#13151C] border border-white/[0.07] space-y-4">
                <h3 className="text-sm font-semibold text-white">
                  {t('admin.access.activeGrantsTitle')}
                </h3>

                <div className="divide-y divide-white/[0.06]">
                  {(overview?.grants ?? []).map((grant) => {
                    const isOwner =
                      grant.isPrimaryOwner ||
                      grant.email === 'allaithmtp@gmail.com';
                    return (
                      <div
                        key={grant.id}
                        className="py-4 flex flex-col gap-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-white font-mono">
                              {grant.email}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {grant.boundUid
                                ? `${t('admin.access.boundStatus')}: ${grant.boundUid}`
                                : t('admin.access.pendingStatus')}
                            </div>
                          </div>

                          {isOwner ? (
                            <span className="text-xs text-blue-400 font-medium">
                              {t('admin.access.primaryProtected')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevoke(grant)}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-xs font-medium text-red-300 flex items-center gap-1.5 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t('admin.access.revokeBtn')}</span>
                            </button>
                          )}
                        </div>

                        {/* Interactive Permission Toggles for Each Grant */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          {(
                            [
                              ['canEditRules', 'admin.sec.rules'],
                              ['canPublishModels', 'admin.sec.models'],
                              ['canMonitorOperations', 'admin.sec.jobs'],
                              ['canManageAccess', 'admin.sec.access'],
                            ] as const
                          ).map(([permKey, labelKey]) => {
                            const active = grant[permKey];
                            return (
                              <button
                                key={permKey}
                                type="button"
                                disabled={isOwner}
                                onClick={() =>
                                  handleToggleExistingPermission(grant, permKey)
                                }
                                className={`px-2.5 py-1.5 rounded-lg border text-start transition-colors flex items-center justify-between gap-2 ${
                                  active
                                    ? 'bg-blue-600/15 border-blue-500/40 text-white'
                                    : 'bg-[#0B0C0E] border-white/[0.06] text-zinc-500'
                                } ${
                                  isOwner
                                    ? 'cursor-default opacity-80'
                                    : 'hover:border-white/[0.2]'
                                }`}
                              >
                                <span className="truncate">{t(labelKey)}</span>
                                <span className="font-mono">
                                  {active ? 'ON' : 'OFF'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Administrative Audit Log */}
              <div className="p-5 rounded-2xl bg-[#13151C] border border-white/[0.07] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>{t('admin.audit.title')}</span>
                </div>

                {(overview?.auditLogs ?? []).length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    {t('admin.audit.empty')}
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06] max-h-72 overflow-y-auto">
                    {(overview?.auditLogs ?? []).map((log) => (
                      <div
                        key={log.id}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-blue-400 font-medium">
                            {log.action}
                          </span>
                          <span className="text-zinc-500 mx-1.5">·</span>
                          <span className="text-zinc-300">{log.details}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono shrink-0 tabular-nums">
                          {log.actorEmail} ·{' '}
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================================================================
               STRUCTURAL SHELL FOR UPCOMING SECTIONS
               (Skills, Styles, References, Jobs, Usage)
               ================================================================ */
            <div className="p-6 rounded-2xl bg-[#13151C] border border-white/[0.07] max-w-3xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white">
                  {t(`admin.sec.${activeSection}`)}
                </h2>
                <span className="text-xs text-blue-400 font-medium">
                  {t('admin.sectionPlaceholder.badge')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('admin.sectionPlaceholder.desc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
