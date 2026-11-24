import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { BOOTSTRAPPED_ADMIN_EMAIL } from './data/defaults';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: BOOTSTRAPPED_ADMIN_EMAIL,
});

// Secondary isolated Auth instance with in-memory persistence so creating Email/Password
// staff accounts never signs out the currently authenticated Owner session.
const provisioningApp = initializeApp(firebaseConfig, 'staff-provisioning');
export const staffProvisionAuth = getAuth(provisioningApp);
void setPersistence(staffProvisionAuth, inMemoryPersistence).catch(() => {});

export function isAuthorizedOwnerUser(user: User | null | undefined): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  const emailMatch = user.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  if (!emailMatch) return false;
  const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com') ?? false;
  return isGoogle;
}

export function isPasswordStaffUser(user: User | null | undefined): boolean {
  if (!user || !user.email) return false;
  const emailLower = user.email.trim().toLowerCase();
  if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) return false;
  return user.providerData?.some((p) => p.providerId === 'password') ?? false;
}

export function isGoogleAuthUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.providerData?.some((p) => p.providerId === 'google.com') ?? false;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
