import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  canAccessAdminSection,
  getAdminOverviewData,
  resolveVerifiedSession,
  revokeAdminGrantOnServer,
  upsertAdminGrantOnServer,
  verifyBearerToken,
} from './server/authAndRbac.ts';
import {
  type BrainModelDraftUpdateInput,
  capturePublishedModelSnapshotForNewTask,
  cloneBrainModelOnServer,
  createBrainModelOnServer,
  deleteBrainModelOnServer,
  getDefaultEnabledBrainModel,
  getPublicBrainModels,
  getPublicStylePresets,
  getSystemCapabilitiesStatus,
  listAdminBrainModels,
  publishBrainModelDraftOnServer,
  recordModelHistoricalUsage,
  rollbackBrainModelVersionOnServer,
  saveBrainModelDraftOnServer,
  setBrainModelArchiveStateOnServer,
  setBrainModelStatusOnServer,
  setDefaultBrainModelOnServer,
} from './server/brainRegistry.ts';
import {
  getServerMediaLimits,
  updateServerMediaLimits,
} from './server/mediaWorker.ts';
import {
  appendResumableUploadChunk,
  buildSignedDerivedUrls,
  cancelResumableUploadSession,
  cleanupIncompleteUploadsAndTempFiles,
  deletePrivateUserAsset,
  executeTrackableProjectDeletion,
  finalizeAndProcessResumableUpload,
  getAuthorizedPrivateAsset,
  getProjectDeletionJobsForUser,
  getResumableUploadSessionStatus,
  initOrResumeUploadSession,
  resolveVariantDiskPathAndMime,
  type StreamVariant,
  verifyAndRegisterProjectOwnership,
  verifySignedStreamToken,
} from './server/privateStorage.ts';
import {
  createVerifiedTestEditPlanOnServer,
  enqueueBackgroundRemotionRenderJob,
  getRenderJobStatusForUser,
  listProjectRenderJobsForUser,
  resolveAuthorizedRenderedMp4File,
} from './server/remotionWorker.ts';
import { validateUnifiedEditPlan } from './src/remotion/editPlanSchema.ts';
import type { AdminSectionId, AssetKind } from './src/types/domain.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function requireAuthenticatedSession(req: Request, res: Response) {
  try {
    const decoded = await verifyBearerToken(req.headers.authorization);
    if (!decoded.email_verified) {
      res.status(403).json({
        ok: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'A verified Google account email is required.',
      });
      return null;
    }
    return resolveVerifiedSession(decoded);
  } catch (err) {
    res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      message:
        err instanceof Error ? err.message : 'Invalid authentication token.',
    });
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Periodic background sweeper for abandoned/expired incomplete uploads
  cleanupIncompleteUploadsAndTempFiles({ maxIdleMinutes: 60 });
  setInterval(
    () => {
      try {
        cleanupIncompleteUploadsAndTempFiles({ maxIdleMinutes: 60 });
      } catch {
        // Ignore background sweeper errors
      }
    },
    1000 * 60 * 15
  );

  // Raw binary body parser exclusively for resumable upload chunks
  app.use(
    '/api/storage/resumable/session/:uploadId',
    (req, res, next) => {
      if (req.method === 'PATCH') {
        express.raw({ type: '*/*', limit: '12mb' })(req, res, next);
      } else {
        next();
      }
    }
  );

  app.use(express.json({ limit: '2mb' }));

  // ==========================================================================
  // 1. Public Health, Catalog & Server Media Limits
  // ==========================================================================
  app.get('/api/health', (_req, res) => {
    res.json(getSystemCapabilitiesStatus());
  });

  app.get('/api/catalog', (_req, res) => {
    res.json({
      engine: 'Brain',
      defaultModelId: getDefaultEnabledBrainModel().id,
      models: getPublicBrainModels(),
      styles: getPublicStylePresets(),
      capabilities: getSystemCapabilitiesStatus(),
    });
  });

  app.get('/api/media/limits', (_req, res) => {
    res.json({
      ok: true,
      limits: getServerMediaLimits(),
    });
  });

  // ==========================================================================
  // 2. Server-Side Auth Verification & Primary Owner / Invite Binding
  // ==========================================================================
  app.post('/api/auth/verify-session', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    res.json({
      ok: true,
      session,
    });
  });

  // ==========================================================================
  // 3. Server-Verified Project Ownership Guard & Trackable Project Deletion
  // ==========================================================================
  app.post('/api/projects/verify-write', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const { projectId, ownerUid, operation, selectedModelId } = req.body as {
      projectId?: string;
      ownerUid?: string;
      operation?: string;
      selectedModelId?: string;
    };

    if (!projectId || !ownerUid) {
      res.status(400).json({
        ok: false,
        code: 'MISSING_PARAMETERS',
        message: 'projectId and ownerUid are required.',
      });
      return;
    }

    try {
      verifyAndRegisterProjectOwnership({
        projectId,
        callerUid: session.uid,
        claimedOwnerUid: ownerUid,
      });

      if (selectedModelId) {
        recordModelHistoricalUsage({
          modelId: selectedModelId,
          projectId,
        });
      }

      // If this write is a new processing/message request, verify the project's model is currently enabled
      let modelSnapshot = undefined;
      if (operation === 'append-message' && selectedModelId) {
        modelSnapshot = capturePublishedModelSnapshotForNewTask({
          modelId: selectedModelId,
          projectId,
        });
      }

      res.json({
        ok: true,
        verifiedUid: session.uid,
        projectId,
        operation: operation ?? 'write',
        modelSnapshot,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Ownership verification failed.';
      const isModelDisabled = msg.startsWith('MODEL_DISABLED_SELECT_REPLACEMENT');
      res.status(isModelDisabled ? 422 : 403).json({
        ok: false,
        code: isModelDisabled
          ? 'MODEL_DISABLED_SELECT_REPLACEMENT'
          : 'FORBIDDEN_PROJECT_OWNERSHIP',
        message: msg,
      });
    }
  });

  app.delete('/api/projects/:projectId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    try {
      const deletionJob = executeTrackableProjectDeletion(
        req.params.projectId,
        session.uid
      );
      res.json({
        ok: true,
        deletedProjectId: req.params.projectId,
        deletionJob,
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_PROJECT_DELETE',
        message:
          err instanceof Error ? err.message : 'Delete verification failed.',
      });
    }
  });

  app.get('/api/projects/deletion-jobs', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    res.json({
      ok: true,
      jobs: getProjectDeletionJobsForUser(session.uid),
    });
  });

  // ==========================================================================
  // 4. Direct Resumable Private Storage & FFprobe/FFmpeg Media Pipeline
  // ==========================================================================

  /**
   * 4a. Initialize or resume a direct chunked upload session
   */
  app.post('/api/storage/resumable/init', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const {
      projectId,
      fileName,
      mimeType,
      kind,
      totalBytes,
      fileFingerprint,
      existingUploadId,
    } = req.body as {
      projectId?: string;
      fileName?: string;
      mimeType?: string;
      kind?: AssetKind;
      totalBytes?: number;
      fileFingerprint?: string;
      existingUploadId?: string;
    };

    if (!projectId || !fileName || typeof totalBytes !== 'number') {
      res.status(400).json({
        ok: false,
        code: 'INVALID_RESUMABLE_INIT',
        message: 'projectId, fileName, and totalBytes are required.',
      });
      return;
    }

    try {
      const uploadSession = initOrResumeUploadSession({
        callerUid: session.uid,
        projectId,
        fileName,
        mimeType: mimeType || 'application/octet-stream',
        kind: kind || 'raw-video',
        totalBytes,
        fileFingerprint,
        existingUploadId,
      });

      res.json({
        ok: true,
        session: {
          uploadId: uploadSession.uploadId,
          assetId: uploadSession.assetId,
          projectId: uploadSession.projectId,
          uploadedBytes: uploadSession.uploadedBytes,
          totalBytes: uploadSession.totalBytes,
          chunkSizeBytes: uploadSession.chunkSizeBytes,
          status: uploadSession.status,
          expiresAt: uploadSession.expiresAt,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize upload.';
      const status = msg.startsWith('FILE_SIZE_LIMIT_EXCEEDED') ? 413 : 400;
      res.status(status).json({
        ok: false,
        code: msg.startsWith('FILE_SIZE_LIMIT_EXCEEDED')
          ? 'FILE_SIZE_LIMIT_EXCEEDED'
          : 'RESUMABLE_INIT_REJECTED',
        message: msg,
      });
    }
  });

  /**
   * 4b. Query exact byte offset for resuming an interrupted upload
   */
  app.get('/api/storage/resumable/session/:uploadId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    try {
      const uploadSession = getResumableUploadSessionStatus({
        callerUid: session.uid,
        uploadId: req.params.uploadId,
      });
      res.setHeader('Upload-Offset', String(uploadSession.uploadedBytes));
      res.setHeader('Upload-Length', String(uploadSession.totalBytes));
      res.json({
        ok: true,
        session: {
          uploadId: uploadSession.uploadId,
          assetId: uploadSession.assetId,
          projectId: uploadSession.projectId,
          uploadedBytes: uploadSession.uploadedBytes,
          totalBytes: uploadSession.totalBytes,
          chunkSizeBytes: uploadSession.chunkSizeBytes,
          status: uploadSession.status,
          expiresAt: uploadSession.expiresAt,
        },
      });
    } catch (err) {
      res.status(404).json({
        ok: false,
        code: 'UPLOAD_SESSION_NOT_FOUND',
        message: err instanceof Error ? err.message : 'Session not found.',
      });
    }
  });

  /**
   * 4c. Append a binary chunk at `x-upload-offset`
   */
  app.patch('/api/storage/resumable/session/:uploadId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const offsetHeader = req.headers['x-upload-offset'];
    const offset = Number(offsetHeader);

    if (!Number.isFinite(offset) || offset < 0 || !Buffer.isBuffer(req.body)) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_CHUNK_PAYLOAD',
        message: 'Valid x-upload-offset header and binary body are required.',
      });
      return;
    }

    try {
      const updated = appendResumableUploadChunk({
        callerUid: session.uid,
        uploadId: req.params.uploadId,
        offset,
        chunk: req.body,
      });
      res.setHeader('Upload-Offset', String(updated.uploadedBytes));
      res.json({
        ok: true,
        uploadId: updated.uploadId,
        uploadedBytes: updated.uploadedBytes,
        totalBytes: updated.totalBytes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chunk upload failed.';
      const isOffsetMismatch = msg.startsWith('OFFSET_MISMATCH');
      res.status(isOffsetMismatch ? 409 : 400).json({
        ok: false,
        code: isOffsetMismatch ? 'OFFSET_MISMATCH' : 'CHUNK_WRITE_FAILED',
        message: msg,
      });
    }
  });

  /**
   * 4d. Cancel an active upload and remove its incomplete `.part` file
   */
  app.delete('/api/storage/resumable/session/:uploadId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    try {
      const result = cancelResumableUploadSession({
        callerUid: session.uid,
        uploadId: req.params.uploadId,
      });
      res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      res.status(404).json({
        ok: false,
        code: 'CANCEL_UPLOAD_FAILED',
        message: err instanceof Error ? err.message : 'Cancel failed.',
      });
    }
  });

  /**
   * 4e. Finalize upload -> Run FFprobe Content Validation + FFmpeg Worker Derivatives
   */
  app.post(
    '/api/storage/resumable/session/:uploadId/finalize',
    async (req, res) => {
      const session = await requireAuthenticatedSession(req, res);
      if (!session) return;

      try {
        const result = await finalizeAndProcessResumableUpload({
          callerUid: session.uid,
          uploadId: req.params.uploadId,
        });

        res.json({
          ok: true,
          asset: {
            id: result.asset.assetId,
            projectId: result.asset.projectId,
            ownerUid: result.asset.ownerUid,
            kind: result.asset.kind,
            fileName: result.asset.fileName,
            storagePath: `/api/storage/files/${result.asset.projectId}/${result.asset.assetId}`,
            processingState: result.asset.processingState,
            warnings: result.asset.warnings,
            timingLink: result.asset.timingLink,
            derivedFiles: result.derivedFiles,
            metadata: result.asset.metadata,
            createdAt: result.asset.createdAt,
            updatedAt: result.asset.updatedAt,
          },
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Media processing failed.';
        const code =
          (err as { code?: string })?.code ||
          (msg.includes(':') ? msg.split(':')[0] : 'MEDIA_PROCESSING_FAILED');
        res.status(422).json({
          ok: false,
          code,
          message: msg,
        });
      }
    }
  );

  /**
   * 4f. Issue or Renew Temporary Signed URLs for Viewing & Processing
   */
  app.post('/api/storage/stream-token', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const { projectId, assetId } = req.body as {
      projectId?: string;
      assetId?: string;
    };

    if (!projectId || !assetId) {
      res.status(400).json({ ok: false, code: 'MISSING_PARAMS' });
      return;
    }

    try {
      const entry = getAuthorizedPrivateAsset({
        callerUid: session.uid,
        projectId,
        assetId,
      });
      const derivedFiles = buildSignedDerivedUrls(entry);
      res.json({
        ok: true,
        authenticatedStreamUrl:
          derivedFiles.previewSignedUrl ?? derivedFiles.originalSignedUrl,
        derivedFiles,
        processingState: entry.processingState,
        warnings: entry.warnings,
        timingLink: entry.timingLink,
        metadata: entry.metadata,
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_STREAM_TOKEN',
        message: err instanceof Error ? err.message : 'Access denied.',
      });
    }
  });

  app.post('/api/storage/renew-urls', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const { projectId, assetIds } = req.body as {
      projectId?: string;
      assetIds?: string[];
    };

    if (!projectId || !Array.isArray(assetIds)) {
      res.status(400).json({ ok: false, code: 'MISSING_PARAMS' });
      return;
    }

    const renewed: Record<string, ReturnType<typeof buildSignedDerivedUrls>> =
      {};
    for (const assetId of assetIds) {
      try {
        const entry = getAuthorizedPrivateAsset({
          callerUid: session.uid,
          projectId,
          assetId,
        });
        renewed[assetId] = buildSignedDerivedUrls(entry);
      } catch {
        // Skip assets not found on disk
      }
    }

    res.json({
      ok: true,
      renewed,
    });
  });

  /**
   * 4g. Cleanup Incomplete Uploads & Temp Files Endpoint
   */
  app.post('/api/storage/cleanup-expired', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const maxIdleMinutes =
      typeof req.body?.maxIdleMinutes === 'number'
        ? req.body.maxIdleMinutes
        : 60;
    const stats = cleanupIncompleteUploadsAndTempFiles({ maxIdleMinutes });
    res.json({
      ok: true,
      ...stats,
    });
  });

  /**
   * 4h. Private Streaming Route with Variant Selection (`original` | `preview` | `thumbnail`) & Range Support
   */
  app.get('/api/storage/files/:projectId/:assetId', async (req, res) => {
    const { projectId, assetId } = req.params;
    let verifiedUid: string | null = null;
    let resolvedVariant: StreamVariant =
      req.query.variant === 'preview' || req.query.variant === 'thumbnail'
        ? req.query.variant
        : 'original';

    if (typeof req.query.st === 'string' && req.query.st.length > 0) {
      const tokenCheck = verifySignedStreamToken(
        req.query.st,
        projectId,
        assetId
      );
      if (tokenCheck) {
        verifiedUid = tokenCheck.ownerUid;
        resolvedVariant = tokenCheck.variant;
      }
    } else if (req.headers.authorization) {
      try {
        const decoded = await verifyBearerToken(req.headers.authorization);
        if (decoded.email_verified) {
          verifiedUid = decoded.uid;
        }
      } catch {
        verifiedUid = null;
      }
    }

    if (!verifiedUid) {
      res.status(401).json({
        ok: false,
        code: 'UNAUTHORIZED_FILE_ACCESS',
        message:
          'Valid authentication or temporary signed token is required to access private user files.',
      });
      return;
    }

    try {
      const asset = getAuthorizedPrivateAsset({
        callerUid: verifiedUid,
        projectId,
        assetId,
      });

      const target = resolveVariantDiskPathAndMime(asset, resolvedVariant);
      const stat = fs.statSync(target.diskPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Content-Type', target.mimeType);
      res.setHeader('Cache-Control', 'private, no-store');

      if (range && target.mimeType !== 'image/jpeg') {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(target.diskPath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(target.diskPath).pipe(res);
      }
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_PRIVATE_ASSET',
        message: err instanceof Error ? err.message : 'Forbidden.',
      });
    }
  });

  app.delete('/api/storage/files/:projectId/:assetId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    try {
      deletePrivateUserAsset({
        callerUid: session.uid,
        projectId: req.params.projectId,
        assetId: req.params.assetId,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_DELETE_ASSET',
        message: err instanceof Error ? err.message : 'Forbidden.',
      });
    }
  });

  // ==========================================================================
  // 5. Server-Protected Admin Panel Routes & Media Limits Governance
  // ==========================================================================
  app.get('/api/admin/overview', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    if (!session.isAdmin) {
      res.status(403).json({
        ok: false,
        code: 'ADMIN_ACCESS_DENIED',
        message: 'You are not authorized to access the VION Admin Panel.',
      });
      return;
    }

    const overview = getAdminOverviewData();
    const canViewModelsOrRules =
      session.permissions.isPrimaryOwner ||
      session.permissions.canPublishModels ||
      session.permissions.canEditRules;

    res.json({
      ok: true,
      session,
      primaryOwnerEmail: overview.primaryOwnerEmail,
      primaryOwnerUid: overview.primaryOwnerUid,
      mediaLimits: getServerMediaLimits(),
      brainModels: canViewModelsOrRules ? listAdminBrainModels() : [],
      grants: session.permissions.canManageAccess ? overview.grants : [],
      auditLogs:
        session.permissions.canManageAccess ||
        session.permissions.canMonitorOperations ||
        canViewModelsOrRules
          ? overview.auditLogs
          : [],
    });
  });

  // ==========================================================================
  // 5b. Brain Models & Rules Management Routes (Server-Protected)
  // ==========================================================================
  app.get('/api/admin/models', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (
      !session.isAdmin ||
      (!session.permissions.isPrimaryOwner &&
        !session.permissions.canPublishModels &&
        !session.permissions.canEditRules)
    ) {
      res.status(403).json({
        ok: false,
        code: 'MODELS_PERMISSION_DENIED',
        message: 'Models or Rules permission is required.',
      });
      return;
    }

    res.json({
      ok: true,
      models: listAdminBrainModels(),
    });
  });

  app.post('/api/admin/models', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    const { id, name, description, descriptionAr, enabled, draftUpdates } =
      req.body as {
        id?: string;
        name?: string;
        description?: string;
        descriptionAr?: string;
        enabled?: boolean;
        draftUpdates?: BrainModelDraftUpdateInput;
      };

    if (!id || !name) {
      res.status(400).json({
        ok: false,
        code: 'MISSING_MODEL_FIELDS',
        message: 'Model id and name are required.',
      });
      return;
    }

    try {
      const result = createBrainModelOnServer({
        actorSession: session,
        id,
        name,
        description,
        descriptionAr,
        enabled,
        draftUpdates,
      });
      res.status(201).json({
        ok: true,
        model: result.model,
        models: listAdminBrainModels(),
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'CREATE_MODEL_FAILED',
        message: err instanceof Error ? err.message : 'Failed to create model.',
      });
    }
  });

  app.post('/api/admin/models/:modelId/clone', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    const { newId, newName } = req.body as {
      newId?: string;
      newName?: string;
    };

    if (!newId || !newName) {
      res.status(400).json({
        ok: false,
        code: 'MISSING_CLONE_FIELDS',
        message: 'newId and newName are required to clone a model.',
      });
      return;
    }

    try {
      const result = cloneBrainModelOnServer({
        actorSession: session,
        sourceModelId: req.params.modelId,
        newId,
        newName,
      });
      res.status(201).json({
        ok: true,
        model: result.model,
        models: listAdminBrainModels(),
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'CLONE_MODEL_FAILED',
        message: err instanceof Error ? err.message : 'Failed to clone model.',
      });
    }
  });

  app.put('/api/admin/models/:modelId/draft', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    try {
      const result = saveBrainModelDraftOnServer({
        actorSession: session,
        modelId: req.params.modelId,
        updates: (req.body?.updates ?? req.body) as BrainModelDraftUpdateInput,
      });
      res.json({
        ok: true,
        model: result.model,
        models: listAdminBrainModels(),
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'SAVE_DRAFT_FAILED',
        message: err instanceof Error ? err.message : 'Failed to save draft.',
      });
    }
  });

  app.post('/api/admin/models/:modelId/publish', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    try {
      const result = publishBrainModelDraftOnServer({
        actorSession: session,
        modelId: req.params.modelId,
        changelog: req.body?.changelog,
      });
      res.json({
        ok: true,
        model: result.model,
        models: listAdminBrainModels(),
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'PUBLISH_MODEL_FAILED',
        message: err instanceof Error ? err.message : 'Failed to publish version.',
      });
    }
  });

  app.post('/api/admin/models/:modelId/rollback', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    const targetModelVersion = Number(req.body?.targetModelVersion);
    if (!Number.isFinite(targetModelVersion) || targetModelVersion < 1) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_TARGET_VERSION',
        message: 'A valid targetModelVersion is required.',
      });
      return;
    }

    try {
      const result = rollbackBrainModelVersionOnServer({
        actorSession: session,
        modelId: req.params.modelId,
        targetModelVersion,
      });
      res.json({
        ok: true,
        model: result.model,
        models: listAdminBrainModels(),
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'ROLLBACK_MODEL_FAILED',
        message: err instanceof Error ? err.message : 'Rollback failed.',
      });
    }
  });

  app.post('/api/admin/models/:modelId/default', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    try {
      const result = setDefaultBrainModelOnServer({
        actorSession: session,
        modelId: req.params.modelId,
      });
      res.json({
        ok: true,
        models: result.models,
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'SET_DEFAULT_FAILED',
        message: err instanceof Error ? err.message : 'Failed to set default model.',
      });
    }
  });

  app.post('/api/admin/models/:modelId/status', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    const { enabled, replacementDefaultModelId } = req.body as {
      enabled?: boolean;
      replacementDefaultModelId?: string;
    };

    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        ok: false,
        code: 'MISSING_ENABLED_FLAG',
        message: 'enabled boolean is required.',
      });
      return;
    }

    try {
      const result = setBrainModelStatusOnServer({
        actorSession: session,
        modelId: req.params.modelId,
        enabled,
        replacementDefaultModelId,
      });
      res.json({
        ok: true,
        models: result.models,
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'MODEL_STATUS_CHANGE_REJECTED',
        message: err instanceof Error ? err.message : 'Failed to change model status.',
      });
    }
  });

  app.post('/api/admin/models/:modelId/archive', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    const { archived, replacementDefaultModelId } = req.body as {
      archived?: boolean;
      replacementDefaultModelId?: string;
    };

    try {
      const result = setBrainModelArchiveStateOnServer({
        actorSession: session,
        modelId: req.params.modelId,
        archived: typeof archived === 'boolean' ? archived : true,
        replacementDefaultModelId,
      });
      res.json({
        ok: true,
        models: result.models,
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'ARCHIVE_MODEL_REJECTED',
        message: err instanceof Error ? err.message : 'Failed to archive model.',
      });
    }
  });

  app.delete('/api/admin/models/:modelId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      return;
    }

    try {
      const result = deleteBrainModelOnServer({
        actorSession: session,
        modelId: req.params.modelId,
      });
      res.json({
        ok: true,
        models: result.models,
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'DELETE_MODEL_REJECTED',
        message: err instanceof Error ? err.message : 'Cannot delete model.',
      });
    }
  });

  app.patch('/api/admin/media-limits', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    if (!session.isAdmin || !session.permissions.canEditRules) {
      res.status(403).json({
        ok: false,
        code: 'EDIT_RULES_PERMISSION_REQUIRED',
        message: 'Edit Rules permission is required to adjust server media limits.',
      });
      return;
    }

    const { maxFileSizeBytes, maxDurationSeconds, signedUrlTtlSeconds } =
      req.body as {
        maxFileSizeBytes?: number;
        maxDurationSeconds?: number;
        signedUrlTtlSeconds?: number;
      };

    const updated = updateServerMediaLimits({
      maxFileSizeBytes,
      maxDurationSeconds,
      signedUrlTtlSeconds,
    });

    res.json({
      ok: true,
      limits: updated,
    });
  });

  app.get('/api/admin/sections/:sectionId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const sectionId = req.params.sectionId as AdminSectionId;
    if (
      !session.isAdmin ||
      !canAccessAdminSection(session.permissions, sectionId)
    ) {
      res.status(403).json({
        ok: false,
        code: 'SECTION_PERMISSION_DENIED',
        message: `Your account does not have the required permission for section "${sectionId}".`,
      });
      return;
    }

    res.json({
      ok: true,
      sectionId,
      authorizedByUid: session.uid,
      status: 'structure-ready-for-upcoming-phase',
      verifiedAt: new Date().toISOString(),
    });
  });

  app.post('/api/admin/access/grant', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    if (!session.isAdmin || !session.permissions.canManageAccess) {
      res.status(403).json({
        ok: false,
        code: 'MANAGE_ACCESS_PERMISSION_REQUIRED',
        message:
          'Manage Access permission is required to grant or modify roles.',
      });
      return;
    }

    const { email, permissions } = req.body as {
      email?: string;
      permissions?: {
        canEditRules?: boolean;
        canPublishModels?: boolean;
        canMonitorOperations?: boolean;
        canManageAccess?: boolean;
      };
    };

    if (!email || !permissions) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_GRANT_PAYLOAD',
        message: 'Email and permissions object are required.',
      });
      return;
    }

    try {
      const result = upsertAdminGrantOnServer({
        actorSession: session,
        targetEmail: email,
        permissions: {
          canEditRules: Boolean(permissions.canEditRules),
          canPublishModels: Boolean(permissions.canPublishModels),
          canMonitorOperations: Boolean(permissions.canMonitorOperations),
          canManageAccess: Boolean(permissions.canManageAccess),
        },
      });
      res.json({
        ok: true,
        grant: result.grant,
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'GRANT_OPERATION_REJECTED',
        message: err instanceof Error ? err.message : 'Operation rejected.',
      });
    }
  });

  app.delete('/api/admin/access/:targetId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    if (!session.isAdmin || !session.permissions.canManageAccess) {
      res.status(403).json({
        ok: false,
        code: 'MANAGE_ACCESS_PERMISSION_REQUIRED',
        message: 'Manage Access permission is required to revoke roles.',
      });
      return;
    }

    try {
      const result = revokeAdminGrantOnServer({
        actorSession: session,
        grantIdOrEmail: decodeURIComponent(req.params.targetId),
      });
      res.json({
        ok: true,
        revokedGrant: result.revokedGrant,
        auditLog: result.auditLog,
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'REVOKE_OPERATION_REJECTED',
        message: err instanceof Error ? err.message : 'Revoke rejected.',
      });
    }
  });

  // ==========================================================================
  // 6. Remotion EditPlan Schema Validation & Background Render Worker Pipeline
  // ==========================================================================

  /**
   * 6a. Server-side validation of a versioned `UnifiedEditPlan` payload (`schemaVersion: '1.0.0'`)
   */
  app.post('/api/remotion/plan/validate', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const validation = validateUnifiedEditPlan(req.body?.plan ?? req.body);
    if (!validation.valid || !validation.plan) {
      res.status(422).json({
        ok: false,
        code: 'INVALID_EDIT_PLAN_SCHEMA',
        errors: validation.errors ?? ['Unknown schema validation error.'],
      });
      return;
    }

    res.json({
      ok: true,
      schemaVersion: validation.plan.schemaVersion,
      plan: validation.plan,
    });
  });

  /**
   * 6b. Build & Server-Validate Deterministic Non-AI Test EditPlan (Test 1 Video or Test 2 Audio)
   */
  app.post('/api/remotion/plan/test-preset', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const { projectId, assetId, testMode, modelId, arabicTitle, englishTitle } =
      req.body as {
        projectId?: string;
        assetId?: string;
        testMode?: 'video-10s-bilingual-test' | 'audio-10s-motion-test';
        modelId?: string;
        arabicTitle?: string;
        englishTitle?: string;
      };

    if (
      !projectId ||
      !assetId ||
      (testMode !== 'video-10s-bilingual-test' &&
        testMode !== 'audio-10s-motion-test')
    ) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_TEST_PLAN_REQUEST',
        message:
          'projectId, assetId, and valid testMode (video-10s-bilingual-test | audio-10s-motion-test) are required.',
      });
      return;
    }

    try {
      const plan = createVerifiedTestEditPlanOnServer({
        callerUid: session.uid,
        projectId,
        assetId,
        testMode,
        modelId,
        arabicTitle,
        englishTitle,
        baseOrigin: '',
      });

      res.json({
        ok: true,
        plan,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'TEST_PLAN_CREATION_FAILED',
        message:
          err instanceof Error ? err.message : 'Failed to build test EditPlan.',
      });
    }
  });

  /**
   * 6c. Enqueue an Independent Background Remotion MP4 Render Job (Decoupled from Browser Connection)
   */
  app.post('/api/render/jobs', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    const { projectId, modelId, plan } = req.body as {
      projectId?: string;
      modelId?: string;
      plan?: unknown;
    };

    if (!projectId || !plan) {
      res.status(400).json({
        ok: false,
        code: 'MISSING_RENDER_PARAMS',
        message: 'projectId and a valid UnifiedEditPlan are required.',
      });
      return;
    }

    try {
      const job = enqueueBackgroundRemotionRenderJob({
        callerUid: session.uid,
        projectId,
        modelId,
        planInput: plan,
        serverPort: PORT,
      });

      res.status(202).json({
        ok: true,
        job,
      });
    } catch (err) {
      res.status(422).json({
        ok: false,
        code: 'RENDER_JOB_REJECTED',
        message:
          err instanceof Error ? err.message : 'Failed to enqueue render job.',
      });
    }
  });

  /**
   * 6d. Poll Background Render Job State, Progress, FFprobe Report & Signed Download Link
   */
  app.get('/api/render/jobs/:jobId', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    try {
      const job = getRenderJobStatusForUser({
        callerUid: session.uid,
        jobId: req.params.jobId,
      });
      res.json({
        ok: true,
        job,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Render job not found.';
      const status = msg === 'FORBIDDEN_RENDER_JOB' ? 403 : 404;
      res.status(status).json({
        ok: false,
        code: msg,
        message: msg,
      });
    }
  });

  /**
   * 6e. List All Persisted Render Jobs for a Project
   */
  app.get('/api/projects/:projectId/render-jobs', async (req, res) => {
    const session = await requireAuthenticatedSession(req, res);
    if (!session) return;

    try {
      const jobs = listProjectRenderJobsForUser({
        callerUid: session.uid,
        projectId: req.params.projectId,
      });
      res.json({
        ok: true,
        jobs,
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN_PROJECT_RENDER_JOBS',
        message: err instanceof Error ? err.message : 'Access denied.',
      });
    }
  });

  /**
   * 6f. Authorized Download & Streaming of Rendered MP4 from Private Storage
   */
  const handleAuthorizedRenderedMp4Download = async (
    req: Request,
    res: Response
  ) => {
    let bearerUid: string | null = null;
    if (req.headers.authorization) {
      try {
        const decoded = await verifyBearerToken(req.headers.authorization);
        if (decoded.email_verified) {
          bearerUid = decoded.uid;
        }
      } catch {
        bearerUid = null;
      }
    }

    const signedToken =
      typeof req.query.st === 'string'
        ? req.query.st
        : typeof req.body?.st === 'string'
          ? req.body.st
          : undefined;

    try {
      const resolved = resolveAuthorizedRenderedMp4File({
        jobId: req.params.jobId,
        signedToken,
        verifiedBearerUid: bearerUid,
      });

      const stat = fs.statSync(resolved.diskPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Vion-Verified-Mp4', 'true');
      res.setHeader('X-Vion-Expected-Bytes', String(fileSize));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resolved.fileName}"`
      );

      if (range && req.method === 'GET') {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(resolved.diskPath, {
          start,
          end,
        });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(resolved.diskPath).pipe(res);
      }
    } catch (err) {
      res.status(403).json({
        ok: false,
        code: 'UNAUTHORIZED_RENDER_DOWNLOAD',
        message:
          err instanceof Error
            ? err.message
            : 'Authorized token or session is required to download rendered MP4.',
      });
    }
  };

  app.get(
    '/api/render/jobs/:jobId/download',
    handleAuthorizedRenderedMp4Download
  );
  app.post(
    '/api/render/jobs/:jobId/download',
    handleAuthorizedRenderedMp4Download
  );

  // ==========================================================================
  // 7. Brain AI Execution Gate (Intentionally Disabled Until Brain AI Phase)
  // ==========================================================================
  app.post('/api/brain/plan', (_req, res) => {
    res.status(501).json({
      ok: false,
      code: 'BRAIN_AI_DISABLED',
      message:
        'Brain AI content analysis and scene planning are not connected yet. Deterministic Remotion EditPlan preview and real MP4 background rendering are active.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VION Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
