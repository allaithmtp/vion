# VION — Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Verified Google Identity**: Every read/write requires `request.auth != null` and `request.auth.token.email_verified == true`.
2. **Strict Tenant Isolation**:
   - A `UserProfile` (`/users/{userId}`) can only be read, created, or updated by `request.auth.uid == userId`.
   - A `ProjectRecord` (`/projects/{projectId}`) must have `ownerUid == request.auth.uid` on creation, `ownerUid` is immutable on update, and only `resource.data.ownerUid == request.auth.uid` can read, list, update, or delete it.
   - `ProjectMessage` (`/projects/{projectId}/messages/{messageId}`) and `ProjectAsset` (`/projects/{projectId}/assets/{assetId}`) enforce the **Master Gate**: the parent `/projects/{projectId}` document must exist and have `ownerUid == request.auth.uid`, and `resource.data.ownerUid == request.auth.uid`.
3. **Zero Client Self-Privilege & Primary Owner Protection**:
   - The Primary Owner is `allaithmtp@gmail.com` (verified email + Google provider).
   - No client can self-assign admin roles unless they are the verified Primary Owner (`allaithmtp@gmail.com`) or an existing admin with `canManageAccess == true` in `/admins/$(request.auth.uid)`.
   - No admin can delete or revoke the Primary Owner's `/admins/{adminUid}` or `/admin_invites/{inviteId}` record (`existing().isPrimaryOwner == false` and `existing().email != 'allaithmtp@gmail.com'`).
4. **Immutable Audit Logs**:
   - `/admin_audit_logs/{logId}` allows `create` only by active admins (`actorUid == request.auth.uid`, `createdAt == request.time`), and strictly forbids `update` and `delete` (`allow update, delete: if false;`).

---

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Payload 1 (Identity Spoofing on Project Create)**: Authenticated user `uid_attacker` creates `/projects/proj_1` with `ownerUid: "uid_victim"`. -> `PERMISSION_DENIED`.
2. **Payload 2 (Cross-Tenant Project Read/List)**: Authenticated user `uid_attacker` attempts `get` or `list` on `/projects/proj_victim` where `ownerUid == "uid_victim"`. -> `PERMISSION_DENIED`.
3. **Payload 3 (Shadow Field Injection on Project Update)**: Owner updates `/projects/proj_1` with `{ name: "New", isAdmin: true }`. -> `PERMISSION_DENIED` via `hasOnly()`.
4. **Payload 4 (Owner Hijack on Project Update)**: Owner updates `/projects/proj_1` changing `ownerUid` from `uid_1` to `uid_2`. -> `PERMISSION_DENIED` (Immortal Field rule).
5. **Payload 5 (Forged Client Timestamp)**: User creates `/projects/proj_1` with a past/future `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`.
6. **Payload 6 (Orphaned / Cross-Project Message Write)**: User `uid_attacker` writes a message to `/projects/proj_victim/messages/msg_1` with `ownerUid: "uid_attacker"`. -> `PERMISSION_DENIED` via Master Gate `get(/projects/proj_victim).data.ownerId`.
7. **Payload 7 (Unverified Email Spoof of Primary Owner)**: Attacker with `email: "allaithmtp@gmail.com"` but `email_verified: false` attempts to bootstrap `/admins/uid_attacker`. -> `PERMISSION_DENIED`.
8. **Payload 8 (Self-Elevation to Admin)**: Regular user `evil@example.com` attempts to create `/admins/uid_evil` with `canManageAccess: true`. -> `PERMISSION_DENIED`.
9. **Payload 9 (Admin Without `canManageAccess` Inviting Another Admin)**: Admin who only has `canMonitorOperations: true` (`canManageAccess: false`) attempts to write to `/admin_invites/inv_1` or `/admins/uid_new`. -> `PERMISSION_DENIED`.
10. **Payload 10 (Deleting or Demoting Primary Owner)**: Secondary admin with `canManageAccess: true` attempts to `delete` or `update` (`isPrimaryOwner: false`) the Primary Owner document (`allaithmtp@gmail.com`). -> `PERMISSION_DENIED`.
11. **Payload 11 (Tampering with Admin Audit Logs)**: Admin attempts to `update` or `delete` `/admin_audit_logs/log_1`. -> `PERMISSION_DENIED`.
12. **Payload 12 (ID / Value Poisoning)**: User attempts to create a project with a 500-character `name` or invalid ID characters (`proj/../../hack`). -> `PERMISSION_DENIED`.
