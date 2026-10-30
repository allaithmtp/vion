import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type {
  AssetKind,
  AssetTechnicalMetadata,
  AudioTrackMetadata,
  MediaWarningCode,
  ServerMediaLimitsConfig,
  TimingLinkSpec,
} from '../src/types/domain.ts';

const execFileAsync = promisify(execFile);

const FFPROBE_BIN = '/usr/bin/ffprobe';
const FFMPEG_BIN = '/usr/bin/ffmpeg';

const LIMITS_CONFIG_FILE = path.resolve(
  process.cwd(),
  '.server_data',
  'media_limits.json'
);

const DEFAULT_MEDIA_LIMITS: ServerMediaLimitsConfig = {
  maxFileSizeBytes: 1024 * 1024 * 1024, // 1 GB default limit
  maxDurationSeconds: 10 * 60, // 10 minutes (600 seconds) default limit
  supportedVideoContainers: ['mp4', 'mov', 'webm', 'matroska', 'm4v', '3gp'],
  supportedVideoCodecs: ['h264', 'hevc', 'vp8', 'vp9', 'av1', 'mpeg4'],
  supportedAudioContainers: [
    'mp3',
    'wav',
    'ogg',
    'flac',
    'aac',
    'm4a',
    'mp4',
    'mov',
    'webm',
    'matroska',
  ],
  supportedAudioCodecs: [
    'aac',
    'mp3',
    'pcm_s16le',
    'pcm_s24le',
    'pcm_f32le',
    'pcm_u8',
    'opus',
    'vorbis',
    'flac',
  ],
  chunkSizeBytes: 2 * 1024 * 1024, // 2 MB resumable chunks
  signedUrlTtlSeconds: 15 * 60, // 15 minutes signed URL TTL
};

function ensureDataDir() {
  const dir = path.dirname(LIMITS_CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function isFfmpegWorkerAvailable(): boolean {
  return fs.existsSync(FFPROBE_BIN) && fs.existsSync(FFMPEG_BIN);
}

export function getServerMediaLimits(): ServerMediaLimitsConfig {
  ensureDataDir();
  if (!fs.existsSync(LIMITS_CONFIG_FILE)) {
    fs.writeFileSync(
      LIMITS_CONFIG_FILE,
      JSON.stringify(DEFAULT_MEDIA_LIMITS, null, 2),
      'utf8'
    );
    return { ...DEFAULT_MEDIA_LIMITS };
  }
  try {
    const parsed = JSON.parse(
      fs.readFileSync(LIMITS_CONFIG_FILE, 'utf8')
    ) as Partial<ServerMediaLimitsConfig>;
    return {
      ...DEFAULT_MEDIA_LIMITS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_MEDIA_LIMITS };
  }
}

export function updateServerMediaLimits(updates: {
  maxFileSizeBytes?: number;
  maxDurationSeconds?: number;
  signedUrlTtlSeconds?: number;
}): ServerMediaLimitsConfig {
  const current = getServerMediaLimits();
  const next: ServerMediaLimitsConfig = {
    ...current,
    maxFileSizeBytes:
      typeof updates.maxFileSizeBytes === 'number' &&
      updates.maxFileSizeBytes >= 1024 * 1024 &&
      updates.maxFileSizeBytes <= 10 * 1024 * 1024 * 1024
        ? Math.floor(updates.maxFileSizeBytes)
        : current.maxFileSizeBytes,
    maxDurationSeconds:
      typeof updates.maxDurationSeconds === 'number' &&
      updates.maxDurationSeconds >= 5 &&
      updates.maxDurationSeconds <= 3600 * 4
        ? Math.floor(updates.maxDurationSeconds)
        : current.maxDurationSeconds,
    signedUrlTtlSeconds:
      typeof updates.signedUrlTtlSeconds === 'number' &&
      updates.signedUrlTtlSeconds >= 60 &&
      updates.signedUrlTtlSeconds <= 86400
        ? Math.floor(updates.signedUrlTtlSeconds)
        : current.signedUrlTtlSeconds,
  };
  ensureDataDir();
  fs.writeFileSync(LIMITS_CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

interface FfprobeStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  tags?: Record<string, string>;
  side_data_list?: Array<{
    side_data_type?: string;
    rotation?: number | string;
  }>;
}

interface FfprobeOutput {
  format?: {
    format_name?: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
  };
  streams?: FfprobeStream[];
}

function parseFrameRateFraction(rateStr?: string): number | undefined {
  if (!rateStr || rateStr === '0/0') return undefined;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
      return num / den;
    }
  }
  const direct = Number(rateStr);
  return Number.isFinite(direct) && direct > 0 ? direct : undefined;
}

function extractRotationDegrees(stream?: FfprobeStream): number {
  if (!stream) return 0;
  if (stream.tags?.rotate) {
    const deg = Math.abs(Number(stream.tags.rotate));
    if (Number.isFinite(deg)) {
      return deg % 360;
    }
  }
  if (Array.isArray(stream.side_data_list)) {
    for (const sd of stream.side_data_list) {
      if (sd.rotation !== undefined) {
        const deg = Math.abs(Number(sd.rotation));
        if (Number.isFinite(deg)) {
          return deg % 360;
        }
      }
    }
  }
  return 0;
}

export interface ProbedMediaValidationResult {
  valid: boolean;
  resolvedKind: AssetKind;
  failureCode?:
    | 'CORRUPTED_MEDIA_FILE'
    | 'UNSUPPORTED_CODEC_OR_FORMAT'
    | 'DURATION_LIMIT_EXCEEDED'
    | 'FILE_SIZE_LIMIT_EXCEEDED';
  failureMessage?: string;
  warnings: MediaWarningCode[];
  metadata: AssetTechnicalMetadata;
}

/**
 * Inspects actual media file binary structure using FFprobe (not extension).
 * Validates container format, video/audio codecs, file size, and duration limits.
 */
export async function probeAndValidateMediaFile(params: {
  filePath: string;
  requestedKind: AssetKind;
  declaredMimeType: string;
}): Promise<ProbedMediaValidationResult> {
  const limits = getServerMediaLimits();

  if (!fs.existsSync(params.filePath)) {
    return {
      valid: false,
      resolvedKind: params.requestedKind,
      failureCode: 'CORRUPTED_MEDIA_FILE',
      failureMessage: 'Uploaded media file does not exist on disk.',
      warnings: [],
      metadata: {
        fileSizeBytes: 0,
        mimeType: params.declaredMimeType,
      },
    };
  }

  const stat = fs.statSync(params.filePath);
  if (stat.size === 0) {
    return {
      valid: false,
      resolvedKind: params.requestedKind,
      failureCode: 'CORRUPTED_MEDIA_FILE',
      failureMessage: 'Media file is empty (0 bytes).',
      warnings: [],
      metadata: {
        fileSizeBytes: 0,
        mimeType: params.declaredMimeType,
      },
    };
  }

  if (stat.size > limits.maxFileSizeBytes) {
    return {
      valid: false,
      resolvedKind: params.requestedKind,
      failureCode: 'FILE_SIZE_LIMIT_EXCEEDED',
      failureMessage: `File size (${stat.size} bytes) exceeds maximum allowed limit (${limits.maxFileSizeBytes} bytes).`,
      warnings: [],
      metadata: {
        fileSizeBytes: stat.size,
        mimeType: params.declaredMimeType,
      },
    };
  }

  let parsed: FfprobeOutput;
  try {
    const { stdout } = await execFileAsync(
      FFPROBE_BIN,
      [
        '-v',
        'error',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        params.filePath,
      ],
      { timeout: 25000 }
    );
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    return {
      valid: false,
      resolvedKind: params.requestedKind,
      failureCode: 'CORRUPTED_MEDIA_FILE',
      failureMessage:
        'FFprobe could not parse a valid media container. The file is corrupted or is not a real media file.',
      warnings: [],
      metadata: {
        fileSizeBytes: stat.size,
        mimeType: params.declaredMimeType,
      },
    };
  }

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const formatNameRaw = (parsed.format?.format_name ?? '').toLowerCase();
  const formatTokens = formatNameRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const videoStreams = streams.filter(
    (s) =>
      s.codec_type === 'video' &&
      s.codec_name !== 'mjpeg' &&
      s.codec_name !== 'png'
  );
  const audioStreams = streams.filter((s) => s.codec_type === 'audio');

  if (videoStreams.length === 0 && audioStreams.length === 0) {
    return {
      valid: false,
      resolvedKind: params.requestedKind,
      failureCode: 'UNSUPPORTED_CODEC_OR_FORMAT',
      failureMessage:
        'File contains no valid video or audio streams recognized by FFprobe.',
      warnings: [],
      metadata: {
        fileSizeBytes: stat.size,
        mimeType: params.declaredMimeType,
      },
    };
  }

  const primaryVideo = videoStreams[0];
  const primaryAudio = audioStreams[0];

  // Determine whether this is a video asset or pure audio asset based on actual streams
  const isVideoAsset = Boolean(primaryVideo);
  const resolvedKind: AssetKind = isVideoAsset
    ? params.requestedKind === 'b-roll'
      ? 'b-roll'
      : 'raw-video'
    : 'voiceover-audio';

  // Validate container & codec against declared server allowlists
  if (isVideoAsset && primaryVideo) {
    const videoCodec = (primaryVideo.codec_name ?? '').toLowerCase();
    const containerSupported = formatTokens.some((tok) =>
      limits.supportedVideoContainers.includes(tok)
    );
    const codecSupported = limits.supportedVideoCodecs.includes(videoCodec);

    if (!containerSupported || !codecSupported) {
      return {
        valid: false,
        resolvedKind,
        failureCode: 'UNSUPPORTED_CODEC_OR_FORMAT',
        failureMessage: `Unsupported video container (${formatNameRaw || 'unknown'}) or codec (${videoCodec || 'unknown'}). Supported video codecs: ${limits.supportedVideoCodecs.join(', ')}.`,
        warnings: [],
        metadata: {
          fileSizeBytes: stat.size,
          mimeType: params.declaredMimeType,
          containerFormat: formatNameRaw,
          videoCodec,
        },
      };
    }
  } else if (primaryAudio) {
    const audioCodec = (primaryAudio.codec_name ?? '').toLowerCase();
    const containerSupported = formatTokens.some((tok) =>
      limits.supportedAudioContainers.includes(tok)
    );
    const codecSupported = limits.supportedAudioCodecs.includes(audioCodec);

    if (!containerSupported || !codecSupported) {
      return {
        valid: false,
        resolvedKind,
        failureCode: 'UNSUPPORTED_CODEC_OR_FORMAT',
        failureMessage: `Unsupported audio container (${formatNameRaw || 'unknown'}) or codec (${audioCodec || 'unknown'}). Supported audio codecs: ${limits.supportedAudioCodecs.join(', ')}.`,
        warnings: [],
        metadata: {
          fileSizeBytes: stat.size,
          mimeType: params.declaredMimeType,
          containerFormat: formatNameRaw,
          audioCodec,
        },
      };
    }
  }

  // Extract duration from format or stream
  const formatDur = Number(parsed.format?.duration);
  const streamDur = Number(primaryVideo?.duration ?? primaryAudio?.duration);
  const rawDuration =
    Number.isFinite(formatDur) && formatDur > 0
      ? formatDur
      : Number.isFinite(streamDur) && streamDur > 0
        ? streamDur
        : 0;
  const durationSeconds = Math.round(rawDuration * 100) / 100;

  if (durationSeconds <= 0) {
    return {
      valid: false,
      resolvedKind,
      failureCode: 'CORRUPTED_MEDIA_FILE',
      failureMessage: 'Media file has invalid or zero duration.',
      warnings: [],
      metadata: {
        fileSizeBytes: stat.size,
        mimeType: params.declaredMimeType,
      },
    };
  }

  if (durationSeconds > limits.maxDurationSeconds) {
    return {
      valid: false,
      resolvedKind,
      failureCode: 'DURATION_LIMIT_EXCEEDED',
      failureMessage: `Media duration (${durationSeconds}s) exceeds server limit of ${limits.maxDurationSeconds}s.`,
      warnings: [],
      metadata: {
        fileSizeBytes: stat.size,
        mimeType: params.declaredMimeType,
        durationSeconds,
      },
    };
  }

  // Extract audio tracks metadata
  const audioTracks: AudioTrackMetadata[] = audioStreams.map((s, idx) => ({
    streamIndex: typeof s.index === 'number' ? s.index : idx,
    codec: (s.codec_name ?? 'unknown').toLowerCase(),
    sampleRate: Number(s.sample_rate) || 44100,
    channels: Number(s.channels) || 2,
    channelLayout: s.channel_layout,
    language: s.tags?.language,
    durationSeconds: Number(s.duration)
      ? Math.round(Number(s.duration) * 100) / 100
      : durationSeconds,
  }));

  const hasAudioTrack = audioTracks.length > 0;
  const warnings: MediaWarningCode[] = [];

  let width: number | undefined;
  let height: number | undefined;
  let aspectRatioLabel: string | undefined;
  let orientation: 'landscape' | 'portrait' | 'square' | undefined;
  let rotationDegrees = 0;
  let fps: number | undefined;
  let isVariableFrameRate = false;

  if (isVideoAsset && primaryVideo) {
    const codedWidth = Number(primaryVideo.width) || 0;
    const codedHeight = Number(primaryVideo.height) || 0;
    rotationDegrees = extractRotationDegrees(primaryVideo);

    const isRotated90or270 = rotationDegrees === 90 || rotationDegrees === 270;
    width = isRotated90or270 ? codedHeight : codedWidth;
    height = isRotated90or270 ? codedWidth : codedHeight;

    if (width > 0 && height > 0) {
      if (Math.abs(width - height) <= 4) {
        orientation = 'square';
        aspectRatioLabel = '1:1';
      } else if (width > height) {
        orientation = 'landscape';
        aspectRatioLabel = '16:9';
      } else {
        orientation = 'portrait';
        aspectRatioLabel = '9:16';
      }
    }

    const rFps = parseFrameRateFraction(primaryVideo.r_frame_rate);
    const avgFps = parseFrameRateFraction(primaryVideo.avg_frame_rate);
    const chosenFps = avgFps ?? rFps ?? 30;
    fps = Math.round(chosenFps * 100) / 100;

    if (rFps && avgFps && Math.abs(rFps - avgFps) > 0.45) {
      isVariableFrameRate = true;
    }

    if (!hasAudioTrack) {
      warnings.push('VIDEO_HAS_NO_AUDIO_TRACK');
    }
  }

  const effectiveMimeType = isVideoAsset
    ? formatTokens.includes('webm')
      ? 'video/webm'
      : 'video/mp4'
    : formatTokens.includes('wav')
      ? 'audio/wav'
      : formatTokens.includes('mp3')
        ? 'audio/mpeg'
        : 'audio/mp4';

  return {
    valid: true,
    resolvedKind,
    warnings,
    metadata: {
      fileSizeBytes: stat.size,
      mimeType: effectiveMimeType,
      containerFormat: formatTokens[0] ?? formatNameRaw,
      videoCodec: primaryVideo?.codec_name?.toLowerCase(),
      audioCodec: primaryAudio?.codec_name?.toLowerCase(),
      durationSeconds,
      width,
      height,
      aspectRatioLabel,
      orientation,
      rotationDegrees,
      fps,
      isVariableFrameRate,
      hasAudioTrack,
      audioTracks,
    },
  };
}

export interface ProcessedDerivativesResult {
  thumbnailDiskPath?: string;
  previewProxyDiskPath?: string;
  normalizedAudioDiskPath?: string;
  timingLink: TimingLinkSpec;
  warnings: MediaWarningCode[];
}

/**
 * Runs FFmpeg worker to produce:
 * - Thumbnail JPEG (`thumbnail.jpg`) for video assets
 * - Normalized CFR 30fps, orientation-corrected lightweight preview proxy (`preview_proxy.mp4`) for video
 * - Normalized web-playable AAC audio preview (`preview_audio.m4a`) for voiceover audio
 * Preserves exact TimingLinkSpec mapping proxy time back to original source media.
 */
export async function generateDerivedMediaArtifacts(params: {
  sourceDiskPath: string;
  outputDir: string;
  assetId: string;
  kind: AssetKind;
  metadata: AssetTechnicalMetadata;
  initialWarnings: MediaWarningCode[];
  onStageChange?: (
    stage: 'generating-thumbnail' | 'normalizing-proxy'
  ) => void;
}): Promise<ProcessedDerivativesResult> {
  fs.mkdirSync(params.outputDir, { recursive: true });
  const warnings = [...params.initialWarnings];
  const sourceDuration = params.metadata.durationSeconds ?? 1;

  if (params.kind === 'raw-video' || params.kind === 'b-roll') {
    const thumbnailDiskPath = path.join(
      params.outputDir,
      `${params.assetId}_thumb.jpg`
    );
    const previewProxyDiskPath = path.join(
      params.outputDir,
      `${params.assetId}_preview.mp4`
    );

    // 1. Generate Thumbnail JPEG
    params.onStageChange?.('generating-thumbnail');
    const seekSec = Math.min(Math.max(0.1, sourceDuration * 0.2), 3.0).toFixed(2);
    await execFileAsync(
      FFMPEG_BIN,
      [
        '-y',
        '-ss',
        seekSec,
        '-i',
        params.sourceDiskPath,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(640,iw)':-2",
        '-q:v',
        '4',
        thumbnailDiskPath,
      ],
      { timeout: 60000 }
    );

    // 2. Generate Lightweight Preview Proxy (Normalizing VFR -> 30fps CFR & Auto-Rotating phone video)
    params.onStageChange?.('normalizing-proxy');
    const targetFps = 30;
    const ffmpegArgs = [
      '-y',
      '-i',
      params.sourceDiskPath,
      '-vf',
      `scale='min(960,iw)':-2,fps=${targetFps},format=yuv420p`,
      '-vsync',
      'cfr',
      '-r',
      String(targetFps),
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '28',
      '-movflags',
      '+faststart',
    ];

    if (params.metadata.hasAudioTrack) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
    } else {
      ffmpegArgs.push('-an');
    }

    ffmpegArgs.push(previewProxyDiskPath);

    await execFileAsync(FFMPEG_BIN, ffmpegArgs, { timeout: 180000 });

    if (params.metadata.isVariableFrameRate && !warnings.includes('VFR_NORMALIZED_TO_CFR')) {
      warnings.push('VFR_NORMALIZED_TO_CFR');
    }
    if (
      params.metadata.rotationDegrees &&
      params.metadata.rotationDegrees !== 0 &&
      !warnings.includes('ROTATION_NORMALIZED')
    ) {
      warnings.push('ROTATION_NORMALIZED');
    }

    // Probe normalized proxy to compute exact TimingLinkSpec
    let normalizedDurationSec = sourceDuration;
    try {
      const { stdout } = await execFileAsync(
        FFPROBE_BIN,
        [
          '-v',
          'error',
          '-show_format',
          '-of',
          'json',
          previewProxyDiskPath,
        ],
        { timeout: 15000 }
      );
      const proxyProbe = JSON.parse(stdout) as FfprobeOutput;
      const d = Number(proxyProbe.format?.duration);
      if (Number.isFinite(d) && d > 0) {
        normalizedDurationSec = Math.round(d * 100) / 100;
      }
    } catch {
      normalizedDurationSec = sourceDuration;
    }

    const timingLink: TimingLinkSpec = {
      sourceDurationSec: sourceDuration,
      normalizedDurationSec,
      targetCfrFps: targetFps,
      rotationAppliedDegrees: params.metadata.rotationDegrees ?? 0,
      timeScaleRatio:
        sourceDuration > 0
          ? Math.round((normalizedDurationSec / sourceDuration) * 10000) / 10000
          : 1,
    };

    return {
      thumbnailDiskPath,
      previewProxyDiskPath,
      timingLink,
      warnings,
    };
  } else {
    // Voiceover Audio Asset -> Generate web-optimized AAC M4A preview
    params.onStageChange?.('normalizing-proxy');
    const normalizedAudioDiskPath = path.join(
      params.outputDir,
      `${params.assetId}_preview.m4a`
    );

    await execFileAsync(
      FFMPEG_BIN,
      [
        '-y',
        '-i',
        params.sourceDiskPath,
        '-vn',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ar',
        '44100',
        '-movflags',
        '+faststart',
        normalizedAudioDiskPath,
      ],
      { timeout: 120000 }
    );

    let normalizedDurationSec = sourceDuration;
    try {
      const { stdout } = await execFileAsync(
        FFPROBE_BIN,
        [
          '-v',
          'error',
          '-show_format',
          '-of',
          'json',
          normalizedAudioDiskPath,
        ],
        { timeout: 15000 }
      );
      const audioProbe = JSON.parse(stdout) as FfprobeOutput;
      const d = Number(audioProbe.format?.duration);
      if (Number.isFinite(d) && d > 0) {
        normalizedDurationSec = Math.round(d * 100) / 100;
      }
    } catch {
      normalizedDurationSec = sourceDuration;
    }

    const timingLink: TimingLinkSpec = {
      sourceDurationSec: sourceDuration,
      normalizedDurationSec,
      rotationAppliedDegrees: 0,
      timeScaleRatio:
        sourceDuration > 0
          ? Math.round((normalizedDurationSec / sourceDuration) * 10000) / 10000
          : 1,
    };

    return {
      normalizedAudioDiskPath,
      timingLink,
      warnings,
    };
  }
}
