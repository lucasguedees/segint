import React, { useState, useRef, useEffect } from "react";
import { Occurrence, Suspect, InvolvedPerson, OccurrenceSeverity, OccurrenceStatus } from "../types";
import {
  X,
  Calendar,
  MapPin,
  Shield,
  FileText,
  Package,
  Camera,
  Upload,
  Clipboard,
  Plus,
  Search,
  User,
  UserPlus,
  Save,
  Trash2,
  ImageIcon,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion } from "motion/react";
import { compressImageFile, compressBase64Image } from "../utils/imageOptimizer";

interface OccurrenceFormModalProps {
  editingOccurrence?: Occurrence | null;
  suspects: Suspect[];
  currentUser: { name: string };
  onClose: () => void;
  onSave: (payload: Partial<Occurrence>) => Promise<void>;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

export default function OccurrenceFormModal({
  editingOccurrence,
  suspects,
  currentUser,
  onClose,
  onSave,
  showToast,
}: OccurrenceFormModalProps) {
  // Parse initial location into municipio & address if available
  const parseLocation = (locStr: string = "") => {
    if (!locStr) return { municipio: "LAJEADO", localExato: "" };
    if (locStr.includes("•")) {
      const parts = locStr.split("•").map((p) => p.trim());
      return { municipio: parts[0] || "LAJEADO", localExato: parts.slice(1).join(" • ") };
    }
    return { municipio: "LAJEADO", localExato: locStr };
  };

  const initialLoc = parseLocation(editingOccurrence?.location || "");

  // Left Column States (Dados Gerais)
  const [date, setDate] = useState<string>(
    editingOccurrence?.date || new Date().toISOString().split("T")[0]
  );
  const [municipio, setMunicipio] = useState<string>(initialLoc.municipio);
  const [title, setTitle] = useState<string>(editingOccurrence?.title || "");
  const [localExato, setLocalExato] = useState<string>(initialLoc.localExato);
  const [historico, setHistorico] = useState<string>(
    editingOccurrence?.description || ""
  );
  const [materialApreendido, setMaterialApreendido] = useState<string>("");
  const [observacoesTatuagens, setObservacoesTatuagens] = useState<string>("");

  // Media States
  const [coverPhoto, setCoverPhoto] = useState<string>(
    editingOccurrence?.photoUrl || ""
  );
  const [extraPhotos, setExtraPhotos] = useState<string[]>(
    editingOccurrence?.photos || []
  );
  const [extraPhotoInput, setExtraPhotoInput] = useState<string>("");

  // Right Column States (Identificação de Envolvidos / Presos)
  const [suspectSearchQuery, setSuspectSearchQuery] = useState<string>("");
  const [isSearchingSuspects, setIsSearchingSuspects] = useState<boolean>(false);

  // Manual Envolvido Fields
  const [manualName, setManualName] = useState<string>("");
  const [manualVulgo, setManualVulgo] = useState<string>("");
  const [manualDoc, setManualDoc] = useState<string>("");
  const [manualAntecedentes, setManualAntecedentes] = useState<string>("");
  const [manualPhoto, setManualPhoto] = useState<string>("");

  // Added Involved People List
  const [involvedPeople, setInvolvedPeople] = useState<InvolvedPerson[]>(
    editingOccurrence?.involvedPeople || [
      ...(editingOccurrence?.envolvidoName
        ? [
            {
              id: `p-${Date.now()}`,
              name: editingOccurrence.envolvidoName,
              vulgo: editingOccurrence.vulgo || "N/I",
              document: "Doc: N/I",
              photoUrl: editingOccurrence.photoUrl || "",
            },
          ]
        : []),
    ]
  );

  const [selectedSuspectIds, setSelectedSuspectIds] = useState<string[]>(
    editingOccurrence?.relatedSuspects || []
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Hidden File Inputs
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);
  const envolvidoFileInputRef = useRef<HTMLInputElement>(null);

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
                setManualPhoto(optimized);
                if (showToast) showToast("Foto do envolvido colada e otimizada!", "success");
              }
              return;
            }
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, [showToast]);

  // File Upload Handlers
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const optimized = await compressImageFile(file, 800, 800, 0.78);
      if (optimized) {
        setter(optimized);
      }
    }
  };

  const handleExtraFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const optimized = await compressImageFile(file, 800, 800, 0.78);
      if (optimized) {
        setExtraPhotos((prev) => [...prev, optimized]);
      }
    }
  };

  const handlePasteClipboard = async (setter: (val: string) => void) => {
    try {
      // 1. Try reading direct binary image from Clipboard API
      if (navigator.clipboard && typeof navigator.clipboard.read === "function") {
        try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
            const imageType = item.types.find((t) => t.startsWith("image/"));
            if (imageType) {
              const blob = await item.getType(imageType);
              const file = new File([blob], "clipboard.jpg", { type: blob.type });
              const optimized = await compressImageFile(file, 800, 800, 0.78);
              if (optimized) {
                setter(optimized);
                if (showToast) showToast("Imagem colada com sucesso!", "success");
                return;
              }
            }
          }
        } catch (err) {
          console.log("Clipboard read() blocked/unsupported, falling back to readText()", err);
        }
      }

      // 2. Fallback to text (URL or base64)
      if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const trimmed = text.trim();
          if (trimmed.startsWith("data:image")) {
            const optimized = await compressBase64Image(trimmed, 800, 800, 0.78);
            setter(optimized);
          } else {
            setter(trimmed);
          }
          if (showToast) showToast("Link da imagem colado com sucesso!", "info");
          return;
        }
      }

      if (showToast) showToast("Nenhuma imagem ou link encontrado na área de transferência.", "info");
    } catch (err) {
      console.error("Paste error:", err);
      if (showToast) showToast("Não foi possível colar automaticamente. Use Ctrl+V no campo de texto.", "error");
    }
  };

  const handleInputPaste = (
    e: React.ClipboardEvent<HTMLElement>,
    setter: (val: string) => void
  ) => {
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
                setter(event.target.result as string);
                if (showToast) showToast("Imagem colada da área de transferência!", "success");
              }
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    }
  };

  const handleAddExtraPhoto = () => {
    if (extraPhotoInput.trim()) {
      setExtraPhotos((prev) => [...prev, extraPhotoInput.trim()]);
      setExtraPhotoInput("");
    }
  };

  const handleRemoveExtraPhoto = (index: number) => {
    setExtraPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Add Manual Envolvido
  const handleAddManualEnvolvido = () => {
    if (!manualName.trim()) {
      if (showToast) showToast("Digite o Nome Completo do envolvido.", "info");
      return;
    }

    const newPerson: InvolvedPerson = {
      id: `p-${Date.now()}`,
      name: manualName.trim().toUpperCase(),
      vulgo: manualVulgo.trim() ? manualVulgo.trim().toUpperCase() : "N/I",
      document: manualDoc.trim() ? `Doc: ${manualDoc.trim()}` : "Doc: N/I",
      photoUrl: manualPhoto.trim() || undefined,
    };

    setInvolvedPeople((prev) => [...prev, newPerson]);

    // Reset manual form
    setManualName("");
    setManualVulgo("");
    setManualDoc("");
    setManualAntecedentes("");
    setManualPhoto("");

    if (showToast) showToast("Envolvido adicionado à lista.", "success");
  };

  // Select Suspect from Database Search
  const handleSelectSuspect = (suspect: Suspect) => {
    // Add to selectedSuspectIds if not present
    if (!selectedSuspectIds.includes(suspect.id)) {
      setSelectedSuspectIds((prev) => [...prev, suspect.id]);
    }

    // Add to involvedPeople if not present
    const exists = involvedPeople.some(
      (p) => p.name.toLowerCase() === suspect.name.toLowerCase()
    );

    if (!exists) {
      setInvolvedPeople((prev) => [
        ...prev,
        {
          id: suspect.id,
          name: suspect.name.toUpperCase(),
          vulgo: suspect.alias ? suspect.alias.toUpperCase() : "N/I",
          document: suspect.document ? `Doc: ${suspect.document}` : "Doc: N/I",
          photoUrl: suspect.photos?.[0] || "",
        },
      ]);
    }

    setSuspectSearchQuery("");
    setIsSearchingSuspects(false);
    if (showToast) showToast(`Suspeito "${suspect.name}" vinculado.`, "success");
  };

  const handleRemoveInvolved = (id?: string, index?: number) => {
    setInvolvedPeople((prev) => prev.filter((p, i) => (id ? p.id !== id : i !== index)));
    if (id) {
      setSelectedSuspectIds((prev) => prev.filter((sId) => sId !== id));
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      if (showToast) showToast("Informe a Natureza / Fato Principal.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build full location string (Município • Local Exato)
      const fullLocation = municipio.trim()
        ? `${municipio.trim().toUpperCase()} • ${localExato.trim().toUpperCase()}`
        : localExato.trim().toUpperCase() || "LAJEADO - RS";

      // Build full description text
      let fullDescription = historico.trim();
      if (materialApreendido.trim()) {
        fullDescription += `\n\n[MATERIAL APREENDIDO]\n${materialApreendido.trim()}`;
      }
      if (observacoesTatuagens.trim()) {
        fullDescription += `\n\n[OBSERVAÇÕES DE TATUAGENS/MARCAS]\n${observacoesTatuagens.trim()}`;
      }

      // Primary envolvido name and vulgo
      const primaryInvolved = involvedPeople[0];
      const primaryName = primaryInvolved?.name || "";
      const primaryVulgo = primaryInvolved?.vulgo && primaryInvolved.vulgo !== "N/I" ? primaryInvolved.vulgo : "";
      const primaryPhoto = coverPhoto || primaryInvolved?.photoUrl || "";

      const payload: Partial<Occurrence> = {
        title: title.trim().toUpperCase(),
        description: fullDescription || "Sem histórico detalhado informado.",
        location: fullLocation,
        date,
        time: editingOccurrence?.time || new Date().toTimeString().slice(0, 5),
        severity: editingOccurrence?.severity || "high",
        status: editingOccurrence?.status || "open",
        envolvidoName: primaryName,
        vulgo: primaryVulgo,
        photoUrl: primaryPhoto,
        photos: extraPhotos.length > 0 ? extraPhotos : primaryPhoto ? [primaryPhoto] : [],
        involvedPeople,
        relatedSuspects: selectedSuspectIds,
        hasMaterial: !!materialApreendido.trim(),
        agentInCharge: editingOccurrence?.agentInCharge || currentUser.name,
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
      if (showToast) showToast("Erro ao salvar o registro de ocorrência.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Suspects search filtering
  const matchingSuspects = suspectSearchQuery.trim()
    ? suspects.filter(
        (s) =>
          s.name.toLowerCase().includes(suspectSearchQuery.toLowerCase()) ||
          s.alias.toLowerCase().includes(suspectSearchQuery.toLowerCase()) ||
          s.document.toLowerCase().includes(suspectSearchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80"
      />

      {/* Main Modal Window (Exact Screenshot Design) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-6xl bg-[#0b0f19] border border-[#1b263b] rounded-[24px] shadow-[0_25px_80px_rgba(0,0,0,0.95)] text-white flex flex-col max-h-[94vh] overflow-hidden my-auto"
      >
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={coverFileInputRef}
          onChange={(e) => handleFileUpload(e, setCoverPhoto)}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={extraFileInputRef}
          onChange={handleExtraFileUpload}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={envolvidoFileInputRef}
          onChange={(e) => handleFileUpload(e, setManualPhoto)}
          accept="image/*"
          className="hidden"
        />

        {/* Modal Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#182338] bg-[#090d16] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#141b2d] border border-[#233150] flex items-center justify-center text-amber-500 shadow-inner">
              <Package className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase font-sans leading-none">
                {editingOccurrence ? "EDITAR OCORRÊNCIA / PRISÃO" : "NOVA OCORRÊNCIA / PRISÃO"}
              </h2>
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mt-1">
                PROCEDIMENTO DE INTELIGÊNCIA
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#121929] hover:bg-[#1a243b] border border-[#212e4a] text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable 2 Columns Grid */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ================= LEFT COLUMN: DADOS GERAIS (Col 6) ================= */}
            <div className="lg:col-span-6 space-y-5">
              
              {/* Row 1: DATA DO FATO & MUNICÍPIO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                    DATA DO FATO
                  </label>
                  <div className="relative flex items-center">
                    <Calendar className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl py-3 pl-10 pr-3 text-xs text-white font-mono uppercase focus:border-blue-500 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                    MUNICÍPIO
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      placeholder="Ex: BELO HORIZONTE"
                      className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl py-3 pl-10 pr-3 text-xs text-white font-mono uppercase focus:border-blue-500 focus:outline-none transition-all shadow-inner placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* NATUREZA / FATO PRINCIPAL */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                  NATUREZA / FATO PRINCIPAL
                </label>
                <div className="relative flex items-center">
                  <Shield className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: TRÁFICO DE DROGAS / POSSE DE ARMA"
                    className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl py-3 pl-10 pr-3 text-xs font-black text-white font-mono uppercase focus:border-blue-500 focus:outline-none transition-all shadow-inner placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* LOCAL DO FATO */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                  LOCAL DO FATO
                </label>
                <input
                  type="text"
                  value={localExato}
                  onChange={(e) => setLocalExato(e.target.value)}
                  placeholder="Rua, Número, Bairro, Referência"
                  className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl py-3 px-3.5 text-xs text-white font-mono uppercase focus:border-blue-500 focus:outline-none transition-all shadow-inner placeholder:text-zinc-600"
                />
              </div>

              {/* HISTÓRICO */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                  HISTÓRICO
                </label>
                <textarea
                  rows={4}
                  value={historico}
                  onChange={(e) => setHistorico(e.target.value)}
                  placeholder="Relato sucinto da operação..."
                  className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl p-3.5 text-xs text-zinc-200 font-sans focus:border-blue-500 focus:outline-none transition-all shadow-inner placeholder:text-zinc-600 resize-none"
                />
              </div>

              {/* MATERIAL APREENDIDO */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                  MATERIAL APREENDIDO
                </label>
                <textarea
                  rows={3}
                  value={materialApreendido}
                  onChange={(e) => setMaterialApreendido(e.target.value)}
                  placeholder={"01 PT .40 S&W\n15 MUNIÇÕES"}
                  className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl p-3.5 text-xs text-zinc-200 font-mono uppercase focus:border-blue-500 focus:outline-none transition-all shadow-inner placeholder:text-zinc-600 resize-none leading-relaxed"
                />
              </div>

              {/* OBSERVAÇÕES DE TATUAGENS / MARCAS */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                  OBSERVAÇÕES DE TATUAGENS / MARCAS
                </label>
                <textarea
                  rows={2}
                  value={observacoesTatuagens}
                  onChange={(e) => setObservacoesTatuagens(e.target.value)}
                  placeholder="Tatuagens de palhaço, carpa, etc..."
                  className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl p-3.5 text-xs text-zinc-200 font-sans focus:border-blue-500 focus:outline-none transition-all shadow-inner placeholder:text-zinc-600 resize-none"
                />
              </div>

              {/* MÍDIA DA OPERAÇÃO (FOTOS DIVERSAS) */}
              <div className="bg-[#0e1423] border border-[#1c2944] rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-zinc-300 font-mono font-black text-xs uppercase tracking-wider">
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  <span>MÍDIA DA OPERAÇÃO (FOTOS DIVERSAS)</span>
                </div>

                {/* FOTO DE CAPA DA OCORRÊNCIA */}
                <div className="bg-[#090e18] border border-[#1a253d] rounded-xl p-3.5 flex items-center gap-4">
                  <div
                    onClick={() => coverFileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl bg-[#121a2c] border-2 border-dashed border-[#233352] hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all shrink-0 group relative"
                  >
                    {coverPhoto ? (
                      <img
                        src={coverPhoto}
                        alt="Capa"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-6 h-6 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-white uppercase font-sans tracking-wide">
                      FOTO DE CAPA DA OCORRÊNCIA
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-sans mt-0.5 leading-snug">
                      Clique para anexar a foto principal (Ex: Material Apreendido).
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => coverFileInputRef.current?.click()}
                        className="bg-[#18233b] hover:bg-[#202d4b] text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase font-bold transition-all border border-[#27385c]"
                      >
                        ARQUIVO
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePasteClipboard(setCoverPhoto)}
                        className="bg-[#18233b] hover:bg-[#202d4b] text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase font-bold transition-all border border-[#27385c]"
                      >
                        COLAR
                      </button>
                      {coverPhoto && (
                        <button
                          type="button"
                          onClick={() => setCoverPhoto("")}
                          className="text-rose-400 hover:text-rose-300 text-[10px] font-mono uppercase font-bold ml-auto"
                        >
                          REMOVER
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* GALERIA DE FOTOS EXTRAS */}
                <div className="space-y-2 pt-1">
                  <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                    GALERIA DE FOTOS EXTRAS
                  </label>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <input
                      type="text"
                      value={extraPhotoInput}
                      onChange={(e) => setExtraPhotoInput(e.target.value)}
                      onPaste={(e) => {
                        handleInputPaste(e, (url) => {
                          setExtraPhotos((prev) => [...prev, url]);
                          setExtraPhotoInput("");
                        });
                      }}
                      placeholder="URL da imagem ou cole (Ctrl+V)..."
                      className="flex-1 min-w-[140px] bg-[#090e18] border border-[#1a253d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => extraFileInputRef.current?.click()}
                      className="bg-[#162035] hover:bg-[#1e2c49] text-zinc-300 text-[10px] font-mono uppercase font-bold px-3 py-2 rounded-xl border border-[#233352] transition-all shrink-0"
                    >
                      ARQUIVO
                    </button>
                    <button
                      type="button"
                      onClick={() => extraFileInputRef.current?.click()}
                      className="bg-[#162035] hover:bg-[#1e2c49] text-zinc-300 text-[10px] font-mono uppercase font-bold px-3 py-2 rounded-xl border border-[#233352] transition-all shrink-0"
                    >
                      CÂMERA
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePasteClipboard(setExtraPhotoInput)}
                      className="bg-[#162035] hover:bg-[#1e2c49] text-zinc-300 text-[10px] font-mono uppercase font-bold px-3 py-2 rounded-xl border border-[#233352] transition-all shrink-0"
                    >
                      COLAR
                    </button>
                    <button
                      type="button"
                      onClick={handleAddExtraPhoto}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black font-mono uppercase px-3 py-2 rounded-xl transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      ADD
                    </button>
                  </div>

                  {/* Extra Photos Thumbnails Grid */}
                  {extraPhotos.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1">
                      {extraPhotos.map((photo, idx) => (
                        <div key={`extra-${idx}-${photo.length}`} className="relative w-14 h-14 rounded-xl border border-[#223252] overflow-hidden bg-[#070b13] shrink-0 group">
                          <img src={photo} alt={`Extra ${idx}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraPhoto(idx)}
                            className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ================= RIGHT COLUMN: IDENTIFICAÇÃO DE ENVOLVIDOS / PRESOS (Col 6) ================= */}
            <div className="lg:col-span-6 bg-[#0e1423] border border-[#1c2944] rounded-2xl p-5 space-y-5">
              
              {/* Header Title */}
              <div className="flex items-center gap-2 text-zinc-200 font-mono font-black text-xs uppercase tracking-wider pb-1 border-b border-[#1b2742]">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>IDENTIFICAÇÃO DE ENVOLVIDOS / PRESOS</span>
              </div>

              {/* Search Suspects Database */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={suspectSearchQuery}
                  onChange={(e) => {
                    setSuspectSearchQuery(e.target.value);
                    setIsSearchingSuspects(true);
                  }}
                  onFocus={() => setIsSearchingSuspects(true)}
                  placeholder="Buscar no banco de suspeitos..."
                  className="w-full bg-[#090e18] border border-[#1a253d] rounded-xl py-2.5 pl-10 pr-3 text-xs text-white font-mono focus:border-blue-500 focus:outline-none transition-all placeholder:text-zinc-600"
                />

                {/* Suspect Search Dropdown Results */}
                {isSearchingSuspects && suspectSearchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[#12192a] border border-[#233354] rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-white/5">
                    {matchingSuspects.length > 0 ? (
                      matchingSuspects.map((s, sIdx) => (
                        <div
                          key={`s-match-${s.id || "s"}-${sIdx}`}
                          onClick={() => handleSelectSuspect(s)}
                          className="p-3 hover:bg-[#1a253e] cursor-pointer flex items-center gap-3 transition-colors"
                        >
                          <img
                            src={s.photos?.[0] || "/placeholder-mugshot.jpg"}
                            alt={s.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-lg object-cover border border-[#253658]"
                          />
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-black text-white uppercase truncate">{s.name}</h5>
                            <p className="text-[10px] font-mono text-blue-400 uppercase">VULGO: {s.alias || "N/I"} | {s.document}</p>
                          </div>
                          <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-zinc-500 italic font-mono text-center uppercase">
                        Nenhum suspeito encontrado no banco.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-section: CADASTRO MANUAL DE ENVOLVIDO */}
              <div className="bg-[#090e18] border border-[#182338] rounded-xl p-4 space-y-3.5">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                  CADASTRO MANUAL DE ENVOLVIDO
                </span>

                {/* NOME COMPLETO */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-zinc-400 uppercase font-bold block">
                    NOME COMPLETO
                  </label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Nome do envolvido..."
                    className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl py-2.5 px-3 text-xs text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* ALCUNHA & RG/CPF */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-zinc-400 uppercase font-bold block">
                      ALCUNHA
                    </label>
                    <input
                      type="text"
                      value={manualVulgo}
                      onChange={(e) => setManualVulgo(e.target.value)}
                      placeholder="Vulgo/Apelido..."
                      className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl py-2.5 px-3 text-xs text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-zinc-400 uppercase font-bold block">
                      RG/CPF
                    </label>
                    <input
                      type="text"
                      value={manualDoc}
                      onChange={(e) => setManualDoc(e.target.value)}
                      placeholder="Documento..."
                      className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl py-2.5 px-3 text-xs text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* ANTECEDENTES DO ENVOLVIDO */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-zinc-400 uppercase font-bold block">
                    ANTECEDENTES DO ENVOLVIDO
                  </label>
                  <textarea
                    rows={2}
                    value={manualAntecedentes}
                    onChange={(e) => setManualAntecedentes(e.target.value)}
                    placeholder="Histórico ou antecedentes..."
                    className="w-full bg-[#101626] border border-[#1d2a45] rounded-xl p-2.5 text-xs text-zinc-200 font-sans focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>

                {/* FOTO DO ENVOLVIDO */}
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-mono text-zinc-400 uppercase font-bold block">
                    FOTO DO ENVOLVIDO
                  </label>

                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => envolvidoFileInputRef.current?.click()}
                      onPaste={(e) => handleInputPaste(e, setManualPhoto)}
                      tabIndex={0}
                      title="Clique para selecionar arquivo ou cole uma imagem (Ctrl+V)"
                      className="w-14 h-16 rounded-xl bg-[#101626] border border-[#202e4d] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-blue-500 transition-colors focus:outline-none focus:border-blue-500"
                    >
                      {manualPhoto ? (
                        <img src={manualPhoto} alt="Foto Envolvido" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => envolvidoFileInputRef.current?.click()}
                          className="bg-[#141d30] hover:bg-[#1c2944] text-zinc-300 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded-lg border border-[#233352] transition-all"
                        >
                          ARQUIVO
                        </button>
                        <button
                          type="button"
                          onClick={() => envolvidoFileInputRef.current?.click()}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-mono font-bold uppercase px-3 py-1.5 rounded-lg transition-all"
                        >
                          CÂMERA
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteClipboard(setManualPhoto)}
                          className="bg-[#141d30] hover:bg-[#1c2944] text-zinc-300 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded-lg border border-[#233352] transition-all"
                        >
                          COLAR
                        </button>
                      </div>

                      <input
                        type="text"
                        value={manualPhoto}
                        onChange={(e) => setManualPhoto(e.target.value)}
                        onPaste={(e) => handleInputPaste(e, setManualPhoto)}
                        placeholder="URL da foto ou cole a imagem (Ctrl+V)..."
                        className="w-full bg-[#101626] border border-[#1d2a45] rounded-lg py-1.5 px-2.5 text-[11px] text-white font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* GREEN BUTTON: + ADICIONAR ENVOLVIDO */}
                <button
                  type="button"
                  onClick={handleAddManualEnvolvido}
                  className="w-full bg-[#059669] hover:bg-[#10b981] text-white font-black font-sans text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>ADICIONAR ENVOLVIDO</span>
                </button>
              </div>

              {/* Sub-section: ENVOLVIDOS ADICIONADOS */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  <span>ENVOLVIDOS ADICIONADOS</span>
                  <span className="w-5 h-5 rounded-full bg-[#1b2844] text-white text-[10px] flex items-center justify-center font-bold">
                    {involvedPeople.length}
                  </span>
                </div>

                {/* List of Added Involved */}
                {involvedPeople.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {involvedPeople.map((person, idx) => (
                      <div
                        key={`inv-${person.id || "p"}-${idx}`}
                        className="bg-[#090e18] border border-[#1b2844] rounded-xl p-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#101626] border border-[#202e4d] overflow-hidden shrink-0">
                            {person.photoUrl ? (
                              <img src={person.photoUrl} alt={person.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-full h-full p-2 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-black text-white uppercase tracking-tight truncate">{person.name}</h5>
                            <p className="text-[10px] font-mono text-blue-400 uppercase truncate">
                              VULGO: {person.vulgo || "N/I"} | {person.document || "Doc: N/I"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveInvolved(person.id, idx)}
                          className="w-8 h-8 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 flex items-center justify-center transition-colors shrink-0"
                          title="Remover envolvido"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 italic font-mono text-center uppercase py-6 border border-dashed border-[#1a253e] rounded-xl">
                    NENHUM ENVOLVIDO CADASTRADO
                  </p>
                )}
              </div>

            </div>

          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-[#182338] mt-6">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-mono font-bold text-zinc-400 hover:text-white uppercase tracking-wider px-4 py-2 transition-colors cursor-pointer"
            >
              CANCELAR
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#2563eb] hover:bg-[#3b82f6] text-white font-black text-xs font-sans uppercase tracking-wider px-6 py-3 rounded-xl shadow-[0_0_25px_rgba(37,99,235,0.45)] transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{editingOccurrence ? "SALVAR ALTERAÇÕES" : "SALVAR REGISTRO"}</span>
            </button>
          </div>
        </form>

      </motion.div>
    </div>
  );
}
