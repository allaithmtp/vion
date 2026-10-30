import { auth } from '../firebase';
import type { UnifiedEditPlan } from '../remotion/editPlanSchema';
import type { RemotionRenderJob } from '../types/domain';

async function getBearerHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication is required.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export const renderService = {
  /**
   * Builds and server-validates one of the two deterministic non-AI test EditPlans:
   * - `video-10s-bilingual-test`: First 10s of uploaded video + Arabic & English titles + subtle zoom & fade
   * - `audio-10s-motion-test`: First 10s of uploaded audio + motion graphics background + title
   */
  async createTestEditPlan(params: {
    projectId: string;
    assetId: string;
    testMode: 'video-10s-bilingual-test' | 'audio-10s-motion-test';
    modelId?: string;
    arabicTitle?: string;
    englishTitle?: string;
  }): Promise<UnifiedEditPlan> {
    const headers = await getBearerHeaders();
    const res = await fetch('/api/remotion/plan/test-preset', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      plan?: UnifiedEditPlan;
      message?: string;
    };

    if (!res.ok || !data.ok || !data.plan) {
      throw new Error(data.message || 'Failed to generate test EditPlan.');
    }

    return data.plan;
  },

  /**
   * Validates any `UnifiedEditPlan` against the server-side Zod schema (`schemaVersion: '1.0.0'`).
   */
  async validateEditPlanOnServer(
    plan: UnifiedEditPlan
  ): Promise<UnifiedEditPlan> {
    const headers = await getBearerHeaders();
    const res = await fetch('/api/remotion/plan/validate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      plan?: UnifiedEditPlan;
      errors?: string[];
      message?: string;
    };

    if (!res.ok || !data.ok || !data.plan) {
      throw new Error(
        data.errors?.join('; ') || data.message || 'Invalid EditPlan schema.'
      );
    }

    return data.plan;
  },

  /**
   * Enqueues an independent background Remotion MP4 render job (`rnd_...`).
   * The job continues running on the server even if the user closes or refreshes the browser.
   */
  async startBackgroundRenderJob(params: {
    projectId: string;
    modelId?: string;
    plan: UnifiedEditPlan;
  }): Promise<RemotionRenderJob> {
    const headers = await getBearerHeaders();
    const res = await fetch('/api/render/jobs', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      job?: RemotionRenderJob;
      message?: string;
    };

    if (!res.ok || !data.ok || !data.job) {
      throw new Error(data.message || 'Failed to start background render job.');
    }

    return data.job;
  },

  /**
   * Polls the current state, frame progress, FFprobe verification report, and signed download URL of a background render job.
   */
  async getRenderJobStatus(jobId: string): Promise<RemotionRenderJob> {
    const headers = await getBearerHeaders();
    const res = await fetch(
      `/api/render/jobs/${encodeURIComponent(jobId)}`,
      {
        headers,
      }
    );

    const data = (await res.json()) as {
      ok?: boolean;
      job?: RemotionRenderJob;
      message?: string;
    };

    if (!res.ok || !data.ok || !data.job) {
      throw new Error(data.message || 'Failed to fetch render job status.');
    }

    return data.job;
  },

  /**
   * Lists all persisted background render jobs for a project.
   */
  async listProjectRenderJobs(
    projectId: string
  ): Promise<RemotionRenderJob[]> {
    const headers = await getBearerHeaders();
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/render-jobs`,
      {
        headers,
      }
    );

    if (!res.ok) return [];
    const data = (await res.json()) as {
      ok?: boolean;
      jobs?: RemotionRenderJob[];
    };
    return Array.isArray(data.jobs) ? data.jobs : [];
  },

  /**
   * Downloads the verified MP4 via an authenticated POST/GET fetch request,
   * strictly validating HTTP status, `Content-Type: video/mp4`, byte size,
   * and the ISO Base Media (`ftyp`) binary header before saving to disk.
   * Never saves an HTML (`Cookie check`) or JSON error response as an MP4 file.
   */
  async downloadRenderedMp4(job: RemotionRenderJob): Promise<void> {
    if (
      job.state !== 'completed' ||
      !job.ffprobeReport ||
      !job.downloadSignedUrl
    ) {
      throw new Error(
        'Rendered MP4 is not ready or has not passed FFprobe verification yet.'
      );
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error('Authentication is required to download rendered MP4.');
    }
    const token = await user.getIdToken();

    // Extract signed token parameter if present on downloadSignedUrl
    let signedToken: string | undefined;
    try {
      const parsedUrl = new URL(job.downloadSignedUrl, window.location.origin);
      signedToken = parsedUrl.searchParams.get('st') ?? undefined;
    } catch {
      signedToken = undefined;
    }

    const endpoint = `/api/render/jobs/${encodeURIComponent(job.id)}/download`;
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'video/mp4, application/octet-stream',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ st: signedToken }),
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
      let errMsg = `Download failed with HTTP ${res.status}.`;
      if (contentType.includes('application/json')) {
        const errJson = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        if (errJson?.message) {
          errMsg = errJson.message;
        }
      }
      throw new Error(errMsg);
    }

    // Strictly reject HTML ("Cookie check") or JSON responses
    if (
      contentType.includes('text/html') ||
      contentType.includes('application/json') ||
      !contentType.includes('video/mp4')
    ) {
      throw new Error(
        `Blocked invalid download response: expected Content-Type "video/mp4", but received "${contentType || 'unknown'}". Refusing to save non-video response as MP4.`
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength < 1024) {
      throw new Error(
        `Blocked corrupted download: received only ${arrayBuffer.byteLength} bytes.`
      );
    }

    // Inspect binary header (bytes 4..7 must be 'ftyp', 'moov', or 'wide')
    const headerBytes = new Uint8Array(arrayBuffer, 0, 12);
    const boxType = String.fromCharCode(
      headerBytes[4],
      headerBytes[5],
      headerBytes[6],
      headerBytes[7]
    );
    if (boxType !== 'ftyp' && boxType !== 'moov' && boxType !== 'wide') {
      throw new Error(
        `Blocked invalid MP4 binary stream: missing ISO Base Media (ftyp/moov) header signature (found "${boxType}").`
      );
    }

    const expectedBytes = job.ffprobeReport.fileSizeBytes;
    if (expectedBytes > 0 && arrayBuffer.byteLength !== expectedBytes) {
      throw new Error(
        `Incomplete MP4 download: expected ${expectedBytes} bytes, received ${arrayBuffer.byteLength} bytes.`
      );
    }

    const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `VION_${job.planMode}_${job.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 15000);
    }
  },
};
