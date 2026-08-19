import React from "react";
import { Suspect } from "../types";
import { ShieldAlert, Eye, Edit3, MapPin, TrendingUp, Info } from "lucide-react";
import { motion } from "motion/react";

interface AlvoFocoCardProps {
  key?: string;
  suspect: Suspect;
  onViewFicha: () => void;
  onEdit: () => void;
}

export default function AlvoFocoCard({ suspect, onViewFicha, onEdit }: AlvoFocoCardProps) {
  // Extract primary photo or use default fingerprint mugshot
  const primaryPhoto = suspect.photos && suspect.photos[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="relative w-full max-w-md mx-auto bg-gradient-to-b from-[#131722] to-[#0a0c14] border border-rose-500/15 hover:border-rose-500/30 rounded-[2rem] overflow-hidden shadow-[0_15px_35px_rgba(225,42,42,0.06)] hover:shadow-[0_20px_40px_rgba(225,42,42,0.12)] p-6 flex flex-col gap-5 text-[#e0e0e0] font-sans transition-all duration-300"
    >
      {/* Header Row: Monitoramento Ativo / Alta Prioridade */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-500 font-mono">
            Monitoramento Ativo
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#e12a2a] text-white text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg shadow-red-950/40">
          <ShieldAlert className="w-3 h-3" />
          <span>Alta Prioridade</span>
        </div>
      </div>

      {/* Main Info Row (Photo and basic details) */}
      <div className="flex gap-4 items-center">
        {/* Photo with double border & custom rounded design */}
        <div className="relative w-28 h-28 flex-shrink-0 rounded-[1.75rem] overflow-hidden border border-rose-500/30 bg-[#050507] shadow-xl shadow-black/40">
          {primaryPhoto ? (
            <img
              src={primaryPhoto}
              alt={suspect.name}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-500 ${
                suspect.coverFocus3x4 ? "scale-[1.65] origin-[center_18%]" : ""
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/10">
              <span className="text-[8px] uppercase tracking-widest font-mono text-rose-500/50">Sem Foto</span>
            </div>
          )}
        </div>

        {/* Name and Identifications */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-lg font-extrabold text-white tracking-wide uppercase truncate font-sans">
            {suspect.name}
          </h3>

          <div className="inline-block bg-rose-950/40 border border-rose-500/20 text-rose-400 text-[10px] font-extrabold tracking-widest uppercase rounded-lg px-2.5 py-1">
            Vulgo: {suspect.alias || "Sem vulgo"}
          </div>

          <div className="flex items-center gap-1 text-zinc-400 text-xs font-mono tracking-wider pt-0.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span className="truncate uppercase">{suspect.municipio || suspect.areaOfOperation || "LAJEADO"}</span>
          </div>
        </div>
      </div>

      {/* Focus Area (FOCO CRIMINAL ATUAL) with custom reason from input */}
      <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-950/15 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-rose-400 font-extrabold tracking-widest text-[10px] font-mono uppercase">
          <TrendingUp className="w-4 h-4 text-rose-500" />
          <span>Foco Criminal Atual</span>
        </div>
        <p className="text-white text-base font-black italic uppercase tracking-wider text-center py-1 select-text">
          "{suspect.alvoEmFocoReason || "SEM MOTIVO DESCRITO"}"
        </p>
      </div>

      {/* Observations / Notes Section */}
      <div className="p-4 rounded-2xl border border-white/5 bg-[#050508]/60 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-zinc-500 font-bold tracking-wider text-[10px] font-mono uppercase">
          <Info className="w-3.5 h-3.5 text-zinc-500" />
          <span>Notas / Observações</span>
        </div>
        <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-3 select-text font-sans">
          {suspect.observations || "Nenhuma observação cadastrada para este alvo."}
        </p>
      </div>

      {/* Action Buttons: Ficha vs Editar */}
      <div className="flex items-center gap-3 pt-2">
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
          className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-mono uppercase text-xs font-black tracking-widest shadow-lg shadow-red-950/20 transition-all duration-200"
        >
          <Edit3 className="w-4 h-4" />
          <span>Editar</span>
        </button>
      </div>
    </motion.div>
  );
}
