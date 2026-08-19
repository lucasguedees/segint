export type UserRole = "admin" | "user";
export type UserStatus = "approved" | "pending" | "rejected";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  badgeId?: string;
  lotacao?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SuspectStatus = "wanted" | "arrested" | "investigating" | "inactive";

export type OccurrenceSeverity = "low" | "medium" | "high" | "critical";
export type OccurrenceStatus = "open" | "investigating" | "closed";

export interface InvolvedPerson {
  id?: string;
  name: string;
  vulgo?: string;
  document?: string;
  photoUrl?: string;
}

export interface Occurrence {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  severity: OccurrenceSeverity;
  status: OccurrenceStatus;
  relatedSuspects?: string[]; // Array of Suspect IDs
  envolvidoName?: string;
  vulgo?: string;
  photoUrl?: string;
  photos?: string[]; // Array of photos for gallery
  involvedPeople?: InvolvedPerson[];
  alvosCount?: number;
  hasMaterial?: boolean;
  extraPhotosCount?: number;
  agentInCharge: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoHistoryEntry {
  id: string;
  url: string;
  date: string;
  description?: string; // e.g. details about clothes/appearance
  agentName?: string;  // agent who recorded the approach photo
  createdAt: string;
}

export interface Suspect {
  id: string;
  name: string;
  alias: string; // alcunha / apelido
  document: string; // RG, CPF, etc.
  status: SuspectStatus;
  birthDate: string;
  motherName: string;
  faction?: string; // facção criminosa
  areaOfOperation?: string; // área de atuação
  height?: string;
  weight?: string;
  skinColor?: string;
  eyeColor?: string;
  hairType?: string;
  tattoosScars?: string;
  observations?: string;
  alvoEmFoco?: boolean;
  alvoEmFocoReason?: string;
  foragido?: boolean;
  mandadoNumero?: string;
  municipio?: string;
  antecedentes?: string;
  frequentCrimes?: string;
  lastKnownAddress?: string;
  photos: string[]; // URLs of photos (first is primary mugshot)
  photoHistory?: PhotoHistoryEntry[]; // library of approach photos and history
  coverFocus3x4?: boolean; // toggle to focus on face/bust (3x4 format) vs full image
  createdBy: string; // UID of user who registered
  createdAt: string;
  updatedAt: string;
}

export type AuditActionType =
  | "CREATE_SUSPECT"
  | "UPDATE_SUSPECT"
  | "DELETE_SUSPECT"
  | "CREATE_OCCURRENCE"
  | "UPDATE_OCCURRENCE"
  | "DELETE_OCCURRENCE"
  | "FACIAL_SCAN"
  | "CREATE_USER"
  | "UPDATE_USER"
  | "DELETE_USER"
  | "APPROVE_USER"
  | "REJECT_USER"
  | "LOGIN"
  | "EXPORT_DATA"
  | "IMPORT_BACKUP";

export interface AuditLog {
  id: string;
  action: AuditActionType;
  actionLabel: string;
  category: "SUSPEITOS" | "OCORRENCIAS" | "USUARIOS" | "BIOMETRIA" | "SISTEMA";
  performedBy: {
    uid: string;
    name: string;
    email: string;
    badgeId?: string;
    lotacao?: string;
    role?: string;
  };
  targetId?: string;
  targetName?: string;
  details: string;
  diff?: Record<string, any>;
  timestamp: string;
}
