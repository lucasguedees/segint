import React, { useState, useEffect, useRef, useMemo } from "react";
import { UserProfile, Occurrence, Suspect, OccurrenceSeverity, OccurrenceStatus } from "../types";
import OccurrenceModal from "./OccurrenceModal";
import OccurrenceFormModal from "./OccurrenceFormModal";
import { matchesOccurrenceSmartSearch } from "../utils/suspectSearch";
import {
  subscribeToOccurrences,
  addOccurrence,
  updateOccurrence,
  deleteOccurrence,
  seedOccurrencesIfEmpty
} from "../dbService";
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock as ClockIcon,
  MapPin,
  AlertOctagon,
  CheckCircle,
  FileText,
  User,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  AlertTriangle,
  X,
  LayoutList,
  Grid,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Download,
  Upload,
  Users,
  Package,
  Camera
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface OccurrencesPanelProps {
  currentUser: UserProfile;
  suspects: Suspect[];
  onViewSuspect: (suspect: Suspect) => void;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

export default function OccurrencesPanel({ currentUser, suspects, onViewSuspect, showToast }: OccurrencesPanelProps) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);

  // View Layout Modes & Zoom Controls (Matches Suspects Page)
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("list");
  const [hideDetails, setHideDetails] = useState<boolean>(false);
  const [photoSize, setPhotoSize] = useState<number>(180);

  // Custom alert and confirmation dialog states
  const [panelAlert, setPanelAlert] = useState<{
    title: string;
    message: string;
    type: "error" | "info" | "success";
  } | null>(null);

  const [panelConfirm, setPanelConfirm] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form/Modal state
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOccurrence, setEditingOccurrence] = useState<Occurrence | null>(null);

  // Hidden File Input for Import
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [severity, setSeverity] = useState<OccurrenceSeverity>("medium");
  const [status, setStatus] = useState<OccurrenceStatus>("open");
  const [selectedSuspects, setSelectedSuspects] = useState<string[]>([]);
  const [envolvidoName, setEnvolvidoName] = useState("");
  const [vulgo, setVulgo] = useState("");
  const [customPhotoUrl, setCustomPhotoUrl] = useState("");

  // Listen to occurrences
  useEffect(() => {
    seedOccurrencesIfEmpty();
    const unsubscribe = subscribeToOccurrences((data) => {
      setOccurrences(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Extract unique cities and count occurrences per city
  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    occurrences.forEach((o) => {
      if (!o.location) return;
      let city = "";
      const parts = o.location.split("•").map((p) => p.trim());
      if (parts.length > 1) {
        city = parts[0].toUpperCase();
      } else {
        const dashParts = o.location.split("-").map((p) => p.trim());
        if (dashParts.length > 1) {
          city = dashParts[dashParts.length - 1].toUpperCase();
        } else {
          city = o.location.split(",")[0].trim().toUpperCase();
        }
      }
      if (city) {
        counts[city] = (counts[city] || 0) + 1;
      }
    });
    return counts;
  }, [occurrences]);

  const availableCities = useMemo(() => {
    return Object.keys(cityCounts).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cityCounts]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setDate(new Date().toISOString().split("T")[0]);
    setTime(new Date().toTimeString().split(" ")[0].slice(0, 5));
    setSeverity("medium");
    setStatus("open");
    setSelectedSuspects([]);
    setEnvolvidoName("");
    setVulgo("");
    setCustomPhotoUrl("");
    setEditingOccurrence(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (occ: Occurrence) => {
    setEditingOccurrence(occ);
    setTitle(occ.title);
    setDescription(occ.description);
    setLocation(occ.location);
    setDate(occ.date);
    setTime(occ.time);
    setSeverity(occ.severity);
    setStatus(occ.status);
    setSelectedSuspects(occ.relatedSuspects || []);
    setEnvolvidoName(occ.envolvidoName || "");
    setVulgo(occ.vulgo || "");
    setCustomPhotoUrl(occ.photoUrl || "");
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !location || !date || !time) {
      setPanelAlert({
        title: "CAMPOS OBRIGATÓRIOS AUSENTES",
        message: "Por favor, preencha todos os campos obrigatórios marcados com asterisco (*).",
        type: "info"
      });
      return;
    }

    const payload = {
      id: editingOccurrence ? editingOccurrence.id : `OCOR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      title,
      description,
      location,
      date,
      time,
      severity,
      status,
      relatedSuspects: selectedSuspects,
      envolvidoName: envolvidoName.trim() || undefined,
      vulgo: vulgo.trim() || undefined,
      photoUrl: customPhotoUrl.trim() || undefined,
      agentInCharge: editingOccurrence ? editingOccurrence.agentInCharge : currentUser.name,
    };

    try {
      if (editingOccurrence) {
        await updateOccurrence(editingOccurrence.id, payload);
        if (selectedOccurrence && selectedOccurrence.id === editingOccurrence.id) {
          setSelectedOccurrence({ ...selectedOccurrence, ...payload, updatedAt: new Date().toISOString() });
        }
        if (showToast) {
          showToast("Ocorrência atualizada com sucesso.", "success");
        }
      } else {
        await addOccurrence(payload);
        if (showToast) {
          showToast("Ocorrência registrada com sucesso.", "success");
        }
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      if (showToast) {
        showToast("Erro ao salvar ocorrência.", "error");
      } else {
        setPanelAlert({
          title: "ERRO DE GRAVAÇÃO",
          message: "Erro ao salvar ocorrência no banco de dados. Verifique sua conexão ou permissões.",
          type: "error"
        });
      }
    }
  };

  const handleDelete = (id: string) => {
    setPanelConfirm({
      title: "EXCLUIR REGISTRO DE OCORRÊNCIA",
      message: "ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente este registro de ocorrência? Esta ação é irreversível.",
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteOccurrence(id);
          if (selectedOccurrence && selectedOccurrence.id === id) {
            setSelectedOccurrence(null);
          }
          if (showToast) {
            showToast("Registro de ocorrência excluído com sucesso.", "success");
          }
        } catch (err) {
          console.error(err);
          if (showToast) {
            showToast("Erro ao excluir ocorrência.", "error");
          } else {
            setPanelAlert({
              title: "ERRO DE EXCLUSÃO",
              message: "Erro ao excluir ocorrência. Verifique suas permissões.",
              type: "error"
            });
          }
        } finally {
          setPanelConfirm(null);
        }
      }
    });
  };

  const handleRestoreDefaults = () => {
    setPanelConfirm({
      title: "RESTAURAR OCORRÊNCIAS",
      message: "Deseja restaurar as ocorrências de demonstração padrão no banco de dados?",
      isDanger: false,
      onConfirm: async () => {
        try {
          await seedOccurrencesIfEmpty();
          if (showToast) {
            showToast("Ocorrências de demonstração restauradas.", "success");
          }
        } catch (err) {
          console.error(err);
          if (showToast) {
            showToast("Erro ao restaurar ocorrências padrão.", "error");
          } else {
            setPanelAlert({
              title: "ERRO DE RESTAURAÇÃO",
              message: "Erro ao restaurar ocorrências de demonstração padrão.",
              type: "error"
            });
          }
        } finally {
          setPanelConfirm(null);
        }
      }
    });
  };

  // Excel / CSV Export Handler
  const handleExcelExport = () => {
    if (filteredOccurrences.length === 0) {
      if (showToast) showToast("Nenhuma ocorrência para exportar.", "info");
      return;
    }

    const headers = [
      "ID",
      "Natureza/Titulo",
      "Envolvido",
      "Vulgo",
      "Localizacao",
      "Data",
      "Horario",
      "Gravidade",
      "Status",
      "Relatorio/Descricao"
    ];

    const rows = filteredOccurrences.map((occ) => {
      const relSuspect = suspects.find((s) => occ.relatedSuspects?.includes(s.id));
      const envName = occ.envolvidoName || relSuspect?.name || "ALVO NÃO IDENTIFICADO";
      const envVulgo = occ.vulgo || relSuspect?.alias || "";
      return [
        `"${occ.id}"`,
        `"${occ.title.replace(/"/g, '""')}"`,
        `"${envName.replace(/"/g, '""')}"`,
        `"${envVulgo.replace(/"/g, '""')}"`,
        `"${occ.location.replace(/"/g, '""')}"`,
        `"${occ.date}"`,
        `"${occ.time}"`,
        `"${occ.severity}"`,
        `"${occ.status}"`,
        `"${occ.description.replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prisoes_e_ocorrencias_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (showToast) {
      showToast(`${filteredOccurrences.length} ocorrências exportadas com sucesso.`, "success");
    }
  };

  // File Import Handler (JSON / CSV)
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let importedCount = 0;

        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (item.title && item.location) {
              await addOccurrence({
                id: item.id || `OCOR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                title: item.title,
                description: item.description || "Importado via arquivo",
                location: item.location,
                date: item.date || new Date().toISOString().split("T")[0],
                time: item.time || "12:00",
                severity: item.severity || "medium",
                status: item.status || "open",
                envolvidoName: item.envolvidoName || item.envolvido,
                vulgo: item.vulgo,
                photoUrl: item.photoUrl,
                agentInCharge: currentUser.name
              });
              importedCount++;
            }
          }
        } else {
          // CSV Import fallback
          const lines = text.split("\n").filter((l) => l.trim());
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
            if (cols.length >= 3) {
              await addOccurrence({
                id: cols[0] || `OCOR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                title: cols[1] || "Ocorrência Importada",
                description: cols[9] || cols[2] || "Importado via CSV",
                location: cols[4] || cols[3] || "LAJEADO/RS",
                date: cols[5] || new Date().toISOString().split("T")[0],
                time: cols[6] || "12:00",
                severity: (cols[7] as any) || "medium",
                status: (cols[8] as any) || "open",
                envolvidoName: cols[2],
                agentInCharge: currentUser.name
              });
              importedCount++;
            }
          }
        }

        if (showToast) {
          showToast(`${importedCount} registros de ocorrências importados com sucesso.`, "success");
        }
      } catch (err) {
        console.error(err);
        if (showToast) showToast("Erro ao importar arquivo de ocorrências.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleSuspectSelection = (suspectId: string) => {
    setSelectedSuspects((prev) =>
      prev.includes(suspectId) ? prev.filter((id) => id !== suspectId) : [...prev, suspectId]
    );
  };

  // Filter Occurrences with Smart Search Engine
  const filteredOccurrences = occurrences.filter((occ) => {
    const matchesQuery = matchesOccurrenceSmartSearch(occ, searchQuery, suspects);

    const matchesCity =
      cityFilter === "all" ||
      occ.location.toUpperCase().includes(cityFilter.toUpperCase());

    const matchesSeverity = severityFilter === "all" || occ.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || occ.status === statusFilter;

    return matchesQuery && matchesCity && matchesSeverity && matchesStatus;
  });

  // Helper to resolve photo for an occurrence
  const getOccurrencePhoto = (occ: Occurrence): string | null => {
    if (occ.photoUrl) return occ.photoUrl;
    if (occ.relatedSuspects && occ.relatedSuspects.length > 0) {
      const rel = suspects.find((s) => s.id === occ.relatedSuspects![0]);
      if (rel && rel.photos && rel.photos[0]) return rel.photos[0];
    }
    return null;
  };

  // Helper to resolve primary suspect or envolvido info
  const getOccurrenceTargetInfo = (occ: Occurrence) => {
    const relSuspect = suspects.find((s) => occ.relatedSuspects?.includes(s.id));
    const name = occ.envolvidoName || relSuspect?.name || "ALVO NÃO IDENTIFICADO";
    const vulgoStr = occ.vulgo || relSuspect?.alias || null;
    const alvos = occ.alvosCount || (occ.relatedSuspects?.length || 1);
    const hasMat = occ.hasMaterial || false;
    const extraPhotos = occ.extraPhotosCount || (relSuspect?.photos && relSuspect.photos.length > 1 ? relSuspect.photos.length - 1 : 0);

    return { name, vulgoStr, alvos, hasMat, extraPhotos, relSuspect };
  };

  return (
    <div className="space-y-5">
      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={importInputRef}
        onChange={handleImportFile}
        accept=".json,.csv"
        className="hidden"
      />

      {/* Header & Main Control Toolbar */}
      <div className="bg-[#0b0e17] border border-[#1a2336] p-4 rounded-2xl shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Badge */}
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-sans">
              Prisões e Ocorrências
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1b2336] border border-[#293652] text-[#93c5fd] font-mono text-xs font-bold shadow-inner">
              {occurrences.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium mt-0.5">
            Histórico operacional da Agência
          </p>
        </div>

        {/* Action Controls Toolbar (Matches Suspects Page Buttons) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* View Layout Toggle & Eye Mode (IDENTICAL TO SUSPECTS PAGE) */}
          <div className="bg-[#121826] border border-[#20293d] p-1 rounded-xl flex items-center gap-1 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setViewLayout("list");
                setHideDetails(false);
              }}
              className={`p-2 rounded-lg transition-all ${
                viewLayout === "list" && !hideDetails
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
              title="Visualização em Lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewLayout("grid");
                setHideDetails(false);
              }}
              className={`p-2 rounded-lg transition-all ${
                viewLayout === "grid" && !hideDetails
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
              title="Visualização em Grade"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setHideDetails(!hideDetails)}
              className={`p-2 rounded-lg transition-all ${
                hideDetails
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
              title="Ocultar Detalhes (Apenas Fotos)"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Photo Size Zoom Slider Bar (IDENTICAL TO SUSPECTS PAGE) */}
          <div className="bg-[#121826] border border-[#20293d] px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm">
            <ZoomOut className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="range"
              min="100"
              max="360"
              step="10"
              value={photoSize}
              onChange={(e) => setPhotoSize(Number(e.target.value))}
              className="w-16 sm:w-24 accent-blue-500 cursor-pointer h-1.5 bg-[#1b253b] rounded-lg appearance-none"
              title="Ajustar Tamanho das Fotos"
            />
            <ZoomIn className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-[10px] font-mono font-bold text-blue-400 min-w-[32px] text-right">
              {photoSize}px
            </span>
          </div>

          {/* Exportar Excel Button */}
          <button
            type="button"
            onClick={handleExcelExport}
            className="bg-[#151c2e] hover:bg-[#1e2842] text-zinc-200 hover:text-white border border-[#232f4a] font-bold text-xs rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2 shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Exportar Excel</span>
          </button>

          {/* Importar Button */}
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="bg-[#151c2e] hover:bg-[#1e2842] text-zinc-200 hover:text-white border border-[#232f4a] font-bold text-xs rounded-xl px-3.5 py-2.5 transition-all flex items-center gap-2 shadow-sm active:scale-95"
          >
            <Upload className="w-4 h-4 text-zinc-400" />
            <span>Importar</span>
          </button>

          {/* + Novo Registro Button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl px-4 py-2.5 shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>

      {/* Search & Cities Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search bar */}
        <div className="md:col-span-8 lg:col-span-9 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
            <Search className="w-4 h-4 text-blue-400/80" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisa Inteligente: natureza/título, envolvido, vulgo, local, agente, data, ID..."
            className="w-full bg-[#0d121f] border border-[#1c273e] hover:border-[#2b3c5e] focus:border-blue-500 text-white text-xs rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-zinc-500 shadow-inner"
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

        {/* Cities Filter Dropdown */}
        <div className="md:col-span-4 lg:col-span-3 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-400 pointer-events-none">
            <Filter className="w-3.5 h-3.5" />
          </span>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full bg-[#0d121f] border border-[#1c273e] hover:border-[#2b3c5e] focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-8 py-3 outline-none transition-all uppercase font-mono font-bold tracking-wider cursor-pointer"
          >
            <option value="all">CIDADES: TODAS ({occurrences.length})</option>
            {availableCities.map((city, cIdx) => (
              <option key={`city-opt-${city}-${cIdx}`} value={city}>
                {city} ({cityCounts[city] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid / List / Eye Mode Container */}
      <div className="w-full">
        {/* Occurrences Main Cards Grid */}
        <div className="w-full space-y-4">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <span className="border-4 border-white/10 border-t-blue-500 rounded-full w-10 h-10 animate-spin"></span>
              <span className="text-xs uppercase font-mono tracking-wider">Carregando livro de ocorrências...</span>
            </div>
          ) : filteredOccurrences.length === 0 ? (
            <div className="py-24 border border-dashed border-white/10 bg-[#0d121f]/50 rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-4">
              <FileText className="w-12 h-12 stroke-[1] text-zinc-600" />
              <div className="text-center space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest font-mono text-zinc-400">Nenhum registro encontrado</p>
                <p className="text-xs text-zinc-600">Altere os filtros de pesquisa ou clique abaixo para restaurar o histórico padrão.</p>
              </div>
              <button
                onClick={handleRestoreDefaults}
                className="mt-2 bg-[#121826] hover:bg-[#1c273e] border border-white/10 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" /> Restaurar Ocorrências Padrão
              </button>
            </div>
          ) : hideDetails ? (
            /* EYE MODE: PHOTOS ONLY GRID (SEM NOME E SEM ALCUNHA, APENAS A FOTO) */
            <div
              className="grid gap-3 transition-all duration-200"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${photoSize}px, 1fr))`,
              }}
            >
              {filteredOccurrences.map((occ, occIdx) => {
                const photo = getOccurrencePhoto(occ);
                const info = getOccurrenceTargetInfo(occ);
                return (
                  <div
                    key={`eye-occ-${occ.id || "occ"}-${occIdx}`}
                    onClick={() => setSelectedOccurrence(occ)}
                    className="group cursor-pointer bg-[#111625] border border-[#20293f] hover:border-blue-500/80 rounded-2xl overflow-hidden shadow-xl relative aspect-[3/4] transition-all duration-300"
                    title={info.name}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={info.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-[#090d18] p-2">
                        <User className="w-10 h-10 stroke-[1.2]" />
                        <span className="text-[8px] uppercase font-mono tracking-widest text-zinc-500 mt-2 text-center">SEM FOTO</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewLayout === "grid" ? (
            /* GRID VIEW: APENAS A FOTO COM O NOME E ALCUNHA */
            <div
              className="grid gap-4 transition-all duration-200"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(photoSize, 140)}px, 1fr))`,
              }}
            >
              {filteredOccurrences.map((occ, occIdx) => {
                const photo = getOccurrencePhoto(occ);
                const info = getOccurrenceTargetInfo(occ);
                const isSelected = selectedOccurrence?.id === occ.id;

                return (
                  <div
                    key={`grid-occ-${occ.id || "occ"}-${occIdx}`}
                    onClick={() => setSelectedOccurrence(occ)}
                    className={`cursor-pointer group bg-[#111625] hover:bg-[#13192b] border ${
                      isSelected
                        ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50"
                        : "border-[#1e283f] hover:border-blue-500/60"
                    } rounded-2xl overflow-hidden transition-all duration-200 shadow-xl flex flex-col`}
                  >
                    {/* Mugshot photo */}
                    <div className="w-full aspect-[3/4] relative overflow-hidden bg-[#070a12] border-b border-[#1e293f] flex items-center justify-center">
                      {photo ? (
                        <img
                          src={photo}
                          alt={info.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950/40 p-3">
                          <User className="w-8 h-8 stroke-[1.2] text-zinc-700" />
                          <span className="text-[7px] uppercase font-mono tracking-widest text-zinc-500 text-center mt-1">SEM FOTO</span>
                        </div>
                      )}
                    </div>

                    {/* Name & Alcunha (Vulgo) Box */}
                    <div className="p-3 space-y-1 bg-[#0d121f] min-w-0">
                      <h3 className="text-xs font-black text-white uppercase tracking-tight truncate leading-snug">
                        {info.name}
                      </h3>
                      <p className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider truncate">
                        {info.vulgoStr ? `VULGO: "${info.vulgoStr}"` : "VULGO: N/I"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW MODE: EXIBIÇÃO DE FICHAS DETALHADAS COMPLETAS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOccurrences.map((occ, occIdx) => {
                const photo = getOccurrencePhoto(occ);
                const info = getOccurrenceTargetInfo(occ);
                const isSelected = selectedOccurrence?.id === occ.id;
                const formattedDate = occ.date.split("-").reverse().join("/");

                return (
                  <div
                    key={`list-occ-${occ.id || "occ"}-${occIdx}`}
                    onClick={() => setSelectedOccurrence(occ)}
                    className={`cursor-pointer group bg-[#111625] hover:bg-[#13192b] border ${
                      isSelected
                        ? "border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.2)]"
                        : "border-[#1e283f] hover:border-[#2f3d5c]"
                    } rounded-2xl overflow-hidden transition-all duration-200 shadow-xl p-3.5 flex items-start gap-3.5 relative min-h-[175px]`}
                  >
                    {/* Mugshot photo on Left */}
                    <div className="w-[110px] sm:w-[125px] h-[145px] sm:h-[155px] flex-shrink-0 relative rounded-xl overflow-hidden bg-[#070a12] border border-[#1e293f] flex items-center justify-center">
                      {photo ? (
                        <img
                          src={photo}
                          alt={info.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950/40 p-3">
                          <User className="w-8 h-8 stroke-[1.2] text-zinc-700" />
                          <span className="text-[7px] uppercase font-mono tracking-widest text-zinc-500 text-center mt-1">SEM FOTO</span>
                        </div>
                      )}

                      {/* Date Overlay on bottom of photo */}
                      <div className="absolute bottom-0 inset-x-0 bg-[#090d18]/95 border-t border-white/10 py-1 text-center font-mono text-[9.5px] font-bold text-white tracking-widest">
                        {formattedDate}
                      </div>
                    </div>

                    {/* Content Right */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch pr-12">
                      <div className="space-y-1">
                        {/* Orange / Amber Nature Badge */}
                        <div>
                          <span className="text-[9px] font-bold tracking-wider text-amber-500 uppercase bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono inline-block max-w-full truncate">
                            {occ.title}
                          </span>
                        </div>

                        {/* Envolvido Full Name */}
                        <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase truncate leading-snug pt-0.5">
                          {info.name}
                        </h3>

                        {/* Location */}
                        <p className="text-[10px] text-zinc-400 font-mono flex items-start gap-1 uppercase leading-snug truncate">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
                          <span className="truncate">{occ.location}</span>
                        </p>

                        {/* Vulgo line */}
                        {info.vulgoStr && (
                          <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider font-mono truncate pt-0.5">
                            VULGO: <span className="text-blue-300">"{info.vulgoStr}"</span>
                          </p>
                        )}
                      </div>

                      {/* Bottom Tags Row */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        <span className="inline-flex items-center gap-1 bg-[#161a38] border border-indigo-500/30 text-[#a5b4fc] text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono">
                          <Users className="w-3 h-3" />
                          {info.alvos} {info.alvos === 1 ? "ALVO" : "ALVOS"}
                        </span>

                        {info.hasMat && (
                          <span className="inline-flex items-center gap-1 bg-[#0e271c] border border-emerald-500/25 text-[#4ade80] text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono">
                            <Package className="w-3 h-3" />
                            MATERIAL
                          </span>
                        )}

                        {info.extraPhotos > 0 && (
                          <span className="inline-flex items-center gap-1 bg-[#122238] border border-blue-500/25 text-[#60a5fa] text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono">
                            <Camera className="w-3 h-3" />
                            +{info.extraPhotos} FOTOS
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Top Right Quick Edit / Delete Buttons */}
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(occ);
                        }}
                        className="p-1.5 rounded-lg bg-[#182136] hover:bg-[#253456] text-zinc-400 hover:text-white border border-[#232f4b] transition-colors"
                        title="Editar Ocorrência"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(occ.id);
                        }}
                        className="p-1.5 rounded-lg bg-[#182136] hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-[#232f4b] transition-colors"
                        title="Excluir Ocorrência"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Right Watermark ID & Arrow Button */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">
                        ID: {occ.id.replace("OCOR-", "").replace("ocor-", "").toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedOccurrence(occ)}
                        className="w-7 h-7 rounded-lg bg-[#172035] hover:bg-blue-600 text-zinc-400 hover:text-white border border-[#232f4b] flex items-center justify-center transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Selected Occurrence Detail Modal (RELATÓRIO DE OCORRÊNCIA) */}
      <AnimatePresence>
        {selectedOccurrence && (
          <OccurrenceModal
            key={`panel-modal-occ-${selectedOccurrence.id}`}
            occurrence={selectedOccurrence}
            suspects={suspects}
            onClose={() => setSelectedOccurrence(null)}
            onViewSuspect={onViewSuspect}
            onEdit={(occ) => handleOpenEdit(occ)}
          />
        )}
      </AnimatePresence>
      </div>

      {/* Form Modal (Create / Edit) */}
      <AnimatePresence>
        {isFormOpen && (
          <OccurrenceFormModal
            key={`panel-form-occ-${editingOccurrence ? editingOccurrence.id : "new"}`}
            editingOccurrence={editingOccurrence}
            suspects={suspects}
            currentUser={currentUser}
            onClose={() => {
              setIsFormOpen(false);
              setEditingOccurrence(null);
            }}
            onSave={async (payload) => {
              try {
                if (editingOccurrence) {
                  await updateOccurrence(editingOccurrence.id, payload);
                  if (selectedOccurrence && selectedOccurrence.id === editingOccurrence.id) {
                    setSelectedOccurrence({ ...selectedOccurrence, ...payload, updatedAt: new Date().toISOString() } as Occurrence);
                  }
                  if (showToast) showToast("Ocorrência atualizada com sucesso.", "success");
                } else {
                  await addOccurrence({
                    id: `OCOR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    title: payload.title || "OCORRÊNCIA",
                    description: payload.description || "",
                    location: payload.location || "",
                    date: payload.date || new Date().toISOString().split("T")[0],
                    time: payload.time || "12:00",
                    severity: payload.severity || "high",
                    status: payload.status || "open",
                    agentInCharge: payload.agentInCharge || currentUser.name,
                    ...payload
                  } as any);
                  if (showToast) showToast("Ocorrência registrada com sucesso.", "success");
                }
                setIsFormOpen(false);
                setEditingOccurrence(null);
              } catch (err) {
                console.error(err);
                if (showToast) showToast("Erro ao salvar ocorrência.", "error");
              }
            }}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Custom Panel alert and confirm dialogs */}
      <AnimatePresence>
        {panelAlert && (
          <div key="panel-alert-dialog" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#121727] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-950/40 text-blue-400 border border-blue-500/20">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-xs font-bold font-mono tracking-widest uppercase text-white">
                    {panelAlert.title}
                  </h3>
                  <p className="text-xs text-zinc-400 uppercase font-mono text-[9px]">
                    {panelAlert.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setPanelAlert(null)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {panelConfirm && (
          <div key="panel-confirm-dialog" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#121727] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${panelConfirm.isDanger ? "bg-rose-950/40 text-rose-400 border border-rose-500/20" : "bg-blue-950/40 text-blue-400 border border-blue-500/20"}`}>
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-xs font-bold font-mono tracking-widest uppercase text-white">
                    {panelConfirm.title}
                  </h3>
                  <p className="text-xs text-zinc-400 uppercase font-mono text-[9px]">
                    {panelConfirm.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPanelConfirm(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase"
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={panelConfirm.onConfirm}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${
                    panelConfirm.isDanger ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  Sim
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
