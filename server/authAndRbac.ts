import fs from 'fs';
import path from 'path';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import type {
  AdminAuditLogEntry,
  AdminGrantEntry,
  AdminPermissions,
  AdminSectionId,
  VerifiedSessionInfo,
} from '../src/types/domain.ts';

export const PRIMARY_OWNER_EMAIL = 'allaithmtp@gmail.com';

if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const DATA_DIR = path.resolve(process.cwd(), '.server_data');
const RBAC_FILE = path.join(DATA_DIR, 'rbac_state.json');

interface ServerRbacState {
  /** Immutable UID bound when allaithmtp@gmail.com first authenticates via Google */
  primaryOwnerUid: string | null;
  grants: AdminGrantEntry[];
  auditLogs: AdminAuditLogEntry[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadRbacState(): ServerRbacState {
  ensureDataDir();
  if (!fs.existsSync(RBAC_FILE)) {
    return {
      primaryOwnerUid: null,
      grants: [],
      auditLogs: [],
    };
  }
  try {
    const raw = fs.readFileSync(RBAC_FILE, 'utf8');
    return JSON.parse(raw) as ServerRbacState;
  } catch {
    return {
      primaryOwnerUid: null,
      grants: [],
      auditLogs: [],
    };
  }
}

function saveRbacState(state: ServerRbacState): void {
  ensureDataDir();
  fs.writeFileSync(RBAC_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function appendServerAuditLog(
  state: ServerRbacState,
  params: {
    actorUid: string;
    actorEmail: string;
    action: string;
    targetEmail: string;
    details: string;
  }
): AdminAuditLogEntry {
  const entry: AdminAuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: params.action,
    targetEmail: params.targetEmail,
    details: params.details,
    createdAt: new Date().toISOString(),
  };
  state.auditLogs.unshift(entry);
  if (state.auditLogs.length > 500) {
    state.auditLogs = state.auditLogs.slice(0, 500);
  }
  return entry;
}

export function recordAdminAuditLog(params: {
  actorUid: string;
  actorEmail: string;
  action: string;
  targetEmail: string;
  details: string;
}): AdminAuditLogEntry {
  const state = loadRbacState();
  const entry = appendServerAuditLog(state, params);
  saveRbacState(state);
  return entry;
}

export function normalizeEmailToInviteId(email: string): string {
  return `inv_${email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 96)}`;
}

/**
 * Cryptographically verifies the Firebase ID token from Authorization header.
 */
export async function verifyBearerToken(
  authHeader?: string
): Promise<DecodedIdToken> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('MISSING_AUTH_TOKEN');
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new Error('EMPTY_AUTH_TOKEN');
  }
  return await getAuth().verifyIdToken(idToken, false);
}

/**
 * Resolves the caller's verified identity and server-authoritative admin permissions.
 * The client UI can never self-assign roles.
 */
export function resolveVerifiedSession(
  decoded: DecodedIdToken
): VerifiedSessionInfo {
  const uid = decoded.uid;
  const email = (decoded.email ?? '').trim().toLowerCase();
  const emailVerified = Boolean(decoded.email_verified);
  const signInProvider = decoded.firebase?.sign_in_provider ?? 'unknown';
  const isVerifiedGoogle =
    emailVerified && signInProvider === 'google.com' && email.length > 0;

  const state = loadRbacState();
  let stateModified = false;

  // 1. Primary Owner Bootstrap & Immutable UID Binding
  if (isVerifiedGoogle && email === PRIMARY_OWNER_EMAIL) {
    if (!state.primaryOwnerUid) {
      state.primaryOwnerUid = uid;
      stateModified = true;
      appendServerAuditLog(state, {
        actorUid: uid,
        actorEmail: email,
        action: 'PRIMARY_OWNER_BOOTSTRAPPED',
        targetEmail: email,
        details: `Bound primary owner (${PRIMARY_OWNER_EMAIL}) to immutable UID ${uid} via verified Google login.`,
      });
    }

    if (state.primaryOwnerUid === uid) {
      let ownerGrant = state.grants.find((g) => g.isPrimaryOwner);
      const now = new Date().toISOString();
      if (!ownerGrant) {
        ownerGrant = {
          id: `owner_${uid}`,
          email: PRIMARY_OWNER_EMAIL,
          boundUid: uid,
          isPrimaryOwner: true,
          canEditRules: true,
          canPublishModels: true,
          canMonitorOperations: true,
          canManageAccess: true,
          createdByUid: uid,
          createdByEmail: PRIMARY_OWNER_EMAIL,
          createdAt: now,
          updatedAt: now,
        };
        state.grants.unshift(ownerGrant);
        stateModified = true;
      } else if (ownerGrant.boundUid !== uid) {
        ownerGrant.boundUid = uid;
        ownerGrant.updatedAt = now;
        stateModified = true;
      }

      if (stateModified) {
        saveRbacState(state);
      }

      return {
        uid,
        email,
        emailVerified,
        signInProvider,
        isAdmin: true,
        permissions: {
          isPrimaryOwner: true,
          canEditRules: true,
          canPublishModels: true,
          canMonitorOperations: true,
          canManageAccess: true,
        },
      };
    }
  }

  // 2. Secondary Admin Lookup & Verified Google Email Invite Binding
  if (isVerifiedGoogle) {
    // Check if there is an active grant by UID or by verified email
    let grant = state.grants.find(
      (g) => !g.isPrimaryOwner && (g.boundUid === uid || g.email === email)
    );

    if (grant) {
      // Bind UID on first verified Google sign-in
      if (!grant.boundUid) {
        grant.boundUid = uid;
        grant.updatedAt = new Date().toISOString();
        appendServerAuditLog(state, {
          actorUid: uid,
          actorEmail: email,
          action: 'ADMIN_GRANT_BOUND_TO_UID',
          targetEmail: email,
          details: `Bound invited email ${email} to UID ${uid} on verified Google sign-in.`,
        });
        saveRbacState(state);
      } else if (grant.boundUid !== uid) {
        // Security check: if already bound to a different UID, deny
        grant = undefined;
      }

      if (grant) {
        const hasAnyPermission =
          grant.canEditRules ||
          grant.canPublishModels ||
          grant.canMonitorOperations ||
          grant.canManageAccess;

        if (hasAnyPermission) {
          return {
            uid,
            email,
            emailVerified,
            signInProvider,
            isAdmin: true,
            permissions: {
              isPrimaryOwner: false,
              canEditRules: grant.canEditRules,
              canPublishModels: grant.canPublishModels,
              canMonitorOperations: grant.canMonitorOperations,
              canManageAccess: grant.canManageAccess,
            },
            pendingInviteToClaim: {
              inviteId: grant.id,
              canEditRules: grant.canEditRules,
              canPublishModels: grant.canPublishModels,
              canMonitorOperations: grant.canMonitorOperations,
              canManageAccess: grant.canManageAccess,
            },
          };
        }
      }
    }
  }

  return {
    uid,
    email,
    emailVerified,
    signInProvider,
    isAdmin: false,
    permissions: {
      isPrimaryOwner: false,
      canEditRules: false,
      canPublishModels: false,
      canMonitorOperations: false,
      canManageAccess: false,
    },
  };
}

/**
 * Checks whether an admin has permission for a specific Admin Panel section.
 */
export function canAccessAdminSection(
  perms: AdminPermissions,
  section: AdminSectionId
): boolean {
  if (perms.isPrimaryOwner) return true;
  switch (section) {
    case 'models':
      return perms.canPublishModels;
    case 'rules':
    case 'skills':
    case 'styles':
    case 'references':
      return perms.canEditRules;
    case 'jobs':
    case 'usage':
      return perms.canMonitorOperations;
    case 'access':
      return perms.canManageAccess;
    default:
      return false;
  }
}

export function getAdminOverviewData() {
  const state = loadRbacState();
  return {
    primaryOwnerEmail: PRIMARY_OWNER_EMAIL,
    primaryOwnerUid: state.primaryOwnerUid,
    grants: state.grants,
    auditLogs: state.auditLogs,
  };
}

export function upsertAdminGrantOnServer(params: {
  actorSession: VerifiedSessionInfo;
  targetEmail: string;
  permissions: {
    canEditRules: boolean;
    canPublishModels: boolean;
    canMonitorOperations: boolean;
    canManageAccess: boolean;
  };
}): { grant: AdminGrantEntry; auditLog: AdminAuditLogEntry } {
  if (!params.actorSession.permissions.canManageAccess) {
    throw new Error('FORBIDDEN_NO_MANAGE_ACCESS');
  }

  const normalizedEmail = params.targetEmail.trim().toLowerCase();
  if (
    !normalizedEmail ||
    !normalizedEmail.includes('@') ||
    normalizedEmail.length > 254
  ) {
    throw new Error('INVALID_EMAIL');
  }

  if (normalizedEmail === PRIMARY_OWNER_EMAIL) {
    throw new Error('CANNOT_MODIFY_PRIMARY_OWNER');
  }

  const state = loadRbacState();
  const now = new Date().toISOString();
  const inviteId = normalizeEmailToInviteId(normalizedEmail);

  let existing = state.grants.find(
    (g) => !g.isPrimaryOwner && g.email === normalizedEmail
  );

  if (existing) {
    existing.canEditRules = Boolean(params.permissions.canEditRules);
    existing.canPublishModels = Boolean(params.permissions.canPublishModels);
    existing.canMonitorOperations = Boolean(
      params.permissions.canMonitorOperations
    );
    existing.canManageAccess = Boolean(params.permissions.canManageAccess);
    existing.updatedAt = now;

    const auditLog = appendServerAuditLog(state, {
      actorUid: params.actorSession.uid,
      actorEmail: params.actorSession.email,
      action: 'ADMIN_PERMISSIONS_UPDATED',
      targetEmail: normalizedEmail,
      details: `Updated permissions for ${normalizedEmail}: editRules=${existing.canEditRules}, publishModels=${existing.canPublishModels}, monitorOps=${existing.canMonitorOperations}, manageAccess=${existing.canManageAccess}`,
    });
    saveRbacState(state);
    return { grant: existing, auditLog };
  }

  const newGrant: AdminGrantEntry = {
    id: inviteId,
    email: normalizedEmail,
    isPrimaryOwner: false,
    canEditRules: Boolean(params.permissions.canEditRules),
    canPublishModels: Boolean(params.permissions.canPublishModels),
    canMonitorOperations: Boolean(params.permissions.canMonitorOperations),
    canManageAccess: Boolean(params.permissions.canManageAccess),
    createdByUid: params.actorSession.uid,
    createdByEmail: params.actorSession.email,
    createdAt: now,
    updatedAt: now,
  };

  state.grants.push(newGrant);
  const auditLog = appendServerAuditLog(state, {
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'ADMIN_GRANT_CREATED',
    targetEmail: normalizedEmail,
    details: `Granted admin permissions to ${normalizedEmail}: editRules=${newGrant.canEditRules}, publishModels=${newGrant.canPublishModels}, monitorOps=${newGrant.canMonitorOperations}, manageAccess=${newGrant.canManageAccess}`,
  });

  saveRbacState(state);
  return { grant: newGrant, auditLog };
}

export function revokeAdminGrantOnServer(params: {
  actorSession: VerifiedSessionInfo;
  grantIdOrEmail: string;
}): { revokedGrant: AdminGrantEntry; auditLog: AdminAuditLogEntry } {
  if (!params.actorSession.permissions.canManageAccess) {
    throw new Error('FORBIDDEN_NO_MANAGE_ACCESS');
  }

  const state = loadRbacState();
  const target = state.grants.find(
    (g) =>
      g.id === params.grantIdOrEmail ||
      g.email === params.grantIdOrEmail.toLowerCase() ||
      g.boundUid === params.grantIdOrEmail
  );

  if (!target) {
    throw new Error('GRANT_NOT_FOUND');
  }

  if (target.isPrimaryOwner || target.email === PRIMARY_OWNER_EMAIL) {
    throw new Error('CANNOT_REVOKE_PRIMARY_OWNER');
  }

  state.grants = state.grants.filter((g) => g.id !== target.id);
  const auditLog = appendServerAuditLog(state, {
    actorUid: params.actorSession.uid,
    actorEmail: params.actorSession.email,
    action: 'ADMIN_ACCESS_REVOKED',
    targetEmail: target.email,
    details: `Revoked all admin permissions for ${target.email} (boundUid=${target.boundUid ?? 'pending'}).`,
  });

  saveRbacState(state);
  return { revokedGrant: target, auditLog };
}
