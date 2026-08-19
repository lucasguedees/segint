import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Safe Firebase App Initialization (prevents re-initialization error on fast reload or Vercel builds)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with robust auto-detect long-polling for sandboxed iframe environments
const customDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = (customDbId && customDbId !== "(default)")
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, customDbId)
  : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });


