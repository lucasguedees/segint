import React, { useState, useEffect, useMemo } from "react";
import { Suspect, SuspectStatus, PhotoHistoryEntry } from "../types";
import { DEFAULT_MUGSHOTS } from "../constants";
import {
  X,
  Shield,
  Plus,
  Camera,
  Eye,
  HelpCircle,
  Upload,
  Clipboard,
  Trash2,
  CameraOff,
  Image,
  Calendar,
  MapPin,
  Fingerprint,
  FileText,
  Check,
  Link,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ArrowRight,
  Copy,
  ExternalLink,
  UserCheck,
  Sparkles,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { checkSuspectDuplicates, SuspectDuplicateMatch } from "../utils/suspectSearch";
import { compressImageFile, compressBase64Image } from "../utils/imageOptimizer";

interface AddSuspectModalProps {
  suspectToEdit?: Suspect; // Provided if editing
  userId: string;
  existingSuspects?: Suspect[];
  onClose: () => void;
  onSave: (suspect: Omit<Suspect, "createdAt" | "updatedAt"> | Partial<Suspect>) => Promise<void>;
  onOpenExistingSuspect?: (suspect: Suspect) => void;
}

export default function AddSuspectModal({
  suspectToEdit,
  userId,
  existingSuspects = [],
  onClose,
  onSave,
  onOpenExistingSuspect,
}: AddSuspectModalProps) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [document, setDocument] = useState("");
  const [status, setStatus] = useState<SuspectStatus>("investigating");
  const [birthDate, setBirthDate] = useState("");
  const [motherName, setMotherName] = useState("");
  const [faction, setFaction] = useState("");
  const [areaOfOperation, setAreaOfOperation] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [skinColor, setSkinColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairType, setHairType] = useState("");
  const [tattoosScars, setTattoosScars] = useState("");
  const [observations, setObservations] = useState("");

  const [alvoEmFoco, setAlvoEmFoco] = useState(false);
  const [alvoEmFocoReason, setAlvoEmFocoReason] = useState("");
  const [foragido, setForagido] = useState(false);
  const [mandadoNumero, setMandadoNumero] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [antecedentes, setAntecedentes] = useState("");
  const [frequentCrimes, setFrequentCrimes] = useState("");
  const [lastKnownAddress, setLastKnownAddress] = useState("");
  const [cadastroDate, setCadastroDate] = useState(new Date().toISOString().split("T")[0]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Intelligent Duplicate & Homonym Detection States
  const [activeTargetSuspect, setActiveTargetSuspect] = useState<Suspect | null>(suspectToEdit || null);
  const [infoAppendMode, setInfoAppendMode] = useState(false);
  const [showDuplicateConfirmModal, setShowDuplicateConfirmModal] = useState(false);
  const [acknowledgedDuplicate, setAcknowledgedDuplicate] = useState(false);
  const [previewSuspect, setPreviewSuspect] = useState<Suspect | null>(null);

  // Photo management: custom URL, upload, camera, or paste
  const [customPhotoUrl, setCustomPhotoUrl] = useState("");
  const [useCustomPhoto, setUseCustomPhoto] = useState(true);
  const [photoTab, setPhotoTab] = useState<"import" | "url">("import");

  // Operational photo archive / gallery states
  const [localPhotoHistory, setLocalPhotoHistory] = useState<PhotoHistoryEntry[]>([]);
  const [galleryPhotoDate, setGalleryPhotoDate] = useState(new Date().toISOString().split("T")[0]);
  const [galleryTempPhotoUrl, setGalleryTempPhotoUrl] = useState("");
  const [showGalleryCamera, setShowGalleryCamera] = useState(false);
  const [galleryCameraError, setGalleryCameraError] = useState("");
  const [isPastingGallery, setIsPastingGallery] = useState(false);
  const galleryVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const galleryStreamRef = React.useRef<MediaStream | null>(null);
  const galleryFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const stopGalleryCamera = () => {
    if (galleryStreamRef.current) {
      galleryStreamRef.current.getTracks().forEach(track => track.stop());
      galleryStreamRef.current = null;
    }
    setShowGalleryCamera(false);
  };

  const startGalleryCamera = async () => {
    setGalleryCameraError("");
    setShowGalleryCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      galleryStreamRef.current = stream;
      if (galleryVideoRef.current) {
        galleryVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Gallery camera access error:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        galleryStreamRef.current = stream;
        if (galleryVideoRef.current) {
          galleryVideoRef.current.srcObject = stream;
        }
      } catch (err2) {
        setGalleryCameraError("Não foi possível acessar a câmera do dispositivo.");
        setShowGalleryCamera(false);
      }
    }
  };

  const captureGalleryPhoto = async () => {
    if (galleryVideoRef.current) {
      const canvas = window.document.createElement("canvas");
      canvas.width = galleryVideoRef.current.videoWidth || 640;
      canvas.height = galleryVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(galleryVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        const optimized = await compressBase64Image(dataUrl, 800, 800, 0.78);
        setGalleryTempPhotoUrl(optimized);
        stopGalleryCamera();
      }
    }
  };

  const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const optimized = await compressImageFile(file, 800, 800, 0.78);
      if (optimized) {
        setGalleryTempPhotoUrl(optimized);
      }
    }
  };

  const handleGalleryAutoPaste = () => {
    stopGalleryCamera();
    setIsPastingGallery(!isPastingGallery);
  };

  const handleAddGalleryPhoto = () => {
    if (!galleryTempPhotoUrl) {
      alert("Selecione uma imagem primeiro (através de arquivo, câmera ou colando) antes de adicionar!");
      return;
    }

    const newEntry: PhotoHistoryEntry = {
      id: "photo-" + Math.random().toString(36).substr(2, 9),
      url: galleryTempPhotoUrl,
      date: galleryPhotoDate,
      createdAt: new Date().toISOString(),
    };

    setLocalPhotoHistory([...localPhotoHistory, newEntry]);
    setGalleryTempPhotoUrl(""); // Reset temp image
  };

  const handleRemoveGalleryPhoto = (id: string) => {
    setLocalPhotoHistory(localPhotoHistory.filter(photo => photo.id !== id));
  };

  // Global paste handler (Ctrl+V) anywhere inside the modal
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              const optimized = await compressImageFile(file, 800, 800, 0.78);
              if (optimized) {
                setCustomPhotoUrl(optimized);
                setUseCustomPhoto(true);
              }
              break;
            }
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, []);

  // Camera integration states
  const [showCameraStream, setShowCameraStream] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
        video: { facingMode: "user" }, // Front-facing camera is usually default for face identification/mugshots
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      try {
        // Fallback for generic video stream (e.g. standard laptop webcam or rear camera)
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
  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = window.document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        const optimized = await compressBase64Image(dataUrl, 800, 800, 0.78);
        setCustomPhotoUrl(optimized);
        setUseCustomPhoto(true);
        stopCamera();
      }
    }
  };

  // Handle files (browsed)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const optimized = await compressImageFile(file, 800, 800, 0.78);
      if (optimized) {
        setCustomPhotoUrl(optimized);
        setUseCustomPhoto(true);
      }
    }
  };

  // Handle paste events on our dedicated paste container
  const handlePasteEvent = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const optimized = await compressImageFile(file, 800, 800, 0.78);
            if (optimized) {
              setCustomPhotoUrl(optimized);
              setUseCustomPhoto(true);
            }
            break;
          }
        }
      }
    }
  };

  // Automatically read from clipboard when clicking the zone
  const handleAutoPaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageTypes = item.types.filter(type => type.startsWith("image/"));
        if (imageTypes.length > 0) {
          const blob = await item.getType(imageTypes[0]);
          const file = new File([blob], "clipboard.jpg", { type: blob.type });
          const optimized = await compressImageFile(file, 800, 800, 0.78);
          if (optimized) {
            setCustomPhotoUrl(optimized);
            setUseCustomPhoto(true);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Direct clipboard.read() failed, trying text fallback", err);
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const trimmed = text.trim();
        if (trimmed.startsWith("data:image")) {
          const optimized = await compressBase64Image(trimmed, 800, 800, 0.78);
          setCustomPhotoUrl(optimized);
          setUseCustomPhoto(true);
          return;
        } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          setCustomPhotoUrl(trimmed);
          setUseCustomPhoto(true);
          return;
        }
      }
    } catch (err) {
      console.warn("Clipboard permission denied or browser restricted:", err);
    }
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (suspectToEdit) {
      setActiveTargetSuspect(suspectToEdit);
      setName(suspectToEdit.name);
      setAlias(suspectToEdit.alias);
      setDocument(suspectToEdit.document);
      setStatus(suspectToEdit.status);
      setBirthDate(suspectToEdit.birthDate || "");
      setMotherName(suspectToEdit.motherName || "");
      setFaction(suspectToEdit.faction || "");
      setAreaOfOperation(suspectToEdit.areaOfOperation || "");
      setHeight(suspectToEdit.height || "");
      setWeight(suspectToEdit.weight || "");
      setSkinColor(suspectToEdit.skinColor || "");
      setEyeColor(suspectToEdit.eyeColor || "");
      setHairType(suspectToEdit.hairType || "");
      setTattoosScars(suspectToEdit.tattoosScars || "");
      setObservations(suspectToEdit.observations || "");

      setAlvoEmFoco(suspectToEdit.alvoEmFoco || false);
      setAlvoEmFocoReason(suspectToEdit.alvoEmFocoReason || "");
      setForagido(suspectToEdit.foragido || false);
      setMandadoNumero(suspectToEdit.mandadoNumero || "");
      setMunicipio(suspectToEdit.municipio || "");
      setAntecedentes(suspectToEdit.antecedentes || "");
      setFrequentCrimes(suspectToEdit.frequentCrimes || "");
      setLastKnownAddress(suspectToEdit.lastKnownAddress || "");
      setCadastroDate(suspectToEdit.createdAt ? suspectToEdit.createdAt.split("T")[0] : new Date().toISOString().split("T")[0]);

      // Check if photo is custom or preset
      const currentPhoto = suspectToEdit.photos?.[0] || "";
      setCustomPhotoUrl(currentPhoto);
      setUseCustomPhoto(true);
      if (currentPhoto.startsWith("data:image") || Object.values(DEFAULT_MUGSHOTS).includes(currentPhoto)) {
        setPhotoTab("import");
      } else {
        setPhotoTab("url");
      }

      setLocalPhotoHistory(suspectToEdit.photoHistory || []);
    } else {
      setActiveTargetSuspect(null);
    }
  }, [suspectToEdit]);

  // Clean up streams on close
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (galleryStreamRef.current) {
        galleryStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Real-time Intelligence Duplicate & Homonym Detection
  const duplicateResult = useMemo(() => {
    if (!existingSuspects || existingSuspects.length === 0) {
      return { hasDuplicate: false, highestConfidence: null, matches: [] };
    }
    return checkSuspectDuplicates(
      {
        name,
        document,
        alias,
        motherName,
        birthDate,
        mandadoNumero,
      },
      existingSuspects,
      activeTargetSuspect?.id || suspectToEdit?.id
    );
  }, [name, document, alias, motherName, birthDate, mandadoNumero, existingSuspects, activeTargetSuspect, suspectToEdit]);

  // Helper to switch modal into editing or appending info to an existing suspect
  const handleSelectExistingToEdit = (existing: Suspect, appendNotes = false) => {
    setActiveTargetSuspect(existing);
    setAcknowledgedDuplicate(true);
    setShowDuplicateConfirmModal(false);
    setPreviewSuspect(null);

    // Keep newly entered values if they exist, otherwise fill with existing
    setName(existing.name || name);
    if (existing.alias) setAlias(existing.alias);
    if (existing.document) setDocument(existing.document);
    if (existing.status) setStatus(existing.status);
    if (existing.birthDate) setBirthDate(existing.birthDate);
    if (existing.motherName) setMotherName(existing.motherName);
    if (existing.faction) setFaction(existing.faction);
    if (existing.areaOfOperation) setAreaOfOperation(existing.areaOfOperation);
    if (existing.municipio) setMunicipio(existing.municipio);
    if (existing.height) setHeight(existing.height);
    if (existing.weight) setWeight(existing.weight);
    if (existing.skinColor) setSkinColor(existing.skinColor);
    if (existing.eyeColor) setEyeColor(existing.eyeColor);
    if (existing.hairType) setHairType(existing.hairType);
    if (existing.tattoosScars) setTattoosScars(existing.tattoosScars);
    if (existing.alvoEmFoco !== undefined) setAlvoEmFoco(existing.alvoEmFoco);
    if (existing.alvoEmFocoReason) setAlvoEmFocoReason(existing.alvoEmFocoReason);
    if (existing.foragido !== undefined) setForagido(existing.foragido);
    if (existing.mandadoNumero) setMandadoNumero(existing.mandadoNumero);
    if (existing.antecedentes) setAntecedentes(existing.antecedentes);
    if (existing.frequentCrimes) setFrequentCrimes(existing.frequentCrimes);
    if (existing.lastKnownAddress) setLastKnownAddress(existing.lastKnownAddress);

    // Observations merge logic
    const todayStr = new Date().toLocaleDateString("pt-BR");
    const currentTypedObs = observations.trim();
    const existingObs = (existing.observations || "").trim();

    if (appendNotes) {
      setInfoAppendMode(true);
      setShowAdvanced(true);
      if (currentTypedObs && !existingObs.includes(currentTypedObs)) {
        setObservations(`${existingObs ? existingObs + "\n\n" : ""}[Atualização / Novas Informações - ${todayStr}]:\n${currentTypedObs}`);
      } else {
        setObservations(`${existingObs ? existingObs + "\n\n" : ""}[Atualização / Novas Informações - ${todayStr}]:\n`);
      }
    } else {
      if (currentTypedObs && !existingObs.includes(currentTypedObs)) {
        setObservations(`${existingObs ? existingObs + "\n\n" : ""}[Novas Anotações Integradas]:\n${currentTypedObs}`);
      } else {
        setObservations(existingObs || currentTypedObs);
      }
    }

    // Photos merge
    const existingPhotos = existing.photos || [];
    let existingHistory = existing.photoHistory || [];

    if (customPhotoUrl && !existingPhotos.includes(customPhotoUrl)) {
      // User captured/uploaded a new photo in the form - archive existing main photo to gallery
      if (existingPhotos[0] && !existingHistory.some((h) => h.url === existingPhotos[0])) {
        existingHistory = [
          {
            id: `ph-${Date.now()}-prev`,
            url: existingPhotos[0],
            date: existing.createdAt ? existing.createdAt.split("T")[0] : todayStr,
            description: "Foto de Arquivo Anterior",
            createdAt: new Date().toISOString(),
          },
          ...existingHistory,
        ];
      }
      setLocalPhotoHistory(existingHistory);
    } else {
      const currentPhoto = existingPhotos[0] || "";
      setCustomPhotoUrl(currentPhoto);
      setUseCustomPhoto(true);
      setLocalPhotoHistory(existingHistory);
    }
  };

  // Helper to revert back to adding a brand new suspect
  const handleRevertToNewSuspect = () => {
    setActiveTargetSuspect(null);
    setInfoAppendMode(false);
    setAcknowledgedDuplicate(false);
  };

  // Helper to import existing suspect details into current form without switching target
  const handleImportDataFromExisting = (existing: Suspect) => {
    if (!name.trim() && existing.name) setName(existing.name);
    if (!alias.trim() && existing.alias) setAlias(existing.alias);
    if (!document.trim() && existing.document) setDocument(existing.document);
    if (!faction.trim() && existing.faction) setFaction(existing.faction);
    if (!municipio.trim() && existing.municipio) setMunicipio(existing.municipio);
    if (!motherName.trim() && existing.motherName) setMotherName(existing.motherName);
    if (!birthDate.trim() && existing.birthDate) setBirthDate(existing.birthDate);
    if (!antecedentes.trim() && existing.antecedentes) setAntecedentes(existing.antecedentes);
    if (!frequentCrimes.trim() && existing.frequentCrimes) setFrequentCrimes(existing.frequentCrimes);
    if (!lastKnownAddress.trim() && existing.lastKnownAddress) setLastKnownAddress(existing.lastKnownAddress);
    if (!tattoosScars.trim() && existing.tattoosScars) setTattoosScars(existing.tattoosScars);
    if (!observations.trim() && existing.observations) setObservations(existing.observations);
    if (existing.photos && existing.photos.length > 0 && !customPhotoUrl) {
      setCustomPhotoUrl(existing.photos[0]);
      setUseCustomPhoto(true);
    }
  };

  const executeSave = async (targetOverride?: Suspect) => {
    setSaving(true);
    setError("");

    const effectiveTarget = targetOverride || activeTargetSuspect || suspectToEdit;
    const finalPhoto = customPhotoUrl.trim() || (effectiveTarget?.photos?.[0] || DEFAULT_MUGSHOTS.mugshot1);
    const photosToSave = (effectiveTarget && !customPhotoUrl.trim() && effectiveTarget.photos && effectiveTarget.photos.length > 0)
      ? effectiveTarget.photos
      : [finalPhoto];

    try {
      if (effectiveTarget) {
        // Edit / Update mode for existing suspect
        await onSave({
          id: effectiveTarget.id,
          name: name.trim().toUpperCase(),
          alias: alias.trim().toUpperCase(),
          document: document.trim(),
          status: foragido ? "wanted" : (status === "wanted" ? "investigating" : status),
          birthDate,
          motherName: motherName.trim(),
          faction: faction.trim().toUpperCase(),
          areaOfOperation: areaOfOperation.trim().toUpperCase(),
          height,
          weight,
          skinColor,
          eyeColor,
          hairType,
          tattoosScars,
          observations,
          alvoEmFoco,
          alvoEmFocoReason,
          foragido,
          mandadoNumero,
          municipio: municipio.trim().toUpperCase(),
          antecedentes,
          frequentCrimes,
          lastKnownAddress,
          photos: photosToSave,
          photoHistory: localPhotoHistory,
        });
      } else {
        // Create mode
        const newSuspectId = "susp-" + Math.random().toString(36).substr(2, 9);
        await onSave({
          id: newSuspectId,
          name: name.trim().toUpperCase(),
          alias: alias.trim().toUpperCase(),
          document: document.trim(),
          status: foragido ? "wanted" : (status === "wanted" ? "investigating" : status),
          birthDate,
          motherName: motherName.trim(),
          faction: faction.trim().toUpperCase(),
          areaOfOperation: areaOfOperation.trim().toUpperCase(),
          height,
          weight,
          skinColor,
          eyeColor,
          hairType,
          tattoosScars,
          observations,
          alvoEmFoco,
          alvoEmFocoReason,
          foragido,
          mandadoNumero,
          municipio: municipio.trim().toUpperCase(),
          antecedentes,
          frequentCrimes,
          lastKnownAddress,
          photos: [finalPhoto],
          photoHistory: localPhotoHistory,
          createdBy: userId,
        });
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar o suspeito. Verifique suas permissões.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("O nome do suspeito é obrigatório.");
      return;
    }

    // Se for um novo cadastro (sem target de edição) e tiver duplicidade de alta certeza não confirmada, intercepta para alerta
    if (!activeTargetSuspect && !suspectToEdit && duplicateResult.hasDuplicate && duplicateResult.highestConfidence === "high" && !acknowledgedDuplicate) {
      setShowDuplicateConfirmModal(true);
      return;
    }

    await executeSave();
  };

  return (
    <div id="add-suspect-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-5xl bg-[#0c101d] border border-[#202b44] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-4 text-zinc-300"
      >
        {/* Header */}
        <div className="bg-[#080b14] border-b border-[#1e273d] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Fingerprint className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white font-sans">
                {activeTargetSuspect || suspectToEdit
                  ? "ALTERAR / ATUALIZAR CADASTRO DE SUSPEITO"
                  : "NOVO CADASTRO DE SUSPEITO"}
              </h2>
              {activeTargetSuspect && (
                <span className="text-[10px] font-mono text-blue-400 flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="w-3 h-3" />
                  Prontuário Existente Selecionado: {activeTargetSuspect.name} (ID: {activeTargetSuspect.id})
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[82vh] bg-[#0c101d]">
          
          {/* Active Target Banner when linked to an existing suspect */}
          {activeTargetSuspect && (
            <div className="bg-gradient-to-r from-blue-950/60 via-[#111827] to-[#0c101d] border border-blue-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-200 shadow-lg shadow-blue-950/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      {infoAppendMode ? "Inclusão de Novas Informações Ativa" : "Modo de Edição / Atualização Ativo"}
                    </span>
                    <span className="text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded uppercase">
                      ID: {activeTargetSuspect.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    Você está editando o prontuário de <strong className="text-white">{activeTargetSuspect.name}</strong>. Ao salvar, os dados serão consolidados diretamente na ficha existente.
                  </p>
                </div>
              </div>
              {!suspectToEdit && (
                <button
                  type="button"
                  onClick={handleRevertToNewSuspect}
                  className="px-3 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors border border-white/10 shrink-0 self-end sm:self-auto"
                >
                  Desvincular e Criar Novo
                </button>
              )}
            </div>
          )}

          {/* REAL-TIME INTELLIGENCE DUPLICATE & HOMONYM WARNING AT THE TOP OF THE CARD */}
          <AnimatePresence>
            {duplicateResult.hasDuplicate && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className={`rounded-xl border p-4 transition-all duration-300 ${
                  duplicateResult.highestConfidence === "high"
                    ? "bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-950/30"
                    : "bg-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-950/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      duplicateResult.highestConfidence === "high"
                        ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse"
                        : "bg-amber-500/20 border-amber-500/40 text-amber-400"
                    }`}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4
                        className={`text-xs font-bold uppercase tracking-wider font-sans ${
                          duplicateResult.highestConfidence === "high"
                            ? "text-rose-300"
                            : "text-amber-300"
                        }`}
                      >
                        ⚠️ Alerta de Inteligência: Cadastro Existente / Homônimo Detectado
                      </h4>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase ${
                          duplicateResult.highestConfidence === "high"
                            ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                            : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        }`}
                      >
                        {duplicateResult.highestConfidence === "high"
                          ? "Alta Probabilidade"
                          : "Similaridade Detectada"}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                      O sistema identificou correspondência com{" "}
                      <strong>{duplicateResult.matches.length}</strong> registro(s) já existente(s) na base:
                    </p>

                    {/* List of Matched Suspects */}
                    <div className="mt-3 space-y-2.5">
                      {duplicateResult.matches.map((match, idx) => {
                        const matchedSuspect = match.suspect;
                        const photoUrl =
                          matchedSuspect.photos?.[0] || DEFAULT_MUGSHOTS.mugshot1;
                        return (
                          <div
                            key={`match-${matchedSuspect.id || idx}`}
                            className="bg-[#0b0f19] border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-lg bg-black overflow-hidden border border-white/10 shrink-0 relative">
                                <img
                                  src={photoUrl}
                                  alt={matchedSuspect.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white uppercase tracking-tight truncate">
                                    {matchedSuspect.name}
                                  </span>
                                  {matchedSuspect.alias && (
                                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                      "{matchedSuspect.alias}"
                                    </span>
                                  )}
                                  {matchedSuspect.foragido && (
                                    <span className="text-[9px] font-mono font-bold bg-red-600/30 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded uppercase">
                                      FORAGIDO
                                    </span>
                                  )}
                                  {matchedSuspect.alvoEmFoco && (
                                    <span className="text-[9px] font-mono font-bold bg-amber-500/30 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded uppercase">
                                      ALVO EM FOCO
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5 flex-wrap font-mono">
                                  {matchedSuspect.document && (
                                    <span>CPF/RG: <strong className="text-zinc-200">{matchedSuspect.document}</strong></span>
                                  )}
                                  {matchedSuspect.faction && (
                                    <span>• Facção: <strong className="text-red-400">{matchedSuspect.faction}</strong></span>
                                  )}
                                  {matchedSuspect.municipio && (
                                    <span>• {matchedSuspect.municipio}</span>
                                  )}
                                </div>
                                {/* Reasons Badges */}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {match.reasons.map((reason, rIdx) => (
                                    <span
                                      key={`reason-${rIdx}`}
                                      className={`text-[9px] px-2 py-0.5 rounded font-mono font-semibold ${
                                        match.confidence === "high"
                                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      }`}
                                    >
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Actions for this match */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleSelectExistingToEdit(matchedSuspect, false)}
                                className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 transition-all border border-blue-500/40 shadow-sm"
                                title="Carregar todos os dados deste suspeito no formulário para edição"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Editar Cadastro</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSelectExistingToEdit(matchedSuspect, true)}
                                className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 transition-all border border-emerald-500/40 shadow-sm"
                                title="Adicionar novas informações, fotos ou anotações a este cadastro existente"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Incluir Informações</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setPreviewSuspect(matchedSuspect)}
                                className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 transition-all border border-white/5"
                                title="Visualizar ficha completa com fotos e histórico"
                              >
                                <Eye className="w-3 h-3 text-zinc-400" />
                                <span>Ver</span>
                              </button>

                              {onOpenExistingSuspect && (
                                <button
                                  type="button"
                                  onClick={() => onOpenExistingSuspect(matchedSuspect)}
                                  className="px-2.5 py-1.5 bg-[#1e273d] hover:bg-blue-600 text-zinc-200 hover:text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 transition-all border border-white/10"
                                  title="Abrir a ficha completa deste suspeito no painel"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Top Row Cards: Toggle Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* ALVO EM FOCO card container */}
            <div className="flex flex-col gap-2">
              <div className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                alvoEmFoco 
                  ? "bg-rose-500/10 border-rose-500/40" 
                  : "bg-[#111625] border-[#1e273d]"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                    alvoEmFoco 
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-400" 
                      : "bg-[#161d30] border-[#242f4c] text-zinc-400"
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">ALVO EM FOCO</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Destaque no Mural</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAlvoEmFoco(!alvoEmFoco)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    alvoEmFoco ? "bg-rose-600" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      alvoEmFoco ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* ALVO EM FOCO REASON INPUT */}
              {alvoEmFoco && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-[#16111a] space-y-2">
                  <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider font-mono">
                    Motivo do Foco (Foco Criminal Atual)
                  </label>
                  <input
                    type="text"
                    value={alvoEmFocoReason}
                    onChange={(e) => setAlvoEmFocoReason(e.target.value)}
                    placeholder="Ex: FURTOS EM FARMÁCIA, TRÁFICO, MANDADO ATIVO"
                    className="w-full bg-[#09070a] border border-rose-500/20 hover:border-rose-500/40 focus:border-rose-500 text-white text-xs rounded-lg px-3 py-2 outline-none transition-all placeholder:text-zinc-600 font-mono uppercase"
                  />
                </div>
              )}
            </div>

            {/* FORAGIDO card container */}
            <div className="flex flex-col gap-2">
              <div className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                foragido 
                  ? "bg-amber-500/10 border-amber-500/40" 
                  : "bg-[#111625] border-[#1e273d]"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                    foragido 
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400" 
                      : "bg-[#161d30] border-[#242f4c] text-zinc-400"
                  }`}>
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">FORAGIDO</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono font-bold text-[#f5a623]">Mandado em Aberto</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForagido(!foragido)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    foragido ? "bg-amber-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      foragido ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* FORAGIDO MANDADO INPUT */}
              {foragido && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-[#1a1611] space-y-2">
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono">
                    Nº do Mandado de Prisão
                  </label>
                  <input
                    type="text"
                    value={mandadoNumero}
                    onChange={(e) => setMandadoNumero(e.target.value)}
                    placeholder="Ex: 5003957-37.2025.8.21.0017.01.0003-02"
                    className="w-full bg-[#0a0907] border border-amber-500/20 hover:border-amber-500/40 focus:border-amber-500 text-white text-xs rounded-lg px-3 py-2 outline-none transition-all placeholder:text-zinc-600 font-mono uppercase"
                  />
                </div>
              )}
            </div>

          </div>

          {/* TWO COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* COLUMN 1: DADOS DE IDENTIFICAÇÃO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#1e273d] pb-2">
                <span className="text-blue-500 text-lg font-bold">—</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 font-sans">
                  DADOS DE IDENTIFICAÇÃO
                </h3>
              </div>

              {/* Data Cadastro & Municipio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                    Data Cadastro
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[#404f76]" />
                    <input
                      type="date"
                      value={cadastroDate}
                      onChange={(e) => setCadastroDate(e.target.value)}
                      className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none transition-all uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                    Município
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-[#404f76]" />
                    <input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      placeholder="Município"
                      className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none transition-all placeholder:text-[#404f76]"
                    />
                  </div>
                </div>
              </div>

              {/* Nome Completo */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do indivíduo"
                  className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg px-3.5 py-2.5 outline-none transition-all placeholder:text-[#404f76]"
                />
              </div>

              {/* Alcunha & RG/CPF */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                    Alcunha (Vulgo)
                  </label>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="Apelido"
                    className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg px-3.5 py-2.5 outline-none transition-all placeholder:text-[#404f76]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                    RG / CPF
                  </label>
                  <div className="relative">
                    <Fingerprint className="absolute left-3 top-2.5 w-4 h-4 text-[#404f76]" />
                    <input
                      type="text"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      placeholder="Documento"
                      className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none transition-all placeholder:text-[#404f76]"
                    />
                  </div>
                </div>
              </div>

              {/* OrCrim (Organização Criminosa) */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                  OrCrim (Organização Criminosa)
                </label>
                <div className="relative">
                  <Flame className="absolute left-3 top-2.5 w-4 h-4 text-red-400" />
                  <input
                    type="text"
                    value={faction}
                    onChange={(e) => setFaction(e.target.value)}
                    placeholder="Ex: OS MANOS, BALA NA CARA, CV, PCC, INDEPENDENTE"
                    className="w-full bg-[#111625] border border-[#1e273d] hover:border-red-500/50 focus:border-red-500 text-white text-xs rounded-lg pl-9 pr-3.5 py-2.5 outline-none transition-all placeholder:text-[#404f76] font-mono uppercase"
                  />
                </div>
              </div>

              {/* Data de Nascimento & Nome da Mãe */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                    Data de Nascimento
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[#404f76]" />
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none transition-all uppercase font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                    Nome da Mãe
                  </label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Filiação materna"
                    className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg px-3.5 py-2.5 outline-none transition-all placeholder:text-[#404f76]"
                  />
                </div>
              </div>

              {/* FOTO DE IDENTIFICAÇÃO CARD */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  Foto de Identificação
                </label>
                
                <div className="bg-[#111625]/60 border border-[#1e273d] rounded-xl p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                    
                    {/* Picture preview container */}
                    <div className="sm:col-span-4 flex justify-center">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-28 h-32 rounded-lg border-2 border-dashed border-[#1e273d] hover:border-blue-500/40 bg-[#0b0e17] flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group"
                        title="Clique para carregar uma imagem ou use Ctrl+V para colar"
                      >
                        {customPhotoUrl ? (
                          <div className="relative w-full h-full">
                            <img
                              src={customPhotoUrl}
                              alt="Suspeito"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-rose-400 text-xs font-bold gap-1">
                              <Trash2 className="w-4 h-4" />
                              <span>Remover</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-[#404f76] p-2 text-center">
                            <Camera className="w-8 h-8 stroke-[1.5] mb-1.5" />
                            <span className="text-[9px] font-mono leading-tight">ANEXAR PERFIL</span>
                            <span className="text-[8px] text-zinc-500 font-sans mt-1 uppercase tracking-tight">(OU CTRL+V)</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Photo upload action selectors */}
                    <div className="sm:col-span-8 space-y-3">
                      
                      {/* Live webcam feed inside the photo card if active */}
                      {showCameraStream ? (
                        <div className="flex flex-col gap-2 bg-[#090c15] p-2 rounded-lg border border-[#1e273d]">
                          <div className="relative aspect-[4/3] bg-black rounded overflow-hidden">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[9px] uppercase tracking-wider py-1 px-3 rounded flex items-center gap-1 transition-all"
                            >
                              <Camera className="w-3 h-3" />
                              Capturar
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="bg-[#1c1c26] hover:bg-white/5 text-zinc-400 hover:text-white font-bold text-[9px] uppercase tracking-wider py-1 px-3 rounded flex items-center gap-1 transition-all border border-white/5"
                            >
                              <CameraOff className="w-3 h-3" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            {/* Arquivo Button */}
                            <button
                              type="button"
                              onClick={() => {
                                fileInputRef.current?.click();
                                stopCamera();
                              }}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-[#161d30] hover:bg-[#1f2842] border border-[#242f4c] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
                            >
                              <Upload className="w-3.5 h-3.5 text-blue-400" />
                              <span>ARQUIVO</span>
                            </button>
                            
                            {/* Câmera Button */}
                            <button
                              type="button"
                              onClick={startCamera}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-[#161d30] hover:bg-[#1f2842] border border-[#242f4c] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
                            >
                              <Camera className="w-3.5 h-3.5 text-emerald-400" />
                              <span>CÂMERA</span>
                            </button>
                          </div>

                          {/* Image URL Input */}
                          <div className="relative mt-1">
                            <Link className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#404f76]" />
                            <input
                              type="text"
                              value={customPhotoUrl}
                              onChange={(e) => {
                                setCustomPhotoUrl(e.target.value);
                                setUseCustomPhoto(true);
                              }}
                              placeholder="URL ou link da imagem (opcional)..."
                              className="w-full bg-[#0b0e17] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg pl-9 pr-3 py-2 outline-none transition-all placeholder:text-[#404f76]"
                            />
                          </div>

                          {/* Helper Info for Paste */}
                          <div className="text-[10px] text-zinc-500 bg-[#090c15] border border-[#1e273d] p-2 rounded-lg flex items-start gap-1.5">
                            <Clipboard className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                            <span>
                              Dica: você pode copiar uma imagem de qualquer site ou pasta e pressionar <kbd className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded font-mono text-[9px] border border-zinc-700">Ctrl + V</kbd> para colar diretamente.
                            </span>
                          </div>
                        </div>
                      )}

                      {cameraError && (
                        <p className="text-[9px] text-rose-400 font-mono mt-1">{cameraError}</p>
                      )}
                    </div>

                  </div>
                </div>
              </div>

            </div>

            {/* COLUMN 2: DADOS CRIMINAIS & INTELIGÊNCIA */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#1e273d] pb-2">
                <span className="text-[#f5a623] text-lg font-bold">—</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5a623] font-sans">
                  DADOS CRIMINAIS & INTELIGÊNCIA
                </h3>
              </div>

              {/* Antecedentes Gerais */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                  Antecedentes Gerais
                </label>
                <textarea
                  rows={3}
                  value={antecedentes}
                  onChange={(e) => setAntecedentes(e.target.value)}
                  placeholder="Lista de antecedentes criminais históricos..."
                  className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-amber-500 text-zinc-300 text-xs rounded-lg px-3.5 py-2 outline-none transition-all placeholder:text-[#404f76] font-sans"
                />
              </div>

              {/* Características / Tatuagens */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                  Características / Tatuagens
                </label>
                <textarea
                  rows={3}
                  value={tattoosScars}
                  onChange={(e) => setTattoosScars(e.target.value)}
                  placeholder="Descrição física, marcas, tatuagens..."
                  className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-amber-500 text-zinc-300 text-xs rounded-lg px-3.5 py-2 outline-none transition-all placeholder:text-[#404f76] font-sans"
                />
              </div>

              {/* Observações Gerais */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                  Observações Gerais
                </label>
                <textarea
                  rows={2}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Notas internas da agência..."
                  className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-amber-500 text-zinc-300 text-xs rounded-lg px-3.5 py-2 outline-none transition-all placeholder:text-[#404f76] font-sans"
                />
              </div>

              {/* Crimes Frequentes */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                  Crimes Frequentes
                </label>
                <input
                  type="text"
                  value={frequentCrimes}
                  onChange={(e) => setFrequentCrimes(e.target.value)}
                  placeholder="Ex: Tráfico, Roubo, Furto..."
                  className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-amber-500 text-white text-xs rounded-lg px-3.5 py-2.5 outline-none transition-all placeholder:text-[#404f76]"
                />
              </div>

              {/* Último Endereço */}
              <div>
                <label className="block text-[10px] font-bold text-[#5d7290] uppercase tracking-wider mb-1.5 font-mono">
                  Último Endereço
                </label>
                <input
                  type="text"
                  value={lastKnownAddress}
                  onChange={(e) => setLastKnownAddress(e.target.value)}
                  placeholder="Último endereço conhecido"
                  className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-amber-500 text-white text-xs rounded-lg px-3.5 py-2.5 outline-none transition-all placeholder:text-[#404f76]"
                />
              </div>

            </div>

          </div>

          {/* ARQUIVO DE FOTOS OPERACIONAIS (GALERIA) */}
          <div className="space-y-4 pt-2 border-t border-[#1e273d]">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 font-sans">
                ARQUIVO DE FOTOS OPERACIONAIS (GALERIA)
              </h3>
            </div>

            <div className="bg-[#111625]/60 border border-[#1e273d] rounded-xl p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Data da Foto */}
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
                    Data da Foto
                  </label>
                  <input
                    type="date"
                    value={galleryPhotoDate}
                    onChange={(e) => setGalleryPhotoDate(e.target.value)}
                    className="w-full bg-[#111625] border border-[#1e273d] hover:border-[#2b395c] focus:border-blue-500 text-white text-xs rounded-lg px-3 py-2.5 outline-none uppercase font-mono"
                  />
                </div>

                {/* Actions (Arquivo, Câmera, Colar) */}
                <div className="md:col-span-6 grid grid-cols-3 gap-2">
                  {/* Hidden Input for File Browser */}
                  <input
                    type="file"
                    ref={galleryFileInputRef}
                    onChange={handleGalleryFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {/* Arquivo Button */}
                  <button
                    type="button"
                    onClick={() => {
                      galleryFileInputRef.current?.click();
                      stopGalleryCamera();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#161d30] hover:bg-[#1f2842] border border-[#242f4c] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span>ARQUIVO</span>
                  </button>
                  
                  {/* Câmera Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (showGalleryCamera) {
                        stopGalleryCamera();
                      } else {
                        startGalleryCamera();
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 border text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                      showGalleryCamera 
                        ? "bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/30 text-rose-400" 
                        : "bg-[#161d30] hover:bg-[#1f2842] border-[#242f4c]"
                    }`}
                  >
                    <Camera className={`w-3.5 h-3.5 ${showGalleryCamera ? "text-rose-400 animate-pulse" : "text-emerald-400"}`} />
                    <span>CÂMERA</span>
                  </button>

                  {/* Colar Button */}
                  <button
                    type="button"
                    onClick={handleGalleryAutoPaste}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#161d30] hover:bg-[#1f2842] border border-[#242f4c] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
                    title="Colar imagem da área de transferência"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-amber-400" />
                    <span>COLAR</span>
                  </button>
                </div>

                {/* Add Button */}
                <div className="md:col-span-3">
                  <button
                    type="button"
                    onClick={handleAddGalleryPhoto}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2563eb] hover:bg-blue-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all shadow-lg shadow-blue-500/10"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ADD FOTO</span>
                  </button>
                </div>
              </div>

              {/* Live webcam feed specifically for gallery */}
              {showGalleryCamera && (
                <div className="mt-4 flex flex-col gap-2 bg-[#090c15] p-3 rounded-lg border border-[#1e273d]">
                  <div className="relative aspect-[4/3] max-w-sm mx-auto bg-black rounded overflow-hidden border border-white/5">
                    <video
                      ref={galleryVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={captureGalleryPhoto}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capturar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopGalleryCamera}
                      className="bg-[#1c1c26] hover:bg-white/5 text-zinc-400 hover:text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all border border-white/5"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  </div>
                  {galleryCameraError && (
                    <p className="text-[10px] text-rose-400 font-mono text-center mt-1">{galleryCameraError}</p>
                  )}
                </div>
              )}

              {/* Paste helper overlay/dialog */}
              {isPastingGallery && (
                <div className="mt-4 p-5 bg-[#090c15] border border-blue-500/30 rounded-xl flex flex-col items-center justify-center text-center gap-3 relative animate-fadeIn">
                  <button 
                    type="button" 
                    onClick={() => setIsPastingGallery(false)}
                    className="absolute top-2.5 right-2.5 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <Clipboard className="w-8 h-8 text-amber-400 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                      ÁREA DE COLAGEM OPERACIONAL
                    </h4>
                    <p className="text-[10px] text-zinc-400 mt-1 max-w-sm leading-relaxed">
                      Selecione/clique no campo de texto abaixo e pressione <kbd className="bg-[#161d30] text-blue-400 px-1.5 py-0.5 rounded border border-[#242f4c] font-mono text-[9px] font-bold">Ctrl + V</kbd> para colar a foto copiada.
                    </p>
                  </div>
                  
                  <textarea
                    autoFocus
                    placeholder="Clique aqui e aperte Ctrl+V para colar a foto"
                    className="w-full max-w-md h-12 bg-[#050507] border border-[#1e273d] focus:border-blue-500/50 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none resize-none overflow-hidden text-center placeholder-zinc-600 font-sans"
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (items) {
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf("image") !== -1) {
                            const file = items[i].getAsFile();
                            if (file) {
                              e.preventDefault();
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  setGalleryTempPhotoUrl(event.target.result as string);
                                  setIsPastingGallery(false);
                                }
                              };
                              reader.readAsDataURL(file);
                              return;
                            }
                          }
                        }
                      }
                      alert("Nenhuma imagem detectada no conteúdo colado. Certifique-se de copiar uma imagem primeiro!");
                    }}
                  />
                </div>
              )}

              {/* Temp Selected Photo Preview */}
              {galleryTempPhotoUrl && (
                <div className="mt-4 bg-[#0d1222] border border-blue-500/20 p-3 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#050507] overflow-hidden border border-[#1e273d] shrink-0">
                      <img
                        src={galleryTempPhotoUrl}
                        alt="Preview operacional"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-zinc-400 block uppercase">IMAGEM SELECIONADA</span>
                      <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Pronta para ser adicionada</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGalleryTempPhotoUrl("")}
                    className="bg-transparent hover:bg-rose-500/10 text-rose-400 p-2 rounded-lg transition-colors border border-rose-500/10"
                    title="Limpar imagem"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* List of already added photos */}
              {localPhotoHistory.length > 0 && (
                <div className="mt-5 border-t border-[#1e273d]/60 pt-4">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3 font-mono">
                    Fotos Operacionais Registradas ({localPhotoHistory.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {localPhotoHistory.map((photo, idx) => (
                      <div 
                        key={photo.id ? `photo-${photo.id}-${idx}` : `photo-${idx}`}
                        className="bg-[#090c15] border border-[#1e273d] rounded-xl overflow-hidden relative group aspect-square flex flex-col justify-between"
                      >
                        <div className="relative flex-1 h-0 min-h-[90px]">
                          <img 
                            src={photo.url} 
                            alt="Foto operacional" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {/* Delete button overlay */}
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryPhoto(photo.id)}
                            className="absolute top-1.5 right-1.5 bg-black/80 hover:bg-rose-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
                            title="Remover da galeria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="bg-[#111625] px-2 py-1 text-center border-t border-[#1e273d]">
                          <span className="text-[9px] font-mono font-bold text-zinc-400">
                            {photo.date ? new Date(photo.date + "T00:00:00").toLocaleDateString("pt-BR") : "S/ Data"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pt-4 border-t border-[#1e273d] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white font-bold uppercase tracking-wider text-[11px] rounded-lg px-5 py-2.5 transition-all border border-[#1e273d]"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#2563eb] hover:bg-blue-500 text-white font-bold uppercase tracking-wider text-[11px] rounded-lg px-6 py-2.5 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {saving ? (
                <span className="border-2 border-white/20 border-t-white rounded-full w-4 h-4 animate-spin"></span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>SALVAR CADASTRO</span>
                </>
              )}
            </button>
          </div>

        </form>

      </motion.div>

      {/* CONFIRMATION MODAL ON DUPLICATE SUBMIT */}
      <AnimatePresence>
        {showDuplicateConfirmModal && (
          <div
            id="duplicate-confirm-modal-overlay"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-xl bg-[#0c101d] border border-rose-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="bg-rose-950/40 border-b border-rose-500/30 p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 animate-pulse">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded uppercase">
                      Alerta Crítico de Inteligência
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white uppercase tracking-tight mt-1 font-sans">
                    Possível Cadastro em Duplicidade Detectado
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Os dados informados coincidem diretamente com registro(s) já existente(s) no sistema.
                  </p>
                </div>
              </div>

              {/* Body: Matches Details */}
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="text-xs text-zinc-300">
                  Verifique o(s) cadastro(s) abaixo antes de prosseguir para evitar registros duplicados no banco de dados:
                </div>

                <div className="space-y-3">
                  {duplicateResult.matches.map((match, idx) => {
                    const matchedSuspect = match.suspect;
                    const photoUrl = matchedSuspect.photos?.[0] || DEFAULT_MUGSHOTS.mugshot1;
                    return (
                      <div
                        key={`modal-match-${matchedSuspect.id || idx}`}
                        className="bg-[#111625] border border-[#202b44] rounded-xl p-4 flex flex-col sm:flex-row items-start gap-4"
                      >
                        <div className="w-16 h-16 rounded-xl bg-black overflow-hidden border border-white/10 shrink-0 relative">
                          <img
                            src={photoUrl}
                            alt={matchedSuspect.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white uppercase">
                              {matchedSuspect.name}
                            </h4>
                            {matchedSuspect.alias && (
                              <span className="text-[11px] font-mono text-amber-400 font-bold">
                                "{matchedSuspect.alias}"
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11px] font-mono text-zinc-400">
                            <div>
                              <span>CPF/RG: </span>
                              <strong className="text-zinc-200">{matchedSuspect.document || "Não informado"}</strong>
                            </div>
                            <div>
                              <span>Facção: </span>
                              <strong className="text-red-400">{matchedSuspect.faction || "Sem facção"}</strong>
                            </div>
                            <div>
                              <span>Município: </span>
                              <strong className="text-zinc-200">{matchedSuspect.municipio || "Não informado"}</strong>
                            </div>
                            <div>
                              <span>Mãe: </span>
                              <strong className="text-zinc-200">{matchedSuspect.motherName || "Não informada"}</strong>
                            </div>
                          </div>

                          {/* Motivo do alerta */}
                          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                            {match.reasons.map((reason, rIdx) => (
                              <span
                                key={`m-reason-${rIdx}`}
                                className="text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200 leading-relaxed">
                    Se for a <strong>mesma pessoa</strong>, recomendamos abrir o cadastro existente e atualizá-lo. Se for um <strong>homônimo</strong> (outra pessoa com mesmo nome), você pode confirmar o cadastro normalmente.
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-[#080b14] border-t border-[#1e273d] p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-stretch justify-end gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowDuplicateConfirmModal(false)}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg uppercase tracking-wider transition-all order-last sm:order-first"
                  >
                    Voltar e Revisar
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setShowDuplicateConfirmModal(false);
                      setAcknowledgedDuplicate(true);
                      await executeSave();
                    }}
                    className="px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
                    title="Confirmar que é outra pessoa (homônimo) e salvar novo cadastro independente"
                  >
                    Confirmar Mesmo Assim (Homônimo)
                  </button>

                  {duplicateResult.matches[0] && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectExistingToEdit(duplicateResult.matches[0].suspect, true);
                        }}
                        className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
                        title="Vincular ao cadastro existente e abrir campo para incluir novas informações e anotações"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Incluir Informações</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelectExistingToEdit(duplicateResult.matches[0].suspect, false);
                        }}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                        title="Vincular e carregar este cadastro para edição completa"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Editar Cadastro Existente</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK PREVIEW MODAL FOR MATCHED SUSPECT */}
      <AnimatePresence>
        {previewSuspect && (
          <div
            id="preview-suspect-modal-overlay"
            className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0c101d] border border-[#202b44] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Preview Header */}
              <div className="bg-[#080b14] border-b border-[#1e273d] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                      Ficha de Inteligência: {previewSuspect.name}
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-400">
                      ID: {previewSuspect.id} • Cadastrado em {new Date(previewSuspect.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewSuspect(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preview Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  <div className="w-32 h-36 rounded-xl bg-black border border-[#1e273d] overflow-hidden shrink-0 relative shadow-inner">
                    <img
                      src={previewSuspect.photos?.[0] || DEFAULT_MUGSHOTS.mugshot1}
                      alt={previewSuspect.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight font-sans">
                      {previewSuspect.name}
                    </h2>
                    {previewSuspect.alias && (
                      <div className="text-xs font-mono text-amber-400 font-bold">
                        VULGO: "{previewSuspect.alias}"
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
                      <div className="bg-[#111625] p-2 rounded-lg border border-[#1e273d]">
                        <span className="text-zinc-500 text-[10px] block uppercase">CPF / RG</span>
                        <span className="text-white font-bold">{previewSuspect.document || "Não informado"}</span>
                      </div>
                      <div className="bg-[#111625] p-2 rounded-lg border border-[#1e273d]">
                        <span className="text-zinc-500 text-[10px] block uppercase">Facção</span>
                        <span className="text-red-400 font-bold">{previewSuspect.faction || "Sem facção"}</span>
                      </div>
                      <div className="bg-[#111625] p-2 rounded-lg border border-[#1e273d]">
                        <span className="text-zinc-500 text-[10px] block uppercase">Município</span>
                        <span className="text-white font-bold">{previewSuspect.municipio || "Não informado"}</span>
                      </div>
                      <div className="bg-[#111625] p-2 rounded-lg border border-[#1e273d]">
                        <span className="text-zinc-500 text-[10px] block uppercase">Mãe</span>
                        <span className="text-white font-bold">{previewSuspect.motherName || "Não informada"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {previewSuspect.antecedentes && (
                  <div className="bg-[#111625] border border-[#1e273d] rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1 font-mono">
                      Antecedentes Criminais
                    </span>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap">{previewSuspect.antecedentes}</p>
                  </div>
                )}

                {previewSuspect.tattoosScars && (
                  <div className="bg-[#111625] border border-[#1e273d] rounded-xl p-3.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1 font-mono">
                      Características / Tatuagens
                    </span>
                    <p className="text-xs text-zinc-300">{previewSuspect.tattoosScars}</p>
                  </div>
                )}
              </div>

              {/* Preview Footer */}
              <div className="bg-[#080b14] border-t border-[#1e273d] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewSuspect(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
                >
                  Fechar
                </button>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectExistingToEdit(previewSuspect, true);
                    }}
                    className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Incluir Informações</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectExistingToEdit(previewSuspect, false);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Editar Cadastro</span>
                  </button>

                  {onOpenExistingSuspect && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewSuspect(null);
                        onOpenExistingSuspect(previewSuspect);
                      }}
                      className="px-3 py-2 bg-[#1e273d] hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Painel</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
