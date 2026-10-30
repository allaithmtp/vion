import type { SupportedLocale } from '../types/domain';

export const TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  en: {
    // App & General
    'app.title': 'AI Video Editor',
    'app.newProject': 'New Project',
    'app.done': 'Done',
    'app.cancel': 'Cancel',
    'app.save': 'Save',
    'app.edit': 'Edit',
    'app.upload': 'Upload',
    'app.delete': 'Delete',
    'app.rename': 'Rename',
    'app.close': 'Close',
    'app.enabled': 'enabled',
    'app.disabledInPhase1': 'Not connected yet',

    // Auth & Session
    'auth.signInWithGoogle': 'Sign in with Google',
    'auth.signOut': 'Sign out',
    'auth.restoringSession': 'Restoring authenticated session...',
    'auth.requiredTitle': 'Sign in to create and save projects',
    'auth.requiredDesc':
      'Projects, conversations, and private media files are linked to your verified Google account and protected on the server.',
    'auth.verifiedGoogleBadge': 'Verified Google Account',

    // Sidebar
    'sidebar.newProject': '+ New Project',
    'sidebar.elements': 'Elements',
    'sidebar.brand': 'Brand',
    'sidebar.settings': 'Settings',
    'sidebar.adminPanel': 'Admin Panel',
    'sidebar.projectsHeader': 'PROJECTS',
    'sidebar.activeFilter': 'Active',
    'sidebar.archivedFilter': 'Archived',
    'sidebar.noProjects': 'No saved projects yet',
    'sidebar.noArchivedProjects': 'No archived projects',
    'sidebar.creatorAccount': 'Creator Account',
    'sidebar.toggleSidebar': 'Toggle Sidebar',
    'sidebar.archiveProject': 'Archive project',
    'sidebar.unarchiveProject': 'Restore project',
    'sidebar.deleteProjectConfirm': 'Delete project',

    // Empty State / Home
    'home.subtitle': 'AI Video Editor',
    'home.workflowHint':
      'Attach a raw video to edit or a voiceover track to build explanatory motion graphics.',
    'home.action.rawVideo': 'Raw Video Edit',
    'home.action.rawVideoSub': 'Cut silences, reframe, add captions & B-roll',
    'home.action.voiceover': 'Voiceover to Motion',
    'home.action.voiceoverSub': 'Turn spoken audio into kinetic visual scenes',

    // Chat Bar, Resumable Upload & Drop-up Menus
    'chat.placeholder': 'Ask AI to edit your video...',
    'chat.sendAria': 'Send instruction to Brain',
    'chat.attachAria': 'Upload video or voiceover audio',
    'chat.attachTitle': 'Direct Resumable Upload to Private Vault',
    'chat.attachRawVideo': 'Upload Raw Video (MP4, MOV, WebM, MKV)',
    'chat.attachRawVideoDesc': 'Verified via FFprobe · Auto-rotates & normalizes VFR to 30fps proxy',
    'chat.attachVoiceover': 'Upload Voiceover Audio (MP3, WAV, M4A, AAC, FLAC)',
    'chat.attachVoiceoverDesc': 'Verified via FFprobe · Normalized for motion graphics timing',
    'chat.localInspectNote':
      'Uploads directly in resumable chunks without passing through chat messages. Max 1 GB · Max 10 min.',
    'chat.modelsButton': 'Models',
    'chat.stylesButton': 'Styles',
    'chat.modelsMenuTitle': 'Brain Engine (Server-Managed)',
    'chat.stylesMenuTitle': 'Visual & Editing Style Preset',
    'chat.phase1Badge': 'Phase 4 · Remotion Player & Render Worker Active',
    'chat.phase1SystemReply':
      'Instruction saved to Firestore under your account. You can test the deterministic Remotion compositions and export a real MP4 from the Preview stage.',
    'chat.assetAddedSystemReply':
      'Media verified by FFprobe, processed by FFmpeg worker (thumbnail & preview proxy ready), and ready for Remotion composition preview & MP4 export.',

    // Resumable Upload & FFmpeg Worker States
    'upload.stagingTitle': 'Direct Resumable Upload & FFmpeg Worker',
    'upload.state.uploading': 'Uploading chunks to private storage...',
    'upload.state.paused': 'Upload interrupted — ready to resume from byte offset',
    'upload.state.canceled': 'Upload canceled & temporary part file cleaned',
    'upload.state.processing': 'FFprobe verifying streams & FFmpeg generating proxy...',
    'upload.state.ready': 'Verified & Ready in Project',
    'upload.state.failed': 'Media validation or upload failed',
    'upload.cancelBtn': 'Cancel',
    'upload.retryBtn': 'Resume / Retry',
    'upload.dismissBtn': 'Dismiss',
    'upload.limitsHint':
      'Supported: MP4, MOV, WebM, MKV, MP3, WAV, M4A, AAC, OGG, FLAC · Max 1 GB · Max 10 min (verified by FFprobe)',
    'upload.warning.noAudio': 'Silent Video (No Audio Track Detected)',
    'upload.warning.vfrNormalized': 'VFR Normalized to 30fps CFR (Timing Linked)',
    'upload.warning.rotationNormalized': 'Phone Orientation Normalized',

    // Models & Styles Catalog
    'models.brain18.description':
      'VION core multimodal planning engine. Understands video & voiceover, plans scenes, and targets Remotion compositions. Underlying AI models are routed on the server.',
    'models.phase1DisabledNotice':
      'Server AI execution is disabled in this phase. Engine selection is persisted in Firestore.',
    'styles.cleanCutStudio.name': 'Clean Cut Studio',
    'styles.cleanCutStudio.description':
      'Tight silence removal, subtle punch-in zooms, and synchronized word captions.',
    'styles.kineticExplainer.name': 'Kinetic Explainer',
    'styles.kineticExplainer.description':
      'Transforms voiceover tracks into structured motion graphics, callouts, and kinetic text.',
    'styles.minimalDocumentary.name': 'Minimal Documentary',
    'styles.minimalDocumentary.description':
      'Cinematic pacing, chapter headers, clean lower thirds, and smooth transitions.',
    'styles.highRetentionSocial.name': 'High-Retention Pacing',
    'styles.highRetentionSocial.description':
      'Fast rhythm cuts, dynamic framing, and high-contrast visual emphasis.',
    'styles.tags.silenceRemoval': 'Silence Removal',
    'styles.tags.dynamicZoom': 'Dynamic Zoom',
    'styles.tags.wordCaptions': 'Word Captions',
    'styles.tags.voiceoverToMotion': 'Voiceover to Motion',
    'styles.tags.kineticType': 'Kinetic Type',
    'styles.tags.visualDiagrams': 'Visual Scenes',
    'styles.tags.chapterHeaders': 'Chapter Headers',
    'styles.tags.lowerThirds': 'Lower Thirds',
    'styles.tags.smoothTransitions': 'Smooth Transitions',
    'styles.tags.fastPacing': 'Fast Pacing',
    'styles.tags.punchZooms': 'Punch Zooms',
    'styles.tags.callouts': 'Callouts',

    // Project Workspace & Preview
    'project.untitled': 'Untitled Project',
    'project.renameTooltip': 'Click to rename project',
    'project.archivedBadge': 'Archived',
    'project.mode.unselected': 'Draft Project',
    'project.mode.videoEdit': 'Raw Video Editing',
    'project.mode.voiceoverMotion': 'Voiceover Motion Graphics',
    'project.tab.chat': 'Conversation',
    'project.tab.preview': 'Preview & Stage',
    'project.tab.split': 'Split View',
    'project.preview.title': 'Remotion Preview & Verified Media Stage',
    'project.preview.emptyTitle': 'No source media attached yet',
    'project.preview.emptyDesc':
      'Use the + button in the chat bar to upload a video or voiceover directly to your private storage vault (no message required).',
    'project.preview.remotionBadge': 'Remotion 4.0.242 · Schema v1.0.0',
    'project.preview.exportMp4': 'Render Real MP4',
    'project.preview.exportDisabledHint':
      'Select or build a Remotion EditPlan first to render a real MP4',
    'project.preview.scenePlanHeader': 'Unified Edit Plan (Schema v1.0.0) & Non-AI Tests',
    'project.preview.noScenesYet':
      'Upload a video or audio file, then load Test 1 (10s Video + AR/EN Titles + Zoom/Fade) or Test 2 (10s Audio + Motion Background & Title) to preview in Remotion Player and render a real MP4.',
    'project.preview.modeSource': 'Raw Media Player',
    'project.preview.modeRemotion': 'Remotion Composition Player',
    'project.preview.loadTest1VideoBtn':
      'Test 1: 10s Video + AR/EN Titles + Zoom & Fade',
    'project.preview.loadTest2AudioBtn':
      'Test 2: 10s Audio + Motion Graphics & Title',
    'project.preview.renderMp4Btn': 'Render Real MP4 (Background Worker)',
    'project.preview.renderingInProgress': 'Rendering MP4 in Background...',
    'project.preview.renderJobsHeader': 'Background Remotion Render Jobs (Independent Worker)',
    'project.preview.noRenderJobs': 'No MP4 render jobs queued for this project yet.',
    'project.preview.downloadMp4Btn': 'Authorized Download MP4',
    'project.preview.ffprobeVerifiedBadge': 'Verified by FFprobe (H.264 + AAC)',
    'project.preview.schemaValidatedBadge': 'Server-Validated Schema v1.0.0',
    'project.preview.activeConfig': 'Active Project Configuration',
    'project.preview.engineLabel': 'Engine',
    'project.preview.styleLabel': 'Style',
    'project.preview.elementsLabel': 'Permitted Elements',
    'project.preview.versionsLabel': 'Output Versions',
    'project.preview.noVersions': 'No rendered MP4 versions',
    'project.preview.proxyBadge': 'Lightweight Preview Proxy (30fps CFR)',
    'project.preview.thumbnailLabel': 'FFmpeg Extracted Thumbnail',
    'project.preview.audioTracksLabel': 'Audio Streams',
    'project.preview.silentVideoBadge': 'Silent Video (0 Audio Tracks)',
    'project.preview.timingLinkLabel': 'Source Timing Link',
    'project.preview.renewUrlsBtn': 'Refresh Signed Link',
    'project.chat.emptyTitle': 'Start directing your edit',
    'project.chat.emptyDesc':
      'Upload a video or voiceover with the + button (even without typing a message), or describe how you want your project edited.',

    // Elements Modal
    'elements.title': 'Elements',
    'elements.subtitle': 'Editing capabilities Brain 1.8 is permitted to use.',
    'elements.enableAll': 'Enable all',
    'elements.disableAll': 'Disable all',
    'elements.footerNote':
      'All capabilities are enabled by default. Disabling an Element acts as a hard editing constraint.',
    'elements.cuts-trimming.title': 'Cuts & Trimming',
    'elements.cuts-trimming.desc':
      'Remove silences, filler words, dead air, and tighten scene pacing.',
    'elements.zoom-reframe.title': 'Zoom & Reframe',
    'elements.zoom-reframe.desc':
      'Dynamic punch-ins, speaker tracking, and focal reframing.',
    'elements.speed.title': 'Speed',
    'elements.speed.desc':
      'Speed ramps, time-remapping, and rhythmic velocity adjustments.',
    'elements.transitions.title': 'Transitions',
    'elements.transitions.desc':
      'Seamless cuts, whip pans, match dissolves, and motion transitions.',
    'elements.captions.title': 'Captions',
    'elements.captions.desc':
      'Word-accurate synchronized subtitles and speaker emphasis.',
    'elements.titles.title': 'Titles',
    'elements.titles.desc':
      'Chapter headers, opening titles, and structured callouts.',
    'elements.text-animation.title': 'Text Animation',
    'elements.text-animation.desc':
      'Kinetic typography, word-by-word reveals, and motion text.',
    'elements.b-roll.title': 'B-Roll',
    'elements.b-roll.desc':
      'Contextual cutaway footage layered over primary dialogue.',
    'elements.motion-graphics.title': 'Motion Graphics',
    'elements.motion-graphics.desc':
      'Explanatory visual scenes, diagrams, and animated icons driven by voiceover.',
    'elements.sound-effects.title': 'Sound Effects',
    'elements.sound-effects.desc':
      'Subtle whooshes, risers, and tactile UI audio accents synced to motion.',
    'elements.background-music.title': 'Background Music',
    'elements.background-music.desc':
      'Mood-matched instrumental beds aligned to narrative beats.',
    'elements.audio-ducking.title': 'Audio Ducking & Cleanup',
    'elements.audio-ducking.desc':
      'Automatic voice clarity leveling and music attenuation during speech.',
    'elements.color-grading.title': 'Color Grading',
    'elements.color-grading.desc':
      'Consistent contrast, skin-tone balance, and cinematic look profiles.',
    'elements.split-screen.title': 'Split Screen & Layouts',
    'elements.split-screen.desc':
      'Multi-source framing, side-by-side comparisons, and grid compositions.',
    'elements.callouts-highlights.title': 'Callouts & Highlights',
    'elements.callouts-highlights.desc':
      'Visual pointers, spotlight masks, and key metric emphasis.',
    'elements.chapter-markers.title': 'Chapter Markers',
    'elements.chapter-markers.desc':
      'Segmented topic dividers and progress indicators for long-form content.',
    'elements.lower-thirds.title': 'Lower Thirds',
    'elements.lower-thirds.desc':
      'Speaker nameplates, source citations, and contextual badges.',
    'elements.auto-framing.title': 'Auto Framing',
    'elements.auto-framing.desc':
      'Intelligent aspect-ratio adaptation across 16:9, 9:16, and 1:1 canvases.',

    // Brand Modal
    'brand.title': 'Brand',
    'brand.subtitle':
      'Reusable brand identity applied automatically across your projects.',
    'brand.logo.label': 'Logo',
    'brand.logo.summary': 'V Logo with Blue Dot (1).png',
    'brand.secondaryLogo.label': 'Secondary Logo',
    'brand.secondaryLogo.summary': 'Monochrome / compact icon mark',
    'brand.watermark.label': 'Watermark',
    'brand.watermark.summary': 'Bottom-right · 65% opacity · Enabled on export',
    'brand.colors.label': 'Colors',
    'brand.fonts.label': 'Fonts',
    'brand.fonts.summary':
      'Plus Jakarta Sans · SemiBold Headings · Medium Captions',
    'brand.intro.label': 'Intro',
    'brand.intro.summary': 'Minimal 1.2s logo reveal',
    'brand.outro.label': 'Outro',
    'brand.outro.summary': 'Clean end card with brand lockup',
    'brand.lowerThird.label': 'Lower Third',
    'brand.lowerThird.summary':
      'Minimal dark glass bar with speaker name & role',
    'brand.editPrompt': 'Update value',

    // Settings & Account Modal
    'settings.title': 'Settings & Account',
    'settings.subtitle':
      'Manage interface language, Google account session, and inspect active services.',
    'settings.languageLabel': 'Interface Language',
    'settings.languageDesc':
      'Switches the entire UI and layout direction (LTR / RTL) immediately without altering your video or message content.',
    'settings.langEn': 'English (Default)',
    'settings.langAr': 'العربية (RTL)',
    'settings.accountSection': 'Authenticated Google Profile',
    'settings.accountNameLabel': 'Display Name',
    'settings.accountTierValue': 'Creator Account',
    'settings.primaryOwnerBadge': 'Primary Owner',
    'settings.adminBadge': 'Authorized Admin',
    'settings.servicesSection': 'Architecture & Service Layer Status (Phase 4)',
    'settings.service.ui': 'Firebase Auth (Google) & Firestore Database',
    'settings.service.uiStatus': 'Connected & Verified',
    'settings.service.privateStorage':
      'Resumable Private Storage & Signed Stream Tokens',
    'settings.service.privateStorageStatus': 'Active (UID-Isolated)',
    'settings.service.ffmpegWorker':
      'FFprobe Content Inspection & FFmpeg Proxy Worker',
    'settings.service.ffmpegWorkerStatus': 'Active (1GB / 10m Limits)',
    'settings.service.brain': 'Brain AI Engine (Analysis & Scene Planning)',
    'settings.service.brainStatus': 'Not connected yet',
    'settings.service.remotion': 'Remotion 4.0.242 Player & Background MP4 Worker',
    'settings.service.remotionStatus': 'Active (Headless Chromium + FFprobe)',
    'settings.service.storage': 'Billing & Payment Gateway',
    'settings.service.storageStatus': 'Not connected yet',

    // Admin Panel (8 Sections + RBAC + Audit Logs)
    'admin.title': 'VION Control Center',
    'admin.subtitle':
      'Server-verified administration, RBAC permissions, and engine governance.',
    'admin.backToEditor': 'Back to Editor',
    'admin.primaryOwnerLabel': 'Primary Owner',
    'admin.boundUidLabel': 'Bound Immutable UID',
    'admin.notBoundYet':
      'Awaiting first verified Google login by Primary Owner',
    'admin.sec.models': 'Models',
    'admin.sec.rules': 'Rules',
    'admin.sec.skills': 'Skills',
    'admin.sec.styles': 'Styles',
    'admin.sec.references': 'References',
    'admin.sec.jobs': 'Jobs',
    'admin.sec.usage': 'Usage',
    'admin.sec.access': 'Access',
    'admin.perm.editRules': 'Edit Rules, Skills, Styles & References',
    'admin.perm.publishModels': 'Publish & Route Brain Models',
    'admin.perm.monitorOperations': 'Monitor Jobs & Usage Telemetry',
    'admin.perm.manageAccess': 'Manage Admin Access & Permissions',
    'admin.access.inviteTitle': 'Grant Admin Access by Verified Google Email',
    'admin.access.emailPlaceholder': 'colleague@gmail.com',
    'admin.access.grantBtn': 'Save / Grant Permissions',
    'admin.access.activeGrantsTitle':
      'Authorized Administrators & Pending Invites',
    'admin.access.revokeBtn': 'Revoke Access',
    'admin.access.primaryProtected': 'Immutable Primary Owner',
    'admin.access.boundStatus': 'Bound to UID',
    'admin.access.pendingStatus': 'Pending Google Login',
    'admin.audit.title': 'Administrative Audit Log',
    'admin.audit.empty': 'No administrative changes recorded yet.',
    'admin.sectionPlaceholder.badge': 'Structure Ready · Upcoming Phase',
    'admin.sectionPlaceholder.desc':
      'This administrative module structure and server permission guard are active. Operational controls for this module will be wired in its dedicated phase.',
    'admin.sectionLocked.title': 'Permission Required',
    'admin.sectionLocked.desc':
      'Your administrator account does not have the required permission to access or modify this section. Server API requests to this module are blocked.',
  },

  ar: {
    // App & General
    'app.title': 'محرر الفيديو بالذكاء الاصطناعي',
    'app.newProject': 'مشروع جديد',
    'app.done': 'تم',
    'app.cancel': 'إلغاء',
    'app.save': 'حفظ',
    'app.edit': 'تعديل',
    'app.upload': 'رفع',
    'app.delete': 'حذف',
    'app.rename': 'إعادة تسمية',
    'app.close': 'إغلاق',
    'app.enabled': 'مفعّل',
    'app.disabledInPhase1': 'غير مربوط بعد',

    // Auth & Session
    'auth.signInWithGoogle': 'تسجيل الدخول عبر Google',
    'auth.signOut': 'تسجيل الخروج',
    'auth.restoringSession': 'جارٍ استعادة الجلسة الموثقة...',
    'auth.requiredTitle': 'سجّل الدخول لإنشاء وحفظ مشاريعك',
    'auth.requiredDesc':
      'تُربط جميع المشاريع والمحادثات والملفات الخاصة بمعرّف حسابك الموثق في Google مع التحقق من الهوية والملكية في الخادم وقاعدة البيانات.',
    'auth.verifiedGoogleBadge': 'حساب Google موثق',

    // Sidebar
    'sidebar.newProject': '+ مشروع جديد',
    'sidebar.elements': 'العناصر',
    'sidebar.brand': 'الهوية البصرية',
    'sidebar.settings': 'الإعدادات',
    'sidebar.adminPanel': 'لوحة الإدارة',
    'sidebar.projectsHeader': 'المشاريع',
    'sidebar.activeFilter': 'النشطة',
    'sidebar.archivedFilter': 'المؤرشفة',
    'sidebar.noProjects': 'لا توجد مشاريع محفوظة بعد',
    'sidebar.noArchivedProjects': 'لا توجد مشاريع مؤرشفة',
    'sidebar.creatorAccount': 'حساب صانع محتوى',
    'sidebar.toggleSidebar': 'إظهار/إخفاء القائمة الجانبية',
    'sidebar.archiveProject': 'أرشفة المشروع',
    'sidebar.unarchiveProject': 'استعادة المشروع من الأرشيف',
    'sidebar.deleteProjectConfirm': 'حذف المشروع',

    // Empty State / Home
    'home.subtitle': 'محرر الفيديو بالذكاء الاصطناعي',
    'home.workflowHint':
      'أرفق فيديو خام لتحريره، أو تعليقًا صوتيًا لتحويله إلى مشاهد موشن جرافيك تشرح الكلام.',
    'home.action.rawVideo': 'تحرير فيديو خام',
    'home.action.rawVideoSub':
      'قص الصمت، إعادة التأطير، نصوص متزامنة ولقطات B-Roll',
    'home.action.voiceover': 'تعليق صوتي إلى موشن جرافيك',
    'home.action.voiceoverSub':
      'تحويل الصوت المسجل إلى مشاهد بصرية متحركة تشرح المحتوى',

    // Chat Bar, Resumable Upload & Drop-up Menus
    'chat.placeholder': 'اطلب من الذكاء الاصطناعي تعديل الفيديو...',
    'chat.sendAria': 'إرسال التوجيه إلى محرك Brain',
    'chat.attachAria': 'رفع فيديو خام أو تعليق صوتي',
    'chat.attachTitle': 'رفع مباشر قابل للاستكمال إلى التخزين الخاص',
    'chat.attachRawVideo': 'رفع فيديو خام (MP4, MOV, WebM, MKV)',
    'chat.attachRawVideoDesc':
      'فحص المحتوى عبر FFprobe · تصحيح اتجاه الهاتف وتوحيد VFR إلى 30fps',
    'chat.attachVoiceover': 'رفع تعليق صوتي (MP3, WAV, M4A, AAC, FLAC)',
    'chat.attachVoiceoverDesc':
      'فحص المحتوى عبر FFprobe · تجهيز نسخة صوتية ومزامنة التوقيت للموشن جرافيك',
    'chat.localInspectNote':
      'يُرفع الملف مباشرة بأجزاء قابلة للاستكمال دون تمريره عبر خادم المحادثة. الحد الأقصى 1GB و10 دقائق.',
    'chat.modelsButton': 'النماذج (Models)',
    'chat.stylesButton': 'الأنماط (Styles)',
    'chat.modelsMenuTitle': 'محرك Brain (يدار من الخادم)',
    'chat.stylesMenuTitle': 'نمط التحرير والموشن جرافيك',
    'chat.phase1Badge': 'المرحلة 4 · مشغل Remotion وعامل الرندر نشط',
    'chat.phase1SystemReply':
      'تم حفظ رسالتك في Firestore ضمن مشروعك الخاص. يمكنك الآن تجربة اختبارات Remotion وتصدير ملف MP4 حقيقي بالصوت من قسم المعاينة.',
    'chat.assetAddedSystemReply':
      'تم التحقق من محتوى الملف عبر FFprobe وتوليد المعاينة عبر FFmpeg، وهو جاهز الآن للمعاينة في Remotion وتصدير MP4.',

    // Resumable Upload & FFmpeg Worker States
    'upload.stagingTitle': 'الرفع المباشر القابل للاستكمال وعامل FFmpeg',
    'upload.state.uploading': 'جارٍ الرفع المباشر للتخزين الخاص...',
    'upload.state.paused': 'توقف الرفع — جاهز للاستكمال من آخر جزء مرفوع',
    'upload.state.canceled': 'تم إلغاء الرفع وحذف الملف المؤقت',
    'upload.state.processing':
      'جارٍ فحص المحتوى عبر FFprobe وتوليد المعاينة عبر FFmpeg...',
    'upload.state.ready': 'تم التحقق والتجهيز في المشروع',
    'upload.state.failed': 'فشل الرفع أو التحقق من صحة الملف',
    'upload.cancelBtn': 'إلغاء',
    'upload.retryBtn': 'استكمال / إعادة المحاولة',
    'upload.dismissBtn': 'إخفاء',
    'upload.limitsHint':
      'الصيغ المدعومة: MP4, MOV, WebM, MKV, MP3, WAV, M4A, AAC, OGG, FLAC · الحد الأقصى 1GB و10 دقائق (يتحقق منها FFprobe فعليًا)',
    'upload.warning.noAudio': 'فيديو صامت (لا يحتوي على مسار صوتي)',
    'upload.warning.vfrNormalized':
      'تم توحيد معدل الإطارات المتغير إلى 30fps مع ربط التوقيت بالأصل',
    'upload.warning.rotationNormalized': 'تم تصحيح اتجاه فيديو الهاتف تلقائيًا',

    // Models & Styles Catalog
    'models.brain18.description':
      'محرك التخطيط الأساسي في منصة VION. يفهم الفيديو والتعليق الصوتي ويخطط للمشاهد لتنفيذها عبر Remotion. تُحدَّد نماذج الذكاء الاصطناعي المشغّلة له من الخادم.',
    'models.phase1DisabledNotice':
      'التنفيذ الفعلي للذكاء الاصطناعي غير مربوط في هذه المرحلة. يتم حفظ اختيار المحرك في Firestore.',
    'styles.cleanCutStudio.name': 'مونتاج استوديو نظيف',
    'styles.cleanCutStudio.description':
      'إزالة دقيقة لفترات الصمت، تقريب بصري متوازن، ونصوص متزامنة كلمة بكلمة.',
    'styles.kineticExplainer.name': 'موشن جرافيك توضيحي',
    'styles.kineticExplainer.description':
      'يحوّل التعليق الصوتي إلى مشاهد موشن جرافيك منظمة، بطاقات شرح، ونصوص حركية.',
    'styles.minimalDocumentary.name': 'وثائقي هادئ',
    'styles.minimalDocumentary.description':
      'إيقاع سينمائي، عناوين فصول واضحة، شريط تعريف سفلي، وانتقالات ناعمة.',
    'styles.highRetentionSocial.name': 'إيقاع سريع عالي الجذب',
    'styles.highRetentionSocial.description':
      'تقطيع سريع، تقريب ديناميكي، وإبراز بصري عالي التباين للنقاط المهمة.',
    'styles.tags.silenceRemoval': 'إزالة الصمت',
    'styles.tags.dynamicZoom': 'تقريب ديناميكي',
    'styles.tags.wordCaptions': 'كابشن كلمة بكلمة',
    'styles.tags.voiceoverToMotion': 'صوت إلى موشن',
    'styles.tags.kineticType': 'نصوص حركية',
    'styles.tags.visualDiagrams': 'مشاهد توضيحية',
    'styles.tags.chapterHeaders': 'عناوين فصول',
    'styles.tags.lowerThirds': 'شريط تعريف سفلي',
    'styles.tags.smoothTransitions': 'انتقالات ناعمة',
    'styles.tags.fastPacing': 'إيقاع سريع',
    'styles.tags.punchZooms': 'زوم خاطف',
    'styles.tags.callouts': 'إشارات توضيحية',

    // Project Workspace & Preview
    'project.untitled': 'مشروع بدون عنوان',
    'project.renameTooltip': 'اضغط لتغيير اسم المشروع',
    'project.archivedBadge': 'مؤرشف',
    'project.mode.unselected': 'مسودة مشروع',
    'project.mode.videoEdit': 'تحرير فيديو خام',
    'project.mode.voiceoverMotion': 'موشن جرافيك لتعليق صوتي',
    'project.tab.chat': 'المحادثة',
    'project.tab.preview': 'المعاينة والمشاهد',
    'project.tab.split': 'عرض مزدوج',
    'project.preview.title': 'منصة معاينة Remotion والوسائط الموثقة',
    'project.preview.emptyTitle': 'لم يتم إرفاق ملف فيديو أو صوت بعد',
    'project.preview.emptyDesc':
      'استخدم زر + في شريط المحادثة لرفع فيديو خام أو تعليق صوتي مباشرة إلى مساحتك الخاصة دون الحاجة لكتابة رسالة.',
    'project.preview.remotionBadge': 'Remotion 4.0.242 · مخطط الإصدار 1.0.0',
    'project.preview.exportMp4': 'تصدير MP4 حقيقي',
    'project.preview.exportDisabledHint':
      'اختر أو أنشئ خطة تحرير Remotion أولًا لتصدير ملف MP4 حقيقي',
    'project.preview.scenePlanHeader': 'مخطط التحرير الموحد (v1.0.0) واختبارات الرندر (دون AI)',
    'project.preview.noScenesYet':
      'ارفع فيديو أو ملف صوت، ثم شغّل الاختبار 1 (أول 10 ثوانٍ للفيديو مع عنوان عربي وإنجليزي وتكبير وتلاشي) أو الاختبار 2 (أول 10 ثوانٍ للصوت فوق خلفية موشن وعنوان) لمعاينته في Remotion Player وتصدير MP4 حقيقي.',
    'project.preview.modeSource': 'مشغل الملف الأصلي',
    'project.preview.modeRemotion': 'معاينة Remotion Player',
    'project.preview.loadTest1VideoBtn':
      'اختبار 1: أول 10 ثوانٍ فيديو + عنوان عربي وإنجليزي + تكبير وتلاشي',
    'project.preview.loadTest2AudioBtn':
      'اختبار 2: أول 10 ثوانٍ صوت + خلفية موشن جرافيك وعنوان',
    'project.preview.renderMp4Btn': 'تصدير MP4 حقيقي بالصوت (مهمة خلفية)',
    'project.preview.renderingInProgress': 'جارٍ رندر MP4 في الخلفية...',
    'project.preview.renderJobsHeader': 'مهام رندر Remotion الخلفية (مستقلة عن المتصفح)',
    'project.preview.noRenderJobs': 'لا توجد مهام رندر MP4 لهذا المشروع بعد.',
    'project.preview.downloadMp4Btn': 'تنزيل MP4 المصرح به',
    'project.preview.ffprobeVerifiedBadge': 'تم فحصه عبر FFprobe (H.264 + AAC)',
    'project.preview.schemaValidatedBadge': 'مخطط موثق خادميًا v1.0.0',
    'project.preview.activeConfig': 'إعدادات المشروع الحالية',
    'project.preview.engineLabel': 'المحرك',
    'project.preview.styleLabel': 'النمط',
    'project.preview.elementsLabel': 'العناصر المسموحة',
    'project.preview.versionsLabel': 'إصدارات النتائج',
    'project.preview.noVersions': 'لا توجد إصدارات MP4 مصدّرة',
    'project.preview.proxyBadge': 'نسخة معاينة خفيفة (30fps CFR)',
    'project.preview.thumbnailLabel': 'الصورة المصغرة المستخرجة',
    'project.preview.audioTracksLabel': 'مسارات الصوت',
    'project.preview.silentVideoBadge': 'فيديو صامت (بلا مسار صوتي)',
    'project.preview.timingLinkLabel': 'ربط التوقيت بالأصل',
    'project.preview.renewUrlsBtn': 'تجديد الرابط المؤقت',
    'project.chat.emptyTitle': 'ابدأ برفع ملفك أو توجيه التحرير',
    'project.chat.emptyDesc':
      'ارفع فيديو خام أو تعليقًا صوتيًا عبر زر + (حتى دون كتابة رسالة)، أو اكتب توجيهاتك في المحادثة.',

    // Elements Modal
    'elements.title': 'العناصر (Elements)',
    'elements.subtitle': 'قدرات التحرير المسموح لمحرك Brain 1.8 باستخدامها.',
    'elements.enableAll': 'تفعيل الكل',
    'elements.disableAll': 'تعطيل الكل',
    'elements.footerNote':
      'جميع القدرات مفعّلة افتراضيًا. تعطيل أي عنصر يُعدّ قيدًا صارمًا يمنع المحرك من استخدامه.',
    'elements.cuts-trimming.title': 'القص والتشذيب (Cuts & Trimming)',
    'elements.cuts-trimming.desc':
      'إزالة الصمت والكلمات الحشوية والفراغات وضبط إيقاع المشاهد.',
    'elements.zoom-reframe.title': 'التقريب وإعادة التأطير (Zoom & Reframe)',
    'elements.zoom-reframe.desc':
      'تقريب ديناميكي، تتبع المتحدث، وإعادة ضبط زاوية التركيز.',
    'elements.speed.title': 'السرعة (Speed)',
    'elements.speed.desc':
      'تدرجات السرعة، إعادة التوقيت الزمني، وضبط السرعة الإيقاعية.',
    'elements.transitions.title': 'الانتقالات (Transitions)',
    'elements.transitions.desc':
      'قطع سلس، انتقالات حركية سريعة، ومزج بصري متناغم بين اللقطات.',
    'elements.captions.title': 'النصوص المتزامنة (Captions)',
    'elements.captions.desc':
      'ترجمة نصية متزامنة بدقة كلمة بكلمة مع إبراز نبرة المتحدث.',
    'elements.titles.title': 'العناوين (Titles)',
    'elements.titles.desc':
      'عناوين الفصول، شاشات البداية، والبطاقات التوضيحية المنظمة.',
    'elements.text-animation.title': 'تحريك النصوص (Text Animation)',
    'elements.text-animation.desc':
      'تايبوجرافي حركي، إظهار متدرج للكلمات، ونصوص متحركة.',
    'elements.b-roll.title': 'لقطات التغطية (B-Roll)',
    'elements.b-roll.desc': 'مشاهد مساندة سياقية تُعرض فوق الحوار الأساسي.',
    'elements.motion-graphics.title': 'الموشن جرافيك (Motion Graphics)',
    'elements.motion-graphics.desc':
      'مشاهد توضيحية ورسوم بيانية وأيقونات متحركة مبنية على التعليق الصوتي.',
    'elements.sound-effects.title': 'المؤثرات الصوتية (Sound Effects)',
    'elements.sound-effects.desc':
      'مؤثرات انتقال وتنبيهات صوتية متزامنة مع الحركة البصرية.',
    'elements.background-music.title': 'الموسيقى الخلفية (Background Music)',
    'elements.background-music.desc':
      'خلفيات موسيقية متوافقة مع طابع الفيديو وإيقاع السرد.',
    'elements.audio-ducking.title':
      'تنقية الصوت وخفض الموسيقى (Audio Ducking)',
    'elements.audio-ducking.desc':
      'موازنة وضوح الصوت وخفض الموسيقى تلقائيًا أثناء الكلام.',
    'elements.color-grading.title': 'تعديل الألوان (Color Grading)',
    'elements.color-grading.desc':
      'توازن التباين ودرجات البشرة وتطبيق طابع لوني متناسق.',
    'elements.split-screen.title':
      'تقسيم الشاشة والتخطيطات (Split Screen)',
    'elements.split-screen.desc':
      'عرض متعدد المصادر، مقارنات جنبًا إلى جنب، وتكوينات شبكية.',
    'elements.callouts-highlights.title':
      'الإشارات والإبراز (Callouts & Highlights)',
    'elements.callouts-highlights.desc':
      'مؤشرات بصرية، إضاءة تركيز، وإبراز الأرقام والنقاط الجوهرية.',
    'elements.chapter-markers.title': 'فواصل الفصول (Chapter Markers)',
    'elements.chapter-markers.desc':
      'مقسمات موضوعية ومؤشرات تقدم للمحتوى الطويل والشروحات.',
    'elements.lower-thirds.title': 'شريط التعريف السفلي (Lower Thirds)',
    'elements.lower-thirds.desc':
      'بطاقات اسم المتحدث والمسمى الوظيفي والمصادر.',
    'elements.auto-framing.title': 'التأطير التلقائي (Auto Framing)',
    'elements.auto-framing.desc':
      'تكييف ذكي لأبعاد الفيديو بين 16:9 و9:16 و1:1.',

    // Brand Modal
    'brand.title': 'الهوية البصرية (Brand)',
    'brand.subtitle':
      'هوية بصرية قابلة لإعادة الاستخدام تُطبّق تلقائيًا عبر مشاريعك.',
    'brand.logo.label': 'الشعار الأساسي (Logo)',
    'brand.logo.summary': 'V Logo with Blue Dot (1).png',
    'brand.secondaryLogo.label': 'الشعار الثانوي (Secondary Logo)',
    'brand.secondaryLogo.summary': 'أيقونة مصغرة أحادية اللون',
    'brand.watermark.label': 'العلامة المائية (Watermark)',
    'brand.watermark.summary': 'أسفل اليمين · شفافية 65% · مفعّل عند التصدير',
    'brand.colors.label': 'الألوان (Colors)',
    'brand.fonts.label': 'الخطوط (Fonts)',
    'brand.fonts.summary':
      'Plus Jakarta Sans · عناوين SemiBold · نصوص Medium',
    'brand.intro.label': 'مقدمة الفيديو (Intro)',
    'brand.intro.summary': 'ظهور بسيط للشعار لمدة 1.2 ثانية',
    'brand.outro.label': 'خاتمة الفيديو (Outro)',
    'brand.outro.summary': 'بطاقة نهاية نظيفة مع قفل الشعار',
    'brand.lowerThird.label': 'شريط التعريف السفلي (Lower Third)',
    'brand.lowerThird.summary':
      'شريط زجاجي داكن بسيط مع اسم المتحدث وصفته',
    'brand.editPrompt': 'تحديث القيمة',

    // Settings & Account Modal
    'settings.title': 'الإعدادات والحساب',
    'settings.subtitle':
      'إدارة لغة الواجهة، جلسة حساب Google، ومعاينة حالة خدمات النظام.',
    'settings.languageLabel': 'لغة الواجهة',
    'settings.languageDesc':
      'يغيّر نصوص الواجهة واتجاه التخطيط (LTR / RTL) فورًا دون تغيير لغة الفيديو أو محتوى رسائلك.',
    'settings.langEn': 'English (الافتراضية)',
    'settings.langAr': 'العربية (RTL)',
    'settings.accountSection': 'ملف حساب Google الموثق',
    'settings.accountNameLabel': 'الاسم المعروض',
    'settings.accountTierValue': 'حساب صانع محتوى',
    'settings.primaryOwnerBadge': 'المالك الأساسي (Primary Owner)',
    'settings.adminBadge': 'مدير مصرح له (Admin)',
    'settings.servicesSection': 'حالة البنية والخدمات (المرحلة الرابعة)',
    'settings.service.ui': 'تسجيل الدخول بـ Google وقاعدة بيانات Firestore',
    'settings.service.uiStatus': 'مربوط وموثق',
    'settings.service.privateStorage':
      'التخزين الخاص القابل للاستكمال والروابط المؤقتة',
    'settings.service.privateStorageStatus': 'نشط (معزول بـ UID)',
    'settings.service.ffmpegWorker':
      'فحص المحتوى بـ FFprobe وعامل معالجة FFmpeg',
    'settings.service.ffmpegWorkerStatus': 'نشط (حد 1GB و10 دقائق)',
    'settings.service.brain':
      'محرك Brain للذكاء الاصطناعي (التحليل وتخطيط المشاهد)',
    'settings.service.brainStatus': 'غير مربوط بعد',
    'settings.service.remotion': 'معاينة Remotion 4.0.242 وعامل رندر MP4 الخلفي',
    'settings.service.remotionStatus': 'نشط (Chromium + FFprobe)',
    'settings.service.storage': 'بوابة الدفع والفوترة',
    'settings.service.storageStatus': 'غير مربوط بعد',

    // Admin Panel
    'admin.title': 'لوحة إدارة VION',
    'admin.subtitle':
      'إدارة محمية خادميًا، فصل الصلاحيات، وسجل التدقيق.',
    'admin.backToEditor': 'العودة للمحرر',
    'admin.primaryOwnerLabel': 'المالك الأساسي للنظام',
    'admin.boundUidLabel': 'معرّف UID الثابت المرتبط',
    'admin.notBoundYet':
      'بانتظار أول دخول موثق عبر Google للمالك الأساسي',
    'admin.sec.models': 'النماذج (Models)',
    'admin.sec.rules': 'القواعد (Rules)',
    'admin.sec.skills': 'المهارات (Skills)',
    'admin.sec.styles': 'الأنماط (Styles)',
    'admin.sec.references': 'المراجع (References)',
    'admin.sec.jobs': 'المهام (Jobs)',
    'admin.sec.usage': 'الاستهلاك (Usage)',
    'admin.sec.access': 'الصلاحيات (Access)',
    'admin.perm.editRules': 'تحرير القواعد والمهارات والأنماط والمراجع',
    'admin.perm.publishModels': 'نشر وتوجيه نماذج Brain',
    'admin.perm.monitorOperations': 'متابعة التشغيل والمهام والاستهلاك',
    'admin.perm.manageAccess': 'إدارة الصلاحيات والمشرفين',
    'admin.access.inviteTitle':
      'إضافة مشرف بالبريد الموثق في Google وتحديد صلاحياته',
    'admin.access.emailPlaceholder': 'colleague@gmail.com',
    'admin.access.grantBtn': 'حفظ / منح الصلاحيات',
    'admin.access.activeGrantsTitle':
      'المشرفون المصرح لهم والدعوات المرتبطة',
    'admin.access.revokeBtn': 'سحب الصلاحية',
    'admin.access.primaryProtected': 'مالك أساسي محمي (غير قابل للحذف)',
    'admin.access.boundStatus': 'مرتبط بـ UID',
    'admin.access.pendingStatus': 'يرتبط تلقائيًا عند الدخول بـ Google',
    'admin.audit.title': 'سجل تغييرات الإدارة (Audit Log)',
    'admin.audit.empty': 'لا توجد تغييرات إدارية مسجلة بعد.',
    'admin.sectionPlaceholder.badge': 'هيكل القسم جاهز · للمرحلة القادمة',
    'admin.sectionPlaceholder.desc':
      'هيكل هذا القسم وحماية الصلاحيات الخادمية الخاصة به مفعّلة. سيتم ربط أدوات التحكم التنفيذية الخاصة به في مرحلته القادمة.',
    'admin.sectionLocked.title': 'صلاحية غير متوفرة',
    'admin.sectionLocked.desc':
      'حسابك الإداري لا يملك الصلاحية المحددة للوصول إلى هذا القسم، ويتم رفض الطلبات خادميًا.',
  },
};
