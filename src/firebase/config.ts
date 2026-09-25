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

export const oAuthClientId: string =
  (localFirebaseConfig as { oAuthClientId?: string }).oAuthClientId ||
  '228496397008-b7bskjaae516ggsa00qofto0a6ji6nch.apps.googleusercontent.com';

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

// Validate connection to Firestore on boot
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

// Safe startup initialization
export default app;
