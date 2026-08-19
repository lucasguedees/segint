import React, { useState, useEffect, useMemo } from "react";
import { UserProfile, Suspect, SuspectStatus, Occurrence, OccurrenceSeverity, OccurrenceStatus } from "../types";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import {
  subscribeToSuspects,
  addSuspect,
  updateSuspect,
  deleteSuspect,
  seedSuspectsIfEmpty,
  seedOccurrencesIfEmpty,
  subscribeToOccurrences,
  addOccurrence,
  subscribeToAllUsers,
  updateUserStatus,
  importBackupBatchToFirestore,
} from "../dbService";
import SuspectCard from "./SuspectCard";
import SuspectModal from "./SuspectModal";
import AddSuspectModal from "./AddSuspectModal";
import AlvoFocoCard from "./AlvoFocoCard";
import ForagidoCard from "./ForagidoCard";
import ReincidenteCard from "./ReincidenteCard";
import OccurrenceModal from "./OccurrenceModal";
import AdminPanel from "./AdminPanel";
import OccurrencesPanel from "./OccurrencesPanel";
import FacialRecognitionPanel from "./FacialRecognitionPanel";
import WatermarkOverlay from "./WatermarkOverlay";
import { matchesSuspectSmartSearch } from "../utils/suspectSearch";
import {
  Shield,
  LogOut,
  Plus,
  Search,
  Filter,
  Users,
  Briefcase,
  Layers,
  Database,
  Sparkles,
  RefreshCw,
  FolderLock,
  Menu,
  ChevronLeft,
  ChevronRight,
  FileText,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  AlertTriangle,
  X,
  Check,
  Target,
  Activity,
  LayoutList,
  Grid,
  FileSpreadsheet,
  Upload,
  Download,
  Brain,
  Settings,
  RotateCcw,
  MapPin,
  Edit2,
  Trash2,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  ScanFace,
  Bell,
  BellRing,
  UserPlus,
  Clock,
  UserCheck,
  ExternalLink,
  ArrowUpDown,
  ArrowDownAZ,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardProps {
  currentUser: UserProfile;
  onLogout?: () => void;
}

type TabType = "database" | "alvo-em-foco" | "foragido" | "reincidentes" | "occurrences" | "facial-recognition" | "admin";

export default function Dashboard({ currentUser, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("database");
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin and Real-time Operator Registration Notification state
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allAdminUsers, setAllAdminUsers] = useState<UserProfile[]>([]);
  const [newOperatorAlert, setNewOperatorAlert] = useState<UserProfile | null>(null);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [adminInitialFilter, setAdminInitialFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const isFirstUsersLoadRef = React.useRef(true);
  const knownUserIdsRef = React.useRef<Set<string>>(new Set());

  // Web Audio synthesizer chime for polite real-time alert
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {
      // Audio playback ignore if blocked by browser policy
    }
  };

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [factionFilter, setFactionFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [suspectSortOrder, setSuspectSortOrder] = useState<"registration_desc" | "registration_asc" | "alpha_asc" | "alpha_desc">("registration_desc");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("list");
  const [hideSuspectDetails, setHideSuspectDetails] = useState(false);
  const [photoSize, setPhotoSize] = useState<number>(180);
  const [largeThumbnails, setLargeThumbnails] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // IA - INTELIGÊNCIA: Automatic suspect generator from occurrences
  const handleAiIntelligenceGenerate = async () => {
    if (occurrences.length === 0) {
      showToast("Nenhuma ocorrência cadastrada para analisar.", "info");
      return;
    }

    setIsAiProcessing(true);
    let createdCount = 0;
    const existingSuspectNames = new Set(
      suspects.map((s) => s.name.trim().toLowerCase())
    );
    const existingSuspectAliases = new Set(
      suspects.map((s) => (s.alias || "").trim().toLowerCase()).filter(Boolean)
    );

    try {
      for (const occ of occurrences) {
        // Collect candidate involved people from occurrence
        const candidates: Array<{
          name: string;
          vulgo?: string;
          document?: string;
          photoUrl?: string;
        }> = [];

        if (occ.envolvidoName && occ.envolvidoName.trim()) {
          candidates.push({
            name: occ.envolvidoName.trim(),
            vulgo: occ.vulgo,
            photoUrl: occ.photoUrl,
          });
        }

        if (occ.involvedPeople && occ.involvedPeople.length > 0) {
          for (const p of occ.involvedPeople) {
            if (p.name && p.name.trim()) {
              candidates.push({
                name: p.name.trim(),
                vulgo: p.vulgo,
                document: p.document,
                photoUrl: p.photoUrl,
              });
            }
          }
        }

        for (const cand of candidates) {
          const normName = cand.name.toLowerCase();
          const normVulgo = (cand.vulgo || "").toLowerCase();

          // Skip if person is already registered in suspects database
          if (existingSuspectNames.has(normName)) continue;
          if (normVulgo && normVulgo !== "n/i" && existingSuspectAliases.has(normVulgo)) continue;

          // Generate new suspect automatically from occurrence data
          const newSuspectId = `SUSP-IA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const newSuspect = {
            id: newSuspectId,
            name: cand.name.toUpperCase(),
            alias: cand.vulgo && cand.vulgo !== "N/I" ? cand.vulgo.toUpperCase() : "",
            document: cand.document ? cand.document.replace(/^Doc:\s*/i, "") : "",
            status: "wanted" as SuspectStatus,
            birthDate: "",
            motherName: "",
            faction: "Independente",
            areaOfOperation: occ.location ? occ.location.split("•")[0].trim().toUpperCase() : "LAJEADO",
            municipio: occ.location ? occ.location.split("•")[0].trim().toUpperCase() : "LAJEADO",
            observations: `[CADASTRADO AUTOMATICAMENTE VIA IA - INTELIGÊNCIA]\nIdentificado na Ocorrência: ${occ.title} (Data: ${occ.date})\nLocal: ${occ.location}\nRelato: ${occ.description}`,
            antecedentes: `Identificado na ocorrência "${occ.title}" em ${occ.date}.`,
            photos: cand.photoUrl ? [cand.photoUrl] : occ.photoUrl ? [occ.photoUrl] : [],
            createdBy: currentUser.uid,
          };

          await addSuspect(newSuspect as any);
          existingSuspectNames.add(normName);
          if (normVulgo && normVulgo !== "n/i") existingSuspectAliases.add(normVulgo);
          createdCount++;
        }
      }

      if (createdCount > 0) {
        showToast(
          `IA - INTELIGÊNCIA: ${createdCount} novo(s) suspeito(s) gerado(s) e cadastrado(s) no banco a partir das ocorrências!`,
          "success"
        );
      } else {
        showToast(
          "IA - INTELIGÊNCIA: Todos os envolvidos em ocorrências já constam cadastrados na página de Suspeitos.",
          "info"
        );
      }
    } catch (err) {
      console.error("Erro na IA Inteligência:", err);
      showToast("Erro ao processar inteligência automática de suspeitos.", "error");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Download complete JSON backup of database
  const handleDownloadBackup = () => {
    try {
      const backupData = {
        system: "SISPIR - INTELIGÊNCIA OPERACIONAL",
        version: "1.0",
        timestamp: new Date().toISOString(),
        exportedBy: currentUser.name,
        suspects,
        occurrences,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sispir_backup_completo_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast("Backup do banco de dados baixado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao gerar arquivo de backup.", "error");
    }
  };

  // Helper to normalize any JSON suspect format (Portuguese/English schemas) into system Suspect model
  const normalizeSuspectFromJSON = (s: any): Suspect | null => {
    if (!s || typeof s !== "object") return null;

    // Name (supports `nome`, `name`, `envolvidoName`, `nomeCompleto`)
    const name = (s.nome || s.name || s.envolvidoName || s.nomeCompleto || "").toString().trim();
    if (!name) return null;

    // Alias / Alcunha
    const alias = (s.alcunha || s.alias || s.vulgo || s.apelido || "").toString().trim();

    // Document / RG / CPF
    const document = (s.rgCpf || s.document || s.documento || s.rg || s.cpf || "").toString().trim();

    // City / Area of Operation
    const city = (s.cidade || s.municipio || s.areaOfOperation || s.areaAtuacao || "LAJEADO").toString().trim();

    // Address
    const address = (s.endereco || s.lastKnownAddress || s.rua || "").toString().trim();

    // Observations & Antecedentes & Features
    const observations = (s.observacoes || s.observations || s.obs || s.rawText || "").toString().trim();
    const antecedentes = (s.antecedentes || s.historicoCriminal || "").toString().trim();
    const caracteristicas = (s.caracteristicas || s.tattoosScars || "").toString().trim();

    // Photos array consolidation
    const photosArr: string[] = [];

    // 1. `s.photos` (array of strings or objects)
    if (Array.isArray(s.photos)) {
      for (const p of s.photos) {
        if (typeof p === "string" && p.trim()) {
          photosArr.push(p.trim());
        } else if (p && typeof p === "object" && p.url && typeof p.url === "string") {
          photosArr.push(p.url.trim());
        }
      }
    }

    // 2. Single image field: `s.imagemUrl`, `s.photoUrl`, `s.fotoUrl`, `s.coverPhoto`, `s.foto`
    const singleImg = s.imagemUrl || s.photoUrl || s.fotoUrl || s.coverPhoto || s.foto;
    if (typeof singleImg === "string" && singleImg.trim() && !photosArr.includes(singleImg.trim())) {
      photosArr.unshift(singleImg.trim()); // Place primary photo first
    }

    // 3. `s.outrasFotos`
    if (s.outrasFotos) {
      if (Array.isArray(s.outrasFotos)) {
        for (const p of s.outrasFotos) {
          if (typeof p === "string" && p.trim() && !photosArr.includes(p.trim())) {
            photosArr.push(p.trim());
          } else if (p && typeof p === "object" && p.url && typeof p.url === "string" && !photosArr.includes(p.url.trim())) {
            photosArr.push(p.url.trim());
          }
        }
      } else if (typeof s.outrasFotos === "string" && s.outrasFotos.trim() && !photosArr.includes(s.outrasFotos.trim())) {
        photosArr.push(s.outrasFotos.trim());
      }
    }

    // Status & flags
    let status: SuspectStatus = (s.status as SuspectStatus) || "wanted";
    if (s.foragido) {
      status = "wanted";
    }

    const alvoEmFoco = Boolean(s.alvoEmFoco || s.alvo_em_foco || s.alvo);
    const foragido = Boolean(s.foragido || s.isForagido || status === "wanted");

    let createdAt = s.createdAt || s.dataCadastro || new Date().toISOString();
    if (typeof s.dataCadastro === "string" && s.dataCadastro.trim()) {
      createdAt = s.dataCadastro.trim();
    }

    return {
      id: (s.id || `SUSP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`).toString(),
      name,
      alias,
      document,
      status,
      birthDate: (s.birthDate || s.dataNascimento || "").toString(),
      motherName: (s.motherName || s.nomeMae || "").toString(),
      faction: (s.faction || s.faccao || s.grupo || "Independente").toString(),
      areaOfOperation: city,
      municipio: city,
      lastKnownAddress: address,
      observations,
      antecedentes,
      tattoosScars: caracteristicas,
      alvoEmFoco,
      alvoEmFocoReason: (s.alvoEmFocoReason || "").toString(),
      foragido,
      mandadoNumero: (s.mandadoNumero || "").toString(),
      photos: photosArr,
      createdBy: (s.createdBy || currentUser.uid || "system").toString(),
      createdAt: createdAt.toString(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Helper to normalize any JSON occurrence format into system Occurrence model
  const normalizeOccurrenceFromJSON = (occ: any): Occurrence | null => {
    if (!occ || typeof occ !== "object") return null;

    const title = (occ.title || occ.titulo || occ.tipo || occ.nome || "").toString().trim();
    if (!title) return null;

    const description = (occ.description || occ.descricao || occ.observacoes || occ.obs || "").toString().trim();
    const location = (occ.location || occ.local || occ.endereco || occ.cidade || occ.municipio || "LAJEADO").toString().trim();

    // Photos
    const photosArr: string[] = [];
    if (Array.isArray(occ.photos)) {
      for (const p of occ.photos) {
        if (typeof p === "string" && p.trim()) photosArr.push(p.trim());
        else if (p && typeof p === "object" && p.url && typeof p.url === "string") photosArr.push(p.url.trim());
      }
    }
    const singlePhoto = occ.photoUrl || occ.imagemUrl || occ.fotoUrl;
    if (typeof singlePhoto === "string" && singlePhoto.trim() && !photosArr.includes(singlePhoto.trim())) {
      photosArr.unshift(singlePhoto.trim());
    }

    return {
      id: (occ.id || `OCOR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`).toString(),
      title,
      description,
      location,
      date: (occ.date || occ.data || new Date().toISOString().split("T")[0]).toString(),
      time: (occ.time || occ.hora || "12:00").toString(),
      severity: (occ.severity || occ.gravidade || "medium") as OccurrenceSeverity,
      status: (occ.status || "open") as OccurrenceStatus,
      agentInCharge: (occ.agentInCharge || occ.agente || currentUser.name || "Agente").toString(),
      envolvidoName: (occ.envolvidoName || occ.envolvido || occ.suspectName || "").toString(),
      vulgo: (occ.vulgo || occ.alcunha || "").toString(),
      photoUrl: photosArr[0] || "",
      photos: photosArr,
      involvedPeople: Array.isArray(occ.involvedPeople) ? occ.involvedPeople : Array.isArray(occ.envolvidos) ? occ.envolvidos : [],
      relatedSuspects: Array.isArray(occ.relatedSuspects) ? occ.relatedSuspects : Array.isArray(occ.suspeitosRelacionados) ? occ.suspeitosRelacionados : [],
      createdAt: (occ.createdAt || occ.dataCadastro || new Date().toISOString()).toString(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Upload/Restore JSON backup into database
  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;

        showToast("Lendo arquivo de backup...", "info");
        const data = JSON.parse(content);

        const rawSuspectsList = Array.isArray(data)
          ? data
          : Array.isArray(data.suspects)
          ? data.suspects
          : Array.isArray(data.suspeitos)
          ? data.suspeitos
          : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.items)
          ? data.items
          : typeof data === "object" && (data.nome || data.name)
          ? [data]
          : [];

        const normalizedSuspects: Suspect[] = [];
        for (const rawSuspect of rawSuspectsList) {
          const s = normalizeSuspectFromJSON(rawSuspect);
          if (s) normalizedSuspects.push(s);
        }

        const rawOccList = Array.isArray(data.occurrences)
          ? data.occurrences
          : Array.isArray(data.ocorrencias)
          ? data.ocorrencias
          : [];

        const normalizedOccs: Occurrence[] = [];
        for (const rawOcc of rawOccList) {
          const occ = normalizeOccurrenceFromJSON(rawOcc);
          if (occ) normalizedOccs.push(occ);
        }

        showToast(
          `Gravando ${normalizedSuspects.length} suspeitos e ${normalizedOccs.length} ocorrências no Firestore...`,
          "info"
        );

        const result = await importBackupBatchToFirestore(
          normalizedSuspects,
          normalizedOccs,
          (msg) => {
            showToast(msg, "info");
          }
        );

        showToast(
          `Backup gravado com sucesso no Firebase na Nuvem! (${result.totalSuspects} suspeitos, ${result.totalOccurrences} ocorrências)`,
          "success"
        );
      } catch (err) {
        console.error(err);
        showToast("Erro ao processar arquivo de backup. Formato JSON inválido.", "error");
      } finally {
        if (backupFileInputRef.current) backupFileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Modal states
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [suspectToEdit, setSuspectToEdit] = useState<Suspect | undefined>(undefined);

  // Custom alert and confirmation dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
    isDanger?: boolean;
  } | null>(null);

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev && prev.message === message ? null : prev));
    }, 4500);
  };

  // Listen to suspects
  useEffect(() => {
    // Seed suspects if the database is completely empty so they have sample data immediately!
    seedSuspectsIfEmpty();

    const unsubscribe = subscribeToSuspects((allSuspects) => {
      setSuspects(allSuspects);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to occurrences
  useEffect(() => {
    seedOccurrencesIfEmpty();
    const unsubscribe = subscribeToOccurrences((allOccurrences) => {
      setOccurrences(allOccurrences);
    });

    return () => unsubscribe();
  }, []);

  // Listen to all users in real-time when current user is admin
  useEffect(() => {
    if (currentUser.role !== "admin") return;

    const unsubscribe = subscribeToAllUsers((users) => {
      setAllAdminUsers(users);
      const pending = users.filter((u) => u.status === "pending");
      setPendingUsers(pending);

      if (isFirstUsersLoadRef.current) {
        isFirstUsersLoadRef.current = false;
        users.forEach((u) => knownUserIdsRef.current.add(u.uid));
      } else {
        // Detect newly registered user with status 'pending'
        const newPending = users.find(
          (u) => u.status === "pending" && !knownUserIdsRef.current.has(u.uid)
        );

        if (newPending) {
          knownUserIdsRef.current.add(newPending.uid);
          setNewOperatorAlert(newPending);
          playNotificationChime();

          // Native Browser Web Notification if permission is granted
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              try {
                new Notification("SISPIR - Novo Cadastro de Operador", {
                  body: `${newPending.name || "Novo operador"} solicitou acesso ao sistema.`,
                  icon: "/favicon.ico",
                });
              } catch (e) {
                // Ignore notification error
              }
            } else if (Notification.permission === "default") {
              Notification.requestPermission();
            }
          }
        }

        users.forEach((u) => knownUserIdsRef.current.add(u.uid));
      }
    });

    return () => unsubscribe();
  }, [currentUser.role]);

  // Quick direct approval helper from notification badge / popup
  const handleQuickApprove = async (uid: string, name: string) => {
    try {
      await updateUserStatus(uid, "approved", "user");
      showToast(`Acesso de ${name} homologado e liberado com sucesso!`, "success");
      if (newOperatorAlert?.uid === uid) {
        setNewOperatorAlert(null);
      }
    } catch (err) {
      console.error("Erro ao aprovar operador:", err);
      showToast("Erro ao homologar acesso do operador.", "error");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("sispir_mode");
    localStorage.removeItem("sispir_local_user_id");
    if (onLogout) {
      onLogout();
    }
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Erro ao deslogar:", err);
    }
    window.location.reload();
  };

  const handleSaveSuspect = async (
    suspectData: Omit<Suspect, "createdAt" | "updatedAt"> | Partial<Suspect>
  ) => {
    try {
      const targetId = (suspectData as any).id || suspectToEdit?.id;
      const isExisting = Boolean(targetId && (suspects.some((s) => s.id === targetId) || suspectToEdit?.id === targetId));

      if (isExisting && targetId) {
        // Editing / Updating existing suspect
        await updateSuspect(targetId, suspectData as any);
        // Update selected suspect modal if open
        if (selectedSuspect && selectedSuspect.id === targetId) {
          setSelectedSuspect({
            ...selectedSuspect,
            ...suspectData,
          } as Suspect);
        }
        showToast("Registro de suspeito atualizado com sucesso.", "success");
      } else {
        // Creating new suspect
        await addSuspect(suspectData as Suspect);
        showToast("Novo registro de suspeito cadastrado com sucesso.", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar o suspeito. Verifique suas credenciais de acesso.", "error");
    }
  };

  const handleDeleteSuspect = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "EXCLUIR PRONTUÁRIO DE INTELIGÊNCIA",
      message: "ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente este registro de suspeito? Esta ação é irreversível.",
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteSuspect(id);
          setSelectedSuspect(null);
          showToast("Registro de suspeito excluído com sucesso do banco de dados.", "success");
        } catch (err) {
          console.error(err);
          showToast("Erro ao excluir suspeito. Verifique as permissões de acesso do seu usuário.", "error");
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleRestoreDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: "RESTAURAR ALVOS DE DEMONSTRAÇÃO",
      message: "Deseja re-alimentar o banco de dados com a listagem de alvos e suspeitos padrão para fins de demonstração?",
      isDanger: false,
      onConfirm: async () => {
        try {
          await seedSuspectsIfEmpty();
          showToast("Alvos padrão restaurados com sucesso.", "success");
        } catch (err) {
          console.error(err);
          showToast("Erro ao restaurar alvos padrão de demonstração.", "error");
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // Extract unique factions for filters list
  const factions = Array.from(
    new Set(suspects.map((s) => s.faction).filter(Boolean))
  ) as string[];

  // Extract unique cities and count suspects per city
  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    suspects.forEach((s) => {
      const city = s.municipio || s.areaOfOperation;
      if (city) {
        counts[city] = (counts[city] || 0) + 1;
      }
    });
    return counts;
  }, [suspects]);

  // Extract unique cities for filter dropdown list
  const cities = useMemo(() => {
    return Object.keys(cityCounts).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cityCounts]);

  // Excel / CSV Export
  const handleExcelExport = () => {
    if (filteredSuspects.length === 0) {
      showToast("Nenhum registro de suspeito para exportar.", "info");
      return;
    }

    const headers = [
      "ID",
      "Nome Completo",
      "Alcunha/Vulgo",
      "Documento (RG/CPF)",
      "Cidade/Area",
      "OrCrim",
      "Status",
      "Antecedentes/Observacoes",
      "Data Cadastro",
    ];

    const rows = filteredSuspects.map((s) => [
      `"${s.id}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.alias || "").replace(/"/g, '""')}"`,
      `"${(s.document || "").replace(/"/g, '""')}"`,
      `"${(s.municipio || s.areaOfOperation || "LAJEADO").replace(/"/g, '""')}"`,
      `"${(s.faction || "").replace(/"/g, '""')}"`,
      `"${s.status}"`,
      `"${(s.antecedentes || s.observations || "").replace(/"/g, '""')}"`,
      `"${s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : ''}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `registro_suspeitos_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(
      `${filteredSuspects.length} registros exportados para arquivo com sucesso.`,
      "success"
    );
  };

  // Import File Handler (JSON or CSV)
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        let importedCount = 0;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.suspects)
            ? parsed.suspects
            : Array.isArray(parsed.suspeitos)
            ? parsed.suspeitos
            : Array.isArray(parsed.data)
            ? parsed.data
            : Array.isArray(parsed.items)
            ? parsed.items
            : typeof parsed === "object" && (parsed.nome || parsed.name)
            ? [parsed]
            : [];

          for (const rawItem of list) {
            const suspect = normalizeSuspectFromJSON(rawItem);
            if (suspect) {
              await addSuspect(suspect);
              importedCount++;
            }
          }
        } else {
          // Simple CSV line parser
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
            if (cols.length >= 2 && cols[1]) {
              await addSuspect({
                name: cols[1] || cols[0],
                alias: cols[2] || "",
                document: cols[3] || "",
                areaOfOperation: cols[4] || "LAJEADO",
                municipio: cols[4] || "LAJEADO",
                faction: cols[5] || "Independente",
                status: "wanted",
                birthDate: "",
                motherName: "",
                observations: cols[7] || "",
                antecedentes: cols[7] || "",
                photos: [],
                createdBy: currentUser.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as any);
              importedCount++;
            }
          }
        }
        showToast(`${importedCount} registros de suspeitos importados com sucesso.`, "success");
      } catch (err) {
        console.error(err);
        showToast("Erro ao importar o arquivo. Verifique se o formato está correto.", "error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Limpar Filters Handler
  const handleLimparFilters = () => {
    setSearchQuery("");
    setCityFilter("all");
    setFactionFilter("all");
    setStatusFilter("all");
    setHideSuspectDetails(false);
    setSuspectSortOrder("registration_desc");
    showToast("Filtros limpos e ordenação restaurada para padrão de cadastro.", "info");
  };

  // Helper to sort suspects by chosen criteria (default: registration date / most recent)
  const sortSuspectsList = (
    list: Suspect[],
    order: "registration_desc" | "registration_asc" | "alpha_asc" | "alpha_desc"
  ) => {
    return [...list].sort((a, b) => {
      if (order === "alpha_asc") {
        return (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" });
      }
      if (order === "alpha_desc") {
        return (b.name || "").localeCompare(a.name || "", "pt-BR", { sensitivity: "base" });
      }
      if (order === "registration_asc") {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      }
      // Default: "registration_desc" (Ordem de Cadastro - Mais recentes no topo)
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return 0;
    });
  };

  // Filter suspects using Smart Multi-Field Search Engine
  const baseFilteredSuspects = suspects.filter((s) => {
    const matchesQuery = matchesSuspectSmartSearch(s, searchQuery, occurrences);

    const matchesFaction = factionFilter === "all" || s.faction === factionFilter;
    const matchesCity =
      cityFilter === "all" ||
      (s.municipio || s.areaOfOperation || "").toUpperCase() === cityFilter.toUpperCase();

    return matchesQuery && matchesFaction && matchesCity;
  });
  const filteredSuspects = sortSuspectsList(baseFilteredSuspects, suspectSortOrder);

  // Filter suspects for Alvo em Foco and Foragido tabs
  const baseFilteredAlvos = suspects.filter((s) => s.alvoEmFoco).filter((s) => {
    const matchesQuery = matchesSuspectSmartSearch(s, searchQuery, occurrences);
    const matchesFaction = factionFilter === "all" || s.faction === factionFilter;
    return matchesQuery && matchesFaction;
  });
  const filteredAlvos = sortSuspectsList(baseFilteredAlvos, suspectSortOrder);

  const baseFilteredForagidos = suspects.filter((s) => s.foragido).filter((s) => {
    const matchesQuery = matchesSuspectSmartSearch(s, searchQuery, occurrences);
    const matchesFaction = factionFilter === "all" || s.faction === factionFilter;
    return matchesQuery && matchesFaction;
  });
  const filteredForagidos = sortSuspectsList(baseFilteredForagidos, suspectSortOrder);

  const filteredReincidentes = suspects
    .map((s) => {
      const suspectOccurrences = occurrences.filter((occ) =>
        occ.relatedSuspects?.includes(s.id)
      );
      return {
        suspect: s,
        count: suspectOccurrences.length,
      };
    })
    .filter((item) => item.count >= 1)
    .sort((a, b) => b.count - a.count)
    .filter((item) => {
      const s = item.suspect;
      const matchesQuery = matchesSuspectSmartSearch(s, searchQuery, occurrences);
      const matchesFaction = factionFilter === "all" || s.faction === factionFilter;
      return matchesQuery && matchesFaction;
    });

  return (
    <div id="dashboard-container" className="h-screen max-h-screen overflow-hidden bg-gradient-to-br from-[#050507] to-[#0a0a0f] text-[#e0e0e0] flex flex-col font-sans select-none relative">
      
      {/* Forensic Security & Anti-Leak Watermark Overlay */}
      <WatermarkOverlay user={currentUser} />

      {/* Top Banner Warning */}
      <div className="bg-red-950/10 border-b border-white/5 py-2 px-4 text-center text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2 font-mono z-30 flex-shrink-0">
        <FolderLock className="w-4 h-4 text-red-600" /> ACESSO RESTRITO - LEI 13.709/2018 (LGPD) · INFORMAÇÕES CONFIDENCIAIS MONITORADAS E AUDITADAS
      </div>

      {/* Real-time Operator Registration Notification Banner for Admin */}
      {currentUser.role === "admin" && pendingUsers.length > 0 && activeTab !== "admin" && (
        <div className="bg-gradient-to-r from-amber-950/80 via-[#211604] to-amber-950/80 border-b border-amber-500/40 py-2 px-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono z-20 flex-shrink-0 shadow-lg shadow-amber-500/10">
          <div className="flex items-center gap-2.5 text-amber-300 font-bold">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] uppercase tracking-wider">
              SOLICITAÇÃO DE ACESSO: {pendingUsers.length} operador{pendingUsers.length > 1 ? "es" : ""} aguardando homologação
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAdminInitialFilter("pending");
                setActiveTab("admin");
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase rounded-lg text-[10px] tracking-wider transition-all shadow cursor-pointer font-sans"
            >
              <span>Homologar Acessos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Split Layout: Sidebar + Main Content */}
      <div className="flex-1 flex relative min-h-0">
        
        {/* DESKTOP COLLAPSIBLE SIDEBAR */}
        <aside
          className={`hidden md:flex flex-col border-r border-white/10 bg-[#0d0d12] transition-all duration-300 flex-shrink-0 select-none ${
            sidebarCollapsed ? "w-16" : "w-64"
          }`}
        >
          {/* Sidebar Header Brand */}
          <div className="h-16 border-b border-white/5 flex items-center px-4 overflow-hidden flex-shrink-0">
            <div className="flex items-center gap-3 truncate">
              <div className="w-8 h-8 bg-[#1c1c26] border border-white/10 flex items-center justify-center rounded flex-shrink-0">
                <div className="w-4 h-4 border border-blue-500 rotate-45 flex items-center justify-center">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                </div>
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <h1 className="text-xs font-bold tracking-widest uppercase text-white leading-none font-mono">SISPIR</h1>
                  <span className="text-[8px] text-zinc-500 uppercase tracking-tighter block mt-1 font-mono">INTEL. OPERACIONAL</span>
                </div>
              )}
            </div>
          </div>

          {/* User profile inside sidebar */}
          {!sidebarCollapsed ? (
            <div className="p-3 border-b border-white/5 bg-[#050507]/40 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 truncate min-w-0">
                  <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-white uppercase font-mono shrink-0">
                    {currentUser.name.slice(0, 2)}
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-zinc-300 leading-none truncate uppercase font-mono">{currentUser.name}</p>
                    <span className="text-[8px] text-emerald-500 font-mono tracking-widest uppercase mt-1 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      AUTORIZADO
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors shrink-0"
                  title="Sair do Sistema"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-3 flex flex-col items-center gap-2 border-b border-white/5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Operador Autorizado"></div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-zinc-500 hover:text-rose-400"
                title="Sair do Sistema"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Navigation Items */}
          <div className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
            <button
              onClick={() => setActiveTab("database")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                activeTab === "database"
                  ? "bg-[#1c1c26] text-white border border-white/5 shadow"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              title={`Suspeitos (${suspects.length})`}
            >
              <Database className="w-4 h-4 text-blue-500 flex-shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex items-center justify-between w-full">
                  <span>Suspeitos</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#1b2336] border border-[#293652] text-[#93c5fd] font-mono text-[9px] font-bold">
                    {suspects.length}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("alvo-em-foco")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                activeTab === "alvo-em-foco"
                  ? "bg-rose-950/40 text-rose-400 border border-rose-500/20 shadow"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              title="Alvo em Foco"
            >
              <Target className="w-4 h-4 text-rose-500 flex-shrink-0" />
              {!sidebarCollapsed && <span>Alvo em Foco</span>}
            </button>

            <button
              onClick={() => setActiveTab("foragido")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                activeTab === "foragido"
                  ? "bg-amber-950/40 text-amber-400 border border-amber-500/20 shadow"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              title="Foragidos"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              {!sidebarCollapsed && <span>Foragidos</span>}
            </button>

            <button
              onClick={() => setActiveTab("reincidentes")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                activeTab === "reincidentes"
                  ? "bg-amber-950/40 text-amber-400 border border-amber-500/20 shadow"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              title="Reincidentes"
            >
              <Activity className="w-4 h-4 text-amber-500 flex-shrink-0" />
              {!sidebarCollapsed && <span>Reincidentes</span>}
            </button>

            <button
              onClick={() => setActiveTab("occurrences")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                activeTab === "occurrences"
                  ? "bg-[#1c1c26] text-white border border-white/5 shadow"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              title={`Ocorrências (${occurrences.length})`}
            >
              <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex items-center justify-between w-full">
                  <span>Ocorrências</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#13271f] border border-[#1b4332] text-[#6ee7b7] font-mono text-[9px] font-bold">
                    {occurrences.length}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("facial-recognition")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                activeTab === "facial-recognition"
                  ? "bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 shadow"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              title="Reconhecimento Facial"
            >
              <ScanFace className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>Reconhecimento Facial</span>}
            </button>

            {currentUser.role === "admin" && (
              <button
                onClick={() => {
                  setAdminInitialFilter("all");
                  setActiveTab("admin");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                  activeTab === "admin"
                    ? "bg-[#1c1c26] text-white border border-white/5 shadow"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
                title={`Gestão de Acessos ${pendingUsers.length > 0 ? `(${pendingUsers.length} pendentes)` : ""}`}
              >
                {sidebarCollapsed ? (
                  <div className="relative flex items-center justify-center">
                    <Users className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    {pendingUsers.length > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center animate-bounce shadow">
                        {pendingUsers.length}
                      </span>
                    )}
                  </div>
                ) : (
                  <Users className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
                {!sidebarCollapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>Gestão de Acessos</span>
                    {pendingUsers.length > 0 ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/50 text-amber-300 font-mono text-[9px] font-bold animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        {pendingUsers.length} PENDENTE{pendingUsers.length > 1 ? "S" : ""}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[9px]">
                        ADM
                      </span>
                    )}
                  </div>
                )}
              </button>
            )}

            {/* Hidden Backup File Input */}
            <input
              type="file"
              ref={backupFileInputRef}
              onChange={handleRestoreBackupFile}
              accept=".json"
              className="hidden"
            />

            {/* Sidebar Extra Action Buttons matching user design */}
            <div className="pt-3 px-1 space-y-2.5 border-t border-white/5">
              {/* IA - INTELIGÊNCIA BUTTON */}
              <button
                type="button"
                onClick={handleAiIntelligenceGenerate}
                disabled={isAiProcessing}
                className={`w-full flex items-center justify-center gap-2.5 px-3 py-3 rounded-2xl border border-indigo-500/40 bg-indigo-950/20 hover:bg-indigo-900/40 text-indigo-300 hover:text-indigo-100 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50 font-sans ${
                  sidebarCollapsed ? "px-2" : ""
                }`}
                title="IA - Inteligência (Gerar Suspeitos das Ocorrências)"
              >
                <Brain className={`w-5 h-5 text-indigo-400 shrink-0 ${isAiProcessing ? "animate-spin" : ""}`} />
                {!sidebarCollapsed && <span>IA - INTELIGÊNCIA</span>}
              </button>

              {/* BACKUP & UPLOAD BUTTONS ROW */}
              {!sidebarCollapsed ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-white/10 bg-[#121826]/80 hover:bg-[#1a2336] text-zinc-300 hover:text-white transition-all text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm"
                    title="Baixar Cópia do Banco de Dados"
                  >
                    <Download className="w-4 h-4 text-zinc-400" />
                    <span>BACKUP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-white/10 bg-[#121826]/80 hover:bg-[#1a2336] text-zinc-300 hover:text-white transition-all text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm"
                    title="Anexar / Restaurar Cópia do Banco de Dados"
                  >
                    <Upload className="w-4 h-4 text-zinc-400" />
                    <span>UPLOAD</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="w-full flex justify-center p-2.5 rounded-xl border border-white/10 bg-[#121826] text-zinc-300 hover:text-white"
                    title="BACKUP"
                  >
                    <Download className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    className="w-full flex justify-center p-2.5 rounded-xl border border-white/10 bg-[#121826] text-zinc-300 hover:text-white"
                    title="UPLOAD"
                  >
                    <Upload className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              )}

              {/* FOOTER - DESENVOLVIDO POR ALI 22ºBPM */}
              {!sidebarCollapsed && (
                <div className="pt-3 pb-1 border-t border-white/5 text-center space-y-0.5">
                  <p className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                    DESENVOLVIDO POR
                  </p>
                  <p className="text-xs font-mono font-black text-blue-500 tracking-wider">
                    ALI 22ºBPM
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="p-2 border-t border-white/5 mt-auto flex-shrink-0 space-y-1">
            {/* Collapse toggle button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 rounded hover:bg-white/5 transition-all font-mono justify-center"
              title={sidebarCollapsed ? "Expandir Sidebar" : "Recolher Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {!sidebarCollapsed && <span>Recolher Menu</span>}
            </button>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded text-rose-500 hover:text-rose-400 hover:bg-rose-950/10 transition-all font-mono ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              title="Sair do Sistema"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>Sair do Sistema</span>}
            </button>
          </div>
        </aside>

        {/* MOBILE SIDEBAR DRAWERS */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div
              key="mobile-sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            />
          )}

          {mobileSidebarOpen && (
            <motion.aside
              key="mobile-sidebar-aside"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 bottom-0 left-0 w-64 bg-[#0d0d12] border-r border-white/10 z-50 flex flex-col select-none"
            >
                {/* Mobile Sidebar Header */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#1c1c26] border border-white/10 flex items-center justify-center rounded">
                      <div className="w-4 h-4 border border-blue-500 rotate-45 flex items-center justify-center">
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <h1 className="text-xs font-bold tracking-widest uppercase text-white leading-none font-mono">SISPIR</h1>
                      <span className="text-[8px] text-zinc-500 uppercase tracking-tighter block mt-1 font-mono">INTEL. OPERACIONAL</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 hover:bg-white/5 rounded text-zinc-500 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile Sidebar User */}
                <div className="p-4 border-b border-white/5 bg-[#050507]/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-white uppercase font-mono">
                      {currentUser.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-zinc-300 leading-none uppercase font-mono">{currentUser.name}</p>
                      <span className="text-[8px] text-emerald-500 font-mono tracking-widest uppercase mt-1.5 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        AUTORIZADO
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation links */}
                <div className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
                  <button
                    onClick={() => {
                      setActiveTab("database");
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                      activeTab === "database"
                        ? "bg-[#1c1c26] text-white border border-white/5"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-blue-500" />
                      <span>Suspeitos</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#1b2336] border border-[#293652] text-[#93c5fd] font-mono text-[9px] font-bold">
                      {suspects.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("alvo-em-foco");
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                      activeTab === "alvo-em-foco"
                        ? "bg-rose-950/45 text-rose-400 border border-rose-500/10"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <Target className="w-4 h-4 text-rose-500" />
                    <span>Alvo em Foco</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("foragido");
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                      activeTab === "foragido"
                        ? "bg-amber-950/45 text-amber-400 border border-amber-500/10"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Foragidos</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("reincidentes");
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                      activeTab === "reincidentes"
                        ? "bg-[#1c1c26] text-white border border-white/5"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <Activity className="w-4 h-4 text-amber-500" />
                    <span>Reincidentes</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("occurrences");
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                      activeTab === "occurrences"
                        ? "bg-[#1c1c26] text-white border border-white/5"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <span>Ocorrências</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#13271f] border border-[#1b4332] text-[#6ee7b7] font-mono text-[9px] font-bold">
                      {occurrences.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("facial-recognition");
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                      activeTab === "facial-recognition"
                        ? "bg-indigo-950/60 text-indigo-300 border border-indigo-500/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <ScanFace className="w-4 h-4 text-indigo-400" />
                    <span>Reconhecimento Facial</span>
                  </button>

                  {currentUser.role === "admin" && (
                    <button
                      onClick={() => {
                        setAdminInitialFilter("all");
                        setActiveTab("admin");
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all font-mono ${
                        activeTab === "admin"
                          ? "bg-[#1c1c26] text-white border border-white/5"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 text-amber-500" />
                        <span>Gestão de Acessos</span>
                      </div>
                      {pendingUsers.length > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/50 text-amber-300 font-mono text-[9px] font-bold animate-pulse">
                          {pendingUsers.length} PENDENTE{pendingUsers.length > 1 ? "S" : ""}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Mobile Sidebar Extra Buttons */}
                  <div className="pt-3 px-1 space-y-2.5 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        handleAiIntelligenceGenerate();
                        setMobileSidebarOpen(false);
                      }}
                      disabled={isAiProcessing}
                      className="w-full flex items-center justify-center gap-2.5 px-3 py-3 rounded-2xl border border-indigo-500/40 bg-indigo-950/20 text-indigo-300 font-bold text-xs uppercase tracking-wider"
                    >
                      <Brain className={`w-5 h-5 text-indigo-400 ${isAiProcessing ? "animate-spin" : ""}`} />
                      <span>IA - INTELIGÊNCIA</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadBackup();
                          setMobileSidebarOpen(false);
                        }}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-white/10 bg-[#121826] text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-wider"
                      >
                        <Download className="w-4 h-4 text-zinc-400" />
                        <span>BACKUP</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          backupFileInputRef.current?.click();
                          setMobileSidebarOpen(false);
                        }}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-white/10 bg-[#121826] text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-wider"
                      >
                        <Upload className="w-4 h-4 text-zinc-400" />
                        <span>UPLOAD</span>
                      </button>
                    </div>

                    <div className="pt-3 pb-1 border-t border-white/5 text-center space-y-0.5">
                      <p className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                        DESENVOLVIDO POR
                      </p>
                      <p className="text-xs font-mono font-black text-blue-500 tracking-wider">
                        ALI 22ºBPM
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile Logout */}
                <div className="p-2 border-t border-white/5 mt-auto">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded text-rose-500 hover:text-rose-400 hover:bg-rose-950/10 transition-all font-mono"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair do Sistema</span>
                  </button>
                </div>
              </motion.aside>
          )}
        </AnimatePresence>

        {/* MAIN PANEL VIEW AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden">
          
          {/* Mobile Top Navbar (Visible only on mobile to trigger drawer) */}
          <header className="md:hidden h-14 border-b border-white/10 bg-[#0d0d12] flex items-center justify-between px-4 flex-shrink-0 select-none">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 hover:bg-white/5 rounded text-zinc-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#1c1c26] border border-white/10 flex items-center justify-center rounded">
                <div className="w-4 h-4 border border-blue-500 rotate-45 flex items-center justify-center">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                </div>
              </div>
              <span className="text-xs font-bold uppercase text-white font-mono tracking-widest">SISPIR</span>
            </div>

            {/* Notification Bell on Mobile */}
            {currentUser.role === "admin" ? (
              <button
                type="button"
                onClick={() => {
                  setAdminInitialFilter("pending");
                  setActiveTab("admin");
                }}
                className="relative p-2 rounded-lg text-zinc-400 hover:text-amber-400"
                title="Solicitações de Acesso Pendentes"
              >
                <Bell className="w-5 h-5" />
                {pendingUsers.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                    {pendingUsers.length}
                  </span>
                )}
              </button>
            ) : (
              <div className="w-8"></div>
            )}
          </header>

          {/* Tab View Container - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <main className="p-4 md:p-8 space-y-6">
              
              {/* VIEW 1: DATABASE (SUSPECTS) */}
              {activeTab === "database" && (
                <>
                  {/* Header Area & Action Toolbar matching screenshot */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-black tracking-tight text-white font-sans">
                          Suspeitos
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#1b2336] border border-[#293652] text-[#93c5fd] font-mono text-xs font-bold shadow-inner">
                          {suspects.length}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                        Registro de indivíduos identificados
                      </p>
                    </div>

                    {/* Right Side Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                      {/* View Mode Toggle Buttons Container */}
                      <div className="bg-[#121826] border border-[#20293d] p-1 rounded-xl flex items-center gap-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setViewLayout("list")}
                          title="Exibição em Lista"
                          className={`p-2 rounded-lg transition-all ${
                            viewLayout === "list"
                              ? "bg-blue-600 text-white shadow"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewLayout("grid")}
                          title="Exibição em Grade"
                          className={`p-2 rounded-lg transition-all ${
                            viewLayout === "grid"
                              ? "bg-blue-600 text-white shadow"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <Grid className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHideSuspectDetails(!hideSuspectDetails)}
                          title={hideSuspectDetails ? "Exibir Ficha Completa" : "Apenas Fotos"}
                          className={`p-2 rounded-lg transition-all ${
                            hideSuspectDetails
                              ? "bg-blue-600/30 text-blue-400 border border-blue-500/40"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {hideSuspectDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Ordenação: Padrão por Cadastro / Alfabética (A-Z) */}
                      <div className="bg-[#121826] border border-[#20293d] p-1 rounded-xl flex items-center gap-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => {
                            if (suspectSortOrder === "alpha_asc") {
                              setSuspectSortOrder("registration_desc");
                              showToast("Ordenação por data de cadastro (padrão) ativada.", "info");
                            } else {
                              setSuspectSortOrder("alpha_asc");
                              showToast("Ordenação alfabética (A-Z) ativada.", "info");
                            }
                          }}
                          title={
                            suspectSortOrder === "alpha_asc"
                              ? "Ordem Alfabética (A-Z) ativa. Clique para voltar à ordem de cadastro."
                              : "Clique para ordenar em Ordem Alfabética (A-Z)"
                          }
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            suspectSortOrder === "alpha_asc" || suspectSortOrder === "alpha_desc"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <ArrowDownAZ className={`w-4 h-4 ${suspectSortOrder === "alpha_asc" || suspectSortOrder === "alpha_desc" ? "text-white" : "text-zinc-400"}`} />
                          <span className="hidden sm:inline text-[11px] font-sans font-medium">
                            {suspectSortOrder === "alpha_asc"
                              ? "A-Z (Ativo)"
                              : suspectSortOrder === "alpha_desc"
                              ? "Z-A (Ativo)"
                              : "A-Z"}
                          </span>
                        </button>

                        <div className="relative">
                          <select
                            value={suspectSortOrder}
                            onChange={(e) => {
                              const val = e.target.value as "registration_desc" | "registration_asc" | "alpha_asc" | "alpha_desc";
                              setSuspectSortOrder(val);
                              if (val === "registration_desc") showToast("Ordenação por data de cadastro (mais recentes).", "info");
                              if (val === "registration_asc") showToast("Ordenação por data de cadastro (mais antigos).", "info");
                              if (val === "alpha_asc") showToast("Ordenação alfabética (A-Z) ativada.", "info");
                              if (val === "alpha_desc") showToast("Ordenação alfabética (Z-A) ativada.", "info");
                            }}
                            className="bg-[#182032] hover:bg-[#1f2a40] text-zinc-300 hover:text-white border border-white/5 text-[11px] font-sans rounded-lg pl-2 pr-6 py-1.5 outline-none transition-all cursor-pointer font-medium appearance-none"
                            title="Critério de Ordenação"
                          >
                            <option value="registration_desc">Cadastro (Padrão)</option>
                            <option value="registration_asc">Cadastro (Antigos)</option>
                            <option value="alpha_asc">Alfabética (A-Z)</option>
                            <option value="alpha_desc">Alfabética (Z-A)</option>
                          </select>
                          <ArrowUpDown className="w-3 h-3 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Photo Size Zoom Slider Bar */}
                      <div className="bg-[#121826] border border-[#20293d] px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                        <ZoomOut className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <input
                          type="range"
                          min="100"
                          max="360"
                          step="10"
                          value={photoSize}
                          onChange={(e) => setPhotoSize(Number(e.target.value))}
                          className="w-20 sm:w-28 accent-blue-500 cursor-pointer h-1.5 bg-[#1b253b] rounded-lg appearance-none"
                          title="Ajustar Tamanho das Fotos"
                        />
                        <ZoomIn className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="text-[10px] font-mono font-bold text-blue-400 min-w-[32px] text-right">
                          {photoSize}px
                        </span>
                      </div>

                      {/* Excel Export Button */}
                      <button
                        type="button"
                        onClick={handleExcelExport}
                        className="bg-[#161d2e] hover:bg-[#1e273d] border border-[#26324a] text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>Excel</span>
                      </button>

                      {/* Limpar Filters Button */}
                      <button
                        type="button"
                        onClick={handleLimparFilters}
                        className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        <span>Limpar</span>
                      </button>

                      {/* Importar File Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-[#161d2e] hover:bg-[#1e273d] border border-[#26324a] text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm"
                      >
                        <Upload className="w-4 h-4 text-zinc-300" />
                        <span>Importar</span>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportFile}
                        accept=".csv,.json"
                        className="hidden"
                      />

                      {/* + Novo Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSuspectToEdit(undefined);
                          setIsAddOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30 active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Novo</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar & City Dropdown Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                    {/* Search Input */}
                    <div className="lg:col-span-9 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                        <Search className="w-4 h-4 text-blue-400/80" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisa Inteligente: nome, vulgo, OrCrim, crime, endereço, tatuagem, mãe, placa, mandado, data..."
                        className="w-full bg-[#131929] border border-[#202a3f] hover:border-[#2a3754] focus:border-blue-500/60 text-white text-xs rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-zinc-500 font-sans shadow-inner"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          title="Limpar pesquisa"
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* City Dropdown */}
                    <div className="lg:col-span-3 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 pointer-events-none">
                        <MapPin className="w-4 h-4 text-zinc-400" />
                      </span>
                      <select
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        className="w-full bg-[#131929] border border-[#202a3f] hover:border-[#2a3754] focus:border-blue-500/60 text-white text-xs rounded-xl pl-9 pr-9 py-3 outline-none transition-all font-sans appearance-none font-medium cursor-pointer"
                      >
                        <option value="all">Cidades: Todas ({suspects.length})</option>
                        {cities.map((c, idx) => (
                          <option key={`city-${c}-${idx}`} value={c}>
                            {c} ({cityCounts[c] || 0})
                          </option>
                        ))}
                      </select>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 pointer-events-none">
                        <Filter className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Active Search / Filter Status Banner */}
                  {searchQuery.trim() && (
                    <div className="flex items-center justify-between bg-blue-950/30 border border-blue-500/20 rounded-xl px-4 py-2 text-xs">
                      <div className="flex items-center gap-2 text-blue-300 font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                        <span>
                          Pesquisa inteligente ativa: <strong className="text-white">"{searchQuery}"</strong>
                        </span>
                        <span className="text-zinc-400 text-[11px] ml-1">
                          ({filteredSuspects.length} {filteredSuspects.length === 1 ? "registro encontrado" : "registros encontrados"} de {suspects.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-[11px] text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-mono"
                      >
                        <X className="w-3 h-3" /> Limpar busca
                      </button>
                    </div>
                  )}

                  {/* Suspects Container */}
                  {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-3 text-zinc-500">
                      <span className="border-4 border-white/10 border-t-blue-500 rounded-full w-10 h-10 animate-spin"></span>
                      <span className="text-[10px] uppercase font-mono tracking-wider">Carregando fichas de inteligência...</span>
                    </div>
                  ) : filteredSuspects.length === 0 ? (
                    <div className="py-24 border border-dashed border-white/10 bg-[#121624]/30 rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-4">
                      <Users className="w-12 h-12 stroke-[1] text-zinc-600" />
                      <div className="text-center space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest font-mono text-zinc-400">Nenhum suspeito encontrado</p>
                        <p className="text-[11px] text-zinc-600">Altere os termos de pesquisa ou clique abaixo para restaurar alvos de demonstração.</p>
                      </div>
                      <button
                        onClick={handleRestoreDefaults}
                        className="mt-2 bg-[#161d2e] hover:bg-[#1e273d] border border-[#26324a] text-zinc-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Restaurar Alvos Padrão
                      </button>
                    </div>
                  ) : hideSuspectDetails ? (
                    /* MODE 1: APENAS FOTOS (Eye Icon Mode - Photo Only, No Text) */
                    <div
                      className="grid gap-4 transition-all duration-200"
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${photoSize}px, 1fr))`,
                      }}
                    >
                      {filteredSuspects.map((suspect, idx) => (
                        <SuspectCard
                          key={`s-m1-${suspect.id || "s"}-${idx}`}
                          suspect={suspect}
                          onClick={() => setSelectedSuspect(suspect)}
                          onEdit={() => {
                            setSuspectToEdit(suspect);
                            setIsAddOpen(true);
                          }}
                          onDelete={() => handleDeleteSuspect(suspect.id)}
                          hideDetails={true}
                        />
                      ))}
                    </div>
                  ) : viewLayout === "grid" ? (
                    /* MODE 2: EXIBIÇÃO EM GRADE (Photo + Name + Alias) */
                    <div
                      className="grid gap-4 transition-all duration-200"
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${photoSize}px, 1fr))`,
                      }}
                    >
                      {filteredSuspects.map((suspect, idx) => (
                        <SuspectCard
                          key={`s-m2-${suspect.id || "s"}-${idx}`}
                          suspect={suspect}
                          onClick={() => setSelectedSuspect(suspect)}
                          onEdit={() => {
                            setSuspectToEdit(suspect);
                            setIsAddOpen(true);
                          }}
                          onDelete={() => handleDeleteSuspect(suspect.id)}
                          compact={true}
                        />
                      ))}
                    </div>
                  ) : (
                    /* MODE 3: EXIBIÇÃO EM LISTA (Ficha Completa Detalhada) */
                    <div
                      className="grid gap-5 transition-all duration-200"
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(photoSize, 280)}px, 1fr))`,
                      }}
                    >
                      {filteredSuspects.map((suspect, idx) => (
                        <SuspectCard
                          key={`s-m3-${suspect.id || "s"}-${idx}`}
                          suspect={suspect}
                          onClick={() => setSelectedSuspect(suspect)}
                          onEdit={() => {
                            setSuspectToEdit(suspect);
                            setIsAddOpen(true);
                          }}
                          onDelete={() => handleDeleteSuspect(suspect.id)}
                          compact={false}
                          hideDetails={false}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* VIEW: ALVO EM FOCO */}
              {activeTab === "alvo-em-foco" && (
                <>
                  {/* Module Header */}
                  <div className="border-b border-rose-500/20 pb-4">
                    <h2 className="text-lg font-bold tracking-widest text-rose-400 uppercase font-mono flex items-center gap-2">
                      <Target className="w-5 h-5 text-rose-500 animate-pulse" /> ALVO EM FOCO
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 font-mono">
                      Monitoramento tático de alvos prioritários, inteligência de OrCrim e vigilância em tempo real
                    </p>
                  </div>

                  {/* Filters and actions row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Search input */}
                    <div className="md:col-span-10 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                        <Search className="w-4 h-4 text-rose-400/80" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisa Inteligente: nome, vulgo, OrCrim, crime, endereço, observação, motivo do alvo..."
                        className="w-full bg-[#0d0d12] border border-white/10 hover:border-white/20 focus:border-zinc-700 text-white text-xs rounded pl-9 pr-9 py-2.5 outline-none transition-all placeholder:text-zinc-700 font-mono"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          title="Limpar pesquisa"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                      {/* OrCrim filter */}
                      <div className="md:col-span-2 relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                          <Layers className="w-4 h-4" />
                        </span>
                        <select
                          value={factionFilter}
                          onChange={(e) => setFactionFilter(e.target.value)}
                          className="w-full bg-[#0d0d12] border border-white/10 hover:border-white/20 focus:border-zinc-700 text-white text-xs rounded pl-9 pr-4 py-2.5 outline-none transition-all uppercase font-mono"
                        >
                          <option value="all">OrCrim (Todas)</option>
                          {factions.map((f, idx) => (
                            <option key={`fac-alvo-${f}-${idx}`} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                  </div>

                  {/* Display options bar */}
                  <div className="flex items-center justify-between bg-[#0d0d12]/40 border border-white/5 rounded-lg px-4 py-2.5 text-xs">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-semibold">
                      Painel de Alvos Ativos
                    </span>
                    <span className="text-[10px] text-rose-400 font-mono uppercase tracking-wider font-semibold">
                      Alvos em Foco: {filteredAlvos.length} {filteredAlvos.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>

                  {/* Suspects Grid */}
                  {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-3 text-zinc-500">
                      <span className="border-4 border-white/10 border-t-rose-500 rounded-full w-10 h-10 animate-spin"></span>
                      <span className="text-[10px] uppercase font-mono tracking-wider">Carregando alvos prioritários...</span>
                    </div>
                  ) : filteredAlvos.length === 0 ? (
                    <div className="py-24 border border-dashed border-rose-500/10 bg-[#12121a]/20 rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-4">
                      <Target className="w-12 h-12 stroke-[1] text-rose-500/40" />
                      <div className="text-center space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest font-mono text-zinc-400">Nenhum Alvo em Foco Ativo</p>
                        <p className="text-[11px] text-zinc-600 font-mono uppercase text-[9px]">Para ativar o monitoramento tático de um suspeito, edite sua ficha e ative a opção "ALVO EM FOCO".</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredAlvos.map((suspect, idx) => (
                        <AlvoFocoCard
                          key={`alvo-${suspect.id || "s"}-${idx}`}
                          suspect={suspect}
                          onViewFicha={() => setSelectedSuspect(suspect)}
                          onEdit={() => {
                            setSuspectToEdit(suspect);
                            setIsAddOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* VIEW: FORAGIDO */}
              {activeTab === "foragido" && (
                <>
                  {/* Module Header */}
                  <div className="border-b border-amber-500/20 pb-4">
                    <h2 className="text-lg font-bold tracking-widest text-amber-400 uppercase font-mono flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" /> FORAGIDOS DA JUSTIÇA
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 font-mono">
                      Controle e busca de foragidos com mandado de prisão ativo expedido pelo poder judiciário
                    </p>
                  </div>

                  {/* Filters and actions row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Search input */}
                    <div className="md:col-span-10 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                        <Search className="w-4 h-4 text-amber-400/80" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisa Inteligente: nome, vulgo, OrCrim, crime, mandado judicial, endereço, observações..."
                        className="w-full bg-[#0d0d12] border border-white/10 hover:border-white/20 focus:border-zinc-700 text-white text-xs rounded pl-9 pr-9 py-2.5 outline-none transition-all placeholder:text-zinc-700 font-mono"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          title="Limpar pesquisa"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* OrCrim filter */}
                    <div className="md:col-span-2 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                        <Layers className="w-4 h-4" />
                      </span>
                      <select
                        value={factionFilter}
                        onChange={(e) => setFactionFilter(e.target.value)}
                        className="w-full bg-[#0d0d12] border border-white/10 hover:border-white/20 focus:border-zinc-700 text-white text-xs rounded pl-9 pr-4 py-2.5 outline-none transition-all uppercase font-mono"
                      >
                        <option value="all">OrCrim (Todas)</option>
                        {factions.map((f, idx) => (
                          <option key={`fac-foragido-${f}-${idx}`} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Display options bar */}
                  <div className="flex items-center justify-between bg-[#0d0d12]/40 border border-white/5 rounded-lg px-4 py-2.5 text-xs">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-semibold">
                      Painel de Foragidos da Justiça
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider font-semibold">
                      Foragidos Ativos: {filteredForagidos.length} {filteredForagidos.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>

                  {/* Suspects Grid */}
                  {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-3 text-zinc-500">
                      <span className="border-4 border-white/10 border-t-amber-500 rounded-full w-10 h-10 animate-spin"></span>
                      <span className="text-[10px] uppercase font-mono tracking-wider">Carregando listagem de foragidos...</span>
                    </div>
                  ) : filteredForagidos.length === 0 ? (
                    <div className="py-24 border border-dashed border-amber-500/10 bg-[#12121a]/20 rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-4">
                      <AlertTriangle className="w-12 h-12 stroke-[1] text-amber-500/40" />
                      <div className="text-center space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest font-mono text-zinc-400">Nenhum Foragido Ativo</p>
                        <p className="text-[11px] text-zinc-600 font-mono uppercase text-[9px]">Para ativar a listagem de um foragido no sistema, edite sua ficha de cadastro e ative o botão "FORAGIDO".</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredForagidos.map((suspect, idx) => (
                        <ForagidoCard
                          key={`foragido-${suspect.id || "s"}-${idx}`}
                          suspect={suspect}
                          onViewFicha={() => setSelectedSuspect(suspect)}
                          onEdit={() => {
                            setSuspectToEdit(suspect);
                            setIsAddOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* VIEW: REINCIDENTES */}
              {activeTab === "reincidentes" && (
                <>
                  {/* Module Header */}
                  <div className="border-b border-amber-500/20 pb-4">
                    <h2 className="text-lg font-bold tracking-widest text-amber-400 uppercase font-mono flex items-center gap-2">
                      <Activity className="w-5 h-5 text-amber-500 animate-pulse" /> REINCIDÊNCIA DE DELITOS
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 font-mono">
                      Controle de recidiva criminal com contagem automatizada baseada em registros de ocorrências vinculados
                    </p>
                  </div>

                  {/* Filters and actions row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Search input */}
                    <div className="md:col-span-10 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                        <Search className="w-4 h-4 text-amber-400/80" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisa Inteligente: nome, vulgo, OrCrim, antecedentes, reincidências, ocorrências vinculadas..."
                        className="w-full bg-[#0d0d12] border border-white/10 hover:border-white/20 focus:border-zinc-700 text-white text-xs rounded pl-9 pr-9 py-2.5 outline-none transition-all placeholder:text-zinc-700 font-mono"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          title="Limpar pesquisa"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* OrCrim filter */}
                    <div className="md:col-span-2 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                        <Layers className="w-4 h-4" />
                      </span>
                      <select
                        value={factionFilter}
                        onChange={(e) => setFactionFilter(e.target.value)}
                        className="w-full bg-[#0d0d12] border border-white/10 hover:border-white/20 focus:border-zinc-700 text-white text-xs rounded pl-9 pr-4 py-2.5 outline-none transition-all uppercase font-mono"
                      >
                        <option value="all">OrCrim (Todas)</option>
                        {factions.map((f, idx) => (
                          <option key={`fac-reinc-${f}-${idx}`} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Display options bar */}
                  <div className="flex items-center justify-between bg-[#0d0d12]/40 border border-white/5 rounded-lg px-4 py-2.5 text-xs">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-semibold">
                      Painel de Controle de Reincidência Delitiva
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider font-semibold">
                      Reincidentes Identificados: {filteredReincidentes.length} {filteredReincidentes.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>

                  {/* Reincidentes Grid */}
                  {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-3 text-zinc-500">
                      <span className="border-4 border-white/10 border-t-amber-500 rounded-full w-10 h-10 animate-spin"></span>
                      <span className="text-[10px] uppercase font-mono tracking-wider">Carregando listagem de reincidentes...</span>
                    </div>
                  ) : filteredReincidentes.length === 0 ? (
                    <div className="py-24 border border-dashed border-amber-500/10 bg-[#12121a]/20 rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-4">
                      <Activity className="w-12 h-12 stroke-[1] text-amber-500/40" />
                      <div className="text-center space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest font-mono text-zinc-400">Nenhum Reincidente Encontrado</p>
                        <p className="text-[11px] text-zinc-600 font-mono uppercase text-[9px]">Não há registros de ocorrências cruzadas vinculadas a suspeitos ativos no banco de dados.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredReincidentes.map(({ suspect }, idx) => (
                        <ReincidenteCard
                          key={`reinc-${suspect.id || "s"}-${idx}`}
                          suspect={suspect}
                          occurrences={occurrences}
                          onViewFicha={() => setSelectedSuspect(suspect)}
                          onViewOccurrence={(occ) => setSelectedOccurrence(occ)}
                          onEdit={() => {
                            setSuspectToEdit(suspect);
                            setIsAddOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* VIEW 2: OCCURRENCES */}
              {activeTab === "occurrences" && (
                <OccurrencesPanel
                  currentUser={currentUser}
                  suspects={suspects}
                  onViewSuspect={(suspect) => setSelectedSuspect(suspect)}
                  showToast={showToast}
                />
              )}

              {/* VIEW 3: FACIAL RECOGNITION */}
              {activeTab === "facial-recognition" && (
                <FacialRecognitionPanel
                  suspects={suspects}
                  onSelectSuspect={(suspect) => setSelectedSuspect(suspect)}
                  showToast={showToast}
                />
              )}

              {/* VIEW 3: ADMIN ACCESS MANAGEMENT */}
              {activeTab === "admin" && (
                <AdminPanel
                  currentUser={currentUser}
                  showToast={showToast}
                  initialFilter={adminInitialFilter}
                />
              )}

            </main>
          </div>

          {/* COMPACT FOOTER */}
          <footer className="h-10 border-t border-white/5 bg-[#050507] flex items-center justify-between px-6 flex-shrink-0 text-[8px] sm:text-[9px] text-zinc-600 font-medium tracking-widest font-mono select-none">
            <div>SISPIR · CENTRAL OPERATIVA DE INTELIGÊNCIA</div>
            <div className="hidden sm:flex items-center gap-4">
              <span>SESSÃO PROTEGIDA POR SSL</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
                <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
                <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
              </div>
            </div>
          </footer>

        </div>

      </div>

      {/* MODALS WITH ANIMATIONS */}
      <AnimatePresence>
        {/* Occurrence Detail Modal */}
        {selectedOccurrence && (
          <OccurrenceModal
            key={`dashboard-modal-occ-${selectedOccurrence.id}`}
            occurrence={selectedOccurrence}
            suspects={suspects}
            onClose={() => setSelectedOccurrence(null)}
            onViewSuspect={(suspect) => {
              setSelectedOccurrence(null);
              setSelectedSuspect(suspect);
            }}
          />
        )}

        {/* Suspect Detail Modal */}
        {selectedSuspect && (
          <SuspectModal
            key={`dashboard-modal-susp-${selectedSuspect.id}`}
            suspect={suspects.find((s) => s.id === selectedSuspect.id) || selectedSuspect}
            currentUser={currentUser}
            onClose={() => setSelectedSuspect(null)}
            onEdit={() => {
              setSuspectToEdit(selectedSuspect);
              setIsAddOpen(true);
            }}
            onDelete={() => handleDeleteSuspect(selectedSuspect.id)}
          />
        )}

        {/* Add/Edit Suspect Modal */}
        {isAddOpen && (
          <AddSuspectModal
            key={`dashboard-modal-add-edit-${suspectToEdit?.id || "new"}`}
            suspectToEdit={suspectToEdit}
            userId={currentUser.uid}
            existingSuspects={suspects}
            onClose={() => {
              setIsAddOpen(false);
              setSuspectToEdit(undefined);
            }}
            onSave={handleSaveSuspect}
            onOpenExistingSuspect={(existing) => {
              setIsAddOpen(false);
              setSuspectToEdit(undefined);
              setSelectedSuspect(existing);
            }}
          />
        )}

        {/* Custom Confirmation Dialog */}
        {confirmDialog && confirmDialog.isOpen && (
          <div key="dashboard-modal-confirm-dialog" id="confirm-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${confirmDialog.isDanger ? "bg-rose-950/40 text-rose-400 border border-rose-500/20" : "bg-blue-950/40 text-blue-400 border border-blue-500/20"}`}>
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-xs font-bold font-mono tracking-widest uppercase text-white">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed uppercase font-mono text-[9px]">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5"
                >
                  Não
                </button>
                <button
                  type="button"
                  id="confirm-btn-action"
                  onClick={confirmDialog.onConfirm}
                  className={`px-5 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    confirmDialog.isDanger
                      ? "bg-rose-600 hover:bg-rose-500 text-white border border-rose-500"
                      : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                  }`}
                >
                  Sim
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Custom Notification Toast */}
        {notification && (
          <div key="dashboard-modal-toast" id="toast-notification" className="fixed bottom-6 right-6 z-[110] max-w-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xl backdrop-blur-md ${
                notification.type === "success"
                  ? "bg-emerald-950/65 border-emerald-500/20 text-emerald-400"
                  : notification.type === "error"
                  ? "bg-rose-950/65 border-rose-500/20 text-rose-400"
                  : "bg-zinc-950/80 border-white/10 text-zinc-300"
              }`}
            >
              <div className="flex-grow space-y-1">
                <p className="text-[10px] font-bold tracking-wider font-mono uppercase">
                  {notification.type === "success" ? "SUCESSO" : notification.type === "error" ? "ALERTA" : "INFO"}
                </p>
                <p className="text-[11px] font-sans font-medium text-zinc-300 leading-snug">
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}

        {/* Real-time Operator Registration Modal Alert */}
        {newOperatorAlert && (
          <div
            key={`new-operator-alert-${newOperatorAlert.uid}`}
            className="fixed bottom-6 left-6 md:left-auto md:right-6 z-[120] max-w-sm sm:max-w-md w-[calc(100%-3rem)] md:w-full"
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="p-5 rounded-2xl border-2 border-amber-500/80 bg-[#0d111d]/98 text-white shadow-2xl backdrop-blur-xl shadow-amber-500/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                    <UserPlus className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                      NOVO OPERADOR CADASTRADO
                    </span>
                    <h4 className="text-sm font-bold text-white font-sans mt-0.5">
                      {newOperatorAlert.name || "Novo Operador"}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => setNewOperatorAlert(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
                  title="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 p-3 rounded-xl bg-black/50 border border-white/5 space-y-1 text-xs font-mono">
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>E-mail:</span>
                  <span className="text-zinc-200 truncate max-w-[200px]">{newOperatorAlert.email}</span>
                </div>
                {newOperatorAlert.badgeId && (
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Matrícula/ID:</span>
                    <span className="text-amber-300 font-bold">{newOperatorAlert.badgeId}</span>
                  </div>
                )}
                {newOperatorAlert.lotacao && (
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Lotação:</span>
                    <span className="text-zinc-200">{newOperatorAlert.lotacao}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleQuickApprove(newOperatorAlert.uid, newOperatorAlert.name)}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-sans uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Liberar Acesso</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminInitialFilter("pending");
                    setActiveTab("admin");
                    setNewOperatorAlert(null);
                  }}
                  className="py-2.5 px-3.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 text-xs font-bold font-sans uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Analisar</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
