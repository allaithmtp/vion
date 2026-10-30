import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AssetKind,
  AssetProcessingState,
  AssetTechnicalMetadata,
  DerivedAssetFiles,
  MediaWarningCode,
  ProjectDeletionJob,
  TimingLinkSpec,
} from '../src/types/domain.ts';
import {
  generateDerivedMediaArtifacts,
  getServerMediaLimits,
  probeAndValidateMediaFile,
} from './mediaWorker.ts';

const PRIVATE_STORAGE_ROOT = path.resolve(process.cwd(), '.private_storage');
const INCOMPLETE_UPLOADS_DIR = path.join(PRIVATE_STORAGE_ROOT, '_uploads');
const TEMP_WORKER_DIR = path.join(PRIVATE_STORAGE_ROOT, '_temp');

const OWNERSHIP_INDEX_FILE = path.resolve(
  process.cwd(),
  '.server_data',
  'ownership_index.json'
);
const UPLOAD_SESSIONS_FILE = path.resolve(
  process.cwd(),
  '.server_data',
  'upload_sessions.json'
);
const DELETION_JOBS_FILE = path.resolve(
  process.cwd(),
  '.server_data',
  'deletion_jobs.json'
);

export type StreamVariant = 'original' | 'preview' | 'thumbnail';

export interface ProjectOwnershipEntry {
  projectId: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetOwnershipEntry {
  assetId: string;
  projectId: string;
  ownerUid: string;
  kind: AssetKind;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  diskPath: string;
  thumbnailDiskPath?: string;
  previewProxyDiskPath?: string;
  normalizedAudioDiskPath?: string;
  processingState: AssetProcessingState;
  failureCode?: string;
  failureMessage?: string;
  warnings: MediaWarningCode[];
  timingLink?: TimingLinkSpec;
  metadata: AssetTechnicalMetadata;
  createdAt: string;
  updatedAt: string;
}

interface OwnershipIndexState {
  projects: Record<string, ProjectOwnershipEntry>;
  assets: Record<string, AssetOwnershipEntry>;
}

export interface ResumableUploadSession {
  uploadId: string;
  assetId: string;
  projectId: string;
  ownerUid: string;
  fileName: string;
  mimeType: string;
  kind: AssetKind;
  totalBytes: number;
  uploadedBytes: number;
  chunkSizeBytes: number;
  fileFingerprint: string;
  partDiskPath: string;
  status: 'uploading' | 'completed' | 'canceled' | 'failed';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface UploadSessionsState {
  sessions: Record<string, ResumableUploadSession>;
}

interface DeletionJobsState {
  jobs: ProjectDeletionJob[];
}

const STREAM_SECRET_FILE = path.resolve(
  process.cwd(),
  '.server_data',
  'stream_secret.key'
);

function loadOrCreateStreamSecret(): string {
  if (process.env.VION_STREAM_SECRET) {
    return process.env.VION_STREAM_SECRET;
  }
  const dir = path.dirname(STREAM_SECRET_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(STREAM_SECRET_FILE)) {
    const existing = fs.readFileSync(STREAM_SECRET_FILE, 'utf8').trim();
    if (existing.length >= 32) {
      return existing;
    }
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(STREAM_SECRET_FILE, generated, 'utf8');
  return generated;
}

const streamSecret = loadOrCreateStreamSecret();

function ensureStorageDirs() {
  for (const dir of [
    PRIVATE_STORAGE_ROOT,
    INCOMPLETE_UPLOADS_DIR,
    TEMP_WORKER_DIR,
    path.dirname(OWNERSHIP_INDEX_FILE),
  ]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function loadOwnershipIndex(): OwnershipIndexState {
  ensureStorageDirs();
  if (!fs.existsSync(OWNERSHIP_INDEX_FILE)) {
    return { projects: {}, assets: {} };
  }
  try {
    return JSON.parse(
      fs.readFileSync(OWNERSHIP_INDEX_FILE, 'utf8')
    ) as OwnershipIndexState;
  } catch {
    return { projects: {}, assets: {} };
  }
}

function saveOwnershipIndex(state: OwnershipIndexState): void {
  ensureStorageDirs();
  fs.writeFileSync(OWNERSHIP_INDEX_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function loadUploadSessions(): UploadSessionsState {
  ensureStorageDirs();
  if (!fs.existsSync(UPLOAD_SESSIONS_FILE)) {
    return { sessions: {} };
  }
  try {
    return JSON.parse(
      fs.readFileSync(UPLOAD_SESSIONS_FILE, 'utf8')
    ) as UploadSessionsState;
  } catch {
    return { sessions: {} };
  }
}

function saveUploadSessions(state: UploadSessionsState): void {
  ensureStorageDirs();
  fs.writeFileSync(UPLOAD_SESSIONS_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function loadDeletionJobs(): DeletionJobsState {
  ensureStorageDirs();
  if (!fs.existsSync(DELETION_JOBS_FILE)) {
    return { jobs: [] };
  }
  try {
    return JSON.parse(
      fs.readFileSync(DELETION_JOBS_FILE, 'utf8')
    ) as DeletionJobsState;
  } catch {
    return { jobs: [] };
  }
}

function saveDeletionJobs(state: DeletionJobsState): void {
  ensureStorageDirs();
  fs.writeFileSync(DELETION_JOBS_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function sanitizeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw new Error('INVALID_RESOURCE_ID');
  }
  return id;
}

/**
 * Verifies or registers project ownership on the server.
 */
export function verifyAndRegisterProjectOwnership(params: {
  projectId: string;
  callerUid: string;
  claimedOwnerUid: string;
}): void {
  const projectId = sanitizeId(params.projectId);
  if (params.callerUid !== params.claimedOwnerUid) {
    throw new Error('FORBIDDEN_OWNER_MISMATCH');
  }

  const index = loadOwnershipIndex();
  const existing = index.projects[projectId];
  const now = new Date().toISOString();

  if (existing && existing.ownerUid !== params.callerUid) {
    throw new Error('FORBIDDEN_PROJECT_OWNED_BY_ANOTHER_USER');
  }

  index.projects[projectId] = {
    projectId,
    ownerUid: params.callerUid,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  saveOwnershipIndex(index);
}

export function verifyProjectOwnershipOrThrow(
  projectId: string,
  callerUid: string
): void {
  const cleanProjectId = sanitizeId(projectId);
  const index = loadOwnershipIndex();
  const existing = index.projects[cleanProjectId];
  if (existing && existing.ownerUid !== callerUid) {
    throw new Error('FORBIDDEN_PROJECT_OWNED_BY_ANOTHER_USER');
  }
}

/**
 * Issues temporary signed stream token bound to (ownerUid, projectId, assetId, variant, expiresAt).
 */
export function issueSignedStreamToken(params: {
  ownerUid: string;
  projectId: string;
  assetId: string;
  variant?: StreamVariant;
  ttlSeconds?: number;
}): { token: string; expiresAtIso: string } {
  const limits = getServerMediaLimits();
  const ttlSec = params.ttlSeconds ?? limits.signedUrlTtlSeconds;
  const expiresAtMs = Date.now() + ttlSec * 1000;
  const variant: StreamVariant = params.variant ?? 'original';
  const payload = `${params.ownerUid}:${params.projectId}:${params.assetId}:${variant}:${expiresAtMs}`;
  const sig = crypto
    .createHmac('sha256', streamSecret)
    .update(payload)
    .digest('hex');
  return {
    token: Buffer.from(`${payload}:${sig}`).toString('base64url'),
    expiresAtIso: new Date(expiresAtMs).toISOString(),
  };
}

export function verifySignedStreamToken(
  token: string,
  expectedProjectId: string,
  expectedAssetId: string
): { ownerUid: string; variant: StreamVariant } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    // Support both 6-part (with variant) and legacy 5-part tokens
    if (parts.length === 6) {
      const [ownerUid, projectId, assetId, variantRaw, expiresAtStr, sig] =
        parts;
      if (
        !ownerUid ||
        projectId !== expectedProjectId ||
        assetId !== expectedAssetId ||
        Date.now() > Number(expiresAtStr)
      ) {
        return null;
      }
      const payload = `${ownerUid}:${projectId}:${assetId}:${variantRaw}:${expiresAtStr}`;
      const expectedSig = crypto
        .createHmac('sha256', streamSecret)
        .update(payload)
        .digest('hex');
      if (sig !== expectedSig) return null;
      const variant: StreamVariant =
        variantRaw === 'preview' || variantRaw === 'thumbnail'
          ? variantRaw
          : 'original';
      return { ownerUid, variant };
    } else if (parts.length === 5) {
      const [ownerUid, projectId, assetId, expiresAtStr, sig] = parts;
      if (
        !ownerUid ||
        projectId !== expectedProjectId ||
        assetId !== expectedAssetId ||
        Date.now() > Number(expiresAtStr)
      ) {
        return null;
      }
      const payload = `${ownerUid}:${projectId}:${assetId}:${expiresAtStr}`;
      const expectedSig = crypto
        .createHmac('sha256', streamSecret)
        .update(payload)
        .digest('hex');
      if (sig !== expectedSig) return null;
      return { ownerUid, variant: 'original' };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildSignedDerivedUrls(
  entry: AssetOwnershipEntry
): DerivedAssetFiles {
  const baseStoragePath = `/api/storage/files/${entry.projectId}/${entry.assetId}`;
  const origToken = issueSignedStreamToken({
    ownerUid: entry.ownerUid,
    projectId: entry.projectId,
    assetId: entry.assetId,
    variant: 'original',
  });

  const derived: DerivedAssetFiles = {
    originalSignedUrl: `${baseStoragePath}?variant=original&st=${encodeURIComponent(origToken.token)}`,
    signedUrlExpiresAt: origToken.expiresAtIso,
  };

  if (entry.thumbnailDiskPath && fs.existsSync(entry.thumbnailDiskPath)) {
    const thumbToken = issueSignedStreamToken({
      ownerUid: entry.ownerUid,
      projectId: entry.projectId,
      assetId: entry.assetId,
      variant: 'thumbnail',
    });
    derived.thumbnailPath = `${baseStoragePath}?variant=thumbnail`;
    derived.thumbnailSignedUrl = `${baseStoragePath}?variant=thumbnail&st=${encodeURIComponent(thumbToken.token)}`;
  }

  if (
    (entry.previewProxyDiskPath && fs.existsSync(entry.previewProxyDiskPath)) ||
    (entry.normalizedAudioDiskPath &&
      fs.existsSync(entry.normalizedAudioDiskPath))
  ) {
    const prevToken = issueSignedStreamToken({
      ownerUid: entry.ownerUid,
      projectId: entry.projectId,
      assetId: entry.assetId,
      variant: 'preview',
    });
    if (entry.previewProxyDiskPath) {
      derived.previewProxyPath = `${baseStoragePath}?variant=preview`;
    }
    if (entry.normalizedAudioDiskPath) {
      derived.normalizedAudioPath = `${baseStoragePath}?variant=preview`;
    }
    derived.previewSignedUrl = `${baseStoragePath}?variant=preview&st=${encodeURIComponent(prevToken.token)}`;
  }

  return derived;
}

// ============================================================================
// RESUMABLE DIRECT UPLOAD ENGINE
// ============================================================================

export function initOrResumeUploadSession(params: {
  callerUid: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  kind: AssetKind;
  totalBytes: number;
  fileFingerprint?: string;
  existingUploadId?: string;
}): ResumableUploadSession {
  const uid = sanitizeId(params.callerUid);
  const projectId = sanitizeId(params.projectId);
  const limits = getServerMediaLimits();

  if (!Number.isFinite(params.totalBytes) || params.totalBytes <= 0) {
    throw new Error('FILE_EMPTY_OR_INVALID_SIZE');
  }
  if (params.totalBytes > limits.maxFileSizeBytes) {
    throw new Error(
      `FILE_SIZE_LIMIT_EXCEEDED: File size (${params.totalBytes} bytes) exceeds limit (${limits.maxFileSizeBytes} bytes).`
    );
  }

  verifyAndRegisterProjectOwnership({
    projectId,
    callerUid: uid,
    claimedOwnerUid: uid,
  });

  const sessionsState = loadUploadSessions();
  const fingerprint =
    params.fileFingerprint ||
    `${uid}:${projectId}:${params.fileName}:${params.totalBytes}`;

  // Check if a matching resumable session already exists and is still valid on disk
  if (params.existingUploadId) {
    const byId = sessionsState.sessions[params.existingUploadId];
    if (
      byId &&
      byId.ownerUid === uid &&
      byId.projectId === projectId &&
      byId.status === 'uploading' &&
      fs.existsSync(byId.partDiskPath)
    ) {
      const actualSize = fs.statSync(byId.partDiskPath).size;
      byId.uploadedBytes = actualSize;
      byId.updatedAt = new Date().toISOString();
      saveUploadSessions(sessionsState);
      return byId;
    }
  }

  for (const session of Object.values(sessionsState.sessions)) {
    if (
      session.ownerUid === uid &&
      session.projectId === projectId &&
      session.fileFingerprint === fingerprint &&
      session.status === 'uploading' &&
      fs.existsSync(session.partDiskPath)
    ) {
      const actualSize = fs.statSync(session.partDiskPath).size;
      if (actualSize <= session.totalBytes) {
        session.uploadedBytes = actualSize;
        session.updatedAt = new Date().toISOString();
        saveUploadSessions(sessionsState);
        return session;
      }
    }
  }

  const uploadId = `upl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const assetId = `ast_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const partDiskPath = path.join(INCOMPLETE_UPLOADS_DIR, `${uploadId}.part`);
  fs.writeFileSync(partDiskPath, Buffer.alloc(0));

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 6); // 6h session window

  const session: ResumableUploadSession = {
    uploadId,
    assetId,
    projectId,
    ownerUid: uid,
    fileName: params.fileName.slice(0, 255),
    mimeType: params.mimeType.slice(0, 128),
    kind: params.kind,
    totalBytes: params.totalBytes,
    uploadedBytes: 0,
    chunkSizeBytes: limits.chunkSizeBytes,
    fileFingerprint: fingerprint.slice(0, 300),
    partDiskPath,
    status: 'uploading',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  sessionsState.sessions[uploadId] = session;
  saveUploadSessions(sessionsState);
  return session;
}

export function getResumableUploadSessionStatus(params: {
  callerUid: string;
  uploadId: string;
}): ResumableUploadSession {
  const cleanUploadId = sanitizeId(params.uploadId);
  const sessionsState = loadUploadSessions();
  const session = sessionsState.sessions[cleanUploadId];

  if (!session) {
    throw new Error('UPLOAD_SESSION_NOT_FOUND');
  }
  if (session.ownerUid !== params.callerUid) {
    throw new Error('FORBIDDEN_UPLOAD_SESSION');
  }

  if (session.status === 'uploading') {
    if (fs.existsSync(session.partDiskPath)) {
      session.uploadedBytes = fs.statSync(session.partDiskPath).size;
    } else {
      session.uploadedBytes = 0;
    }
    saveUploadSessions(sessionsState);
  }

  return session;
}

export function appendResumableUploadChunk(params: {
  callerUid: string;
  uploadId: string;
  offset: number;
  chunk: Buffer;
}): ResumableUploadSession {
  const cleanUploadId = sanitizeId(params.uploadId);
  const sessionsState = loadUploadSessions();
  const session = sessionsState.sessions[cleanUploadId];

  if (!session) {
    throw new Error('UPLOAD_SESSION_NOT_FOUND');
  }
  if (session.ownerUid !== params.callerUid) {
    throw new Error('FORBIDDEN_UPLOAD_SESSION');
  }
  if (session.status !== 'uploading') {
    throw new Error(`UPLOAD_SESSION_NOT_ACTIVE:${session.status}`);
  }
  if (!fs.existsSync(session.partDiskPath)) {
    throw new Error('UPLOAD_PART_FILE_MISSING');
  }

  const currentDiskSize = fs.statSync(session.partDiskPath).size;
  if (params.offset !== currentDiskSize) {
    session.uploadedBytes = currentDiskSize;
    saveUploadSessions(sessionsState);
    throw new Error(`OFFSET_MISMATCH:expected=${currentDiskSize},got=${params.offset}`);
  }

  if (currentDiskSize + params.chunk.byteLength > session.totalBytes) {
    throw new Error('CHUNK_EXCEEDS_DECLARED_TOTAL_BYTES');
  }

  const fd = fs.openSync(session.partDiskPath, 'a');
  try {
    fs.writeSync(fd, params.chunk, 0, params.chunk.byteLength);
  } finally {
    fs.closeSync(fd);
  }

  session.uploadedBytes = currentDiskSize + params.chunk.byteLength;
  session.updatedAt = new Date().toISOString();
  saveUploadSessions(sessionsState);
  return session;
}

export function cancelResumableUploadSession(params: {
  callerUid: string;
  uploadId: string;
}): { canceledUploadId: string; removedPartBytes: number } {
  const cleanUploadId = sanitizeId(params.uploadId);
  const sessionsState = loadUploadSessions();
  const session = sessionsState.sessions[cleanUploadId];

  if (!session) {
    throw new Error('UPLOAD_SESSION_NOT_FOUND');
  }
  if (session.ownerUid !== params.callerUid) {
    throw new Error('FORBIDDEN_UPLOAD_SESSION');
  }

  let removedPartBytes = 0;
  if (fs.existsSync(session.partDiskPath)) {
    removedPartBytes = fs.statSync(session.partDiskPath).size;
    fs.unlinkSync(session.partDiskPath);
  }

  session.status = 'canceled';
  session.uploadedBytes = 0;
  session.updatedAt = new Date().toISOString();
  delete sessionsState.sessions[cleanUploadId];
  saveUploadSessions(sessionsState);

  return {
    canceledUploadId: cleanUploadId,
    removedPartBytes,
  };
}

/**
 * Finalizes a completed resumable upload:
 * 1. Verifies uploadedBytes === totalBytes
 * 2. Inspects real container/codec/streams/duration via FFprobe
 * 3. Rejects and cleans up corrupted or unsupported files
 * 4. Executes FFmpeg worker to generate thumbnail, CFR/upright video proxy, or normalized audio preview
 * 5. Saves asset entry and returns full probed metadata + signed URLs
 */
export async function finalizeAndProcessResumableUpload(params: {
  callerUid: string;
  uploadId: string;
}): Promise<{
  asset: AssetOwnershipEntry;
  derivedFiles: DerivedAssetFiles;
}> {
  const cleanUploadId = sanitizeId(params.uploadId);
  const sessionsState = loadUploadSessions();
  const session = sessionsState.sessions[cleanUploadId];

  if (!session) {
    throw new Error('UPLOAD_SESSION_NOT_FOUND');
  }
  if (session.ownerUid !== params.callerUid) {
    throw new Error('FORBIDDEN_UPLOAD_SESSION');
  }
  if (!fs.existsSync(session.partDiskPath)) {
    throw new Error('UPLOAD_PART_FILE_MISSING');
  }

  const stat = fs.statSync(session.partDiskPath);
  if (stat.size !== session.totalBytes) {
    throw new Error(
      `INCOMPLETE_UPLOAD:uploaded=${stat.size},expected=${session.totalBytes}`
    );
  }

  // Prepare project asset directory
  const userProjectDir = path.join(
    PRIVATE_STORAGE_ROOT,
    session.ownerUid,
    session.projectId
  );
  const derivedDir = path.join(userProjectDir, 'derived');
  fs.mkdirSync(derivedDir, { recursive: true });

  const safeExt =
    path
      .extname(session.fileName)
      .replace(/[^a-zA-Z0-9.]/g, '')
      .slice(0, 12) || '.bin';
  const finalDiskPath = path.join(
    userProjectDir,
    `${session.assetId}${safeExt}`
  );

  // Move completed .part file to final private storage path
  fs.renameSync(session.partDiskPath, finalDiskPath);
  delete sessionsState.sessions[cleanUploadId];
  saveUploadSessions(sessionsState);

  const now = new Date().toISOString();
  const index = loadOwnershipIndex();

  // Register initial probing state
  const entry: AssetOwnershipEntry = {
    assetId: session.assetId,
    projectId: session.projectId,
    ownerUid: session.ownerUid,
    kind: session.kind,
    fileName: session.fileName,
    mimeType: session.mimeType,
    fileSizeBytes: session.totalBytes,
    diskPath: finalDiskPath,
    processingState: 'probing',
    warnings: [],
    metadata: {
      fileSizeBytes: session.totalBytes,
      mimeType: session.mimeType,
    },
    createdAt: now,
    updatedAt: now,
  };
  index.assets[session.assetId] = entry;
  saveOwnershipIndex(index);

  // Step 1: Real Content Verification & Probing with FFprobe
  const probeResult = await probeAndValidateMediaFile({
    filePath: finalDiskPath,
    requestedKind: session.kind,
    declaredMimeType: session.mimeType,
  });

  if (!probeResult.valid) {
    // Delete invalid/corrupted/unsupported binary from private storage immediately
    if (fs.existsSync(finalDiskPath)) {
      fs.unlinkSync(finalDiskPath);
    }
    entry.processingState = 'failed';
    entry.failureCode = probeResult.failureCode ?? 'INVALID_MEDIA';
    entry.failureMessage =
      probeResult.failureMessage ?? 'Media verification failed.';
    entry.updatedAt = new Date().toISOString();
    delete index.assets[session.assetId];
    saveOwnershipIndex(index);

    const err = new Error(
      `${entry.failureCode}: ${entry.failureMessage}`
    ) as Error & { code?: string };
    err.code = entry.failureCode;
    throw err;
  }

  entry.kind = probeResult.resolvedKind;
  entry.mimeType = probeResult.metadata.mimeType;
  entry.metadata = probeResult.metadata;
  entry.warnings = probeResult.warnings;
  entry.processingState =
    entry.kind === 'raw-video' || entry.kind === 'b-roll'
      ? 'generating-thumbnail'
      : 'normalizing-proxy';
  entry.updatedAt = new Date().toISOString();
  index.assets[session.assetId] = entry;
  saveOwnershipIndex(index);

  // Step 2: FFmpeg Derivative Generation (Thumbnail, CFR/Orientation Proxy, Audio Preview)
  try {
    const derivatives = await generateDerivedMediaArtifacts({
      sourceDiskPath: finalDiskPath,
      outputDir: derivedDir,
      assetId: session.assetId,
      kind: entry.kind,
      metadata: entry.metadata,
      initialWarnings: entry.warnings,
      onStageChange: (stage) => {
        const currentIndex = loadOwnershipIndex();
        if (currentIndex.assets[session.assetId]) {
          currentIndex.assets[session.assetId].processingState = stage;
          currentIndex.assets[session.assetId].updatedAt =
            new Date().toISOString();
          saveOwnershipIndex(currentIndex);
        }
      },
    });

    const latestIndex = loadOwnershipIndex();
    entry.thumbnailDiskPath = derivatives.thumbnailDiskPath;
    entry.previewProxyDiskPath = derivatives.previewProxyDiskPath;
    entry.normalizedAudioDiskPath = derivatives.normalizedAudioDiskPath;
    entry.timingLink = derivatives.timingLink;
    entry.warnings = derivatives.warnings;
    entry.processingState = 'ready';
    entry.updatedAt = new Date().toISOString();
    latestIndex.assets[session.assetId] = entry;
    saveOwnershipIndex(latestIndex);

    return {
      asset: entry,
      derivedFiles: buildSignedDerivedUrls(entry),
    };
  } catch (ffmpegErr) {
    const latestIndex = loadOwnershipIndex();
    entry.processingState = 'failed';
    entry.failureCode = 'FFMPEG_PROCESSING_FAILED';
    entry.failureMessage =
      ffmpegErr instanceof Error
        ? ffmpegErr.message
        : 'FFmpeg media processing failed.';
    entry.updatedAt = new Date().toISOString();
    latestIndex.assets[session.assetId] = entry;
    saveOwnershipIndex(latestIndex);
    throw new Error(`${entry.failureCode}: ${entry.failureMessage}`);
  }
}

export function getAuthorizedPrivateAsset(params: {
  callerUid: string;
  projectId: string;
  assetId: string;
}): AssetOwnershipEntry {
  const projectId = sanitizeId(params.projectId);
  const assetId = sanitizeId(params.assetId);
  const index = loadOwnershipIndex();
  const entry = index.assets[assetId];

  if (!entry || entry.projectId !== projectId) {
    throw new Error('ASSET_NOT_FOUND');
  }
  if (entry.ownerUid !== params.callerUid) {
    throw new Error('FORBIDDEN_ASSET_OWNED_BY_ANOTHER_USER');
  }
  return entry;
}

export function resolveVariantDiskPathAndMime(
  entry: AssetOwnershipEntry,
  variant: StreamVariant
): { diskPath: string; mimeType: string } {
  if (variant === 'thumbnail' && entry.thumbnailDiskPath && fs.existsSync(entry.thumbnailDiskPath)) {
    return {
      diskPath: entry.thumbnailDiskPath,
      mimeType: 'image/jpeg',
    };
  }
  if (variant === 'preview') {
    if (entry.previewProxyDiskPath && fs.existsSync(entry.previewProxyDiskPath)) {
      return {
        diskPath: entry.previewProxyDiskPath,
        mimeType: 'video/mp4',
      };
    }
    if (
      entry.normalizedAudioDiskPath &&
      fs.existsSync(entry.normalizedAudioDiskPath)
    ) {
      return {
        diskPath: entry.normalizedAudioDiskPath,
        mimeType: 'audio/mp4',
      };
    }
  }
  if (!fs.existsSync(entry.diskPath)) {
    throw new Error('ASSET_FILE_MISSING');
  }
  return {
    diskPath: entry.diskPath,
    mimeType: entry.mimeType,
  };
}

export function deletePrivateUserAsset(params: {
  callerUid: string;
  projectId: string;
  assetId: string;
}): void {
  const entry = getAuthorizedPrivateAsset(params);
  for (const p of [
    entry.diskPath,
    entry.thumbnailDiskPath,
    entry.previewProxyDiskPath,
    entry.normalizedAudioDiskPath,
  ]) {
    if (p && fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
  const index = loadOwnershipIndex();
  delete index.assets[entry.assetId];
  saveOwnershipIndex(index);
}

/**
 * Sweeps expired/abandoned resumable uploads and temporary worker files.
 */
export function cleanupIncompleteUploadsAndTempFiles(options?: {
  maxIdleMinutes?: number;
}): {
  cleanedSessionsCount: number;
  removedOrphanPartFilesCount: number;
  freedBytes: number;
} {
  ensureStorageDirs();
  const maxIdleMs = (options?.maxIdleMinutes ?? 60) * 60 * 1000;
  const nowMs = Date.now();

  const sessionsState = loadUploadSessions();
  let cleanedSessionsCount = 0;
  let removedOrphanPartFilesCount = 0;
  let freedBytes = 0;

  for (const [uploadId, session] of Object.entries(sessionsState.sessions)) {
    const updatedMs = new Date(session.updatedAt).getTime();
    const expiredMs = new Date(session.expiresAt).getTime();
    if (nowMs > expiredMs || nowMs - updatedMs > maxIdleMs) {
      if (fs.existsSync(session.partDiskPath)) {
        freedBytes += fs.statSync(session.partDiskPath).size;
        fs.unlinkSync(session.partDiskPath);
      }
      delete sessionsState.sessions[uploadId];
      cleanedSessionsCount++;
    }
  }
  saveUploadSessions(sessionsState);

  // Also remove any orphaned .part files not referenced by an active session
  const activePartPaths = new Set(
    Object.values(sessionsState.sessions).map((s) => s.partDiskPath)
  );
  if (fs.existsSync(INCOMPLETE_UPLOADS_DIR)) {
    for (const name of fs.readdirSync(INCOMPLETE_UPLOADS_DIR)) {
      const fullPath = path.join(INCOMPLETE_UPLOADS_DIR, name);
      if (!activePartPaths.has(fullPath) && fs.existsSync(fullPath)) {
        const st = fs.statSync(fullPath);
        if (st.isFile()) {
          freedBytes += st.size;
          fs.unlinkSync(fullPath);
          removedOrphanPartFilesCount++;
        }
      }
    }
  }

  return {
    cleanedSessionsCount,
    removedOrphanPartFilesCount,
    freedBytes,
  };
}

/**
 * Executes a trackable project deletion job (`ProjectDeletionJob`) that:
 * 1. Aborts and removes any active/incomplete resumable uploads for the project
 * 2. Removes all original media files for the project
 * 3. Removes all derived thumbnails, video proxies, and normalized audio files
 * 4. Purges the project and its assets from the server ownership index
 */
export function executeTrackableProjectDeletion(
  projectId: string,
  callerUid: string
): ProjectDeletionJob {
  const cleanProjectId = sanitizeId(projectId);
  const cleanCallerUid = sanitizeId(callerUid);
  const index = loadOwnershipIndex();
  const existing = index.projects[cleanProjectId];

  if (existing && existing.ownerUid !== cleanCallerUid) {
    throw new Error('FORBIDDEN_PROJECT_OWNED_BY_ANOTHER_USER');
  }

  const jobId = `del_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const startedAt = new Date().toISOString();
  let removedFilesCount = 0;
  let freedBytes = 0;

  const steps: ProjectDeletionJob['steps'] = [];

  // Step 1: Abort active uploads for this project
  const sessionsState = loadUploadSessions();
  for (const [uploadId, session] of Object.entries(sessionsState.sessions)) {
    if (
      session.projectId === cleanProjectId &&
      session.ownerUid === cleanCallerUid
    ) {
      if (fs.existsSync(session.partDiskPath)) {
        freedBytes += fs.statSync(session.partDiskPath).size;
        fs.unlinkSync(session.partDiskPath);
        removedFilesCount++;
      }
      delete sessionsState.sessions[uploadId];
    }
  }
  saveUploadSessions(sessionsState);
  steps.push({ step: 'abort_active_uploads', status: 'completed' });

  // Step 2 & 3: Remove original and derived files inside project directory
  const projectDir = path.join(
    PRIVATE_STORAGE_ROOT,
    cleanCallerUid,
    cleanProjectId
  );

  function walkAndDelete(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    for (const entryName of fs.readdirSync(dirPath)) {
      const full = path.join(dirPath, entryName);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walkAndDelete(full);
      } else {
        freedBytes += st.size;
        removedFilesCount++;
        fs.unlinkSync(full);
      }
    }
  }

  walkAndDelete(projectDir);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
  steps.push({ step: 'remove_original_files', status: 'completed' });
  steps.push({
    step: 'remove_derived_proxies_and_thumbnails',
    status: 'completed',
  });

  // Step 4: Purge ownership index
  delete index.projects[cleanProjectId];
  for (const [assetId, asset] of Object.entries(index.assets)) {
    if (
      asset.projectId === cleanProjectId &&
      asset.ownerUid === cleanCallerUid
    ) {
      delete index.assets[assetId];
    }
  }
  saveOwnershipIndex(index);
  steps.push({ step: 'purge_ownership_index', status: 'completed' });

  const job: ProjectDeletionJob = {
    id: jobId,
    projectId: cleanProjectId,
    ownerUid: cleanCallerUid,
    state: 'completed',
    removedFilesCount,
    freedBytes,
    steps,
    startedAt,
    completedAt: new Date().toISOString(),
  };

  const jobsState = loadDeletionJobs();
  jobsState.jobs.unshift(job);
  jobsState.jobs = jobsState.jobs.slice(0, 100);
  saveDeletionJobs(jobsState);

  return job;
}

export function getProjectDeletionJobsForUser(
  callerUid: string
): ProjectDeletionJob[] {
  const jobsState = loadDeletionJobs();
  return jobsState.jobs.filter((j) => j.ownerUid === callerUid);
}
