import React from "react";
import { Suspect, Occurrence } from "../types";
import { Eye, Edit3, MapPin, Activity, Award, ChevronRight, Settings } from "lucide-react";
import { motion } from "motion/react";

interface ReincidenteCardProps {
  suspect: Suspect;
  occurrences: Occurrence[];
  onViewFicha: () => void;
  onViewOccurrence: (occurrence: Occurrence) => void;
  onEdit: () => void;
}

export default function ReincidenteCard({ suspect, occurrences, onViewFicha, onViewOccurrence, onEdit }: ReincidenteCardProps) {
  const primaryPhoto = suspect.photos && suspect.photos[0];

  // Filter occurrences related to this suspect
  const relatedOccurrences = occurrences
    .filter((occ) => occ.relatedSuspects?.includes(suspect.id))
    // Sort by date (newest first)
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date.split("/").reverse().join("-")) : new Date(a.createdAt);
      const dateB = b.date ? new Date(b.date.split("/").reverse().join("-")) : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

  const totalCount = relatedOccurrences.length;

  // Group occurrences by title to detect patterns
  const patternsMap: { [title: string]: number } = {};
  relatedOccurrences.forEach((occ) => {
    const title = occ.title.toUpperCase().trim();
    patternsMap[title] = (patternsMap[title] || 0) + 1;
  });

  const patterns = Object.entries(patternsMap).map(([title, count]) => ({
    title,
    count,
  }));

  // Define styling based on total count of offenses
  const isCritical = totalCount >= 5;
  const statusLabel = isCritical ? "REINCIDÊNCIA CRÍTICA" : "REINCIDENTE";
  
  // Theme styling
  const headerTextColor = isCritical ? "text-red-500" : "text-amber-500";
  const badgeBgColor = isCritical ? "bg-red-500" : "bg-amber-600";
  const ringBgColor = isCritical ? "bg-red-500" : "bg-amber-500";
  const shadowColor = isCritical 
    ? "shadow-[0_15px_35px_rgba(239,68,68,0.06)] hover:shadow-[0_20px_40px_rgba(239,68,68,0.12)] border-red-500/15 hover:border-red-500/30" 
    : "shadow-[0_15px_35px_rgba(217,119,6,0.05)] hover:shadow-[0_20px_40px_rgba(217,119,6,0.1)] border-amber-500/15 hover:border-amber-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className={`relative w-full max-w-md mx-auto bg-gradient-to-b from-[#131722] to-[#0a0c14] rounded-[2rem] overflow-hidden p-6 flex flex-col gap-5 text-[#e0e0e0] font-sans transition-all duration-300 border ${shadowColor}`}
    >
      {/* Header Row: Reincidência Status & Count Badge */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ringBgColor} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${ringBgColor}`}></span>
          </span>
          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${headerTextColor} font-mono`}>
            {statusLabel}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 ${badgeBgColor} text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-black/40`}>
          <Activity className="w-3.5 h-3.5" />
          <span>{totalCount}X</span>
        </div>
      </div>

      {/* Main Info Row (Photo and basic details) */}
      <div className="flex gap-4 items-center">
        {/* Photo with double border & custom rounded design */}
        <div className={`relative w-28 h-28 flex-shrink-0 rounded-[1.75rem] overflow-hidden border ${isCritical ? "border-red-500/30" : "border-amber-500/30"} bg-[#050507] shadow-xl shadow-black/40`}>
          {primaryPhoto ? (
            <img
              src={primaryPhoto}
              alt={suspect.name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-500 ${
                suspect.coverFocus3x4 ? "scale-[1.65] origin-[center_18%]" : ""
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/10">
              <span className="text-[8px] uppercase tracking-widest font-mono text-zinc-500">Sem Foto</span>
            </div>
          )}
        </div>

        {/* Name and Identifications */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-lg font-extrabold text-white tracking-wide uppercase truncate font-sans">
            {suspect.name}
          </h3>

          <div className="inline-block bg-amber-950/20 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold tracking-widest uppercase rounded-lg px-2.5 py-0.5">
            Vulgo: {suspect.alias || "Sem vulgo"}
          </div>

          <div className="flex items-center gap-1 text-zinc-400 text-xs font-mono tracking-wider pt-0.5">
            <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="truncate uppercase">{suspect.municipio || suspect.areaOfOperation || "LAJEADO"}</span>
          </div>
        </div>
      </div>

      {/* PADRÕES DETECTADOS (Patterns Detected) section */}
      <div className="p-4 rounded-2xl border border-amber-500/10 bg-[#161412]/40 flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 text-amber-400 font-extrabold tracking-widest text-[10px] font-mono uppercase">
          <Settings className="w-4 h-4 text-amber-500" />
          <span>Padrões Detectados</span>
        </div>
        
        {patterns.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {patterns.map((pat, index) => (
              <span
                key={`pat-${pat.title}-${index}`}
                className="bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/20 text-[#f5a623] text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-colors font-mono"
              >
                {pat.title} ({pat.count}X)
              </span>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-[10px] uppercase font-mono italic">
            Nenhum padrão detectado no histórico.
          </p>
        )}
      </div>

      {/* LINHA DO TEMPO (Timeline of Occurrences) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-zinc-400 font-extrabold tracking-widest text-[10px] font-mono uppercase px-1">
          <Activity className="w-4 h-4 text-zinc-400" />
          <span>Linha do Tempo</span>
        </div>

        {relatedOccurrences.length > 0 ? (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {relatedOccurrences.map((occ, oIdx) => (
              <div
                key={`rel-occ-${occ.id || "occ"}-${oIdx}`}
                className="relative bg-[#0d0f17] hover:bg-[#141824] border border-white/5 hover:border-white/10 rounded-xl p-3 flex items-center justify-between transition-all duration-150 cursor-pointer"
                onClick={() => onViewOccurrence(occ)}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-wider mb-0.5">
                    <span className="text-amber-500 font-bold">{occ.date || "N/D"}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 uppercase truncate">{occ.location || "LAJEADO"}</span>
                  </div>
                  <h4 className="text-white text-xs font-bold uppercase truncate tracking-wide font-sans">
                    {occ.title}
                  </h4>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 text-[10px] uppercase font-mono italic px-1">
            Sem ocorrências registradas na linha do tempo.
          </p>
        )}
      </div>

      {/* Action Buttons: Ficha vs Editar */}
      <div className="flex items-center gap-3 pt-2 mt-auto border-t border-white/5">
        <button
          type="button"
          onClick={onViewFicha}
          className="flex-1 bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/50 hover:border-slate-600/50 text-white rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-mono uppercase text-xs font-black tracking-widest transition-all duration-200"
        >
          <Eye className="w-4 h-4" />
          <span>Ficha</span>
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-mono uppercase text-xs font-black tracking-widest shadow-lg shadow-amber-950/20 transition-all duration-200"
        >
          <Edit3 className="w-4 h-4" />
          <span>Editar</span>
        </button>
      </div>
    </motion.div>
  );
}
