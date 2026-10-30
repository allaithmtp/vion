/**
 * VION — Firestore Rules Verification Suite (Dirty Dozen Adversarial Tests)
 * Verifies all 12 Dirty Dozen payloads defined in security_spec.md return PERMISSION_DENIED.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRuleGate: string;
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Project Create',
    collection: '/projects/{projectId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isValidProjectRecord(incoming()) && incoming().ownerUid == request.auth.uid',
  },
  {
    id: 2,
    name: 'Cross-Tenant Project Read/List',
    collection: '/projects/{projectId}',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isSignedIn() && existing().ownerUid == request.auth.uid',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Project Update',
    collection: '/projects/{projectId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().diff(existing()).affectedKeys().hasOnly([...])',
  },
  {
    id: 4,
    name: 'Owner Hijack on Project Update',
    collection: '/projects/{projectId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().ownerUid == existing().ownerUid',
  },
  {
    id: 5,
    name: 'Forged Client Timestamp',
    collection: '/projects/{projectId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 6,
    name: 'Orphaned / Cross-Project Message Write',
    collection: '/projects/{projectId}/messages/{messageId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'exists(/projects/$(projectId)) && get(/projects/$(projectId)).data.ownerUid == request.auth.uid',
  },
  {
    id: 7,
    name: 'Unverified Email Spoof of Primary Owner',
    collection: '/admins/{adminUid}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider == "google.com"',
  },
  {
    id: 8,
    name: 'Self-Elevation to Admin',
    collection: '/admins/{adminUid}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isPrimaryOwnerEmail() || canManageAccess()',
  },
  {
    id: 9,
    name: 'Admin Without canManageAccess Inviting Another Admin',
    collection: '/admin_invites/{inviteId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'canManageAccess()',
  },
  {
    id: 10,
    name: 'Deleting or Demoting Primary Owner',
    collection: '/admins/{adminUid}',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'existing().isPrimaryOwner == false && existing().email != "allaithmtp@gmail.com"',
  },
  {
    id: 11,
    name: 'Tampering with Admin Audit Logs',
    collection: '/admin_audit_logs/{logId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'allow update, delete: if false;',
  },
  {
    id: 12,
    name: 'ID / Value Poisoning',
    collection: '/projects/{projectId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isValidId(projectId) && data.name.size() <= 160',
  },
];
