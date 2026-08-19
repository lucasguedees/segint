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
  return localStorage.getItem("sispir_mode") === "local";
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isLocalMode()) {
    const profileStr = localStorage.getItem(`sispir_local_profile_${uid}`);
    return profileStr ? JSON.parse(profileStr) : null;
  }
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Erro ao obter perfil do usuário:", error);
    throw error;
  }
}

export async function createUserProfile(
  uid: string,
  name: string,
  email: string,
  badgeId?: string
): Promise<UserProfile> {
  if (isLocalMode()) {
    const role: UserRole = "admin";
    const status: UserStatus = "approved";
    const profile: UserProfile = {
      uid,
      name,
      email,
      role,
      status,
      badgeId: badgeId || "",
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(`sispir_local_profile_${uid}`, JSON.stringify(profile));
    
    const usersStr = localStorage.getItem("sispir_local_users") || "[]";
    const users = JSON.parse(usersStr) as UserProfile[];
    if (!users.some((u) => u.uid === uid)) {
      users.push(profile);
      localStorage.setItem("sispir_local_users", JSON.stringify(users));
    }
    
    window.dispatchEvent(new Event("sispir_local_users_update"));
    window.dispatchEvent(new Event("sispir_local_profile_update"));
    return profile;
  }
  try {
    const isOwner = email.toLowerCase() === "lucas2305rj1994@gmail.com";
    let isEmpty = false;
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      isEmpty = snapshot.empty;
    } catch {
      // If collection read is restricted before user document creation, fallback safely
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

    await setDoc(doc(db, "users", uid), profile);
    return profile;
  } catch (error) {
    console.error("Erro ao criar perfil do usuário:", error);
    throw error;
  }
}

export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void
) {
  if (isLocalMode()) {
    const fetchLocalProfile = () => {
      const profileStr = localStorage.getItem(`sispir_local_profile_${uid}`);
      if (profileStr) {
        onUpdate(JSON.parse(profileStr));
      } else {
        onUpdate(null);
      }
    };
    
    fetchLocalProfile();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `sispir_local_profile_${uid}`) {
        fetchLocalProfile();
      }
    };
    
    const handleCustomChange = () => {
      fetchLocalProfile();
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sispir_local_profile_update", handleCustomChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sispir_local_profile_update", handleCustomChange);
    };
  }
  return onSnapshot(
    doc(db, "users", uid),
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as UserProfile);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error("Erro no listener do perfil do usuário:", error);
    }
  );
}

// Admin service: get all users for approval
export function subscribeToAllUsers(onUpdate: (users: UserProfile[]) => void) {
  if (isLocalMode()) {
    const fetchUsers = () => {
      const usersStr = localStorage.getItem("sispir_local_users") || "[]";
      onUpdate(JSON.parse(usersStr));
    };
    fetchUsers();
    
    window.addEventListener("sispir_local_users_update", fetchUsers);
    return () => window.removeEventListener("sispir_local_users_update", fetchUsers);
  }
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      onUpdate(users);
    },
    (error) => {
      console.error("Erro ao escutar todos os usuários:", error);
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

  if (isLocalMode()) {
    const profileStr = localStorage.getItem(`sispir_local_profile_${uid}`);
    if (profileStr) {
      const profile = JSON.parse(profileStr) as UserProfile;
      const updated = { ...profile, ...cleanUpdates };
      localStorage.setItem(`sispir_local_profile_${uid}`, JSON.stringify(updated));
    }
    
    const usersStr = localStorage.getItem("sispir_local_users") || "[]";
    const users = JSON.parse(usersStr) as UserProfile[];
    const index = users.findIndex((u) => u.uid === uid);
    if (index !== -1) {
      users[index] = { ...users[index], ...cleanUpdates };
      localStorage.setItem("sispir_local_users", JSON.stringify(users));
    }
    
    window.dispatchEvent(new Event("sispir_local_profile_update"));
    window.dispatchEvent(new Event("sispir_local_users_update"));
    return;
  }

  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, cleanUpdates);
  } catch (error) {
    console.error("Erro ao atualizar dados do perfil do usuário:", error);
    throw error;
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  if (isLocalMode()) {
    localStorage.removeItem(`sispir_local_profile_${uid}`);
    const usersStr = localStorage.getItem("sispir_local_users") || "[]";
    const users = (JSON.parse(usersStr) as UserProfile[]).filter((u) => u.uid !== uid);
    localStorage.setItem("sispir_local_users", JSON.stringify(users));
    window.dispatchEvent(new Event("sispir_local_users_update"));
    return;
  }

  try {
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);
  } catch (error) {
    console.error("Erro ao excluir perfil de usuário:", error);
    throw error;
  }
}

// --- Suspects Services ---

export function subscribeToSuspects(onUpdate: (suspects: Suspect[]) => void) {
  if (isLocalMode()) {
    const fetchSuspects = async () => {
      let suspects = await idbGet<Suspect[]>("sispir_local_suspects");
      if (!suspects || suspects.length === 0) {
        const suspectsStr = localStorage.getItem("sispir_local_suspects") || "[]";
        try {
          suspects = JSON.parse(suspectsStr) as Suspect[];
        } catch {
          suspects = [];
        }
      }
      if (!suspects || suspects.length === 0) {
        suspects = MOCK_SUSPECTS;
        await idbSet("sispir_local_suspects", suspects);
        safeSetLocalStorage("sispir_local_suspects", suspects);
      }
      // Preserve registration order (order of creation / insertion in database)
      const sortedByRegistration = [...suspects].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return 0;
      });
      onUpdate(sortedByRegistration.length > 0 ? sortedByRegistration : suspects);
    };
    fetchSuspects();
    
    window.addEventListener("sispir_local_suspects_update", fetchSuspects);
    return () => window.removeEventListener("sispir_local_suspects_update", fetchSuspects);
  }
  const suspectsRef = collection(db, "suspects");
  const q = query(suspectsRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const suspects: Suspect[] = [];
      snapshot.forEach((doc) => {
        suspects.push(doc.data() as Suspect);
      });
      onUpdate(suspects);
    },
    (error) => {
      console.warn("Retrying suspect subscription with fallback query:", error);
      return onSnapshot(suspectsRef, (snap) => {
        const suspects: Suspect[] = [];
        snap.forEach((doc) => {
          suspects.push(doc.data() as Suspect);
        });
        suspects.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        onUpdate(suspects);
      });
    }
  );
}

export async function addSuspect(suspect: Omit<Suspect, "createdAt" | "updatedAt">): Promise<void> {
  if (isLocalMode()) {
    let suspects = await idbGet<Suspect[]>("sispir_local_suspects");
    if (!suspects || suspects.length === 0) {
      const suspectsStr = localStorage.getItem("sispir_local_suspects") || "[]";
      try {
        suspects = JSON.parse(suspectsStr) as Suspect[];
      } catch {
        suspects = [];
      }
    }
    const fullSuspect: Suspect = {
      ...suspect,
      createdAt: (suspect as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const index = suspects.findIndex((s) => s.id === fullSuspect.id);
    if (index !== -1) {
      suspects[index] = fullSuspect;
    } else {
      suspects.push(fullSuspect);
    }

    await idbSet("sispir_local_suspects", suspects);
    safeSetLocalStorage("sispir_local_suspects", suspects);
    window.dispatchEvent(new Event("sispir_local_suspects_update"));
    return;
  }
  try {
    const suspectRef = doc(db, "suspects", suspect.id);
    const fullSuspect: Suspect = {
      ...suspect,
      createdAt: (suspect as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(suspectRef, fullSuspect);
  } catch (error) {
    console.error("Erro ao adicionar suspeito:", error);
    throw error;
  }
}

export async function updateSuspect(
  suspectId: string,
  suspectData: Partial<Omit<Suspect, "id" | "createdAt" | "createdBy">>
): Promise<void> {
  if (isLocalMode()) {
    let suspects = await idbGet<Suspect[]>("sispir_local_suspects");
    if (!suspects || suspects.length === 0) {
      const suspectsStr = localStorage.getItem("sispir_local_suspects") || "[]";
      try {
        suspects = JSON.parse(suspectsStr) as Suspect[];
      } catch {
        suspects = [];
      }
    }
    const index = suspects.findIndex((s) => s.id === suspectId);
    if (index !== -1) {
      suspects[index] = {
        ...suspects[index],
        ...suspectData,
        updatedAt: new Date().toISOString(),
      };
      await idbSet("sispir_local_suspects", suspects);
      safeSetLocalStorage("sispir_local_suspects", suspects);
      window.dispatchEvent(new Event("sispir_local_suspects_update"));
    }
    return;
  }
  try {
    const suspectRef = doc(db, "suspects", suspectId);
    await updateDoc(suspectRef, {
      ...suspectData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao atualizar suspeito:", error);
    throw error;
  }
}

export async function deleteSuspect(suspectId: string): Promise<void> {
  if (isLocalMode()) {
    let suspects = await idbGet<Suspect[]>("sispir_local_suspects");
    if (!suspects || suspects.length === 0) {
      const suspectsStr = localStorage.getItem("sispir_local_suspects") || "[]";
      try {
        suspects = JSON.parse(suspectsStr) as Suspect[];
      } catch {
        suspects = [];
      }
    }
    const filtered = suspects.filter((s) => s.id !== suspectId);
    await idbSet("sispir_local_suspects", filtered);
    safeSetLocalStorage("sispir_local_suspects", filtered);
    window.dispatchEvent(new Event("sispir_local_suspects_update"));
    return;
  }
  try {
    await deleteDoc(doc(db, "suspects", suspectId));
  } catch (error) {
    console.error("Erro ao deletar suspeito:", error);
    throw error;
  }
}

// Seeding helper to seed suspects if empty
export async function seedSuspectsIfEmpty(): Promise<void> {
  if (isLocalMode()) {
    let suspects = await idbGet<Suspect[]>("sispir_local_suspects");
    if (!suspects || suspects.length === 0) {
      const suspectsStr = localStorage.getItem("sispir_local_suspects") || "[]";
      try {
        suspects = JSON.parse(suspectsStr) as Suspect[];
      } catch {
        suspects = [];
      }
    }
    if (suspects.length === 0) {
      await idbSet("sispir_local_suspects", MOCK_SUSPECTS);
      safeSetLocalStorage("sispir_local_suspects", MOCK_SUSPECTS);
      window.dispatchEvent(new Event("sispir_local_suspects_update"));
    }
    return;
  }
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
  if (isLocalMode()) {
    const fetchOccurrences = async () => {
      let occurrences = await idbGet<Occurrence[]>("sispir_local_occurrences");
      if (!occurrences || occurrences.length === 0) {
        const occurrencesStr = localStorage.getItem("sispir_local_occurrences") || "[]";
        try {
          occurrences = JSON.parse(occurrencesStr) as Occurrence[];
        } catch {
          occurrences = [];
        }
      }
      if (!occurrences || occurrences.length === 0) {
        occurrences = MOCK_OCCURRENCES;
        await idbSet("sispir_local_occurrences", occurrences);
        safeSetLocalStorage("sispir_local_occurrences", occurrences);
      }
      onUpdate(occurrences.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    fetchOccurrences();
    
    window.addEventListener("sispir_local_occurrences_update", fetchOccurrences);
    return () => window.removeEventListener("sispir_local_occurrences_update", fetchOccurrences);
  }
  const occurrencesRef = collection(db, "occurrences");
  const q = query(occurrencesRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const occurrences: Occurrence[] = [];
      snapshot.forEach((doc) => {
        occurrences.push(doc.data() as Occurrence);
      });
      onUpdate(occurrences);
    },
    (error) => {
      console.error("Erro ao escutar ocorrências:", error);
    }
  );
}

export async function addOccurrence(occurrence: Omit<Occurrence, "createdAt" | "updatedAt">): Promise<void> {
  if (isLocalMode()) {
    let occurrences = await idbGet<Occurrence[]>("sispir_local_occurrences");
    if (!occurrences || occurrences.length === 0) {
      const occurrencesStr = localStorage.getItem("sispir_local_occurrences") || "[]";
      try {
        occurrences = JSON.parse(occurrencesStr) as Occurrence[];
      } catch {
        occurrences = [];
      }
    }
    const fullOccurrence: Occurrence = {
      ...occurrence,
      createdAt: (occurrence as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const index = occurrences.findIndex((o) => o.id === fullOccurrence.id);
    if (index !== -1) {
      occurrences[index] = fullOccurrence;
    } else {
      occurrences.push(fullOccurrence);
    }

    await idbSet("sispir_local_occurrences", occurrences);
    safeSetLocalStorage("sispir_local_occurrences", occurrences);
    window.dispatchEvent(new Event("sispir_local_occurrences_update"));
    return;
  }
  try {
    const occurrenceRef = doc(db, "occurrences", occurrence.id);
    const fullOccurrence: Occurrence = {
      ...occurrence,
      createdAt: (occurrence as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(occurrenceRef, fullOccurrence);
  } catch (error) {
    console.error("Erro ao adicionar ocorrência:", error);
    throw error;
  }
}

export async function updateOccurrence(
  occurrenceId: string,
  occurrenceData: Partial<Omit<Occurrence, "id" | "createdAt">>
): Promise<void> {
  if (isLocalMode()) {
    let occurrences = await idbGet<Occurrence[]>("sispir_local_occurrences");
    if (!occurrences || occurrences.length === 0) {
      const occurrencesStr = localStorage.getItem("sispir_local_occurrences") || "[]";
      try {
        occurrences = JSON.parse(occurrencesStr) as Occurrence[];
      } catch {
        occurrences = [];
      }
    }
    const index = occurrences.findIndex((o) => o.id === occurrenceId);
    if (index !== -1) {
      occurrences[index] = {
        ...occurrences[index],
        ...occurrenceData,
        updatedAt: new Date().toISOString(),
      };
      await idbSet("sispir_local_occurrences", occurrences);
      safeSetLocalStorage("sispir_local_occurrences", occurrences);
      window.dispatchEvent(new Event("sispir_local_occurrences_update"));
    }
    return;
  }
  try {
    const occurrenceRef = doc(db, "occurrences", occurrenceId);
    await updateDoc(occurrenceRef, {
      ...occurrenceData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao atualizar ocorrência:", error);
    throw error;
  }
}

export async function deleteOccurrence(occurrenceId: string): Promise<void> {
  if (isLocalMode()) {
    let occurrences = await idbGet<Occurrence[]>("sispir_local_occurrences");
    if (!occurrences || occurrences.length === 0) {
      const occurrencesStr = localStorage.getItem("sispir_local_occurrences") || "[]";
      try {
        occurrences = JSON.parse(occurrencesStr) as Occurrence[];
      } catch {
        occurrences = [];
      }
    }
    const filtered = occurrences.filter((o) => o.id !== occurrenceId);
    await idbSet("sispir_local_occurrences", filtered);
    safeSetLocalStorage("sispir_local_occurrences", filtered);
    window.dispatchEvent(new Event("sispir_local_occurrences_update"));
    return;
  }
  try {
    await deleteDoc(doc(db, "occurrences", occurrenceId));
  } catch (error) {
    console.error("Erro ao deletar ocorrência:", error);
    throw error;
  }
}

// Seeding helper to seed occurrences if empty
export async function seedOccurrencesIfEmpty(): Promise<void> {
  if (isLocalMode()) {
    let occurrences = await idbGet<Occurrence[]>("sispir_local_occurrences");
    if (!occurrences || occurrences.length === 0) {
      const occurrencesStr = localStorage.getItem("sispir_local_occurrences") || "[]";
      try {
        occurrences = JSON.parse(occurrencesStr) as Occurrence[];
      } catch {
        occurrences = [];
      }
    }
    if (occurrences.length === 0) {
      await idbSet("sispir_local_occurrences", MOCK_OCCURRENCES);
      safeSetLocalStorage("sispir_local_occurrences", MOCK_OCCURRENCES);
      window.dispatchEvent(new Event("sispir_local_occurrences_update"));
    }
    return;
  }
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
