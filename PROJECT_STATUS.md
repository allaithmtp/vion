# VION — AI Video Editor (`PROJECT_STATUS.md`)

## Current Phase
- **Phase 4 (Completed)**: Interactive `@remotion/player` Browser Preview, Versioned & Server-Validated `UnifiedEditPlan` Schema (`v1.0.0`), Shared Scene Components (`VionMasterComposition`), Independent Background Node.js + `@remotion/renderer` MP4 Render Worker (`server/remotionWorker.ts`), Deterministic Non-AI Test 1 (Uploaded Video 10s + Arabic/English Titles + Zoom & Fade) and Test 2 (Uploaded Audio 10s + Motion Graphics Background & Title), Private Storage MP4 Archival with Authorized Download, and Real `FFprobe` Output Verification.

---

## Completed Architecture & Features

### 1. Foundation & UI (Phase 1)
- **Visual Identity**: Deep obsidian (`#0B0C0E`) canvas, crisp white typography, electric blue (`#2563EB` / `#3B82F6`) accents, official VION wordmark top-right (`end`), Sidebar toggle + `New Project` top-left (`start`), and rounded bottom chat bar with `+` button and `Blue Orbit Network Icon`.
- **Responsive Layout**: Desktop split/chat/preview workspace and mobile keyboard-safe (`100dvh`, `pb-safe`) tabs.
- **Instant Bilingual Localization (`EN` / `AR` + `RTL`)**: Full translation dictionary switching layout direction and UI text immediately while preserving user content direction (`dir="auto"`).

### 2. Firebase Auth, Firestore & Admin RBAC (Phase 2)
- **Authentication**: Google Sign-In (`signInWithPopup`), sign-out, and automatic session restoration (`onAuthStateChanged`).
- **Firestore Persistence & Security Rules**:
  - Collections: `/users/{userId}`, `/projects/{projectId}`, `/projects/{projectId}/messages/{messageId}`, `/projects/{projectId}/assets/{assetId}`, `/admins/{adminUid}`, `/admin_invites/{inviteId}`, `/admin_audit_logs/{logId}`.
  - Strict UID ownership isolation in `firestore.rules` (linted with `@firebase/eslint-plugin-security-rules` and deployed via `DeployRules` RPC) and server ownership verification (`server/privateStorage.ts`).
- **Admin Control Center**:
  - Primary Owner (`allaithmtp@gmail.com`) verified server-side by token signature, `email_verified`, and `google.com` provider, bound to immutable UID.
  - 4 separated permissions (`canEditRules`, `canPublishModels`, `canMonitorOperations`, `canManageAccess`), immediate server-side revocation enforcement, and immutable audit logs.

### 3. Resumable Private Storage & FFprobe/FFmpeg Media Pipeline (Phase 3)
- **Direct Resumable Upload Protocol (`/server/privateStorage.ts`, `/src/services/storageService.ts`)**:
  - Uploads binary files in 2 MB chunks directly to `/api/storage/resumable/session/:uploadId` without routing large binaries through the chat payload.
  - Real byte-accurate progress (`uploadedBytes / totalBytes`), instant **Cancel** (aborting request & deleting `.part` file on server), and **Resume / Retry** from the exact server byte offset (`Upload-Offset`).
- **FFprobe Real Content Verification & Configurable Limits (`/server/mediaWorker.ts`)**:
  - Server-configurable limits stored in `.server_data/media_limits.json` (default **1 GB** and **10 minutes**).
  - Extracts `durationSeconds`, `width`, `height`, `fps`, `isVariableFrameRate` (VFR detection), `rotationDegrees`, `orientation`, and `audioTracks`.
- **FFmpeg Worker Derivatives & Source Timing Link (`/server/mediaWorker.ts`)**:
  - Generates frame thumbnail (`_thumb.jpg`), lightweight web-ready 30fps CFR & auto-rotated video preview proxy (`_preview.mp4`), and normalized AAC M4A audio preview (`_preview.m4a`) with `TimingLinkSpec`.

### 4. Remotion Player Preview, Versioned EditPlan Schema & Background MP4 Render Worker (Phase 4)
- **Pinned Compatible Remotion Packages (`4.0.242`)**:
  - `remotion@4.0.242`, `@remotion/player@4.0.242`, `@remotion/renderer@4.0.242`, `@remotion/bundler@4.0.242`, `@remotion/cli@4.0.242`, and `zod@3.24.2`.
- **Unified Versioned EditPlan Schema (`/src/remotion/editPlanSchema.ts`)**:
  - `schemaVersion: '1.0.0'` validated server-side via `validateUnifiedEditPlan` (`POST /api/remotion/plan/validate` and `POST /api/remotion/plan/test-preset`).
  - Covers `assets`, `clips` (`source-video` & `motion-graphics` with `zoomStart`, `zoomEnd`, `fadeInFrames`, `fadeOutFrames`), `textOverlays` (Arabic & English typography, `fontFamily`, `direction`, `position`, `fadeInFrames`, `fadeOutFrames`), `audioTracks`, `width`, `height`, `fps`, and `durationInFrames`.
- **Shared Scene Components (`/src/remotion/VionComposition.tsx`, `/src/remotion/index.tsx`)**:
  - Exact same `VionMasterComposition` component, assets, timing, and fonts (`Cairo, "Noto Sans Arabic", "Plus Jakarta Sans", sans-serif`) are rendered by `<Player>` in `ProjectWorkspace.tsx` and by `@remotion/renderer` on the server.
- **Deterministic Non-AI Tests**:
  1. **Test 1 (`video-10s-bilingual-test`)**: First 10 seconds of an uploaded video (or source duration if shorter), with an Arabic title and an English title, subtle zoom (`1.0 -> 1.08`), and fade in/out.
  2. **Test 2 (`audio-10s-motion-test`)**: First 10 seconds of an uploaded audio file (or source duration if shorter), over a motion graphics background and bilingual title.
- **Independent Background Render Worker & FFprobe MP4 Verification (`/server/remotionWorker.ts`, `/Dockerfile.worker`)**:
  - Enqueues background render jobs (`POST /api/render/jobs`) with persisted job state (`.server_data/render_jobs.json`) and independent job IDs (`rnd_...`), decoupled from browser connection continuity.
  - Renders real H.264 + AAC `.mp4` files using Headless Chromium (`ensureBrowser`, `selectComposition`, `renderMedia`), inspects the output via `/usr/bin/ffprobe` (`inspectRenderedMp4WithFfprobe`), stores the verified `.mp4` in `.private_storage/{ownerUid}/{projectId}/renders/{jobId}.mp4`, and serves authorized downloads (`GET /api/render/jobs/:jobId/download?st=...`).

---

## Next Planned Phases
1. **Brain AI Engine Integration**: Connect server-side Gemini multimodal analysis, speech/timestamp extraction, and AI-driven generation/refinement of `UnifiedEditPlan` scenes via conversation.
