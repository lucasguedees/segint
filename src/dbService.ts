import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { UserProfile, Suspect, UserRole, UserStatus, Occurrence } from "./types";
import { MOCK_SUSPECTS, MOCK_OCCURRENCES } from "./constants";

// --- IndexedDB & Storage Optimization Helpers ---
const IDB_NAME = "sispir_local_db";
const IDB_STORE = "keyvalue";

function getIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? (req.result as T) : null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("IndexedDB read fallback:", e);
    return null;
  }
}

export async function idbSet(key: string, val: any): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("IndexedDB write error:", e);
  }
}

function createLightweightCopy(items: any[]): any[] {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const copy = { ...item };
    if (Array.isArray(copy.photos)) {
      copy.photos = copy.photos.map((p: any) =>
        typeof p === "string" && p.startsWith("data:") && p.length > 500
          ? p.substring(0, 100) + "...[image_stored_in_idb]"
          : p
      );
    }
    if (typeof copy.photoUrl === "string" && copy.photoUrl.startsWith("data:") && copy.photoUrl.length > 500) {
      copy.photoUrl = copy.photoUrl.substring(0, 100) + "...[image_stored_in_idb]";
    }
    return copy;
  });
}

function safeSetLocalStorage(key: string, rawData: any): void {
  try {
    const jsonStr = typeof rawData === "string" ? rawData : JSON.stringify(rawData);
    localStorage.setItem(key, jsonStr);
  } catch (e) {
    console.warn(`localStorage setItem quota exceeded for key "${key}". Saving lightweight fallback copy...`);
    try {
      if (Array.isArray(rawData)) {
        const light = createLightweightCopy(rawData);
        localStorage.setItem(key, JSON.stringify(light));
      } else if (typeof rawData === "string") {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed)) {
          const light = createLightweightCopy(parsed);
          localStorage.setItem(key, JSON.stringify(light));
        }
      }
    } catch (e2) {
      console.warn("localStorage quota fallback notice: full data remains safely stored in IndexedDB.", e2);
    }
  }
}

// --- User Profile Services ---

export function isLocalMode(): boolean {
  return false;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
  } catch (error) {
    console.warn("Aviso ao obter perfil do usuário no Firestore:", error);
  }
  const profileStr = localStorage.getItem(`sispir_local_profile_${uid}`);
  return profileStr ? JSON.parse(profileStr) : null;
}

export async function createUserProfile(
  uid: string,
  name: string,
  email: string,
  badgeId?: string
): Promise<UserProfile> {
  const isOwner = email.toLowerCase() === "lucas2305rj1994@gmail.com";
  let isEmpty = false;
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    isEmpty = snapshot.empty;
  } catch {
    isEmpty = isOwner;
  }

  // Default to 'admin' and 'approved' for workspace owner or first user
  const role: UserRole = isOwner || isEmpty ? "admin" : "user";
  const status: UserStatus = isOwner || isEmpty ? "approved" : "pending";

  const profile: UserProfile = {
    uid,
    name,
    email,
    role,
    status,
    badgeId: badgeId || "",
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, "users", uid), profile, { merge: true });
  } catch (error) {
    console.warn("Aviso ao salvar perfil no Firestore:", error);
  }

  localStorage.setItem(`sispir_local_profile_${uid}`, JSON.stringify(profile));
  return profile;
}

export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void
) {
  // 1. Immediate local memory fallback
  const profileStr = localStorage.getItem(`sispir_local_profile_${uid}`);
  if (profileStr) {
    try {
      onUpdate(JSON.parse(profileStr));
    } catch {}
  }

  return onSnapshot(
    doc(db, "users", uid),
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        localStorage.setItem(`sispir_local_profile_${uid}`, JSON.stringify(data));
        onUpdate(data);
      } else {
        const local = localStorage.getItem(`sispir_local_profile_${uid}`);
        if (local) {
          try {
            onUpdate(JSON.parse(local));
          } catch {
            onUpdate(null);
          }
        } else {
          onUpdate(null);
        }
      }
    },
    (error) => {
      console.warn("Aviso no listener do perfil do usuário:", error);
      const local = localStorage.getItem(`sispir_local_profile_${uid}`);
      if (local) {
        try {
          onUpdate(JSON.parse(local));
        } catch {
          onUpdate(null);
        }
      }
    }
  );
}

// Admin service: get all users for approval
export function subscribeToAllUsers(onUpdate: (users: UserProfile[]) => void) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      if (users.length > 0) {
        localStorage.setItem("sispir_local_users", JSON.stringify(users));
        onUpdate(users);
      } else {
        const localStr = localStorage.getItem("sispir_local_users");
        if (localStr) {
          try {
            onUpdate(JSON.parse(localStr));
          } catch {
            onUpdate([]);
          }
        } else {
          onUpdate([]);
        }
      }
    },
    (error) => {
      console.warn("Retrying user subscription with fallback:", error);
      return onSnapshot(
        usersRef,
        (snap) => {
          const users: UserProfile[] = [];
          snap.forEach((doc) => {
            users.push(doc.data() as UserProfile);
          });
          onUpdate(users);
        },
        (nestedErr) => {
          console.warn("Fallback user subscription error:", nestedErr);
          const usersStr = localStorage.getItem("sispir_local_users") || "[]";
          try {
            onUpdate(JSON.parse(usersStr));
          } catch {
            onUpdate([]);
          }
        }
      );
    }
  );
}

export async function updateUserStatus(
  uid: string,
  status: UserStatus,
  role: UserRole
): Promise<void> {
  return updateUserProfileData(uid, { status, role });
}

export async function updateUserProfileData(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const cleanUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, cleanUpdates, { merge: true });
  } catch (error) {
    console.warn("Aviso ao atualizar dados do perfil no Firestore:", error);
  }

  const profileStr = localStorage.getItem(`sispir_local_profile_${uid}`);
  if (profileStr) {
    const profile = JSON.parse(profileStr) as UserProfile;
    const updated = { ...profile, ...cleanUpdates };
    localStorage.setItem(`sispir_local_profile_${uid}`, JSON.stringify(updated));
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);
  } catch (error) {
    console.warn("Aviso ao excluir perfil de usuário no Firestore:", error);
  }
  localStorage.removeItem(`sispir_local_profile_${uid}`);
}

// Clean objects for Firestore to eliminate undefined/null and invalid types
function cleanDocForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      result[key] = "";
    } else if (Array.isArray(value)) {
      result[key] = value
        .filter((v) => v !== undefined && v !== null)
        .map((v) => (typeof v === "object" ? cleanDocForFirestore(v) : String(v).trim()));
    } else if (typeof value === "object" && !(value instanceof Date)) {
      result[key] = cleanDocForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// --- Suspects Services ---

export function subscribeToSuspects(onUpdate: (suspects: Suspect[]) => void) {
  // 1. Immediately hydrate from local database so the screen is never blank
  idbGet<Suspect[]>("sispir_local_suspects").then((local) => {
    if (local && local.length > 0) {
      onUpdate(local);
    }
  });

  const handleCustomLocalUpdate = () => {
    idbGet<Suspect[]>("sispir_local_suspects").then((local) => {
      if (local && local.length > 0) {
        onUpdate(local);
      }
    });
  };
  window.addEventListener("sispir_local_suspects_update", handleCustomLocalUpdate);

  const suspectsRef = collection(db, "suspects");
  // Query all documents directly without restrictive index filtering
  const unsubscribeFirestore = onSnapshot(
    suspectsRef,
    (snapshot) => {
      const suspects: Suspect[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Suspect;
        suspects.push({
          ...data,
          id: data.id || docSnap.id,
        });
      });

      suspects.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      // If Firestore returned documents, sync to local and update
      if (suspects.length > 0) {
        idbSet("sispir_local_suspects", suspects);
        onUpdate(suspects);
      } else {
        // Fallback to local mocks if Firestore has 0 documents
        idbGet<Suspect[]>("sispir_local_suspects").then((local) => {
          if (local && local.length > 0) {
            onUpdate(local);
          } else {
            onUpdate(MOCK_SUSPECTS);
          }
        });
      }
    },
    (error) => {
      console.warn("Aviso na assinatura de suspeitos Firestore:", error);
      idbGet<Suspect[]>("sispir_local_suspects").then((local) => {
        if (local && local.length > 0) {
          onUpdate(local);
        } else {
          onUpdate(MOCK_SUSPECTS);
        }
      });
    }
  );

  return () => {
    window.removeEventListener("sispir_local_suspects_update", handleCustomLocalUpdate);
    if (typeof unsubscribeFirestore === "function") unsubscribeFirestore();
  };
}

export async function addSuspect(suspect: Omit<Suspect, "createdAt" | "updatedAt">): Promise<void> {
  const suspectId = suspect.id || `SUSP_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const fullSuspect: Suspect = cleanDocForFirestore({
    ...suspect,
    id: suspectId,
    createdAt: (suspect as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  try {
    const suspectRef = doc(db, "suspects", fullSuspect.id);
    await setDoc(suspectRef, fullSuspect, { merge: true });
  } catch (error) {
    console.error("Erro ao gravar suspeito no Firestore:", error);
  }

  // Also maintain local mirror
  try {
    let local = (await idbGet<Suspect[]>("sispir_local_suspects")) || [];
    const idx = local.findIndex((s) => s.id === fullSuspect.id);
    if (idx !== -1) local[idx] = fullSuspect;
    else local.unshift(fullSuspect);
    await idbSet("sispir_local_suspects", local);
    safeSetLocalStorage("sispir_local_suspects", local);
    window.dispatchEvent(new Event("sispir_local_suspects_update"));
  } catch (e) {
    console.error("Erro no cache local do suspeito:", e);
  }
}

export async function updateSuspect(
  suspectId: string,
  suspectData: Partial<Omit<Suspect, "id" | "createdAt" | "createdBy">>
): Promise<void> {
  const updatePayload = cleanDocForFirestore({
    ...suspectData,
    updatedAt: new Date().toISOString(),
  });

  try {
    const suspectRef = doc(db, "suspects", suspectId);
    await setDoc(suspectRef, updatePayload, { merge: true });
  } catch (error) {
    console.error("Erro ao atualizar suspeito no Firestore:", error);
  }

  try {
    let local = (await idbGet<Suspect[]>("sispir_local_suspects")) || [];
    const idx = local.findIndex((s) => s.id === suspectId);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updatePayload };
      await idbSet("sispir_local_suspects", local);
      safeSetLocalStorage("sispir_local_suspects", local);
      window.dispatchEvent(new Event("sispir_local_suspects_update"));
    }
  } catch (e) {
    console.error("Erro ao atualizar cache local do suspeito:", e);
  }
}

export async function deleteSuspect(suspectId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "suspects", suspectId));
  } catch (error) {
    console.error("Erro ao deletar suspeito no Firestore:", error);
  }

  try {
    let local = (await idbGet<Suspect[]>("sispir_local_suspects")) || [];
    const filtered = local.filter((s) => s.id !== suspectId);
    await idbSet("sispir_local_suspects", filtered);
    safeSetLocalStorage("sispir_local_suspects", filtered);
    window.dispatchEvent(new Event("sispir_local_suspects_update"));
  } catch (e) {
    console.error("Erro ao deletar cache local do suspeito:", e);
  }
}

// Module-level guard to prevent multiple concurrent seeding calls
let isSeedingSuspects = false;
let hasCheckedSuspectsSeeding = false;
let isSeedingOccurrences = false;
let hasCheckedOccurrencesSeeding = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Ultra-fast chunked Firestore Batch Importer for full database backups with backoff & rate limiting
export async function importBackupBatchToFirestore(
  suspects: Suspect[],
  occurrences: Occurrence[],
  onProgress?: (progressText: string, percentage: number) => void
): Promise<{ totalSuspects: number; totalOccurrences: number }> {
  // Update local persistent storage immediately so data is visible and safe right away
  if (suspects.length > 0) {
    await idbSet("sispir_local_suspects", suspects);
    safeSetLocalStorage("sispir_local_suspects", suspects);
    window.dispatchEvent(new Event("sispir_local_suspects_update"));
  }
  if (occurrences.length > 0) {
    await idbSet("sispir_local_occurrences", occurrences);
    safeSetLocalStorage("sispir_local_occurrences", occurrences);
    window.dispatchEvent(new Event("sispir_local_occurrences_update"));
  }

  const BATCH_SIZE = 25; // Smaller batch size prevents Firestore Web SDK write-stream queue saturation
  let importedSuspects = 0;
  let importedOccurrences = 0;
  const totalItems = suspects.length + occurrences.length;

  // Helper to sanitize Firestore document ID
  const sanitizeDocId = (id: string, prefix: string, index: number) => {
    const cleaned = (id || "").toString().trim().replace(/[\/\s#?\[\]]+/g, "_");
    return cleaned || `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  };

  // Helper to safely truncate oversize base64 photo for Firestore cloud doc while keeping IDB pristine
  const sanitizeSuspectPhotos = (photos: string[] | undefined) => {
    if (!Array.isArray(photos)) return [];
    return photos.map((p) => {
      if (typeof p !== "string") return "";
      const trimmed = p.trim();
      // Keep string size safe for cloud Firestore document limit (1MB max per document)
      if (trimmed.startsWith("data:") && trimmed.length > 400000) {
        return trimmed.substring(0, 400000);
      }
      return trimmed;
    }).filter(Boolean);
  };

  // 1. Batch Write Suspects to Cloud Firestore with Paced Execution
  for (let i = 0; i < suspects.length; i += BATCH_SIZE) {
    const chunk = suspects.slice(i, i + BATCH_SIZE);
    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      attempts++;
      try {
        const batch = writeBatch(db);
        for (let j = 0; j < chunk.length; j++) {
          const s = chunk[j];
          const cleanId = sanitizeDocId(s.id, "SUSP", i + j);
          const fullSuspect: Suspect = cleanDocForFirestore({
            ...s,
            id: cleanId,
            photos: sanitizeSuspectPhotos(s.photos),
            createdAt: s.createdAt || new Date().toISOString(),
            updatedAt: s.updatedAt || new Date().toISOString(),
          });
          const ref = doc(db, "suspects", cleanId);
          batch.set(ref, fullSuspect, { merge: true });
        }
        await batch.commit();
        importedSuspects += chunk.length;
        success = true;
        // Pacing delay between batch commits to allow Firestore Write Stream to flush
        await sleep(50);
      } catch (batchErr: any) {
        console.warn(`Lote de suspeitos tentativa ${attempts} falhou, aguardando backoff...`, batchErr);
        await sleep(attempts * 250);
        if (attempts >= 3) {
          // Fallback to sequential individual writes with safety pauses
          for (let j = 0; j < chunk.length; j++) {
            const s = chunk[j];
            try {
              const cleanId = sanitizeDocId(s.id, "SUSP", i + j);
              const fullSuspect: Suspect = cleanDocForFirestore({
                ...s,
                id: cleanId,
                photos: sanitizeSuspectPhotos(s.photos),
                createdAt: s.createdAt || new Date().toISOString(),
                updatedAt: s.updatedAt || new Date().toISOString(),
              });
              await setDoc(doc(db, "suspects", cleanId), fullSuspect, { merge: true });
              importedSuspects++;
              await sleep(15);
            } catch (singleErr) {
              console.warn("Aviso ao gravar suspeito individual:", singleErr);
            }
          }
          success = true;
        }
      }
    }

    if (onProgress && totalItems > 0) {
      const pct = Math.round((importedSuspects / totalItems) * 100);
      onProgress(`Gravando suspeitos no Firebase (${importedSuspects}/${suspects.length})...`, pct);
    }
  }

  // 2. Batch Write Occurrences to Cloud Firestore with Paced Execution
  for (let i = 0; i < occurrences.length; i += BATCH_SIZE) {
    const chunk = occurrences.slice(i, i + BATCH_SIZE);
    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      attempts++;
      try {
        const batch = writeBatch(db);
        for (let j = 0; j < chunk.length; j++) {
          const o = chunk[j];
          const cleanId = sanitizeDocId(o.id, "OCC", i + j);
          const fullOcc: Occurrence = cleanDocForFirestore({
            ...o,
            id: cleanId,
            photos: sanitizeSuspectPhotos(o.photos),
            createdAt: o.createdAt || new Date().toISOString(),
            updatedAt: o.updatedAt || new Date().toISOString(),
          });
          const ref = doc(db, "occurrences", cleanId);
          batch.set(ref, fullOcc, { merge: true });
        }
        await batch.commit();
        importedOccurrences += chunk.length;
        success = true;
        await sleep(50);
      } catch (batchErr: any) {
        console.warn(`Lote de ocorrências tentativa ${attempts} falhou, aguardando backoff...`, batchErr);
        await sleep(attempts * 250);
        if (attempts >= 3) {
          for (let j = 0; j < chunk.length; j++) {
            const o = chunk[j];
            try {
              const cleanId = sanitizeDocId(o.id, "OCC", i + j);
              const fullOcc: Occurrence = cleanDocForFirestore({
                ...o,
                id: cleanId,
                photos: sanitizeSuspectPhotos(o.photos),
                createdAt: o.createdAt || new Date().toISOString(),
                updatedAt: o.updatedAt || new Date().toISOString(),
              });
              await setDoc(doc(db, "occurrences", cleanId), fullOcc, { merge: true });
              importedOccurrences++;
              await sleep(15);
            } catch (singleErr) {
              console.warn("Aviso ao gravar ocorrência individual:", singleErr);
            }
          }
          success = true;
        }
      }
    }

    if (onProgress && totalItems > 0) {
      const pct = Math.round(((importedSuspects + importedOccurrences) / totalItems) * 100);
      onProgress(`Gravando ocorrências no Firebase (${importedOccurrences}/${occurrences.length})...`, pct);
    }
  }

  return { totalSuspects: importedSuspects, totalOccurrences: importedOccurrences };
}

// Seeding helper to seed suspects if empty
export async function seedSuspectsIfEmpty(): Promise<void> {
  if (isSeedingSuspects || hasCheckedSuspectsSeeding) return;
  hasCheckedSuspectsSeeding = true;
  isSeedingSuspects = true;

  try {
    const suspectsRef = collection(db, "suspects");
    const snapshot = await getDocs(suspectsRef);
    if (snapshot.empty) {
      console.log("Banco de suspeitos vazio. Alimentando dados padrão...");
      for (const suspect of MOCK_SUSPECTS) {
        try {
          const docRef = doc(db, "suspects", suspect.id);
          await setDoc(docRef, suspect, { merge: true });
          await sleep(50);
        } catch (e) {
          console.warn("Aviso ao semear suspeito individual:", e);
        }
      }
      console.log("Banco de suspeitos alimentado com sucesso.");
    }
  } catch (error) {
    console.warn("Aviso ao verificar/popular suspeitos padrão:", error);
  } finally {
    isSeedingSuspects = false;
  }
}

export async function populateInitialMocks(): Promise<void> {
  await Promise.all([seedSuspectsIfEmpty(), seedOccurrencesIfEmpty()]);
}

// --- Occurrences Services ---

export function subscribeToOccurrences(onUpdate: (occurrences: Occurrence[]) => void) {
  // 1. Immediately load local data
  idbGet<Occurrence[]>("sispir_local_occurrences").then((local) => {
    if (local && local.length > 0) {
      onUpdate(local);
    }
  });

  const handleCustomOccUpdate = () => {
    idbGet<Occurrence[]>("sispir_local_occurrences").then((local) => {
      if (local && local.length > 0) {
        onUpdate(local);
      }
    });
  };
  window.addEventListener("sispir_local_occurrences_update", handleCustomOccUpdate);

  const occurrencesRef = collection(db, "occurrences");
  const unsubscribeFirestore = onSnapshot(
    occurrencesRef,
    (snapshot) => {
      const occurrences: Occurrence[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Occurrence;
        occurrences.push({
          ...data,
          id: data.id || docSnap.id,
        });
      });

      occurrences.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      if (occurrences.length > 0) {
        idbSet("sispir_local_occurrences", occurrences);
        onUpdate(occurrences);
      } else {
        idbGet<Occurrence[]>("sispir_local_occurrences").then((local) => {
          if (local && local.length > 0) {
            onUpdate(local);
          } else {
            onUpdate(MOCK_OCCURRENCES);
          }
        });
      }
    },
    (error) => {
      console.warn("Aviso na assinatura de ocorrências Firestore:", error);
      idbGet<Occurrence[]>("sispir_local_occurrences").then((local) => {
        if (local && local.length > 0) {
          onUpdate(local);
        } else {
          onUpdate(MOCK_OCCURRENCES);
        }
      });
    }
  );

  return () => {
    window.removeEventListener("sispir_local_occurrences_update", handleCustomOccUpdate);
    if (typeof unsubscribeFirestore === "function") unsubscribeFirestore();
  };
}

export async function seedOccurrencesIfEmpty(): Promise<void> {
  if (isSeedingOccurrences || hasCheckedOccurrencesSeeding) return;
  hasCheckedOccurrencesSeeding = true;
  isSeedingOccurrences = true;

  try {
    const occurrencesRef = collection(db, "occurrences");
    const snapshot = await getDocs(occurrencesRef);
    if (snapshot.empty) {
      console.log("Banco de ocorrências vazio. Sembrando dados padrão...");
      for (const occurrence of MOCK_OCCURRENCES) {
        try {
          const docRef = doc(db, "occurrences", occurrence.id);
          await setDoc(docRef, occurrence, { merge: true });
          await sleep(50);
        } catch (e) {
          console.warn("Aviso ao semear ocorrência individual:", e);
        }
      }
      console.log("Banco de ocorrências alimentado com sucesso.");
    }
  } catch (error) {
    console.error("Erro ao sembrar ocorrências padrão:", error);
  } finally {
    isSeedingOccurrences = false;
  }
}

export async function addOccurrence(occurrence: Omit<Occurrence, "createdAt" | "updatedAt">): Promise<void> {
  const occId = occurrence.id || `OCOR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const fullOccurrence: Occurrence = cleanDocForFirestore({
    ...occurrence,
    id: occId,
    photos: Array.isArray(occurrence.photos) ? occurrence.photos.filter(Boolean) : occurrence.photoUrl ? [occurrence.photoUrl] : [],
    involvedPeople: Array.isArray(occurrence.involvedPeople) ? occurrence.involvedPeople : [],
    relatedSuspects: Array.isArray(occurrence.relatedSuspects) ? occurrence.relatedSuspects : [],
    createdAt: (occurrence as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  try {
    const occurrenceRef = doc(db, "occurrences", fullOccurrence.id);
    await setDoc(occurrenceRef, fullOccurrence, { merge: true });
  } catch (error) {
    console.error("Erro ao gravar ocorrência no Firestore:", error);
  }

  try {
    let local = (await idbGet<Occurrence[]>("sispir_local_occurrences")) || [];
    const idx = local.findIndex((o) => o.id === fullOccurrence.id);
    if (idx !== -1) local[idx] = fullOccurrence;
    else local.unshift(fullOccurrence);
    await idbSet("sispir_local_occurrences", local);
    safeSetLocalStorage("sispir_local_occurrences", local);
    window.dispatchEvent(new Event("sispir_local_occurrences_update"));
  } catch (e) {
    console.error("Erro ao atualizar cache local da ocorrência:", e);
  }
}

export async function updateOccurrence(
  occurrenceId: string,
  occurrenceData: Partial<Omit<Occurrence, "id" | "createdAt">>
): Promise<void> {
  const updatePayload = cleanDocForFirestore({
    ...occurrenceData,
    updatedAt: new Date().toISOString(),
  });

  try {
    const occurrenceRef = doc(db, "occurrences", occurrenceId);
    await setDoc(occurrenceRef, updatePayload, { merge: true });
  } catch (error) {
    console.error("Erro ao atualizar ocorrência no Firestore:", error);
  }

  try {
    let local = (await idbGet<Occurrence[]>("sispir_local_occurrences")) || [];
    const idx = local.findIndex((o) => o.id === occurrenceId);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updatePayload };
      await idbSet("sispir_local_occurrences", local);
      safeSetLocalStorage("sispir_local_occurrences", local);
      window.dispatchEvent(new Event("sispir_local_occurrences_update"));
    }
  } catch (e) {
    console.error("Erro ao atualizar cache local da ocorrência:", e);
  }
}

export async function deleteOccurrence(occurrenceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "occurrences", occurrenceId));
  } catch (error) {
    console.error("Erro ao deletar ocorrência no Firestore:", error);
  }

  try {
    let local = (await idbGet<Occurrence[]>("sispir_local_occurrences")) || [];
    const filtered = local.filter((o) => o.id !== occurrenceId);
    await idbSet("sispir_local_occurrences", filtered);
    safeSetLocalStorage("sispir_local_occurrences", filtered);
    window.dispatchEvent(new Event("sispir_local_occurrences_update"));
  } catch (e) {
    console.error("Erro ao deletar cache local da ocorrência:", e);
  }
}
