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
  const q = query(suspectsRef, orderBy("createdAt", "desc"));
  const unsubscribeFirestore = onSnapshot(
    q,
    (snapshot) => {
      const suspects: Suspect[] = [];
      snapshot.forEach((doc) => {
        suspects.push(doc.data() as Suspect);
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
      console.warn("Retrying suspect subscription with fallback query:", error);
      return onSnapshot(
        suspectsRef,
        (snap) => {
          const suspects: Suspect[] = [];
          snap.forEach((doc) => {
            suspects.push(doc.data() as Suspect);
          });
          suspects.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          if (suspects.length > 0) {
            idbSet("sispir_local_suspects", suspects);
            onUpdate(suspects);
          }
        },
        (nestedErr) => {
          console.warn("Fallback suspects subscription error:", nestedErr);
          idbGet<Suspect[]>("sispir_local_suspects").then((local) => {
            if (local && local.length > 0) {
              onUpdate(local);
            } else {
              onUpdate(MOCK_SUSPECTS);
            }
          });
        }
      );
    }
  );

  return () => {
    window.removeEventListener("sispir_local_suspects_update", handleCustomLocalUpdate);
    if (typeof unsubscribeFirestore === "function") unsubscribeFirestore();
  };
}

export async function addSuspect(suspect: Omit<Suspect, "createdAt" | "updatedAt">): Promise<void> {
  const fullSuspect: Suspect = {
    ...suspect,
    createdAt: (suspect as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const suspectRef = doc(db, "suspects", suspect.id);
    await setDoc(suspectRef, fullSuspect);
  } catch (error) {
    console.warn("Aviso ao gravar suspeito no Firestore:", error);
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
  const updatePayload = {
    ...suspectData,
    updatedAt: new Date().toISOString(),
  };

  try {
    const suspectRef = doc(db, "suspects", suspectId);
    await updateDoc(suspectRef, updatePayload);
  } catch (error) {
    console.warn("Aviso ao atualizar suspeito no Firestore:", error);
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
    console.warn("Aviso ao deletar suspeito no Firestore:", error);
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

// Ultra-fast chunked Firestore Batch Importer for full database backups
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

  const BATCH_SIZE = 100; // Safe chunk size under Firestore payload limits
  let importedSuspects = 0;
  let importedOccurrences = 0;
  const totalItems = suspects.length + occurrences.length;

  // Helper to sanitize Firestore document ID (cannot contain slashes or invalid characters)
  const sanitizeDocId = (id: string, prefix: string) => {
    const cleaned = (id || "").toString().trim().replace(/[\/\s#?\[\]]+/g, "_");
    return cleaned || `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  // 1. Batch Write Suspects to Cloud Firestore
  for (let i = 0; i < suspects.length; i += BATCH_SIZE) {
    const chunk = suspects.slice(i, i + BATCH_SIZE);
    try {
      const batch = writeBatch(db);
      for (const s of chunk) {
        const cleanId = sanitizeDocId(s.id, "SUSP");
        const fullSuspect: Suspect = {
          ...s,
          id: cleanId,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString(),
        };
        const ref = doc(db, "suspects", cleanId);
        batch.set(ref, fullSuspect);
      }
      await batch.commit();
      importedSuspects += chunk.length;
    } catch (batchErr) {
      console.warn("Lote em massa falhou, gravando individualmente os suspeitos:", batchErr);
      // Fallback: write individually so single item errors don't drop the rest
      for (const s of chunk) {
        try {
          const cleanId = sanitizeDocId(s.id, "SUSP");
          const fullSuspect: Suspect = {
            ...s,
            id: cleanId,
            createdAt: s.createdAt || new Date().toISOString(),
            updatedAt: s.updatedAt || new Date().toISOString(),
          };
          await setDoc(doc(db, "suspects", cleanId), fullSuspect);
          importedSuspects++;
        } catch (singleErr) {
          console.warn("Erro ao gravar suspeito individual:", singleErr);
        }
      }
    }

    if (onProgress && totalItems > 0) {
      const pct = Math.round((importedSuspects / totalItems) * 100);
      onProgress(`Gravando suspeitos no Firebase (${importedSuspects}/${suspects.length})...`, pct);
    }
  }

  // 2. Batch Write Occurrences to Cloud Firestore
  for (let i = 0; i < occurrences.length; i += BATCH_SIZE) {
    const chunk = occurrences.slice(i, i + BATCH_SIZE);
    try {
      const batch = writeBatch(db);
      for (const o of chunk) {
        const cleanId = sanitizeDocId(o.id, "OCC");
        const fullOcc: Occurrence = {
          ...o,
          id: cleanId,
          createdAt: o.createdAt || new Date().toISOString(),
          updatedAt: o.updatedAt || new Date().toISOString(),
        };
        const ref = doc(db, "occurrences", cleanId);
        batch.set(ref, fullOcc);
      }
      await batch.commit();
      importedOccurrences += chunk.length;
    } catch (batchErr) {
      console.warn("Lote em massa falhou, gravando individualmente as ocorrências:", batchErr);
      for (const o of chunk) {
        try {
          const cleanId = sanitizeDocId(o.id, "OCC");
          const fullOcc: Occurrence = {
            ...o,
            id: cleanId,
            createdAt: o.createdAt || new Date().toISOString(),
            updatedAt: o.updatedAt || new Date().toISOString(),
          };
          await setDoc(doc(db, "occurrences", cleanId), fullOcc);
          importedOccurrences++;
        } catch (singleErr) {
          console.warn("Erro ao gravar ocorrência individual:", singleErr);
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
  try {
    const suspectsRef = collection(db, "suspects");
    const snapshot = await getDocs(suspectsRef);
    if (snapshot.empty) {
      console.log("Banco de suspeitos vazio. Alimentando dados padrão...");
      const batch = writeBatch(db);
      MOCK_SUSPECTS.forEach((suspect) => {
        const docRef = doc(db, "suspects", suspect.id);
        batch.set(docRef, suspect);
      });
      await batch.commit();
      console.log("Banco de suspeitos alimentado com sucesso.");
    }
  } catch (error) {
    console.warn("Aviso ao verificar/popular suspeitos padrão:", error);
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
  const q = query(occurrencesRef, orderBy("createdAt", "desc"));
  const unsubscribeFirestore = onSnapshot(
    q,
    (snapshot) => {
      const occurrences: Occurrence[] = [];
      snapshot.forEach((doc) => {
        occurrences.push(doc.data() as Occurrence);
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
      console.warn("Retrying occurrences subscription with fallback query:", error);
      return onSnapshot(
        occurrencesRef,
        (snap) => {
          const occurrences: Occurrence[] = [];
          snap.forEach((doc) => {
            occurrences.push(doc.data() as Occurrence);
          });
          if (occurrences.length > 0) {
            idbSet("sispir_local_occurrences", occurrences);
            onUpdate(occurrences);
          }
        },
        (nestedErr) => {
          console.warn("Fallback occurrences subscription error:", nestedErr);
          idbGet<Occurrence[]>("sispir_local_occurrences").then((local) => {
            if (local && local.length > 0) {
              onUpdate(local);
            } else {
              onUpdate(MOCK_OCCURRENCES);
            }
          });
        }
      );
    }
  );

  return () => {
    window.removeEventListener("sispir_local_occurrences_update", handleCustomOccUpdate);
    if (typeof unsubscribeFirestore === "function") unsubscribeFirestore();
  };
}

export async function addOccurrence(occurrence: Omit<Occurrence, "createdAt" | "updatedAt">): Promise<void> {
  const fullOccurrence: Occurrence = {
    ...occurrence,
    createdAt: (occurrence as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const occurrenceRef = doc(db, "occurrences", occurrence.id);
    await setDoc(occurrenceRef, fullOccurrence);
  } catch (error) {
    console.warn("Aviso ao adicionar ocorrência no Firestore:", error);
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
  const updatePayload = {
    ...occurrenceData,
    updatedAt: new Date().toISOString(),
  };

  try {
    const occurrenceRef = doc(db, "occurrences", occurrenceId);
    await updateDoc(occurrenceRef, updatePayload);
  } catch (error) {
    console.warn("Aviso ao atualizar ocorrência no Firestore:", error);
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
    console.warn("Aviso ao deletar ocorrência no Firestore:", error);
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

// Seeding helper to seed occurrences if empty
export async function seedOccurrencesIfEmpty(): Promise<void> {
  try {
    const occurrencesRef = collection(db, "occurrences");
    const snapshot = await getDocs(occurrencesRef);
    if (snapshot.empty) {
      console.log("Banco de ocorrências vazio. Sembrando dados padrão...");
      const batch = writeBatch(db);
      MOCK_OCCURRENCES.forEach((occurrence) => {
        const docRef = doc(db, "occurrences", occurrence.id);
        batch.set(docRef, occurrence);
      });
      await batch.commit();
      console.log("Banco de ocorrências alimentado com sucesso.");
    }
  } catch (error) {
    console.error("Erro ao sembrar ocorrências padrão:", error);
  }
}
