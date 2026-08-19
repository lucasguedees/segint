import React from "react";
import { Suspect } from "../types";
import {
  Calendar,
  Edit2,
  Trash2,
  ArrowRight,
  Fingerprint,
  MapPin,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { motion } from "motion/react";

interface SuspectCardProps {
  suspect: Suspect;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  hideDetails?: boolean; // Eye icon mode: photo ONLY (no text)
  compact?: boolean;     // Grid view mode: photo + name + alias
}

export default function SuspectCard({
  suspect,
  onClick,
  onEdit,
  onDelete,
  hideDetails = false,
  compact = false,
}: SuspectCardProps) {
  const primaryPhoto = suspect.photos && suspect.photos[0];

  // Format date DD/MM/YYYY
  const formatDate = (isoString?: string) => {
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

  // City display
  const city = suspect.municipio || suspect.areaOfOperation || "LAJEADO";

  // Antecedentes text
  const antecedentesText =
    suspect.antecedentes ||
    suspect.frequentCrimes ||
    suspect.observations ||
    "Sem antecedentes registrados";

  // Document formatting
  const rawDoc = suspect.document ? suspect.document.replace(/\(RG\)|\(CPF\)/gi, "").trim() : "7136834269";

  // MODE 1: PHOTO ONLY (Eye icon mode - no name, no alias, no text)
  if (hideDetails) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, scale: 1.02 }}
        onClick={onClick}
        className="group cursor-pointer bg-[#121624] border border-[#20293d] hover:border-blue-500/60 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 relative aspect-[3/4]"
      >
        {primaryPhoto ? (
          <img
            src={primaryPhoto}
            alt={suspect.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-[#090d18]">
            <Fingerprint className="w-12 h-12 stroke-[1.2]" />
            <span className="text-[9px] uppercase mt-2 font-mono tracking-widest text-zinc-500">
              Sem Imagem
            </span>
          </div>
        )}
        <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/50 rounded-2xl transition-all pointer-events-none" />
      </motion.div>
    );
  }

  // MODE 2: COMPACT (Grid view mode - Photo + Name + Alias)
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        onClick={onClick}
        className="group cursor-pointer bg-[#121726] hover:bg-[#151c30] border border-[#20293f] hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between relative"
      >
        {/* Mugshot Photo */}
        <div className="relative aspect-[3/4] bg-[#090d18] overflow-hidden">
          {primaryPhoto ? (
            <img
              src={primaryPhoto}
              alt={suspect.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/40">
              <Fingerprint className="w-12 h-12 stroke-[1]" />
              <span className="text-[9px] uppercase mt-1.5 tracking-widest font-mono text-zinc-500">
                Sem Imagem
              </span>
            </div>
          )}

          {/* Quick Edit/Delete buttons on photo hover */}
          {(onEdit || onDelete) && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-black/65 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-red-400 hover:bg-white/10 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Name and Alias block */}
        <div className="p-3 bg-[#0e1322] border-t border-[#1e273e] space-y-0.5">
          <h3 className="text-white font-bold text-xs uppercase tracking-tight truncate group-hover:text-blue-300 transition-colors">
            {suspect.name}
          </h3>
          {suspect.alias ? (
            <p className="text-blue-400 font-bold text-[11px] uppercase tracking-wide truncate">
              "{suspect.alias}"
            </p>
          ) : (
            <p className="text-zinc-500 text-[10px] uppercase font-mono truncate">
              Sem Alcunha
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // MODE 3: FULL DETAILS (List / Full Ficha view mode)
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onClick={onClick}
      className="group cursor-pointer bg-[#121726] hover:bg-[#151c30] border border-[#20293f] hover:border-blue-500/40 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3 shadow-lg hover:shadow-2xl relative"
    >
      {/* Top row: Circular Photo + Name/Alias + City Pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar Photo */}
          <div className="w-11 h-11 rounded-full overflow-hidden border border-white/15 bg-[#090c14] flex-shrink-0 shadow-md">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={suspect.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900">
                <Fingerprint className="w-5 h-5 stroke-[1.5]" />
              </div>
            )}
          </div>

          {/* Name & Alias */}
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-bold text-xs uppercase tracking-tight line-clamp-1 group-hover:text-blue-300 transition-colors">
              {suspect.name}
            </h3>
            {suspect.alias ? (
              <p className="text-blue-400 font-bold text-[11px] uppercase tracking-wide truncate mt-0.5">
                "{suspect.alias}"
              </p>
            ) : (
              <p className="text-zinc-500 text-[10px] uppercase font-mono truncate mt-0.5">
                Sem Alcunha
              </p>
            )}
          </div>
        </div>

        {/* City Tag Pill */}
        <div className="bg-[#0e1322] border border-[#222c44] text-[#a0a8c2] text-[9px] font-mono font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 flex-shrink-0 shadow-sm">
          <MapPin className="w-3 h-3 text-zinc-400" />
          <span className="truncate max-w-[90px]">{city}</span>
        </div>
      </div>

      {/* Middle Recessed Box: Crimes/Antecedentes & DOC */}
      <div className="bg-[#0b0e18] border border-white/5 rounded-xl p-3 space-y-2 font-sans">
        {/* Antecedentes line */}
        <div className="flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-500/90 flex-shrink-0 mt-0.5" />
          <p className="text-zinc-300 text-[10.5px] leading-snug line-clamp-2 font-sans">
            {antecedentesText}
          </p>
        </div>

        {/* Document Line */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="bg-[#182136] text-zinc-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
            DOC
          </span>
          <span className="text-zinc-300 font-mono text-[11px] font-semibold tracking-wider truncate">
            {rawDoc}
          </span>
        </div>
      </div>

      {/* Bottom Footer: Date + Action Buttons */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-zinc-400">
        {/* Date */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
          <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <span>{formatDate(suspect.createdAt)}</span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Editar registro"
              className="p-1.5 rounded-md bg-[#182034] hover:bg-[#222e4a] text-zinc-400 hover:text-white border border-[#25324e] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Excluir registro"
              className="p-1.5 rounded-md bg-[#182034] hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-[#25324e] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            title="Visualizar ficha completa"
            className="p-1.5 rounded-md bg-[#182034] hover:bg-blue-600 text-zinc-400 hover:text-white border border-[#25324e] transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

