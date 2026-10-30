import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  AssetKind,
  AssetProcessingState,
  AssetTechnicalMetadata,
  BrainModelId,
  ChatMessage,
  DerivedAssetFiles,
  MediaAsset,
  MediaWarningCode,
  Project,
  ProjectDeletionJob,
  ProjectWorkflowMode,
  StylePresetId,
  TimingLinkSpec,
} from '../types/domain';
import { processingService } from './processingService';

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

async function verifyProjectWriteOnServer(
  projectId: string,
  ownerUid: string,
  operation: string,
  selectedModelId?: string
): Promise<{
  modelVersion?: number;
  rulesVersion?: number;
}> {
  const user = auth.currentUser;
  if (!user || user.uid !== ownerUid) {
    throw new Error('Unauthorized project owner.');
  }
  const idToken = await user.getIdToken();
  const res = await fetch('/api/projects/verify-write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ projectId, ownerUid, operation, selectedModelId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || 'Server project ownership verification failed.'
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    modelSnapshot?: {
      modelVersion?: number;
      rulesVersion?: number;
    };
  };
  return {
    modelVersion: data.modelSnapshot?.modelVersion,
    rulesVersion: data.modelSnapshot?.rulesVersion,
  };
}

export interface ResumableUploadProgressUpdate {
  uploadId: string;
  assetId: string;
  uploadedBytes: number;
  totalBytes: number;
  progressPercent: number;
  state:
    | 'uploading'
    | 'paused'
    | 'canceled'
    | 'processing'
    | 'ready'
    | 'failed';
  processingStageLabel?: string;
  errorMessage?: string;
}

export const storageService = {
  /**
   * Real-time listener for all projects owned by `ownerUid`.
   */
  subscribeUserProjects(
    ownerUid: string,
    onProjectsUpdate: (projects: Project[]) => void
  ): Unsubscribe {
    const path = 'projects';
    const q = query(
      collection(db, 'projects'),
      where('ownerUid', '==', ownerUid)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Project[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id,
            ownerUid: d.ownerUid,
            name: d.name,
            workflowMode: d.workflowMode as ProjectWorkflowMode,
            selectedModelId: d.selectedModelId as BrainModelId,
            selectedStyleId: d.selectedStyleId as StylePresetId,
            archived: Boolean(d.archived),
            assets: [],
            messages: [],
            analysis: null,
            editPlans: [],
            tasks: [],
            outputVersions: [],
            createdAt: timestampToIso(d.createdAt),
            updatedAt: timestampToIso(d.updatedAt),
          };
        });
        list.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        onProjectsUpdate(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  },

  /**
   * Real-time listener for messages inside an opened project (`projects/{projectId}/messages`).
   */
  subscribeProjectMessages(
    projectId: string,
    ownerUid: string,
    onMessagesUpdate: (messages: ChatMessage[]) => void
  ): Unsubscribe {
    const path = `projects/${projectId}/messages`;
    const q = query(
      collection(db, 'projects', projectId, 'messages'),
      where('ownerUid', '==', ownerUid)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id,
            projectId: d.projectId,
            ownerUid: d.ownerUid,
            role: d.role,
            content: d.content,
            systemNoticeKey: d.systemNoticeKey,
            attachments: [],
            selectedModelId: d.selectedModelId,
            modelVersion:
              typeof d.modelVersion === 'number' ? d.modelVersion : undefined,
            rulesVersion:
              typeof d.rulesVersion === 'number' ? d.rulesVersion : undefined,
            selectedStyleId: d.selectedStyleId,
            createdAt: timestampToIso(d.createdAt),
          };
        });
        msgs.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        onMessagesUpdate(msgs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  },

  /**
   * Real-time listener for private media assets inside an opened project (`projects/{projectId}/assets`).
   * Automatically resolves temporary signed URLs for original, preview proxy, and thumbnail variants.
   */
  subscribeProjectAssets(
    projectId: string,
    ownerUid: string,
    onAssetsUpdate: (assets: MediaAsset[]) => void
  ): Unsubscribe {
    const path = `projects/${projectId}/assets`;
    const q = query(
      collection(db, 'projects', projectId, 'assets'),
      where('ownerUid', '==', ownerUid)
    );

    return onSnapshot(
      q,
      async (snapshot) => {
        const user = auth.currentUser;
        const idToken = user ? await user.getIdToken() : '';

        const assets: MediaAsset[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const d = docSnap.data();
            let streamUrl: string | undefined;
            let derivedFiles: DerivedAssetFiles | undefined;
            let serverMetadata: Partial<AssetTechnicalMetadata> = {};
            let serverWarnings: MediaWarningCode[] | undefined;
            let serverTimingLink: TimingLinkSpec | undefined;
            let serverProcessingState: AssetProcessingState | undefined;

            if (idToken) {
              try {
                const tokenRes = await fetch('/api/storage/stream-token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({
                    projectId: d.projectId,
                    assetId: d.id,
                  }),
                });
                if (tokenRes.ok) {
                  const tokenJson = (await tokenRes.json()) as {
                    authenticatedStreamUrl?: string;
                    derivedFiles?: DerivedAssetFiles;
                    processingState?: AssetProcessingState;
                    warnings?: MediaWarningCode[];
                    timingLink?: TimingLinkSpec;
                    metadata?: AssetTechnicalMetadata;
                  };
                  streamUrl = tokenJson.authenticatedStreamUrl;
                  derivedFiles = tokenJson.derivedFiles;
                  serverProcessingState = tokenJson.processingState;
                  serverWarnings = tokenJson.warnings;
                  serverTimingLink = tokenJson.timingLink;
                  if (tokenJson.metadata) {
                    serverMetadata = tokenJson.metadata;
                  }
                }
              } catch {
                // Ignore if offline or file missing
              }
            }

            const width = serverMetadata.width ?? d.width;
            const height = serverMetadata.height ?? d.height;
            const warningsList =
              serverWarnings ??
              (Array.isArray(d.warnings)
                ? (d.warnings as MediaWarningCode[])
                : []);

            const timingLink: TimingLinkSpec | undefined =
              serverTimingLink ??
              (typeof d.sourceDurationSec === 'number' &&
              typeof d.normalizedDurationSec === 'number'
                ? {
                    sourceDurationSec: d.sourceDurationSec,
                    normalizedDurationSec: d.normalizedDurationSec,
                    targetCfrFps: d.targetCfrFps,
                    rotationAppliedDegrees: d.rotationAppliedDegrees ?? 0,
                    timeScaleRatio: d.timeScaleRatio ?? 1,
                  }
                : undefined);

            return {
              id: d.id,
              projectId: d.projectId,
              ownerUid: d.ownerUid,
              kind: d.kind as AssetKind,
              fileName: d.fileName,
              storagePath: d.storagePath,
              localObjectUrl: streamUrl,
              storageStatus: 'uploaded',
              processingState:
                serverProcessingState ??
                (d.processingState as AssetProcessingState) ??
                'ready',
              warnings: warningsList,
              timingLink,
              derivedFiles: derivedFiles ?? {
                thumbnailPath: d.thumbnailPath,
                previewProxyPath: d.previewProxyPath,
                normalizedAudioPath: d.normalizedAudioPath,
              },
              metadata: {
                fileSizeBytes: d.fileSizeBytes,
                mimeType: d.mimeType,
                containerFormat:
                  serverMetadata.containerFormat ?? d.containerFormat,
                videoCodec: serverMetadata.videoCodec ?? d.videoCodec,
                audioCodec: serverMetadata.audioCodec ?? d.audioCodec,
                durationSeconds:
                  serverMetadata.durationSeconds ?? d.durationSeconds,
                width,
                height,
                aspectRatioLabel:
                  width && height
                    ? Math.abs(width - height) <= 4
                      ? '1:1'
                      : width > height
                        ? '16:9'
                        : '9:16'
                    : undefined,
                orientation: serverMetadata.orientation ?? d.orientation,
                rotationDegrees:
                  serverMetadata.rotationDegrees ?? d.rotationDegrees,
                fps: serverMetadata.fps ?? d.fps,
                isVariableFrameRate:
                  serverMetadata.isVariableFrameRate ?? d.isVariableFrameRate,
                hasAudioTrack: serverMetadata.hasAudioTrack ?? d.hasAudioTrack,
                audioTracks: serverMetadata.audioTracks,
              },
              createdAt: timestampToIso(d.createdAt),
              updatedAt: d.updatedAt ? timestampToIso(d.updatedAt) : undefined,
            };
          })
        );

        assets.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        onAssetsUpdate(assets);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  },

  /**
   * Renews temporary signed URLs for all assets in a project before or upon expiry.
   */
  async renewProjectAssetSignedUrls(
    projectId: string,
    assetIds: string[]
  ): Promise<Record<string, DerivedAssetFiles>> {
    const user = auth.currentUser;
    if (!user || assetIds.length === 0) return {};
    const idToken = await user.getIdToken();
    const res = await fetch('/api/storage/renew-urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ projectId, assetIds }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      ok: boolean;
      renewed?: Record<string, DerivedAssetFiles>;
    };
    return data.renewed ?? {};
  },

  async createProject(params: {
    ownerUid: string;
    name: string;
    workflowMode?: ProjectWorkflowMode;
    selectedModelId?: BrainModelId;
    selectedStyleId?: StylePresetId;
  }): Promise<Project> {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanName = params.name.trim().slice(0, 160) || 'Untitled Project';
    const workflowMode = params.workflowMode ?? 'unselected';
    const selectedModelId = params.selectedModelId ?? 'brain-1.8';
    const selectedStyleId = params.selectedStyleId ?? 'clean-cut-studio';

    await verifyProjectWriteOnServer(
      projectId,
      params.ownerUid,
      'create',
      selectedModelId
    );

    const path = `projects/${projectId}`;
    try {
      await setDoc(doc(db, 'projects', projectId), {
        id: projectId,
        ownerUid: params.ownerUid,
        name: cleanName,
        workflowMode,
        selectedModelId,
        selectedStyleId,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    const now = new Date().toISOString();
    return {
      id: projectId,
      ownerUid: params.ownerUid,
      name: cleanName,
      workflowMode,
      selectedModelId,
      selectedStyleId,
      archived: false,
      assets: [],
      messages: [],
      analysis: null,
      editPlans: [],
      tasks: [],
      outputVersions: [],
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateProjectFields(
    projectId: string,
    ownerUid: string,
    updates: Partial<{
      name: string;
      workflowMode: ProjectWorkflowMode;
      selectedModelId: BrainModelId;
      selectedStyleId: StylePresetId;
      archived: boolean;
    }>
  ): Promise<void> {
    await verifyProjectWriteOnServer(
      projectId,
      ownerUid,
      'update',
      updates.selectedModelId
    );

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.name === 'string') {
      payload.name = updates.name.trim().slice(0, 160) || 'Untitled Project';
    }
    if (updates.workflowMode) {
      payload.workflowMode = updates.workflowMode;
    }
    if (updates.selectedModelId) {
      payload.selectedModelId = updates.selectedModelId;
    }
    if (updates.selectedStyleId) {
      payload.selectedStyleId = updates.selectedStyleId;
    }
    if (typeof updates.archived === 'boolean') {
      payload.archived = updates.archived;
    }

    const path = `projects/${projectId}`;
    try {
      await updateDoc(doc(db, 'projects', projectId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  /**
   * Deletes a project and runs a trackable `ProjectDeletionJob` on the server
   * to remove all original files, derived thumbnails/proxies, and incomplete uploads.
   */
  async deleteProject(
    projectId: string,
    ownerUid: string
  ): Promise<ProjectDeletionJob | null> {
    const user = auth.currentUser;
    if (!user || user.uid !== ownerUid) {
      throw new Error('Unauthorized delete attempt.');
    }
    const idToken = await user.getIdToken();

    // 1. Verify ownership on server and execute trackable deletion job
    const serverRes = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!serverRes.ok) {
      throw new Error('Server rejected project deletion.');
    }
    const serverJson = (await serverRes.json()) as {
      deletionJob?: ProjectDeletionJob;
    };

    // 2. Delete subcollection messages and assets in Firestore, then delete project doc
    try {
      const msgQuery = query(
        collection(db, 'projects', projectId, 'messages'),
        where('ownerUid', '==', ownerUid)
      );
      const msgSnaps = await getDocs(msgQuery);
      for (const mDoc of msgSnaps.docs) {
        await deleteDoc(doc(db, 'projects', projectId, 'messages', mDoc.id));
      }

      const assetQuery = query(
        collection(db, 'projects', projectId, 'assets'),
        where('ownerUid', '==', ownerUid)
      );
      const assetSnaps = await getDocs(assetQuery);
      for (const aDoc of assetSnaps.docs) {
        await deleteDoc(doc(db, 'projects', projectId, 'assets', aDoc.id));
      }

      await deleteDoc(doc(db, 'projects', projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
    }

    return serverJson.deletionJob ?? null;
  },

  async addMessageToProject(params: {
    projectId: string;
    ownerUid: string;
    role: 'user' | 'brain-system';
    content: string;
    systemNoticeKey?: string;
    selectedModelId: BrainModelId;
    selectedStyleId: StylePresetId;
  }): Promise<void> {
    const verifiedSnap = await verifyProjectWriteOnServer(
      params.projectId,
      params.ownerUid,
      'append-message',
      params.selectedModelId
    );

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const path = `projects/${params.projectId}/messages/${messageId}`;

    const docData: Record<string, unknown> = {
      id: messageId,
      projectId: params.projectId,
      ownerUid: params.ownerUid,
      role: params.role,
      content: params.content.slice(0, 8000),
      selectedModelId: params.selectedModelId,
      modelVersion: verifiedSnap.modelVersion ?? 1,
      rulesVersion: verifiedSnap.rulesVersion ?? 1,
      selectedStyleId: params.selectedStyleId,
      createdAt: serverTimestamp(),
    };
    if (params.systemNoticeKey) {
      docData.systemNoticeKey = params.systemNoticeKey.slice(0, 120);
    }

    try {
      await setDoc(
        doc(db, 'projects', params.projectId, 'messages', messageId),
        docData
      );
      await updateDoc(doc(db, 'projects', params.projectId), {
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  /**
   * Cancels an active resumable upload session on the server and removes its `.part` file.
   */
  async cancelResumableUploadOnServer(uploadId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !uploadId) return;
    const idToken = await user.getIdToken();
    await fetch(`/api/storage/resumable/session/${uploadId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }).catch(() => {});
  },

  /**
   * Direct Resumable Upload & Server FFprobe/FFmpeg Processing Pipeline:
   * - Streams binary chunks directly to `/api/storage/resumable/session/:uploadId`
   * - Supports real progress, pause/abort, and resuming from server offset
   * - Finalizes via FFprobe content verification & FFmpeg proxy/thumbnail worker
   * - Saves verified asset metadata and derived paths in Firestore
   */
  async executeResumableMediaUpload(params: {
    projectId: string;
    ownerUid: string;
    file: File;
    kind: AssetKind;
    existingUploadId?: string;
    abortSignal?: AbortSignal;
    onProgress?: (update: ResumableUploadProgressUpdate) => void;
  }): Promise<MediaAsset> {
    const user = auth.currentUser;
    if (!user || user.uid !== params.ownerUid) {
      throw new Error('Unauthorized asset upload.');
    }

    const idToken = await user.getIdToken();
    const fingerprint = processingService.buildFileFingerprint(
      params.projectId,
      params.file
    );

    // 1. Initialize or resume session on server
    const initRes = await fetch('/api/storage/resumable/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        projectId: params.projectId,
        fileName: params.file.name,
        mimeType:
          params.file.type ||
          (params.kind === 'voiceover-audio' ? 'audio/mpeg' : 'video/mp4'),
        kind: params.kind,
        totalBytes: params.file.size,
        fileFingerprint: fingerprint,
        existingUploadId: params.existingUploadId,
      }),
      signal: params.abortSignal,
    });

    if (!initRes.ok) {
      const errJson = await initRes.json().catch(() => ({}));
      throw new Error(
        errJson.message || 'Failed to initialize resumable upload.'
      );
    }

    const initData = (await initRes.json()) as {
      ok: boolean;
      session: {
        uploadId: string;
        assetId: string;
        projectId: string;
        uploadedBytes: number;
        totalBytes: number;
        chunkSizeBytes: number;
      };
    };

    const { uploadId, assetId, totalBytes, chunkSizeBytes } = initData.session;
    let offset = initData.session.uploadedBytes;

    params.onProgress?.({
      uploadId,
      assetId,
      uploadedBytes: offset,
      totalBytes,
      progressPercent:
        totalBytes > 0 ? Math.round((offset / totalBytes) * 100) : 0,
      state: 'uploading',
    });

    // 2. Upload chunks sequentially from current server offset
    while (offset < totalBytes) {
      if (params.abortSignal?.aborted) {
        throw new DOMException('Upload aborted by user', 'AbortError');
      }

      const nextEnd = Math.min(offset + chunkSizeBytes, totalBytes);
      const blobSlice = params.file.slice(offset, nextEnd);
      const chunkBuffer = await blobSlice.arrayBuffer();

      const patchRes = await fetch(
        `/api/storage/resumable/session/${uploadId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/octet-stream',
            'x-upload-offset': String(offset),
          },
          body: chunkBuffer,
          signal: params.abortSignal,
        }
      );

      if (!patchRes.ok) {
        if (patchRes.status === 409) {
          // Re-sync offset from server and continue
          const statusRes = await fetch(
            `/api/storage/resumable/session/${uploadId}`,
            {
              headers: { Authorization: `Bearer ${idToken}` },
              signal: params.abortSignal,
            }
          );
          if (statusRes.ok) {
            const stData = await statusRes.json();
            offset = stData.session.uploadedBytes;
            continue;
          }
        }
        const errJson = await patchRes.json().catch(() => ({}));
        throw new Error(errJson.message || 'Chunk upload interrupted.');
      }

      const patchData = (await patchRes.json()) as {
        uploadedBytes: number;
      };
      offset = patchData.uploadedBytes;

      params.onProgress?.({
        uploadId,
        assetId,
        uploadedBytes: offset,
        totalBytes,
        progressPercent:
          totalBytes > 0 ? Math.round((offset / totalBytes) * 100) : 100,
        state: 'uploading',
      });
    }

    // 3. Finalize & Run Server FFprobe Validation + FFmpeg Worker
    params.onProgress?.({
      uploadId,
      assetId,
      uploadedBytes: totalBytes,
      totalBytes,
      progressPercent: 100,
      state: 'processing',
      processingStageLabel: 'FFprobe & FFmpeg Worker',
    });

    const finalizeRes = await fetch(
      `/api/storage/resumable/session/${uploadId}/finalize`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      }
    );

    if (!finalizeRes.ok) {
      const errJson = await finalizeRes.json().catch(() => ({}));
      throw new Error(
        errJson.message || 'FFprobe/FFmpeg media validation failed.'
      );
    }

    const finalized = (await finalizeRes.json()) as {
      ok: boolean;
      asset: {
        id: string;
        projectId: string;
        ownerUid: string;
        kind: AssetKind;
        fileName: string;
        storagePath: string;
        processingState: AssetProcessingState;
        warnings: MediaWarningCode[];
        timingLink?: TimingLinkSpec;
        derivedFiles: DerivedAssetFiles;
        metadata: AssetTechnicalMetadata;
        createdAt: string;
      };
    };

    const srvAsset = finalized.asset;

    // 4. Persist verified asset metadata & derived paths in Firestore `/projects/{projectId}/assets/{assetId}`
    const path = `projects/${params.projectId}/assets/${srvAsset.id}`;
    const assetDoc: Record<string, unknown> = {
      id: srvAsset.id,
      projectId: params.projectId,
      ownerUid: params.ownerUid,
      kind: srvAsset.kind,
      fileName: srvAsset.fileName.slice(0, 255),
      mimeType: srvAsset.metadata.mimeType.slice(0, 128),
      fileSizeBytes: srvAsset.metadata.fileSizeBytes,
      storagePath: srvAsset.storagePath,
      processingState: srvAsset.processingState,
      warnings: srvAsset.warnings ?? [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (srvAsset.metadata.containerFormat) {
      assetDoc.containerFormat = srvAsset.metadata.containerFormat.slice(0, 64);
    }
    if (srvAsset.metadata.videoCodec) {
      assetDoc.videoCodec = srvAsset.metadata.videoCodec.slice(0, 64);
    }
    if (srvAsset.metadata.audioCodec) {
      assetDoc.audioCodec = srvAsset.metadata.audioCodec.slice(0, 64);
    }
    if (typeof srvAsset.metadata.durationSeconds === 'number') {
      assetDoc.durationSeconds = srvAsset.metadata.durationSeconds;
    }
    if (typeof srvAsset.metadata.width === 'number') {
      assetDoc.width = srvAsset.metadata.width;
    }
    if (typeof srvAsset.metadata.height === 'number') {
      assetDoc.height = srvAsset.metadata.height;
    }
    if (srvAsset.metadata.orientation) {
      assetDoc.orientation = srvAsset.metadata.orientation;
    }
    if (typeof srvAsset.metadata.rotationDegrees === 'number') {
      assetDoc.rotationDegrees = srvAsset.metadata.rotationDegrees;
    }
    if (typeof srvAsset.metadata.fps === 'number') {
      assetDoc.fps = srvAsset.metadata.fps;
    }
    if (typeof srvAsset.metadata.isVariableFrameRate === 'boolean') {
      assetDoc.isVariableFrameRate = srvAsset.metadata.isVariableFrameRate;
    }
    if (typeof srvAsset.metadata.hasAudioTrack === 'boolean') {
      assetDoc.hasAudioTrack = srvAsset.metadata.hasAudioTrack;
    }
    if (Array.isArray(srvAsset.metadata.audioTracks)) {
      assetDoc.audioTracksCount = srvAsset.metadata.audioTracks.length;
    }
    if (srvAsset.derivedFiles.thumbnailPath) {
      assetDoc.thumbnailPath = srvAsset.derivedFiles.thumbnailPath;
    }
    if (srvAsset.derivedFiles.previewProxyPath) {
      assetDoc.previewProxyPath = srvAsset.derivedFiles.previewProxyPath;
    }
    if (srvAsset.derivedFiles.normalizedAudioPath) {
      assetDoc.normalizedAudioPath = srvAsset.derivedFiles.normalizedAudioPath;
    }
    if (srvAsset.timingLink) {
      assetDoc.sourceDurationSec = srvAsset.timingLink.sourceDurationSec;
      assetDoc.normalizedDurationSec =
        srvAsset.timingLink.normalizedDurationSec;
      if (typeof srvAsset.timingLink.targetCfrFps === 'number') {
        assetDoc.targetCfrFps = srvAsset.timingLink.targetCfrFps;
      }
      assetDoc.rotationAppliedDegrees =
        srvAsset.timingLink.rotationAppliedDegrees;
      assetDoc.timeScaleRatio = srvAsset.timingLink.timeScaleRatio;
    }

    try {
      await setDoc(
        doc(db, 'projects', params.projectId, 'assets', srvAsset.id),
        assetDoc
      );
      await updateDoc(doc(db, 'projects', params.projectId), {
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    params.onProgress?.({
      uploadId,
      assetId: srvAsset.id,
      uploadedBytes: totalBytes,
      totalBytes,
      progressPercent: 100,
      state: 'ready',
    });

    return {
      id: srvAsset.id,
      projectId: params.projectId,
      ownerUid: params.ownerUid,
      kind: srvAsset.kind,
      fileName: srvAsset.fileName,
      storagePath: srvAsset.storagePath,
      localObjectUrl:
        srvAsset.derivedFiles.previewSignedUrl ??
        srvAsset.derivedFiles.originalSignedUrl,
      storageStatus: 'uploaded',
      processingState: srvAsset.processingState,
      warnings: srvAsset.warnings,
      timingLink: srvAsset.timingLink,
      derivedFiles: srvAsset.derivedFiles,
      metadata: srvAsset.metadata,
      createdAt: srvAsset.createdAt,
    };
  },
};
