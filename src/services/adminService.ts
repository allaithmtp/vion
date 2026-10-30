import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  AdminAuditLogEntry,
  AdminGrantEntry,
  AdminSectionId,
  BrainModelAdminRecord,
  BrainModelLimitsConfig,
  BrainRulesConfig,
  BrainStageProviderConfig,
  BrainTaskStageId,
  ElementCapabilityId,
  StylePresetId,
  VerifiedSessionInfo,
} from '../types/domain';

export interface AdminOverviewResponse {
  ok: boolean;
  session: VerifiedSessionInfo;
  primaryOwnerEmail: string;
  primaryOwnerUid: string | null;
  brainModels?: BrainModelAdminRecord[];
  grants: AdminGrantEntry[];
  auditLogs: AdminAuditLogEntry[];
}

export interface BrainModelDraftPayload {
  name?: string;
  description?: string;
  descriptionAr?: string;
  badgeText?: string;
  videoCapabilities?: string[];
  audioCapabilities?: string[];
  capabilities?: (
    | 'video-editing'
    | 'voiceover-motion'
    | 'scene-planning'
    | 'remotion-codegen'
  )[];
  taskStages?: Partial<
    Record<BrainTaskStageId, Partial<BrainStageProviderConfig>>
  >;
  rules?: Partial<BrainRulesConfig>;
  allowedSkillIds?: ElementCapabilityId[];
  allowedStyleIds?: StylePresetId[];
  allowNewComponentGeneration?: boolean;
  limits?: Partial<BrainModelLimitsConfig>;
}

async function getAdminHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_AUTHENTICATED');
  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

async function syncAuditLogToFirestore(auditLog?: AdminAuditLogEntry) {
  const user = auth.currentUser;
  if (!user || !auditLog) return;
  try {
    await setDoc(doc(db, 'admin_audit_logs', auditLog.id), {
      id: auditLog.id,
      actorUid: user.uid,
      actorEmail: (user.email || '').toLowerCase(),
      action: auditLog.action,
      targetEmail: auditLog.targetEmail,
      details: auditLog.details.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Server audit log is already authoritative
  }
}

export const adminService = {
  async fetchAdminOverview(): Promise<AdminOverviewResponse> {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/overview', {
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Admin access denied.');
    }
    return (await res.json()) as AdminOverviewResponse;
  },

  async verifySectionAccess(sectionId: AdminSectionId): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;
    const idToken = await user.getIdToken();

    const res = await fetch(`/api/admin/sections/${sectionId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return res.ok;
  },

  // ==========================================================================
  // Brain Models & Rules Management
  // ==========================================================================
  async fetchBrainModels(): Promise<BrainModelAdminRecord[]> {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/models', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to load Brain models.');
    }
    const data = (await res.json()) as {
      ok: boolean;
      models: BrainModelAdminRecord[];
    };
    return data.models ?? [];
  },

  async createBrainModel(params: {
    id: string;
    name: string;
    description?: string;
    descriptionAr?: string;
    enabled?: boolean;
    draftUpdates?: BrainModelDraftPayload;
  }): Promise<{
    model: BrainModelAdminRecord;
    models: BrainModelAdminRecord[];
  }> {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/admin/models', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create Brain model.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async cloneBrainModel(params: {
    sourceModelId: string;
    newId: string;
    newName: string;
  }): Promise<{
    model: BrainModelAdminRecord;
    models: BrainModelAdminRecord[];
  }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(params.sourceModelId)}/clone`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          newId: params.newId,
          newName: params.newName,
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to clone Brain model.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async saveBrainModelDraft(params: {
    modelId: string;
    updates: BrainModelDraftPayload;
  }): Promise<{
    model: BrainModelAdminRecord;
    models: BrainModelAdminRecord[];
  }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(params.modelId)}/draft`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ updates: params.updates }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to save draft settings/rules.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async publishBrainModelDraft(params: {
    modelId: string;
    changelog?: string;
  }): Promise<{
    model: BrainModelAdminRecord;
    models: BrainModelAdminRecord[];
  }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(params.modelId)}/publish`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ changelog: params.changelog }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to publish model version.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async rollbackBrainModelVersion(params: {
    modelId: string;
    targetModelVersion: number;
  }): Promise<{
    model: BrainModelAdminRecord;
    models: BrainModelAdminRecord[];
  }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(params.modelId)}/rollback`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetModelVersion: params.targetModelVersion,
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to rollback model version.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async setDefaultBrainModel(
    modelId: string
  ): Promise<{ models: BrainModelAdminRecord[] }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(modelId)}/default`,
      {
        method: 'POST',
        headers,
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to set default model.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async setBrainModelStatus(params: {
    modelId: string;
    enabled: boolean;
    replacementDefaultModelId?: string;
  }): Promise<{ models: BrainModelAdminRecord[] }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(params.modelId)}/status`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          enabled: params.enabled,
          replacementDefaultModelId: params.replacementDefaultModelId,
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to change model status.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async setBrainModelArchiveState(params: {
    modelId: string;
    archived: boolean;
    replacementDefaultModelId?: string;
  }): Promise<{ models: BrainModelAdminRecord[] }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(params.modelId)}/archive`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          archived: params.archived,
          replacementDefaultModelId: params.replacementDefaultModelId,
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to archive/restore model.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  async deleteBrainModel(
    modelId: string
  ): Promise<{ models: BrainModelAdminRecord[] }> {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `/api/admin/models/${encodeURIComponent(modelId)}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete model.');
    }
    await syncAuditLogToFirestore(data.auditLog);
    return data;
  },

  // ==========================================================================
  // Admin Access & RBAC Grants
  // ==========================================================================
  async upsertGrant(params: {
    email: string;
    permissions: {
      canEditRules: boolean;
      canPublishModels: boolean;
      canMonitorOperations: boolean;
      canManageAccess: boolean;
    };
  }): Promise<{ grant: AdminGrantEntry; auditLog: AdminAuditLogEntry }> {
    const user = auth.currentUser;
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const idToken = await user.getIdToken();

    // 1. Server-authoritative grant creation/update
    const res = await fetch('/api/admin/access/grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Grant operation rejected by server.');
    }

    const data = (await res.json()) as {
      grant: AdminGrantEntry;
      auditLog: AdminAuditLogEntry;
    };

    // 2. Sync to Firestore `/admin_invites/{inviteId}` and `/admin_audit_logs/{logId}`
    try {
      const inviteRef = doc(db, 'admin_invites', data.grant.id);
      const inviteSnap = await getDoc(inviteRef);
      if (!inviteSnap.exists()) {
        await setDoc(inviteRef, {
          inviteId: data.grant.id,
          email: data.grant.email,
          isPrimaryOwner: false,
          canEditRules: data.grant.canEditRules,
          canPublishModels: data.grant.canPublishModels,
          canMonitorOperations: data.grant.canMonitorOperations,
          canManageAccess: data.grant.canManageAccess,
          createdByUid: user.uid,
          createdByEmail: (user.email || '').toLowerCase(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(inviteRef, {
          canEditRules: data.grant.canEditRules,
          canPublishModels: data.grant.canPublishModels,
          canMonitorOperations: data.grant.canMonitorOperations,
          canManageAccess: data.grant.canManageAccess,
          updatedAt: serverTimestamp(),
        });
      }

      if (data.grant.boundUid) {
        const adminRef = doc(db, 'admins', data.grant.boundUid);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
          await updateDoc(adminRef, {
            canEditRules: data.grant.canEditRules,
            canPublishModels: data.grant.canPublishModels,
            canMonitorOperations: data.grant.canMonitorOperations,
            canManageAccess: data.grant.canManageAccess,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await syncAuditLogToFirestore(data.auditLog);
    } catch {
      // Server state is already authoritative
    }

    return data;
  },

  async revokeGrant(
    grantIdOrEmail: string
  ): Promise<{ revokedGrant: AdminGrantEntry; auditLog: AdminAuditLogEntry }> {
    const user = auth.currentUser;
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const idToken = await user.getIdToken();

    // 1. Server-authoritative revocation
    const res = await fetch(
      `/api/admin/access/${encodeURIComponent(grantIdOrEmail)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Revoke operation rejected by server.');
    }

    const data = (await res.json()) as {
      revokedGrant: AdminGrantEntry;
      auditLog: AdminAuditLogEntry;
    };

    try {
      await deleteDoc(doc(db, 'admin_invites', data.revokedGrant.id));
      if (data.revokedGrant.boundUid) {
        await deleteDoc(doc(db, 'admins', data.revokedGrant.boundUid));
      }
      await syncAuditLogToFirestore(data.auditLog);
    } catch {
      // Server state is already authoritative
    }

    return data;
  },
};
