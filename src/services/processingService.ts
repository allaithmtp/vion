import type { AssetKind, AssetTechnicalMetadata } from '../types/domain';

export const processingService = {
  async inspectFileMetadata(
    file: File,
    explicitKind?: AssetKind
  ): Promise<{ kind: AssetKind; metadata: AssetTechnicalMetadata }> {
    const isAudio =
      explicitKind === 'voiceover-audio' ||
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);

    const kind: AssetKind =
      explicitKind ?? (isAudio ? 'voiceover-audio' : 'raw-video');
    const tempObjectUrl = URL.createObjectURL(file);

    const probed = await this.probeMediaDimensionsAndDuration(
      tempObjectUrl,
      kind
    );
    URL.revokeObjectURL(tempObjectUrl);

    return {
      kind,
      metadata: {
        fileSizeBytes: file.size,
        mimeType:
          file.type || (kind === 'voiceover-audio' ? 'audio/mpeg' : 'video/mp4'),
        durationSeconds: probed.durationSeconds,
        width: probed.width,
        height: probed.height,
        aspectRatioLabel:
          probed.width && probed.height
            ? probed.width >= probed.height
              ? '16:9'
              : '9:16'
            : undefined,
      },
    };
  },

  probeMediaDimensionsAndDuration(
    objectUrl: string,
    kind: AssetKind
  ): Promise<{ durationSeconds?: number; width?: number; height?: number }> {
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => resolve({}), 2500);

      if (kind === 'voiceover-audio') {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          resolve({
            durationSeconds: Number.isFinite(audio.duration)
              ? Math.round(audio.duration * 10) / 10
              : undefined,
          });
        };
        audio.onerror = () => {
          window.clearTimeout(timeout);
          resolve({});
        };
        audio.src = objectUrl;
      } else {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          resolve({
            durationSeconds: Number.isFinite(video.duration)
              ? Math.round(video.duration * 10) / 10
              : undefined,
            width: video.videoWidth || undefined,
            height: video.videoHeight || undefined,
          });
        };
        video.onerror = () => {
          window.clearTimeout(timeout);
          resolve({});
        };
        video.src = objectUrl;
      }
    });
  },

  buildFileFingerprint(projectId: string, file: File): string {
    return `${projectId}:${file.name}:${file.size}:${file.lastModified}`;
  },

  formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  },

  formatDuration(seconds?: number): string {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },
};
