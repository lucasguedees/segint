import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore
const customDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = (customDbId && customDbId !== "(default)")
  ? initializeFirestore(app, {}, customDbId)
  : getFirestore(app);

