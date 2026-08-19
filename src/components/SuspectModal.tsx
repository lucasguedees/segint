import React, { useState, useEffect, useRef } from "react";
import { Suspect, UserProfile, PhotoHistoryEntry } from "../types";
import {
  X,
  FileText,
  Edit2,
  Trash2,
  Calendar,
  User,
  Fingerprint,
  MapPin,
  Shield,
  Layers,
  Sparkles,
  Printer,
  Compass,
  AlertOctagon,
  Camera,
  CameraOff,
  Upload,
  Clipboard,
  Plus,
  Image as ImageIcon,
  History,
  Eye,
  Flame,
  Home,
  UserCheck,
  Check,
  Shirt,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Scan,
  Target,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { updateSuspect } from "../dbService";
import { DEFAULT_MUGSHOTS } from "../constants";

interface SuspectModalProps {
  suspect: Suspect;
  currentUser: UserProfile;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SuspectModal({
  suspect,
  currentUser,
  onClose,
  onEdit,
  onDelete,
}: SuspectModalProps) {
  // Can modify if user is creator OR user is admin
  const canModify = currentUser.role === "admin" || suspect.createdBy === currentUser.uid;

  // Photo library states
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoDate, setNewPhotoDate] = useState(new Date().toISOString().split("T")[0]);
  const [newPhotoDesc, setNewPhotoDesc] = useState("");
  const [newPhotoAgent, setNewPhotoAgent] = useState(currentUser.name || "");
  const [photoTab, setPhotoTab] = useState<"import" | "url">("import");
  const [selectedPresetPhoto, setSelectedPresetPhoto] = useState<keyof typeof DEFAULT_MUGSHOTS>("mugshot1");
  const [savingPhoto, setSavingPhoto] = useState(false);

  // Camera integration states
  const [showCameraStream, setShowCameraStream] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Big preview photo state (lightbox)
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Custom alert and confirmation dialog states inside the SuspectModal
  const [modalAlert, setModalAlert] = useState<{
    title: string;
    message: string;
    type: "error" | "info" | "success";
  } | null>(null);

  const [modalConfirm, setModalConfirm] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Stop camera helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCameraStream(false);
  };

  // Start camera helper
  const startCamera = async () => {
    setCameraError("");
    setShowCameraStream(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err2) {
        setCameraError("Não foi possível acessar a câmera do dispositivo. Verifique as permissões de acesso.");
        setShowCameraStream(false);
      }
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setNewPhotoUrl(dataUrl);
        stopCamera();
      }
    }
  };

  // Handle files (browsed)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNewPhotoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle paste events on our dedicated paste container
  const handlePasteEvent = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setNewPhotoUrl(event.target.result as string);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    }
  };

  // Automatically read from clipboard when clicking the zone
  const handleAutoPaste = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.read === "function") {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageTypes = item.types.filter(type => type.startsWith("image/"));
          if (imageTypes.length > 0) {
            const blob = await item.getType(imageTypes[0]);
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setNewPhotoUrl(event.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    } catch (err) {
      // Direct clipboard.read() might be restricted by permissions policy
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const trimmed = text.trim();
          if (trimmed.startsWith("data:image") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            setNewPhotoUrl(trimmed);
            return;
          }
        }
      }
    } catch (err) {
      // Direct clipboard reading blocked by browser permissions policy
    }
  };

  // Clean up streams on close
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = newPhotoUrl;
    if (!finalUrl) {
      setModalAlert({
        title: "FOTO AUSENTE",
        message: "Por favor, tire uma foto, carregue um arquivo ou cole o link de uma imagem para poder salvar.",
        type: "info"
      });
      return;
    }

    setSavingPhoto(true);

    try {
      const currentHistory = suspect.photoHistory || [];
      
      // If history is empty, let's include the primary mugshot as the initial entry first
      const fullHistory = [...currentHistory];
      if (fullHistory.length === 0 && suspect.photos && suspect.photos[0]) {
        fullHistory.push({
          id: "initial",
          url: suspect.photos[0],
          date: suspect.createdAt ? suspect.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
          description: "Mugshot inicial de cadastro do prontuário.",
          agentName: suspect.createdBy === "system" ? "SISTEMA" : "OPERADOR SISPIR",
          createdAt: suspect.createdAt || new Date().toISOString()
        });
      }

      const newEntry: PhotoHistoryEntry = {
        id: "photo-" + Date.now(),
        url: finalUrl,
        date: newPhotoDate,
        description: newPhotoDesc.trim() || "Nova foto de abordagem registrada.",
        agentName: currentUser.name || "OPERADOR SISPIR",
        createdAt: new Date().toISOString()
      };

      const updatedHistory = [newEntry, ...fullHistory]; // newest first
      
      // Also sync back to photos array (append to photos array, so it is backwards compatible)
      const updatedPhotos = [suspect.photos[0]]; // keep primary first
      updatedHistory.forEach(entry => {
        if (!updatedPhotos.includes(entry.url)) {
          updatedPhotos.push(entry.url);
        }
      });

      await updateSuspect(suspect.id, {
        photos: updatedPhotos,
        photoHistory: updatedHistory
      });

      // Reset form states
      setIsAddingPhoto(false);
      setNewPhotoUrl("");
      setNewPhotoDesc("");
      setNewPhotoDate(new Date().toISOString().split("T")[0]);
    } catch (err) {
      console.error("Erro ao salvar foto de abordagem:", err);
      setModalAlert({
        title: "ERRO AO SALVAR FOTO",
        message: "Ocorreu um erro ao salvar a nova foto de abordagem no prontuário. Por favor, tente novamente.",
        type: "error"
      });
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleDeletePhoto = (entryId: string) => {
    if (entryId === "initial") {
      setModalAlert({
        title: "EXCLUSÃO NEGADA",
        message: "A foto de mugshot inicial de cadastro é o arquivo base do prontuário e não pode ser excluída.",
        type: "info"
      });
      return;
    }

    setModalConfirm({
      title: "EXCLUIR HISTÓRICO DE ABORDAGEM",
      message: "Tem certeza de que deseja remover esta foto de histórico de abordagens do suspeito?",
      isDanger: true,
      onConfirm: async () => {
        try {
          const currentHistory = suspect.photoHistory || [];
          const updatedHistory = currentHistory.filter(entry => entry.id !== entryId);

          // Re-sync photos array
          const updatedPhotos = [suspect.photos[0]]; // keep primary
          updatedHistory.forEach(entry => {
            if (!updatedPhotos.includes(entry.url)) {
              updatedPhotos.push(entry.url);
            }
          });

          await updateSuspect(suspect.id, {
            photos: updatedPhotos,
            photoHistory: updatedHistory
          });
          setModalConfirm(null);
        } catch (err) {
          console.error("Erro ao excluir foto do histórico:", err);
          setModalConfirm(null);
          setModalAlert({
            title: "ERRO AO EXCLUIR FOTO",
            message: "Houve um erro de processamento ao tentar excluir a foto do prontuário.",
            type: "error"
          });
        }
      }
    });
  };

  const rawHistoryEntries = suspect.photoHistory || (suspect.photos && suspect.photos[0] ? [
    {
      id: "initial",
      url: suspect.photos[0],
      date: suspect.createdAt ? suspect.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
      description: "Mugshot inicial de cadastro do prontuário.",
      agentName: suspect.createdBy === "system" ? "SISTEMA" : "OPERADOR SISPIR",
      createdAt: suspect.createdAt || new Date().toISOString()
    }
  ] : []);

  const historyEntries = [...rawHistoryEntries].sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const createA = a.createdAt || "";
    const createB = b.createdAt || "";
    return createA.localeCompare(createB);
  });

  // Photo library navigation helpers
  const handlePrevPhoto = () => {
    if (!activePhotoUrl) return;
    const currentIndex = historyEntries.findIndex(e => e.url === activePhotoUrl);
    if (currentIndex !== -1 && historyEntries.length > 0) {
      const prevIndex = (currentIndex - 1 + historyEntries.length) % historyEntries.length;
      setActivePhotoUrl(historyEntries[prevIndex].url);
    }
  };

  const handleNextPhoto = () => {
    if (!activePhotoUrl) return;
    const currentIndex = historyEntries.findIndex(e => e.url === activePhotoUrl);
    if (currentIndex !== -1 && historyEntries.length > 0) {
      const nextIndex = (currentIndex + 1) % historyEntries.length;
      setActivePhotoUrl(historyEntries[nextIndex].url);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activePhotoUrl) return;
      if (e.key === "ArrowLeft") {
        handlePrevPhoto();
      } else if (e.key === "ArrowRight") {
        handleNextPhoto();
      } else if (e.key === "Escape") {
        setActivePhotoUrl(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePhotoUrl, historyEntries]);

  const handlePrint = () => {
    window.print();
  };

  const handleSetAsCover = async (photoUrl: string) => {
    if (!canModify) return;
    
    setModalConfirm({
      title: "DEFINIR COMO CAPA",
      message: "Deseja definir esta foto como a capa principal do prontuário?",
      isDanger: false,
      onConfirm: async () => {
        setModalConfirm(null);
        try {
          // Put selected photo at index 0
          const remainingPhotos = suspect.photos.filter(url => url !== photoUrl);
          const updatedPhotos = [photoUrl, ...remainingPhotos];
          
          await updateSuspect(suspect.id, {
            photos: updatedPhotos
          });

          setModalAlert({
            title: "CAPA ATUALIZADA",
            message: "A capa principal do prontuário foi alterada com sucesso.",
            type: "success"
          });
        } catch (err) {
          console.error("Erro ao definir foto como capa:", err);
          setModalAlert({
            title: "ERRO AO DEFINIR CAPA",
            message: "Houve um erro ao tentar definir a foto como capa do prontuário.",
            type: "error"
          });
        }
      }
    });
  };

  // Helper data values for template display matching screenshot
  const primaryPhoto = suspect.photos && suspect.photos[0];

  const formatDateBR = (isoString?: string) => {
    if (!isoString) return "11/08/2026";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "11/08/2026";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "11/08/2026";
    }
  };

  const formatBirthDateAndAge = (birthDateStr?: string) => {
    if (!birthDateStr || !birthDateStr.trim()) return "NÃO INFORMADA";
    try {
      const parts = birthDateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const birth = new Date(year, month - 1, day);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          const formattedDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
          if (age >= 0 && age <= 120) {
            return `${formattedDate} (${age} anos)`;
          }
          return formattedDate;
        }
      }
      return birthDateStr;
    } catch {
      return birthDateStr;
    }
  };

  const rawDoc = suspect.document
    ? suspect.document.replace(/\(RG\)|\(CPF\)/gi, "").trim()
    : "NÃO INFORMADO";

  const city = suspect.municipio || suspect.areaOfOperation || "LAJEADO";

  const antecedentesText = [
    suspect.antecedentes,
    suspect.frequentCrimes ? `CRIMES FREQUENTES: ${suspect.frequentCrimes}` : null
  ].filter(Boolean).join(" | ") || (suspect.frequentCrimes || "SEM REGISTRO DE ANTECEDENTES NO PRONTUÁRIO");

  const tattoosOrCharacteristics =
    suspect.tattoosScars || "Sem descrição de características físicas.";

  const mandadoText =
    suspect.mandadoNumero
      ? `Nº MANDADO DE PRISÃO: ${suspect.mandadoNumero}`
      : suspect.observations && suspect.observations.toLowerCase().includes("mandado")
      ? suspect.observations
      : suspect.foragido
      ? "FORAGIDO DA JUSTIÇA (MANDADO EM ABERTO)"
      : "Nenhum mandado ativo registrado.";

  return (
    <div id="suspect-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-[#12192b] border border-[#202c4d] rounded-3xl shadow-2xl shadow-black overflow-hidden flex flex-col my-auto max-h-[90vh]"
      >
        {/* Header Bar */}
        <div className="bg-[#0e1424] border-b border-[#202c4d] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1b253e] border border-[#28395e] flex items-center justify-center text-blue-400 shadow-sm shrink-0">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-lg sm:text-xl tracking-tight uppercase font-sans leading-none">
                FICHA DE SUSPEITO
              </h2>
              <p className="text-[#64748b] text-[10px] font-mono tracking-widest uppercase mt-1">
                SISTEMA DE INTELIGÊNCIA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canModify && (
              <button
                onClick={onEdit}
                className="p-2.5 rounded-xl bg-[#1b253e] hover:bg-[#253354] border border-[#28395e] text-zinc-300 hover:text-white transition-all shadow-sm"
                title="Editar Suspeito"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-blue-900/40"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>EXPORTAR</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-[#1b253e] hover:bg-[#253354] border border-[#28395e] text-zinc-400 hover:text-white transition-all shadow-sm"
              title="Fechar Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          
          {/* Top Section: Photo on Left, Main Profile Info on Right */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Photo Mugshot Box */}
            <div className="md:col-span-4 flex flex-col gap-2">
              <div className="relative aspect-[3/4] bg-[#090d19] rounded-2xl overflow-hidden border border-[#233152] shadow-xl group">
                {primaryPhoto ? (
                  <img
                    src={primaryPhoto}
                    alt={suspect.name}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-transform duration-300 ${
                      suspect.coverFocus3x4 ? "scale-[1.6] origin-[center_18%]" : ""
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                    <Fingerprint className="w-16 h-16 stroke-[1]" />
                    <span className="text-[10px] font-mono mt-2 uppercase tracking-widest">Sem Imagem</span>
                  </div>
                )}

                {/* Overlay text at bottom of photo */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end">
                  <span className="text-blue-400 font-bold text-[10px] tracking-wider uppercase font-mono">
                    FOTO PRINCIPAL
                  </span>
                  <span className="text-zinc-400 text-[9px] font-mono mt-0.5">
                    {formatDateBR(suspect.createdAt)}
                  </span>
                </div>
              </div>

              {/* Cover Focus 3x4 toggle */}
              {canModify && primaryPhoto && (
                <div className="grid grid-cols-2 gap-1 bg-[#0b101c] p-1 rounded-xl border border-[#1b2742]">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!suspect.coverFocus3x4) return;
                      try {
                        await updateSuspect(suspect.id, { coverFocus3x4: false });
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className={`py-1 px-2 rounded-lg font-mono text-[9px] font-bold uppercase transition-all ${
                      !suspect.coverFocus3x4
                        ? "bg-[#18233c] text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Completa
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (suspect.coverFocus3x4) return;
                      try {
                        await updateSuspect(suspect.id, { coverFocus3x4: true });
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className={`py-1 px-2 rounded-lg font-mono text-[9px] font-bold uppercase transition-all ${
                      suspect.coverFocus3x4
                        ? "bg-blue-600/30 text-blue-400 border border-blue-500/30"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Foco 3x4
                  </button>
                </div>
              )}
            </div>

            {/* Right Information Details */}
            <div className="md:col-span-8 flex flex-col justify-between space-y-4">
              {/* Status Badge Pill */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[11px] font-bold uppercase tracking-wider shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  {suspect.foragido
                    ? "FORAGIDO"
                    : suspect.alvoEmFoco
                    ? "ALVO EM FOCO"
                    : "SUSPEITO IDENTIFICADO"}
                </span>
              </div>

              {/* Name block */}
              <div>
                <span className="block text-[#64748b] text-[9.5px] font-mono font-bold tracking-widest uppercase mb-1">
                  NOME COMPLETO
                </span>
                <h2 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight font-sans leading-tight">
                  {suspect.name}
                </h2>
                {suspect.alias && (
                  <p className="text-blue-400 font-bold text-sm uppercase mt-1 tracking-wide">
                    Vulgo: "{suspect.alias}"
                  </p>
                )}
              </div>

              {/* 3 Dark Recessed Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <span className="block text-[#64748b] text-[9px] font-mono font-bold tracking-wider uppercase mb-1">
                    RG / CPF
                  </span>
                  <div className="bg-[#0b101c] border border-[#1b2742] rounded-xl px-3.5 py-2.5 font-mono text-xs sm:text-sm font-bold text-zinc-200 tracking-wider truncate">
                    {rawDoc}
                  </div>
                </div>

                <div>
                  <span className="block text-[#64748b] text-[9px] font-mono font-bold tracking-wider uppercase mb-1">
                    DATA CADASTRO
                  </span>
                  <div className="bg-[#0b101c] border border-[#1b2742] rounded-xl px-3.5 py-2.5 font-mono text-xs sm:text-sm font-bold text-zinc-200 tracking-wider truncate">
                    {formatDateBR(suspect.createdAt)}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <span className="block text-[#64748b] text-[9px] font-mono font-bold tracking-wider uppercase mb-1">
                    MUNICÍPIO
                  </span>
                  <div className="bg-[#0b101c] border border-[#1b2742] rounded-xl px-3.5 py-2.5 font-mono text-xs sm:text-sm font-bold text-zinc-200 tracking-wider uppercase truncate">
                    {city}
                  </div>
                </div>

                {/* DESTAQUE DE ORCRIM COM MÁXIMA ÊNFASE */}
                <div className="sm:col-span-2 rounded-2xl p-4 bg-gradient-to-r from-red-950/40 via-amber-950/20 to-[#0b101c] border-2 border-red-500/50 shadow-xl shadow-red-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
                  
                  <div className="flex items-center gap-3.5 relative z-10">
                    <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
                      <Flame className="w-6 h-6 text-red-400 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-black tracking-widest uppercase text-red-400">
                          ORGANIZAÇÃO CRIMINOSA (ORCRIM)
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-extrabold uppercase border tracking-wider ${
                          suspect.faction
                            ? "bg-red-500/25 text-red-300 border-red-500/40 shadow-sm"
                            : "bg-zinc-800/60 text-zinc-400 border-zinc-700/50"
                        }`}>
                          {suspect.faction ? "VINCULADO" : "NÃO CONSTA"}
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-black text-white font-mono uppercase tracking-wide mt-0.5">
                        {suspect.faction ? suspect.faction : "SEM ORCRIM DECLARADA"}
                      </div>
                    </div>
                  </div>

                  {suspect.areaOfOperation && (
                    <div className="text-left sm:text-right relative z-10 bg-[#070b14]/70 sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-white/5 w-full sm:w-auto">
                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider block font-bold">
                        ÁREA DE ATUAÇÃO
                      </span>
                      <span className="text-xs font-black text-amber-400 uppercase font-mono tracking-wide">
                        {suspect.areaOfOperation}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Middle 4 Structured Section Cards (2 Columns Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* Card 1: ANTECEDENTES CRIMINAIS */}
            <div className="bg-[#0e1424] border border-[#202c4d] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider font-mono">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>ANTECEDENTES CRIMINAIS</span>
              </div>
              <p className="text-zinc-200 text-xs font-bold italic uppercase leading-relaxed font-sans">
                {antecedentesText}
              </p>
            </div>

            {/* Card 2: INTELIGÊNCIA & FOCO */}
            <div className="bg-[#0e1424] border border-[#202c4d] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider font-mono">
                <Target className="w-4 h-4 text-rose-400" />
                <span>INTELIGÊNCIA & FOCO</span>
              </div>
              <div>
                <span className="block text-amber-500 font-bold text-[10px] uppercase tracking-wider mb-1">
                  MANDADO DE PRISÃO / OBS
                </span>
                <div className="bg-[#0b101c] border border-[#1b2742] rounded-xl p-3 font-mono text-xs text-zinc-200 font-bold leading-relaxed">
                  {mandadoText}
                </div>
              </div>
            </div>

            {/* Card 3: CARACTERÍSTICAS & TATUAGENS */}
            <div className="bg-[#0e1424] border border-[#202c4d] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider font-mono">
                <Info className="w-4 h-4 text-amber-400" />
                <span>CARACTERÍSTICAS & TATUAGENS</span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed font-sans">
                {tattoosOrCharacteristics}
              </p>
            </div>

            {/* Card 4: OBSERVAÇÕES GERAIS */}
            <div className="bg-[#0e1424] border border-[#202c4d] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-zinc-400 font-bold text-xs uppercase tracking-wider font-mono">
                <Clipboard className="w-4 h-4 text-zinc-400" />
                <span>OBSERVAÇÕES GERAIS</span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed font-sans">
                {suspect.observations || "Sem observações adicionais."}
              </p>
            </div>

          </div>

          {/* ======================================================== */}
          {/* PHOTO LIBRARY & HISTORICAL TIMELINE */}
          {/* ======================================================== */}
          <div className="border-t border-[#202c4d] pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-blue-400 font-mono uppercase tracking-wider">
                  ARQUIVO FOTOGRÁFICO COMPLETO ({historyEntries.length})
                </h3>
              </div>
              
              {!isAddingPhoto && (
                <button
                  onClick={() => {
                    setIsAddingPhoto(true);
                    setNewPhotoDate(new Date().toISOString().split("T")[0]);
                    setNewPhotoDesc("");
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30"
                >
                  <Plus className="w-3.5 h-3.5" /> Registrar Foto
                </button>
              )}
            </div>

            {/* Inline Form to Add a Historical Photo */}
            <AnimatePresence>
              {isAddingPhoto && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleSavePhoto}
                  className="p-5 bg-[#0d0d12] border border-blue-500/25 rounded-xl space-y-4 overflow-hidden"
                >
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h4 className="text-xs font-mono font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Camera className="w-4 h-4" /> Registrar Foto de Nova Abordagem
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingPhoto(false);
                        stopCamera();
                      }}
                      className="text-zinc-500 hover:text-white text-[10px] uppercase font-bold tracking-widest"
                    >
                      Cancelar
                    </button>
                    {/* Preview of the photo to be added */}
                    <div className="md:col-span-3 flex justify-center items-center">
                      <div className="w-28 h-28 rounded-lg bg-[#050507] border border-white/10 overflow-hidden relative flex flex-col items-center justify-center text-zinc-600 shadow-inner">
                        {newPhotoUrl ? (
                          <img
                            src={newPhotoUrl}
                            alt="Preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>
                            <Camera className="w-8 h-8 stroke-[1.5] mb-1 text-zinc-800" />
                            <span className="text-[8px] uppercase tracking-widest font-mono text-zinc-700">Sem Imagem</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Photo Selector inputs */}
                    <div className="md:col-span-9 space-y-3">
                      <div className="flex gap-2 border-b border-white/5 pb-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoTab("import");
                          }}
                          className={`text-[9px] font-bold uppercase py-1 px-2.5 rounded transition-all flex items-center gap-1 ${
                            photoTab === "import" ? "bg-[#1c1c26] text-white border border-white/10" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Upload className="w-3 h-3" /> Carregar / Capturar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoTab("url");
                            stopCamera();
                          }}
                          className={`text-[9px] font-bold uppercase py-1 px-2.5 rounded transition-all flex items-center gap-1 ${
                            photoTab === "url" ? "bg-[#1c1c26] text-white border border-white/10" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Eye className="w-3 h-3" /> Link URL da Web
                        </button>
                      </div>

                      {photoTab === "import" && (
                        <div className="space-y-3">
                          {showCameraStream ? (
                            <div className="flex flex-col gap-2 bg-[#050507] p-2 rounded border border-white/10 max-w-xs">
                              <div className="relative aspect-[4/3] bg-black rounded overflow-hidden border border-white/5">
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                              </div>
                              <div className="flex gap-2 justify-center">
                                <button
                                  type="button"
                                  onClick={capturePhoto}
                                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[9px] uppercase tracking-wider py-1 px-2.5 rounded flex items-center gap-1"
                                >
                                  <Camera className="w-3 h-3" /> Capturar Foto
                                </button>
                                <button
                                  type="button"
                                  onClick={stopCamera}
                                  className="bg-[#1c1c26] text-zinc-400 hover:text-white font-bold text-[9px] uppercase tracking-wider py-1 px-2.5 rounded border border-white/5"
                                >
                                  <CameraOff className="w-3 h-3" /> Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1.5">
                                <label className="flex items-center gap-2 p-2.5 bg-[#050507] border border-white/5 hover:border-white/15 rounded-lg cursor-pointer text-left">
                                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                                  <div className="flex-grow">
                                    <p className="text-[9px] font-bold text-white uppercase tracking-wider">Upload de Arquivo</p>
                                    <p className="text-[7px] text-zinc-500">Imagem da galeria</p>
                                  </div>
                                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                </label>

                                <button
                                  type="button"
                                  onClick={startCamera}
                                  className="w-full flex items-center gap-2 p-2.5 bg-[#050507] border border-white/5 hover:border-white/15 rounded-lg text-left"
                                >
                                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                                  <div className="flex-grow">
                                    <p className="text-[9px] font-bold text-white uppercase tracking-wider">Ativar Câmera</p>
                                    <p className="text-[7px] text-zinc-500">Webcam do aparelho</p>
                                  </div>
                                </button>
                              </div>

                              <div
                                onClick={handleAutoPaste}
                                onPaste={handlePasteEvent}
                                className="relative bg-[#050507] border border-dashed border-white/10 hover:border-blue-500/30 rounded-lg p-2.5 flex flex-col items-center justify-center text-center cursor-pointer outline-none focus:border-blue-500/50"
                                tabIndex={0}
                                title="Clique para colar automaticamente ou use Ctrl+V"
                              >
                                <Clipboard className="w-4 h-4 text-zinc-500 mb-1" />
                                <p className="text-[8px] font-mono text-zinc-400 font-bold uppercase">Colar Automático</p>
                                <p className="text-[7px] text-zinc-600 mt-0.5 leading-relaxed">
                                  Clique aqui para colar ou use <span className="text-zinc-500 font-bold">Ctrl+V</span>
                                </p>
                              </div>
                            </div>
                          )}
                          {cameraError && <p className="text-[9px] text-rose-400 font-mono">{cameraError}</p>}
                        </div>
                      )}

                      {photoTab === "url" && (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={newPhotoUrl}
                            onChange={(e) => setNewPhotoUrl(e.target.value)}
                            placeholder="https://exemplo.com/foto_abordagem.jpg"
                            className="w-full bg-[#050507] border border-white/10 focus:border-zinc-700 text-white text-[11px] rounded px-2.5 py-1.5 outline-none"
                          />
                          <p className="text-[7px] text-zinc-600 font-mono font-sans">Forneça o link ou caminho da imagem JPG, PNG ou WEBP.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadados Form fields (Date, Clothing/Desc, Agent) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
                    <div className="sm:col-span-3">
                      <label className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
                        Data da Abordagem
                      </label>
                      <input
                        type="date"
                        value={newPhotoDate}
                        onChange={(e) => setNewPhotoDate(e.target.value)}
                        className="w-full bg-[#050507] border border-white/10 focus:border-zinc-700 text-white text-[11px] rounded px-2.5 py-1.5 outline-none font-mono"
                        required
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Shirt className="w-3 h-3 text-blue-400" /> Descrição de Vestimentas / Aparência / Corte
                      </label>
                      <input
                        type="text"
                        value={newPhotoDesc}
                        onChange={(e) => setNewPhotoDesc(e.target.value)}
                        placeholder="Ex: Vestia casaco preto de capuz, boné escuro, calça cargo jeans. Cabelo raspado nas laterais."
                        className="w-full bg-[#050507] border border-white/10 focus:border-zinc-700 text-white text-[11px] rounded px-2.5 py-1.5 outline-none"
                        required
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
                        Agente / Operador
                      </label>
                      <input
                        type="text"
                        value={currentUser.name || "OPERADOR SISPIR"}
                        readOnly
                        disabled
                        className="w-full bg-[#0d0d12]/60 border border-white/5 text-zinc-400 text-[11px] rounded px-2.5 py-1.5 outline-none cursor-not-allowed font-mono uppercase"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingPhoto(false);
                        stopCamera();
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-[9px] uppercase tracking-wider py-1.5 px-3 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingPhoto}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-[9px] uppercase tracking-wider py-1.5 px-4 rounded font-bold flex items-center gap-1 transition-all"
                    >
                      {savingPhoto ? "Salvando..." : "Salvar Foto de Abordagem"}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Photo History List Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-1">
              {historyEntries.map((entry, idx) => {
                const isCurrentCover = entry.url === suspect.photos[0];
                return (
                  <div
                    key={`hist-${entry.id || "entry"}-${idx}`}
                    className={`bg-[#0d0d12] border rounded-xl overflow-hidden group hover:border-white/15 transition-all flex flex-col justify-between hover:shadow-lg hover:shadow-black ${
                      isCurrentCover ? "border-emerald-500/30" : "border-white/5"
                    }`}
                  >
                    {/* Photo Area */}
                    <div className="relative aspect-[4/3] bg-black overflow-hidden cursor-pointer" onClick={() => setActivePhotoUrl(entry.url)}>
                      <img
                        src={entry.url}
                        alt="Approach Photo"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-150 text-white text-[8px] font-mono uppercase tracking-widest gap-1">
                        <Eye className="w-4 h-4 text-blue-400" />
                        Visualizar Abordagem
                      </div>
                      {/* Trash can overlay if we can delete (cannot delete current cover photo) */}
                      {canModify && !isCurrentCover && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(entry.id);
                          }}
                          className="absolute top-2 right-2 bg-black/80 hover:bg-rose-900 text-zinc-400 hover:text-white p-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          title="Excluir foto do histórico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isCurrentCover && (
                        <div className="absolute top-2 left-2 bg-emerald-500/90 border border-emerald-400/40 text-white text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow">
                          CAPA ATUAL
                        </div>
                      )}
                    </div>

                    {/* Details Area */}
                    <div className="p-3 space-y-2 flex-grow flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500">
                          <span className="flex items-center gap-1 font-bold">
                            <Calendar className="w-3 h-3 text-zinc-600" />
                            {new Date(entry.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                          <span className="uppercase text-[7px] truncate max-w-[80px] font-bold text-zinc-400">
                            {entry.agentName || "OPERADOR"}
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-zinc-300 font-sans leading-relaxed line-clamp-3 uppercase font-mono tracking-tight">
                          {entry.description || "Sem descrição de aparência registrada."}
                        </p>
                      </div>

                      {/* Cover Photo Selection Option */}
                      <div className="pt-2 border-t border-white/5 mt-auto">
                        {isCurrentCover ? (
                          <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1 py-1 bg-emerald-950/10 border border-emerald-500/10 rounded">
                            <Check className="w-3 h-3 text-emerald-500" /> Capa do Prontuário
                          </span>
                        ) : canModify ? (
                          <button
                            type="button"
                            onClick={() => handleSetAsCover(entry.url)}
                            className="w-full text-center bg-[#14141e] hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 font-mono text-[8px] font-bold uppercase tracking-wider py-1.5 rounded transition-all active:scale-95 flex items-center justify-center gap-1"
                          >
                            Definir como Capa
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {historyEntries.length === 0 && (
              <div className="text-center py-8 bg-[#0d0d12]/50 rounded-xl border border-dashed border-white/5">
                <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-mono">Nenhuma foto histórica registrada ainda.</p>
              </div>
            )}
          </div>

        </div>
      </motion.div>

      {/* ======================================================== */}
      {/* IMMERSIVE LIGHTBOX PHOTO VIEWER */}
      {/* ======================================================== */}
      <AnimatePresence>
        {activePhotoUrl && (
          <div
            key={`suspect-lightbox-${activePhotoUrl}`}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
            onClick={() => setActivePhotoUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-3xl w-full bg-[#0d0d12] border border-white/10 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl shadow-black"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left side: Photo */}
              <div className="md:w-3/5 bg-black flex items-center justify-center aspect-square md:aspect-auto md:max-h-[70vh] relative group">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevPhoto();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black text-white hover:text-blue-400 p-2 rounded-full border border-white/10 transition-all z-10 hover:scale-110 active:scale-95 flex items-center justify-center"
                  title="Anterior (Seta Esquerda)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <img
                  src={activePhotoUrl}
                  alt="Foto do histórico"
                  className="max-h-full max-w-full object-contain"
                />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextPhoto();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black text-white hover:text-blue-400 p-2 rounded-full border border-white/10 transition-all z-10 hover:scale-110 active:scale-95 flex items-center justify-center"
                  title="Próxima (Seta Direita)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Right side: Details */}
              <div className="md:w-2/5 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 bg-[#0d0d12]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono tracking-widest text-blue-400 font-bold uppercase">
                      DETALHES DA CAPTURA
                    </span>
                    <button
                      onClick={() => setActivePhotoUrl(null)}
                      className="text-zinc-500 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Find the entry in history list to display details */}
                  {(() => {
                    const entry = historyEntries.find(e => e.url === activePhotoUrl);
                    if (!entry) return null;
                    return (
                      <div className="space-y-4 font-sans">
                        <div>
                          <span className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest">DATA DA ABORDAGEM</span>
                          <span className="text-sm font-semibold text-white flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            {new Date(entry.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest">AGENTE RESPONSÁVEL</span>
                          <span className="text-xs text-zinc-300 font-semibold uppercase mt-0.5 block font-mono">
                            {entry.agentName || "NÃO CONSTA"}
                          </span>
                        </div>

                        <div className="bg-[#050507] p-4 rounded-lg border border-white/5">
                          <span className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <Shirt className="w-3 h-3 text-blue-400" /> VESTIMENTAS E APARÊNCIA
                          </span>
                          <p className="text-xs text-zinc-200 leading-relaxed uppercase font-mono">
                            {entry.description || "Nenhum detalhe de roupas cadastrado."}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2 mt-6">
                  {activePhotoUrl === suspect.photos[0] ? (
                    <div className="w-full bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 py-2.5 rounded-lg text-xs uppercase tracking-wider font-mono font-bold text-center flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Foto de Capa Ativa
                    </div>
                  ) : canModify ? (
                    <button
                      type="button"
                      onClick={() => handleSetAsCover(activePhotoUrl)}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-xs uppercase tracking-wider font-mono font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-blue-950/25"
                    >
                      Definir como Capa do Prontuário
                    </button>
                  ) : null}

                  <button
                    onClick={() => setActivePhotoUrl(null)}
                    className="w-full bg-[#1c1c26] hover:bg-white/5 border border-white/5 text-zinc-400 hover:text-white py-2.5 rounded-lg text-xs uppercase tracking-wider font-mono font-bold transition-all"
                  >
                    Fechar Visualizador
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Modal alert and confirm inside SuspectModal */}
      <AnimatePresence>
        {modalAlert && (
          <div key="suspect-modal-alert-dialog" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#12121a] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${modalAlert.type === "error" ? "bg-rose-950/40 text-rose-400 border border-rose-500/20" : "bg-blue-950/40 text-blue-400 border border-blue-500/20"}`}>
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-xs font-bold font-mono tracking-widest uppercase text-white">
                    {modalAlert.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed uppercase font-mono text-[9px] whitespace-pre-wrap">
                    {modalAlert.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalAlert(null)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-blue-500"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {modalConfirm && (
          <div key="suspect-modal-confirm-dialog" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#12121a] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${modalConfirm.isDanger ? "bg-rose-950/40 text-rose-400 border border-rose-500/20" : "bg-blue-950/40 text-blue-400 border border-blue-500/20"}`}>
                  <AlertOctagon className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-xs font-bold font-mono tracking-widest uppercase text-white">
                    {modalConfirm.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed uppercase font-mono text-[9px]">
                    {modalConfirm.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalConfirm(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={modalConfirm.onConfirm}
                  className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    modalConfirm.isDanger
                      ? "bg-rose-600 hover:bg-rose-500 text-white border border-rose-500"
                      : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
