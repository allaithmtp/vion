import {
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  BrandIdentity,
  ElementCapability,
  ElementCapabilityId,
  SupportedLocale,
  UserAccount,
  VerifiedSessionInfo,
} from '../types/domain';

const BRAND_STORAGE_KEY = 'vion_brand_identity_v1';
const ELEMENTS_STORAGE_KEY = 'vion_elements_capabilities_v1';

const DEFAULT_ACCOUNT: UserAccount = {
  id: 'guest',
  displayName: 'Guest',
  accountTierKey: 'sidebar.creatorAccount',
  avatarInitial: 'G',
  avatarColor: '#4A3525',
  preferredLocale: 'en',
};

const DEFAULT_BRAND_IDENTITY: BrandIdentity = {
  logo: {
    id: 'logo',
    labelKey: 'brand.logo.label',
    summaryTextKey: 'brand.logo.summary',
    customFileName: 'V Logo with Blue Dot (1).png',
    localPreviewUrl: '/assets/aistudio/Glossy_V_Icon_with_Blue_Dot_73929391.png',
  },
  secondaryLogo: {
    id: 'secondary-logo',
    labelKey: 'brand.secondaryLogo.label',
    summaryTextKey: 'brand.secondaryLogo.summary',
  },
  watermark: {
    id: 'watermark',
    labelKey: 'brand.watermark.label',
    summaryTextKey: 'brand.watermark.summary',
  },
  colors: {
    primaryText: '#FFFFFF',
    accentBlue: '#3B82F6',
    canvasDark: '#0E0F12',
  },
  fonts: {
    headingFont: 'Plus Jakarta Sans',
    headingWeight: 'SemiBold Headings',
    captionWeight: 'Medium Captions',
  },
  intro: {
    id: 'intro',
    labelKey: 'brand.intro.label',
    summaryTextKey: 'brand.intro.summary',
  },
  outro: {
    id: 'outro',
    labelKey: 'brand.outro.label',
    summaryTextKey: 'brand.outro.summary',
  },
  lowerThird: {
    styleSummaryKey: 'brand.lowerThird.summary',
    enabled: true,
  },
};

export const INITIAL_ELEMENTS_LIST: ElementCapability[] = [
  {
    id: 'cuts-trimming',
    titleKey: 'elements.cuts-trimming.title',
    descriptionKey: 'elements.cuts-trimming.desc',
    enabled: true,
  },
  {
    id: 'zoom-reframe',
    titleKey: 'elements.zoom-reframe.title',
    descriptionKey: 'elements.zoom-reframe.desc',
    enabled: true,
  },
  {
    id: 'speed',
    titleKey: 'elements.speed.title',
    descriptionKey: 'elements.speed.desc',
    enabled: true,
  },
  {
    id: 'transitions',
    titleKey: 'elements.transitions.title',
    descriptionKey: 'elements.transitions.desc',
    enabled: true,
  },
  {
    id: 'captions',
    titleKey: 'elements.captions.title',
    descriptionKey: 'elements.captions.desc',
    enabled: true,
  },
  {
    id: 'titles',
    titleKey: 'elements.titles.title',
    descriptionKey: 'elements.titles.desc',
    enabled: true,
  },
  {
    id: 'text-animation',
    titleKey: 'elements.text-animation.title',
    descriptionKey: 'elements.text-animation.desc',
    enabled: true,
  },
  {
    id: 'b-roll',
    titleKey: 'elements.b-roll.title',
    descriptionKey: 'elements.b-roll.desc',
    enabled: true,
  },
  {
    id: 'motion-graphics',
    titleKey: 'elements.motion-graphics.title',
    descriptionKey: 'elements.motion-graphics.desc',
    enabled: true,
  },
  {
    id: 'sound-effects',
    titleKey: 'elements.sound-effects.title',
    descriptionKey: 'elements.sound-effects.desc',
    enabled: true,
  },
  {
    id: 'background-music',
    titleKey: 'elements.background-music.title',
    descriptionKey: 'elements.background-music.desc',
    enabled: true,
  },
  {
    id: 'audio-ducking',
    titleKey: 'elements.audio-ducking.title',
    descriptionKey: 'elements.audio-ducking.desc',
    enabled: true,
  },
  {
    id: 'color-grading',
    titleKey: 'elements.color-grading.title',
    descriptionKey: 'elements.color-grading.desc',
    enabled: true,
  },
  {
    id: 'split-screen',
    titleKey: 'elements.split-screen.title',
    descriptionKey: 'elements.split-screen.desc',
    enabled: true,
  },
  {
    id: 'callouts-highlights',
    titleKey: 'elements.callouts-highlights.title',
    descriptionKey: 'elements.callouts-highlights.desc',
    enabled: true,
  },
  {
    id: 'chapter-markers',
    titleKey: 'elements.chapter-markers.title',
    descriptionKey: 'elements.chapter-markers.desc',
    enabled: true,
  },
  {
    id: 'lower-thirds',
    titleKey: 'elements.lower-thirds.title',
    descriptionKey: 'elements.lower-thirds.desc',
    enabled: true,
  },
  {
    id: 'auto-framing',
    titleKey: 'elements.auto-framing.title',
    descriptionKey: 'elements.auto-framing.desc',
    enabled: true,
  },
];

export const accountService = {
  getDefaultAccount(): UserAccount {
    return DEFAULT_ACCOUNT;
  },

  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  async getIdToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }
    return await user.getIdToken();
  },

  /**
   * Calls the backend server to verify the user's Firebase ID token,
   * verify Google provider + verified email, and resolve server-authoritative
   * Primary Owner or Admin permissions. Also syncs the user profile in Firestore.
   */
  async syncAuthenticatedUserAndSession(
    firebaseUser: User,
    preferredLocale: SupportedLocale
  ): Promise<{ account: UserAccount; session: VerifiedSessionInfo }> {
    const idToken = await firebaseUser.getIdToken();

    // 1. Verify session & role on the Node.js server
    const res = await fetch('/api/auth/verify-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to verify session on server.');
    }

    const payload = (await res.json()) as {
      ok: boolean;
      session: VerifiedSessionInfo;
    };
    const session = payload.session;

    // 2. Sync user profile in Firestore `/users/{uid}`
    const userPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const fallbackName = (
      firebaseUser.displayName ||
      firebaseUser.email?.split('@')[0] ||
      'Creator'
    ).slice(0, 120);
    const cleanEmail = (firebaseUser.email || '').slice(0, 254);

    let finalDisplayName = fallbackName;

    try {
      const existingSnap = await getDoc(userRef);
      if (!existingSnap.exists()) {
        const createData: Record<string, unknown> = {
          uid: firebaseUser.uid,
          email: cleanEmail,
          displayName: fallbackName,
          preferredLocale,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (firebaseUser.photoURL) {
          createData.photoURL = firebaseUser.photoURL.slice(0, 1024);
        }
        await setDoc(userRef, createData);
      } else {
        const data = existingSnap.data();
        if (typeof data.displayName === 'string' && data.displayName.trim()) {
          finalDisplayName = data.displayName;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }

    // 3. If Primary Owner or Invited Admin, ensure Firestore `/admins/{uid}` is synced
    try {
      if (session.permissions.isPrimaryOwner) {
        const adminRef = doc(db, 'admins', firebaseUser.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: firebaseUser.uid,
            email: cleanEmail.toLowerCase(),
            isPrimaryOwner: true,
            canEditRules: true,
            canPublishModels: true,
            canMonitorOperations: true,
            canManageAccess: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        // Check if there is a matching Firestore invite in `/admin_invites` for this verified email
        const invitesQuery = query(
          collection(db, 'admin_invites'),
          where('email', '==', cleanEmail.toLowerCase())
        );
        const inviteSnaps = await getDocs(invitesQuery);
        if (!inviteSnaps.empty) {
          const inviteDoc = inviteSnaps.docs[0];
          const invData = inviteDoc.data();
          if (invData.boundUid !== firebaseUser.uid) {
            await updateDoc(doc(db, 'admin_invites', inviteDoc.id), {
              boundUid: firebaseUser.uid,
              updatedAt: serverTimestamp(),
            });
          }
          const adminRef = doc(db, 'admins', firebaseUser.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              uid: firebaseUser.uid,
              email: cleanEmail.toLowerCase(),
              inviteId: inviteDoc.id,
              isPrimaryOwner: false,
              canEditRules: Boolean(invData.canEditRules),
              canPublishModels: Boolean(invData.canPublishModels),
              canMonitorOperations: Boolean(invData.canMonitorOperations),
              canManageAccess: Boolean(invData.canManageAccess),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    } catch {
      // Non-fatal if user does not have admin invite
    }

    const account: UserAccount = {
      id: firebaseUser.uid,
      email: cleanEmail,
      photoURL: firebaseUser.photoURL || undefined,
      displayName: finalDisplayName,
      accountTierKey: session.permissions.isPrimaryOwner
        ? 'settings.primaryOwnerBadge'
        : session.isAdmin
          ? 'settings.adminBadge'
          : 'sidebar.creatorAccount',
      avatarInitial: finalDisplayName.charAt(0).toUpperCase() || 'U',
      avatarColor: '#2563EB',
      preferredLocale,
    };

    return { account, session };
  },

  async updateAccountName(
    currentAccount: UserAccount,
    displayName: string
  ): Promise<UserAccount> {
    const trimmed = displayName.trim().slice(0, 120) || 'Creator';
    const user = auth.currentUser;
    if (user) {
      const userPath = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: trimmed,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }
    return {
      ...currentAccount,
      displayName: trimmed,
      avatarInitial: trimmed.charAt(0).toUpperCase(),
    };
  },

  getBrandIdentity(): BrandIdentity {
    try {
      const raw = localStorage.getItem(BRAND_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_BRAND_IDENTITY, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_BRAND_IDENTITY;
  },

  saveBrandIdentity(brand: BrandIdentity): BrandIdentity {
    try {
      localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(brand));
    } catch {
      // Ignore
    }
    return brand;
  },

  getElements(): ElementCapability[] {
    try {
      const raw = localStorage.getItem(ELEMENTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<ElementCapabilityId, boolean>;
        return INITIAL_ELEMENTS_LIST.map((item) => ({
          ...item,
          enabled:
            typeof parsed[item.id] === 'boolean'
              ? parsed[item.id]
              : item.enabled,
        }));
      }
    } catch {
      // Fallback
    }
    return INITIAL_ELEMENTS_LIST;
  },

  saveElements(elements: ElementCapability[]): ElementCapability[] {
    try {
      const stateMap = elements.reduce(
        (acc, item) => {
          acc[item.id] = item.enabled;
          return acc;
        },
        {} as Record<ElementCapabilityId, boolean>
      );
      localStorage.setItem(ELEMENTS_STORAGE_KEY, JSON.stringify(stateMap));
    } catch {
      // Ignore
    }
    return elements;
  },
};
