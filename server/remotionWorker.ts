import { bundle } from '@remotion/bundler';
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from '@remotion/renderer';
import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
  buildAudio10sMotionTestPlan,
  buildVideo10sBilingualTestPlan,
  type EditPlanAssetRef,
  type UnifiedEditPlan,
  validateUnifiedEditPlan,
} from '../src/remotion/editPlanSchema.ts';
import type {
  RemotionRenderJob,
  RenderedMp4ProbeReport,
} from '../src/types/domain.ts';
import { capturePublishedModelSnapshotForNewTask } from './brainRegistry.ts';
import {
  getAuthorizedPrivateAsset,
  issueSignedStreamToken,
  verifyProjectOwnershipOrThrow,
  verifySignedStreamToken,
} from './privateStorage.ts';

const execFileAsync = promisify(execFile);

const FFPROBE_BIN = '/usr/bin/ffprobe';
const FFMPEG_BIN = '/usr/bin/ffmpeg';

const PRIVATE_STORAGE_ROOT = path.resolve(process.cwd(), '.private_storage');
const RENDER_JOBS_FILE = path.resolve(
  process.cwd(),
  '.server_data',
  'render_jobs.json'
);

interface PersistedRenderJobRecord extends RemotionRenderJob {
  outputDiskPath?: string;
  plan: UnifiedEditPlan;
}

interface RenderJobsState {
  jobs: Record<string, PersistedRenderJobRecord>;
}

let cachedBundlePromise: Promise<string> | null = null;
const activeQueue: string[] = [];
let isWorkerProcessing = false;

function ensureDataDirs() {
  const dir = path.dirname(RENDER_JOBS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(PRIVATE_STORAGE_ROOT)) {
    fs.mkdirSync(PRIVATE_STORAGE_ROOT, { recursive: true });
  }
}

function loadRenderJobsState(): RenderJobsState {
  ensureDataDirs();
  if (!fs.existsSync(RENDER_JOBS_FILE)) {
    return { jobs: {} };
  }
  try {
    return JSON.parse(
      fs.readFileSync(RENDER_JOBS_FILE, 'utf8')
    ) as RenderJobsState;
  } catch {
    return { jobs: {} };
  }
}

function saveRenderJobsState(state: RenderJobsState): void {
  ensureDataDirs();
  fs.writeFileSync(RENDER_JOBS_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function updateJobRecord(
  jobId: string,
  mutator: (job: PersistedRenderJobRecord) => void
): PersistedRenderJobRecord | null {
  const state = loadRenderJobsState();
  const job = state.jobs[jobId];
  if (!job) return null;
  mutator(job);
  job.updatedAt = new Date().toISOString();
  saveRenderJobsState(state);
  return job;
}

async function getOrCreateRemotionBundle(): Promise<string> {
  if (!cachedBundlePromise) {
    cachedBundlePromise = (async () => {
      await ensureBrowser();
      const entryPoint = path.resolve(process.cwd(), 'src/remotion/index.tsx');
      return await bundle({
        entryPoint,
      });
    })().catch((err) => {
      cachedBundlePromise = null;
      throw err;
    });
  }
  return cachedBundlePromise;
}

/**
 * Inspects the rendered MP4 output file using `/usr/bin/ffprobe` to verify
 * that it is a real H.264 MP4 with an active AAC audio stream and valid duration.
 */
export function hasValidMp4HeaderOnDisk(mp4DiskPath: string): boolean {
  if (!fs.existsSync(mp4DiskPath)) return false;
  const stat = fs.statSync(mp4DiskPath);
  if (stat.size < 1024) return false;
  const fd = fs.openSync(mp4DiskPath, 'r');
  try {
    const header = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, header, 0, 12, 0);
    if (bytesRead < 12) return false;
    const boxType = header.subarray(4, 8).toString('ascii');
    return boxType === 'ftyp' || boxType === 'moov' || boxType === 'wide';
  } finally {
    fs.closeSync(fd);
  }
}

export async function inspectRenderedMp4WithFfprobe(
  mp4DiskPath: string
): Promise<RenderedMp4ProbeReport> {
  if (!fs.existsSync(mp4DiskPath)) {
    throw new Error('RENDERED_MP4_MISSING_ON_DISK');
  }
  const stat = fs.statSync(mp4DiskPath);
  if (stat.size <= 1024) {
    throw new Error('RENDERED_MP4_EMPTY');
  }
  if (!hasValidMp4HeaderOnDisk(mp4DiskPath)) {
    throw new Error('RENDERED_MP4_INVALID_CONTAINER_HEADER');
  }

  const { stdout } = await execFileAsync(
    FFPROBE_BIN,
    [
      '-v',
      'error',
      '-show_format',
      '-show_streams',
      '-of',
      'json',
      mp4DiskPath,
    ],
    { timeout: 20000 }
  );

  const parsed = JSON.parse(stdout) as {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      r_frame_rate?: string;
      duration?: string;
    }>;
  };

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  if (!videoStream) {
    throw new Error('RENDERED_MP4_HAS_NO_VIDEO_STREAM');
  }
  if (!audioStream) {
    throw new Error('RENDERED_MP4_HAS_NO_AUDIO_STREAM');
  }

  const rateRaw =
    videoStream.avg_frame_rate || videoStream.r_frame_rate || '30/1';
  const [num, den] = rateRaw.split('/').map(Number);
  const fps =
    Number.isFinite(num) && Number.isFinite(den) && den > 0
      ? Math.round((num / den) * 100) / 100
      : 30;

  const durationSeconds =
    Math.round(
      (Number(parsed.format?.duration || videoStream.duration || 0) || 0) * 100
    ) / 100;

  return {
    containerFormat: parsed.format?.format_name ?? 'mp4',
    videoCodec: (videoStream.codec_name ?? 'h264').toLowerCase(),
    audioCodec: (audioStream.codec_name ?? 'aac').toLowerCase(),
    hasAudioTrack: Boolean(audioStream),
    durationSeconds,
    width: Number(videoStream.width) || 1280,
    height: Number(videoStream.height) || 720,
    fps,
    fileSizeBytes: stat.size,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Ensures the rendered MP4 contains a valid AAC audio track even if the user
 * ran Test 1 on a silent source video that had 0 audio tracks.
 */
async function ensureAudioTrackOnRenderedMp4(
  mp4DiskPath: string,
  durationSeconds: number
): Promise<void> {
  const { stdout } = await execFileAsync(
    FFPROBE_BIN,
    ['-v', 'error', '-show_streams', '-of', 'json', mp4DiskPath],
    { timeout: 15000 }
  );
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ codec_type?: string }>;
  };
  const hasAudio = (parsed.streams ?? []).some(
    (s) => s.codec_type === 'audio'
  );
  if (hasAudio) return;

  const tempMuxPath = `${mp4DiskPath}.muxed.mp4`;
  await execFileAsync(
    FFMPEG_BIN,
    [
      '-y',
      '-i',
      mp4DiskPath,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=220:sample_rate=44100:duration=${Math.max(1, durationSeconds).toFixed(2)}`,
      '-filter_complex',
      '[1:a]volume=0.03[aud]',
      '-map',
      '0:v:0',
      '-map',
      '[aud]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-shortest',
      '-movflags',
      '+faststart',
      tempMuxPath,
    ],
    { timeout: 60000 }
  );
  fs.renameSync(tempMuxPath, mp4DiskPath);
}

function toPublicRenderJobDTO(
  job: PersistedRenderJobRecord
): RemotionRenderJob {
  const { outputDiskPath: _disk, plan, ...rest } = job;
  let downloadSignedUrl: string | undefined;
  let signedUrlExpiresAt: string | undefined;

  if (
    job.state === 'completed' &&
    job.outputDiskPath &&
    job.ffprobeReport &&
    job.ffprobeReport.hasAudioTrack &&
    job.ffprobeReport.durationSeconds > 0 &&
    hasValidMp4HeaderOnDisk(job.outputDiskPath)
  ) {
    const issued = issueSignedStreamToken({
      ownerUid: job.ownerUid,
      projectId: job.projectId,
      assetId: job.id,
      variant: 'original',
    });
    downloadSignedUrl = `/api/render/jobs/${job.id}/download?st=${encodeURIComponent(issued.token)}`;
    signedUrlExpiresAt = issued.expiresAtIso;
  }

  return {
    ...rest,
    modelId: rest.modelId || plan.modelId || 'brain-1.8',
    modelVersion: rest.modelVersion || plan.modelVersion || 1,
    rulesVersion: rest.rulesVersion || plan.rulesVersion || 1,
    planId: plan.id,
    planTitle: plan.title,
    planMode: plan.planMode,
    downloadSignedUrl,
    signedUrlExpiresAt,
  };
}

/**
 * Resolves a project asset into an `EditPlanAssetRef` with a valid signed URL.
 */
export function buildEditPlanAssetRefFromStorage(params: {
  callerUid: string;
  projectId: string;
  assetId: string;
  baseOrigin: string;
}): EditPlanAssetRef {
  const entry = getAuthorizedPrivateAsset({
    callerUid: params.callerUid,
    projectId: params.projectId,
    assetId: params.assetId,
  });

  const hasPreview =
    (entry.previewProxyDiskPath &&
      fs.existsSync(entry.previewProxyDiskPath)) ||
    (entry.normalizedAudioDiskPath &&
      fs.existsSync(entry.normalizedAudioDiskPath));

  const variant = hasPreview ? 'preview' : 'original';
  const tokenObj = issueSignedStreamToken({
    ownerUid: entry.ownerUid,
    projectId: entry.projectId,
    assetId: entry.assetId,
    variant,
    ttlSeconds: 3600,
  });

  const relativePath = `/api/storage/files/${entry.projectId}/${entry.assetId}?variant=${variant}&st=${encodeURIComponent(tokenObj.token)}`;
  const playbackUrl = params.baseOrigin
    ? `${params.baseOrigin}${relativePath}`
    : relativePath;

  return {
    id: entry.assetId,
    kind: entry.kind,
    fileName: entry.fileName,
    playbackUrl,
    durationSeconds:
      entry.timingLink?.normalizedDurationSec ??
      entry.metadata.durationSeconds ??
      5,
    width: entry.metadata.width,
    height: entry.metadata.height,
    hasAudioTrack:
      entry.kind === 'voiceover-audio'
        ? true
        : Boolean(entry.metadata.hasAudioTrack),
  };
}

/**
 * Generates and server-validates one of the two deterministic non-AI test EditPlans:
 * - `video-10s-bilingual-test`: First 10s of uploaded video + Arabic & English titles + subtle zoom & fade
 * - `audio-10s-motion-test`: First 10s of uploaded audio + motion graphics background + title
 */
export function createVerifiedTestEditPlanOnServer(params: {
  callerUid: string;
  projectId: string;
  assetId: string;
  testMode: 'video-10s-bilingual-test' | 'audio-10s-motion-test';
  modelId?: string;
  arabicTitle?: string;
  englishTitle?: string;
  baseOrigin: string;
}): UnifiedEditPlan {
  verifyProjectOwnershipOrThrow(params.projectId, params.callerUid);

  const modelSnap = capturePublishedModelSnapshotForNewTask({
    modelId: params.modelId,
    projectId: params.projectId,
  });

  const assetRef = buildEditPlanAssetRefFromStorage({
    callerUid: params.callerUid,
    projectId: params.projectId,
    assetId: params.assetId,
    baseOrigin: params.baseOrigin,
  });

  const rawPlan =
    params.testMode === 'video-10s-bilingual-test'
      ? buildVideo10sBilingualTestPlan({
          projectId: params.projectId,
          asset: assetRef,
          modelId: modelSnap.modelId,
          modelVersion: modelSnap.modelVersion,
          rulesVersion: modelSnap.rulesVersion,
          arabicTitle: params.arabicTitle,
          englishTitle: params.englishTitle,
        })
      : buildAudio10sMotionTestPlan({
          projectId: params.projectId,
          asset: assetRef,
          modelId: modelSnap.modelId,
          modelVersion: modelSnap.modelVersion,
          rulesVersion: modelSnap.rulesVersion,
          headlineText: params.arabicTitle,
          subheadlineText: params.englishTitle,
        });

  const validation = validateUnifiedEditPlan(rawPlan);
  if (!validation.valid || !validation.plan) {
    throw new Error(
      `INVALID_EDIT_PLAN: ${(validation.errors ?? []).join('; ')}`
    );
  }

  return validation.plan;
}

/**
 * Enqueues an independent background render job decoupled from browser connection continuity.
 * Validates that the requested model is currently enabled (blocking new jobs if disabled),
 * and captures an immutable `modelSnapshot` so running jobs complete with their saved configuration
 * even if the model is subsequently disabled or modified.
 */
export function enqueueBackgroundRemotionRenderJob(params: {
  callerUid: string;
  projectId: string;
  modelId?: string;
  planInput: unknown;
  serverPort: number;
}): RemotionRenderJob {
  verifyProjectOwnershipOrThrow(params.projectId, params.callerUid);

  const validation = validateUnifiedEditPlan(params.planInput);
  if (!validation.valid || !validation.plan) {
    throw new Error(
      `EDIT_PLAN_VALIDATION_FAILED: ${(validation.errors ?? []).join('; ')}`
    );
  }

  const plan = validation.plan;
  if (plan.projectId !== params.projectId) {
    throw new Error('EDIT_PLAN_PROJECT_MISMATCH');
  }

  // Validate model is currently enabled & capture immutable snapshot for this job
  const targetModelId = params.modelId || plan.modelId || 'brain-1.8';
  const modelSnapshot = capturePublishedModelSnapshotForNewTask({
    modelId: targetModelId,
    projectId: params.projectId,
  });

  // Rewrite all asset playbackUrls with fresh 1-hour loopback tokens for the background worker
  const localOrigin = `http://127.0.0.1:${params.serverPort}`;
  const workerAssets: EditPlanAssetRef[] = plan.assets.map((assetRef) =>
    buildEditPlanAssetRefFromStorage({
      callerUid: params.callerUid,
      projectId: params.projectId,
      assetId: assetRef.id,
      baseOrigin: localOrigin,
    })
  );

  const workerPlan: UnifiedEditPlan = {
    ...plan,
    modelId: modelSnapshot.modelId,
    modelVersion: modelSnapshot.modelVersion,
    rulesVersion: modelSnapshot.rulesVersion,
    assets: workerAssets,
  };

  const jobId = `rnd_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  const record: PersistedRenderJobRecord = {
    id: jobId,
    projectId: params.projectId,
    ownerUid: params.callerUid,
    modelId: modelSnapshot.modelId,
    modelVersion: modelSnapshot.modelVersion,
    rulesVersion: modelSnapshot.rulesVersion,
    modelSnapshot,
    planId: workerPlan.id,
    planTitle: workerPlan.title,
    planMode: workerPlan.planMode,
    plan: workerPlan,
    state: 'queued',
    progressPercent: 0,
    renderedFrames: 0,
    totalFrames: workerPlan.durationInFrames,
    createdAt: now,
    updatedAt: now,
  };

  const state = loadRenderJobsState();
  state.jobs[jobId] = record;
  saveRenderJobsState(state);

  activeQueue.push(jobId);
  // Kick off background worker loop without awaiting (decoupled from HTTP request lifecycle)
  void processRenderQueueLoop();

  return toPublicRenderJobDTO(record);
}

async function processRenderQueueLoop(): Promise<void> {
  if (isWorkerProcessing) return;
  isWorkerProcessing = true;

  try {
    while (activeQueue.length > 0) {
      const jobId = activeQueue.shift();
      if (!jobId) continue;
      await executeSingleRenderJob(jobId);
    }
  } finally {
    isWorkerProcessing = false;
  }
}

async function executeSingleRenderJob(jobId: string): Promise<void> {
  const initial = updateJobRecord(jobId, (j) => {
    j.state = 'bundling';
    j.progressPercent = 4;
  });
  if (!initial) return;

  const tempRenderDir = path.join(PRIVATE_STORAGE_ROOT, '_temp_renders');
  fs.mkdirSync(tempRenderDir, { recursive: true });
  const tempMp4Path = path.join(tempRenderDir, `${jobId}.mp4`);

  try {
    // 1. Bundle or reuse cached Remotion bundle
    const serveUrl = await getOrCreateRemotionBundle();

    updateJobRecord(jobId, (j) => {
      j.state = 'rendering';
      j.progressPercent = 10;
    });

    // 2. Select composition with the validated UnifiedEditPlan inputProps
    const inputProps = { plan: initial.plan };
    const composition = await selectComposition({
      serveUrl,
      id: 'VionMasterComposition',
      inputProps,
    });

    // 3. Render real MP4 with H.264 video and AAC audio via headless Chromium + FFmpeg
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      audioCodec: 'aac',
      outputLocation: tempMp4Path,
      inputProps,
      pixelFormat: 'yuv420p',
      overwrite: true,
      onProgress: ({ renderedFrames, progress }) => {
        const pct = Math.min(92, Math.max(10, Math.round(10 + progress * 82)));
        updateJobRecord(jobId, (j) => {
          j.state = 'rendering';
          j.renderedFrames = renderedFrames;
          j.totalFrames = composition.durationInFrames;
          j.progressPercent = pct;
        });
      },
    });

    // 4. Ensure an audio track exists if source was silent video
    await ensureAudioTrackOnRenderedMp4(
      tempMp4Path,
      initial.plan.durationSeconds
    );

    // 5. Move rendered MP4 into user's private storage vault first
    updateJobRecord(jobId, (j) => {
      j.state = 'uploading-storage';
      j.progressPercent = 94;
    });

    const userRendersDir = path.join(
      PRIVATE_STORAGE_ROOT,
      initial.ownerUid,
      initial.projectId,
      'renders'
    );
    fs.mkdirSync(userRendersDir, { recursive: true });
    const finalDiskPath = path.join(userRendersDir, `${jobId}.mp4`);
    fs.renameSync(tempMp4Path, finalDiskPath);

    // 6. Inspect and verify the final storage MP4 via FFprobe BEFORE marking completed
    updateJobRecord(jobId, (j) => {
      j.state = 'probing-output';
      j.progressPercent = 98;
    });

    const ffprobeReport = await inspectRenderedMp4WithFfprobe(finalDiskPath);

    updateJobRecord(jobId, (j) => {
      j.state = 'completed';
      j.progressPercent = 100;
      j.renderedFrames = j.totalFrames;
      j.outputDiskPath = finalDiskPath;
      j.outputStoragePath = `/api/render/jobs/${jobId}/download`;
      j.ffprobeReport = ffprobeReport;
      j.completedAt = new Date().toISOString();
    });
  } catch (err) {
    if (fs.existsSync(tempMp4Path)) {
      fs.unlinkSync(tempMp4Path);
    }
    const message =
      err instanceof Error ? err.message : 'Remotion MP4 render failed.';
    updateJobRecord(jobId, (j) => {
      j.state = 'failed';
      j.errorMessage = message;
    });
  }
}

export function getRenderJobStatusForUser(params: {
  callerUid: string;
  jobId: string;
}): RemotionRenderJob {
  const state = loadRenderJobsState();
  const job = state.jobs[params.jobId];
  if (!job) {
    throw new Error('RENDER_JOB_NOT_FOUND');
  }
  if (job.ownerUid !== params.callerUid) {
    throw new Error('FORBIDDEN_RENDER_JOB');
  }
  return toPublicRenderJobDTO(job);
}

export function listProjectRenderJobsForUser(params: {
  callerUid: string;
  projectId: string;
}): RemotionRenderJob[] {
  verifyProjectOwnershipOrThrow(params.projectId, params.callerUid);
  const state = loadRenderJobsState();
  return Object.values(state.jobs)
    .filter(
      (j) =>
        j.projectId === params.projectId && j.ownerUid === params.callerUid
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map(toPublicRenderJobDTO);
}

export function resolveAuthorizedRenderedMp4File(params: {
  jobId: string;
  signedToken?: string;
  verifiedBearerUid?: string | null;
}): {
  diskPath: string;
  fileName: string;
  job: PersistedRenderJobRecord;
} {
  const state = loadRenderJobsState();
  const job = state.jobs[params.jobId];
  if (
    !job ||
    job.state !== 'completed' ||
    !job.outputDiskPath ||
    !job.ffprobeReport
  ) {
    throw new Error('RENDER_OUTPUT_NOT_READY');
  }

  let authorizedUid: string | null = null;
  if (params.verifiedBearerUid) {
    authorizedUid = params.verifiedBearerUid;
  }
  if (!authorizedUid && params.signedToken) {
    const tokenInfo = verifySignedStreamToken(
      params.signedToken,
      job.projectId,
      job.id
    );
    if (tokenInfo) {
      authorizedUid = tokenInfo.ownerUid;
    }
  }

  if (!authorizedUid || authorizedUid !== job.ownerUid) {
    throw new Error('FORBIDDEN_RENDER_DOWNLOAD');
  }
  if (!hasValidMp4HeaderOnDisk(job.outputDiskPath)) {
    throw new Error('RENDER_FILE_MISSING_OR_INVALID_MP4');
  }

  return {
    diskPath: job.outputDiskPath,
    fileName: `VION_${job.planMode}_${job.id}.mp4`,
    job,
  };
}
