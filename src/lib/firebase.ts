import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { City, RiverReading, Shelter, ShelterReading } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Utility function to remove undefined fields recursively so setDoc doesn't fail
function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields) as unknown as T;

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null
        ? removeUndefinedFields(value)
        : value;
    }
  }
  return cleaned as T;
}

// Track in memory which collections have been seeded or received data
const seededCollectionsInMemory = new Set<string>();

function markCollectionSeeded(collectionName: string) {
  seededCollectionsInMemory.add(collectionName);
  try {
    localStorage.setItem(`seeded_${collectionName}`, 'true');
  } catch (e) {}
  const seedFlagRef = doc(db, 'appConfig', `seeded_${collectionName}`);
  setDoc(seedFlagRef, { value: 'true', initialized: true }, { merge: true }).catch(() => {});
}

// Helper to subscribe to Firestore collection with automatic initial seeding
export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  initialSeed?: T[]
) {
  const colRef = collection(db, collectionName);
  const seedFlagRef = doc(db, 'appConfig', `seeded_${collectionName}`);
  let hasReceivedSnapshot = false;

  try {
    return onSnapshot(
      colRef,
      async (snapshot) => {
        hasReceivedSnapshot = true;
        if (!snapshot.empty) {
          markCollectionSeeded(collectionName);
          const items: T[] = [];
          snapshot.forEach((doc) => {
            items.push(doc.data() as T);
          });
          onData(items);
          return;
        }

        // Snapshot IS EMPTY
        let isAlreadySeeded = seededCollectionsInMemory.has(collectionName);

        if (!isAlreadySeeded) {
          try {
            if (localStorage.getItem(`seeded_${collectionName}`) === 'true') {
              isAlreadySeeded = true;
            }
          } catch (e) {}
        }

        if (!isAlreadySeeded) {
          try {
            const flagSnap = await getDoc(seedFlagRef);
            if (flagSnap.exists() && (flagSnap.data()?.value === 'true' || flagSnap.data()?.initialized === true)) {
              isAlreadySeeded = true;
            }
          } catch (e) {
            // Ignore read error
          }
        }

        if (isAlreadySeeded) {
          // User intentionally emptied the collection or collection was already initialized
          markCollectionSeeded(collectionName);
          onData([]);
          return;
        }

        // If NEVER seeded or initialized before, perform initial seeding
        markCollectionSeeded(collectionName);
        if (initialSeed && initialSeed.length > 0) {
          console.log(`[Firebase] Initializing brand new empty collection '${collectionName}' with seed data...`);
          try {
            const batch = writeBatch(db);
            initialSeed.forEach((item) => {
              const itemRef = doc(db, collectionName, item.id);
              batch.set(itemRef, removeUndefinedFields(item));
            });
            await batch.commit();
            console.log(`[Firebase] Successfully seeded '${collectionName}'`);
            return;
          } catch (err) {
            console.warn(`[Firebase] Failed to seed '${collectionName}' (quota/network):`, err);
            onData(initialSeed);
          }
        } else {
          onData([]);
        }
      },
      (error) => {
        console.warn(`[Firebase] Quota/Subscription error on '${collectionName}':`, error?.message || error);
        if (!hasReceivedSnapshot && initialSeed) {
          onData(initialSeed);
        }
      }
    );
  } catch (err) {
    console.warn(`[Firebase] Failed to setup subscription on '${collectionName}':`, err);
    if (initialSeed) onData(initialSeed);
    return () => {};
  }
}

// CRUD Helpers
export async function saveDocument<T extends { id: string }>(collectionName: string, data: T): Promise<void> {
  markCollectionSeeded(collectionName);
  try {
    const docRef = doc(db, collectionName, data.id);
    const cleanedData = removeUndefinedFields(data);
    await setDoc(docRef, cleanedData);
    console.log(`[Firebase] Document successfully saved to '${collectionName}' (ID: ${data.id})`);
  } catch (err: any) {
    console.warn(`[Firebase] Error saving document to '${collectionName}' (ID: ${data.id}):`, err?.message || err);
  }
}

export async function batchSaveDocuments<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!items || items.length === 0) return;
  markCollectionSeeded(collectionName);
  const BATCH_SIZE = 400;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        const itemRef = doc(db, collectionName, item.id);
        batch.set(itemRef, removeUndefinedFields(item));
      });
      await batch.commit();
    } catch (err: any) {
      console.warn(`[Firebase] Error batch saving chunk to '${collectionName}':`, err?.message || err);
    }
  }
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  markCollectionSeeded(collectionName);
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn(`[Firebase] Error deleting document from '${collectionName}' (ID: ${id}):`, err?.message || err);
  }
}

export async function saveAppConfig(key: string, value: string): Promise<void> {
  try {
    const docRef = doc(db, 'appConfig', key);
    await setDoc(docRef, { value }, { merge: true });
  } catch (err: any) {
    console.warn(`[Firebase] Error saving appConfig '${key}':`, err?.message || err);
  }
}

export function subscribeAppConfig(key: string, onValue: (val: string | null) => void) {
  try {
    const docRef = doc(db, 'appConfig', key);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onValue(docSnap.data().value || null);
        } else {
          onValue(null);
        }
      },
      (error) => {
        console.warn(`[Firebase] Error/Quota in appConfig '${key}':`, error?.message || error);
        onValue(null);
      }
    );
  } catch (err) {
    console.warn(`[Firebase] Failed to setup appConfig subscription '${key}':`, err);
    onValue(null);
    return () => {};
  }
}
