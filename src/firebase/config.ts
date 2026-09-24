import { initializeApp, getApps, getApp, FirebaseOptions, setLogLevel } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import localFirebaseConfig from '../../firebase-applet-config.json';

// Silence non-fatal internal SDK notices (e.g. Analytics falling back to the local measurementId)
try {
  setLogLevel('error');
} catch {
  // Safe if already configured
}

// Support both firebase-applet-config.json and Vite environment variables
const resolvedConfig: FirebaseOptions & { firestoreDatabaseId?: string } = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || localFirebaseConfig.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID || localFirebaseConfig.firestoreDatabaseId,
};

const app = !getApps().length ? initializeApp(resolvedConfig) : getApp();

export const auth = getAuth(app);

// Use the provisioned database ID or default if not specified
const isCustomDb = Boolean(
  resolvedConfig.firestoreDatabaseId &&
  resolvedConfig.firestoreDatabaseId !== '(default)' &&
  resolvedConfig.firestoreDatabaseId.trim() !== ''
);

export const db = isCustomDb
  ? getFirestore(app, resolvedConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Analytics safely for browser environment
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics fallback for restricted environments
  });
}

// Safe startup check: silent connection verification
async function testConnection() {
  try {
    // Only attempt if not offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch {
    // Graceful offline fallback - no warning emitted to keep console clean
  }
}
// Run asynchronously without blocking
testConnection().catch(() => {});

export default app;
