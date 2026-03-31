import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Import the Firebase configuration
// We use a dynamic-like check for the config file to avoid build failures in external environments
// where the file might be missing (e.g., when deployed from GitHub).
const configs = import.meta.glob('../firebase-applet-config.json', { eager: true, import: 'default' });
const configFromFile = configs['../firebase-applet-config.json'] as any;

const firebaseConfig = {
  apiKey: configFromFile?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: configFromFile?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: configFromFile?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: configFromFile?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: configFromFile?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: configFromFile?.appId || import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: configFromFile?.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_DATABASE_ID
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
