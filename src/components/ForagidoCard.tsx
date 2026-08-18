import React from "react";
import { Suspect } from "../types";
import { Shield, Eye, Edit3, MapPin, FileText, Info } from "lucide-react";
import { motion } from "motion/react";

interface ForagidoCardProps {
  key?: string;
  suspect: Suspect;
  onViewFicha: () => void;
  onEdit: () => void;
}

export default function ForagidoCard({ suspect, onViewFicha, onEdit }: ForagidoCardProps) {
  const primaryPhoto = suspect.photos && suspect.photos[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="relative w-full max-w-md mx-auto bg-gradient-to-b from-[#1c1611] to-[#0f0c0a] border border-amber-500/15 hover:border-amber-500/30 rounded-[2rem] overflow-hidden shadow-[0_15px_35px_rgba(245,166,35,0.04)] hover:shadow-[0_20px_40px_rgba(245,166,35,0.08)] p-6 flex flex-col gap-5 text-[#e0e0e0] font-sans transition-all duration-300"
    >
      {/* Header Row: Mandado Ativo */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 font-mono">
            Mandado Ativo
          </span>
        </div>
      </div>

      {/* Main Info Row (Photo and basic details) */}
      <div className="flex gap-4 items-center">
        {/* Photo with amber border & custom rounded design */}
        <div className="relative w-28 h-28 flex-shrink-0 rounded-[1.75rem] overflow-hidden border border-amber-500/30 bg-[#050507] shadow-xl shadow-black/40">
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
              <span className="text-[8px] uppercase tracking-widest font-mono text-amber-500/50">Sem Foto</span>
            </div>
          )}
        </div>

        {/* Name and Identifications */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-base font-extrabold text-white tracking-wide uppercase truncate font-sans">
            {suspect.name}
          </h3>

          <div className="inline-block bg-amber-950/40 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold tracking-widest uppercase rounded-lg px-2.5 py-0.5">
            Vulgo: {suspect.alias || "Sem vulgo"}
          </div>

          <div className="flex items-center gap-1 text-zinc-400 text-xs font-mono tracking-wider pt-0.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="truncate uppercase">{suspect.municipio || suspect.areaOfOperation || "LAJEADO"}</span>
          </div>

          {suspect.document && (
            <div className="inline-flex items-center bg-[#1e2330] text-zinc-300 text-[9px] font-bold px-2 py-0.5 rounded border border-white/5 font-mono uppercase mt-0.5">
              DOC: {suspect.document}
            </div>
          )}
        </div>
      </div>

      {/* Mandado / Localização Section */}
      <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-950/15 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-amber-400 font-extrabold tracking-widest text-[10px] font-mono uppercase">
          <FileText className="w-4 h-4 text-amber-500" />
          <span>Mandado / Localização</span>
        </div>
        <p className="text-white text-xs font-black uppercase tracking-wider font-mono">
          Nº do Mandado: <span className="text-amber-400">{suspect.mandadoNumero || "NÃO INFORMADO"}</span>
        </p>
      </div>

      {/* Antecedentes Section */}
      <div className="p-4 rounded-2xl border border-white/5 bg-[#050508]/60 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-zinc-500 font-bold tracking-wider text-[10px] font-mono uppercase">
          <Info className="w-3.5 h-3.5 text-zinc-500" />
          <span>Antecedentes</span>
        </div>
        <p className="text-zinc-400 text-[10px] uppercase font-mono leading-relaxed line-clamp-3 select-text">
          {suspect.antecedentes || suspect.observations || "NENHUM ANTECEDENTE REGISTRADO NO SISTEMA."}
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
          className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-mono uppercase text-xs font-black tracking-widest shadow-lg shadow-amber-950/20 transition-all duration-200"
        >
          <Edit3 className="w-4 h-4" />
          <span>Editar</span>
        </button>
      </div>
    </motion.div>
  );
}
