import React, { useState } from "react";
import { Occurrence, Suspect, InvolvedPerson } from "../types";
import {
  X,
  Calendar,
  MapPin,
  FileText,
  Users,
  Edit2,
  Camera,
  Package,
  Printer,
  Download,
  ExternalLink,
  Shield,
  User,
  CheckCircle2
} from "lucide-react";
import { motion } from "motion/react";

interface OccurrenceModalProps {
  occurrence: Occurrence;
  suspects: Suspect[];
  onClose: () => void;
  onViewSuspect?: (suspect: Suspect) => void;
  onEdit?: (occurrence: Occurrence) => void;
}

export default function OccurrenceModal({
  occurrence,
  suspects,
  onClose,
  onViewSuspect,
  onEdit,
}: OccurrenceModalProps) {
  // Photos Gallery state
  const getPhotosList = (): string[] => {
    const list: string[] = [];
    if (occurrence.photoUrl) list.push(occurrence.photoUrl);
    if (occurrence.photos && occurrence.photos.length > 0) {
      occurrence.photos.forEach((p) => {
        if (!list.includes(p)) list.push(p);
      });
    }
    // Add photos from related suspects
    if (occurrence.relatedSuspects) {
      for (const id of occurrence.relatedSuspects) {
        const s = suspects.find((sp) => sp.id === id);
        if (s && s.photos) {
          s.photos.forEach((p) => {
            if (!list.includes(p)) list.push(p);
          });
        }
      }
    }
    return list.length > 0 ? list : ["/placeholder-mugshot.jpg"];
  };

  const photosList = getPhotosList();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const activePhoto = photosList[selectedPhotoIndex] || photosList[0];

  // Helper to compile list of involved people
  const getInvolvedList = (): InvolvedPerson[] => {
    if (occurrence.involvedPeople && occurrence.involvedPeople.length > 0) {
      return occurrence.involvedPeople;
    }

    const list: InvolvedPerson[] = [];

    // Related suspects from suspect database
    const relatedSuspectsList = suspects.filter((s) =>
      occurrence.relatedSuspects?.includes(s.id)
    );

    for (const s of relatedSuspectsList) {
      list.push({
        id: s.id,
        name: s.name,
        vulgo: s.alias ? `"${s.alias}"` : "N/I",
        document: s.document ? `Doc: ${s.document}` : "Doc: N/I",
        photoUrl: s.photos?.[0],
      });
    }

    // Primary envolvido if not already in list
    if (occurrence.envolvidoName) {
      const exists = list.some(
        (p) => p.name.toLowerCase() === occurrence.envolvidoName?.toLowerCase()
      );
      if (!exists) {
        list.unshift({
          name: occurrence.envolvidoName,
          vulgo: occurrence.vulgo ? `"${occurrence.vulgo}"` : "N/I",
          document: "Doc: N/I",
          photoUrl: occurrence.photoUrl,
        });
      }
    }

    return list;
  };

  const involvedList = getInvolvedList();

  // Helper to parse Municipality from location
  const getMunicipio = (loc: string) => {
    if (!loc) return "LAJEADO";
    const parts = loc.split("•").map((p) => p.trim());
    if (parts.length > 1) return parts[0].toUpperCase();
    const dashParts = loc.split("-").map((p) => p.trim());
    if (dashParts.length > 1) {
      const last = dashParts[dashParts.length - 1];
      if (last.length <= 30 && !last.includes("RUA")) return last.toUpperCase();
    }
    const commaParts = loc.split(",").map((p) => p.trim());
    if (commaParts.length > 1) {
      const last = commaParts[commaParts.length - 1];
      if (last.length <= 30 && !last.includes("RUA")) return last.toUpperCase();
    }
    return "LAJEADO";
  };

  const formattedDate = occurrence.date
    ? occurrence.date.split("-").reverse().join("/")
    : "12/08/2026";

  const handleExport = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>RELATÓRIO DE OCORRÊNCIA - ${occurrence.id}</title>
            <style>
              body { font-family: monospace, Arial, sans-serif; background: #fff; color: #111; padding: 30px; line-height: 1.5; }
              .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-align: center; }
              .header h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
              .header p { margin: 4px 0 0; font-size: 11px; color: #555; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
              .box { border: 1px solid #ccc; padding: 12px; background: #f9f9f9; }
              .box-full { border: 1px solid #ccc; padding: 12px; background: #f9f9f9; margin-bottom: 20px; }
              .label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
              .value { font-size: 13px; font-weight: bold; text-transform: uppercase; }
              .narrative { font-size: 12px; white-space: pre-wrap; color: #222; }
              .footer { border-top: 1px solid #ddd; margin-top: 30px; pt-10px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>RELATÓRIO DE OCORRÊNCIA</h1>
              <p>SISTEMA DE INTELIGÊNCIA DA AGÊNCIA DE SEGURANÇA</p>
            </div>

            <div class="box-full">
              <div class="label">Natureza da Ocorrência</div>
              <div class="value" style="font-size: 16px; color: #b91c1c;">${occurrence.title}</div>
            </div>

            <div class="grid">
              <div class="box">
                <div class="label">Data do Fato</div>
                <div class="value">${formattedDate}</div>
              </div>
              <div class="box">
                <div class="label">Município</div>
                <div class="value">${getMunicipio(occurrence.location)}</div>
              </div>
            </div>

            <div class="box-full">
              <div class="label">Local Exato</div>
              <div class="value">${occurrence.location}</div>
            </div>

            <div class="box-full">
              <div class="label">Histórico da Ocorrência</div>
              <div class="narrative">${occurrence.description}</div>
            </div>

            <div class="box-full">
              <div class="label">Indivíduos Envolvidos (${involvedList.length})</div>
              ${involvedList
                .map(
                  (p) => `<div style="padding: 6px 0; border-bottom: 1px solid #eee;">
                    <strong>${p.name}</strong> | Vulgo: ${p.vulgo || "N/I"} | ${p.document || ""}
                  </div>`
                )
                .join("")}
            </div>

            <div class="footer">
              <div>REGISTRO ID: ${occurrence.id}</div>
              <div>ENCARREGADO: ${occurrence.agentInCharge}</div>
            </div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md">
      {/* Backdrop Click */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80"
      />

      {/* Main Modal Card (Matches Uploaded Reference Image) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-4xl bg-[#0a0e1a] border border-[#1d2a48] rounded-[24px] sm:rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.95)] p-5 sm:p-7 text-white flex flex-col max-h-[92vh] overflow-hidden my-auto"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#1b2742] pb-4 mb-5 shrink-0">
          <div className="flex items-center gap-3">
            {/* Orange/Yellow Archive Box Icon Badge */}
            <div className="w-10 h-10 rounded-xl bg-[#1a233a] border border-[#27365a] flex items-center justify-center text-amber-500 shadow-inner">
              <Package className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase font-sans leading-none">
                RELATÓRIO DE OCORRÊNCIA
              </h2>
              <p className="text-[10px] sm:text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-widest mt-1">
                SISTEMA DE INTELIGÊNCIA
              </p>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-2">
            {/* Edit Button */}
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(occurrence);
                  onClose();
                }}
                className="w-10 h-10 rounded-xl bg-[#151d32] hover:bg-[#1e2a47] border border-[#233256] text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
                title="Editar Ocorrência"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExport}
              className="bg-blue-600 hover:bg-blue-500 border border-blue-400/30 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.45)] transition-all active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4 stroke-[2.2]" />
              <span>EXPORTAR</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-[#151d32] hover:bg-[#1e2a47] border border-[#233256] text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
          {/* Top Section: Photo + Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Photo & Thumbnails Column (Col 4) */}
            <div className="md:col-span-4 lg:col-span-4 flex flex-col gap-3">
              {/* Main Mugshot Card */}
              <div className="relative rounded-2xl overflow-hidden border border-[#202e4d] bg-[#060912] aspect-[3/4] shadow-2xl group">
                <img
                  src={activePhoto}
                  alt={occurrence.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />

                {/* Bottom Left Photo Overlay Text */}
                <div className="absolute bottom-0 inset-x-0 p-3.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end">
                  <span className="text-xs font-black text-blue-400 font-mono tracking-wider uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    FOTO OCORRÊNCIA
                  </span>
                  <span className="text-[10.5px] font-bold text-zinc-300 font-mono tracking-widest drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    {formattedDate}
                  </span>
                </div>
              </div>

              {/* Photo Thumbnails Gallery */}
              {photosList.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                  {photosList.map((photo, idx) => {
                    const isActive = idx === selectedPhotoIndex;
                    return (
                      <button
                        key={`photo-thumb-${idx}-${photo.slice(-10)}`}
                        type="button"
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                          isActive
                            ? "border-blue-500 ring-2 ring-blue-500/30 scale-105"
                            : "border-[#1e2a47] opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={photo}
                          alt={`Foto ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Metadata Details Column (Col 8) */}
            <div className="md:col-span-8 lg:col-span-8 space-y-4">
              {/* Nature Label & Main Title */}
              <div>
                <span className="text-amber-500 text-[11px] font-mono font-extrabold tracking-wider uppercase block mb-1">
                  NATUREZA DA OCORRÊNCIA
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-snug font-sans">
                  {occurrence.title}
                </h1>
              </div>

              {/* Recessed Metadata Cards */}
              <div className="space-y-3 pt-1">
                {/* Row 1: Date & Municipality */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#0e1424] border border-[#1b2742] rounded-xl p-3 shadow-inner">
                    <span className="text-[9.5px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      DATA DO FATO
                    </span>
                    <p className="text-xs sm:text-sm font-black text-white font-mono uppercase">
                      {formattedDate}
                    </p>
                  </div>

                  <div className="bg-[#0e1424] border border-[#1b2742] rounded-xl p-3 shadow-inner">
                    <span className="text-[9.5px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                      MUNICÍPIO
                    </span>
                    <p className="text-xs sm:text-sm font-black text-white font-mono uppercase">
                      {getMunicipio(occurrence.location)}
                    </p>
                  </div>
                </div>

                {/* Row 2: Exact Location */}
                <div className="bg-[#0e1424] border border-[#1b2742] rounded-xl p-3 shadow-inner">
                  <span className="text-[9.5px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    LOCAL EXATO
                  </span>
                  <p className="text-xs sm:text-sm font-black text-white font-mono uppercase tracking-wide leading-relaxed">
                    {occurrence.location}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Side-by-side Histórico & Indivíduos Envolvidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* Histórico da Ocorrência Container */}
            <div className="bg-[#0d1323] border border-[#1b2742] rounded-2xl p-5 flex flex-col space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-black font-mono tracking-widest uppercase">
                <FileText className="w-4 h-4 stroke-[2.2]" />
                <span>HISTÓRICO DA OCORRÊNCIA</span>
              </div>

              <div className="bg-[#070b14]/70 p-4 rounded-xl border border-white/5 text-xs text-zinc-300 leading-relaxed font-sans font-medium whitespace-pre-wrap max-h-[280px] overflow-y-auto custom-scrollbar">
                {occurrence.description || "Nenhum histórico detalhado informado."}
              </div>
            </div>

            {/* Indivíduos Envolvidos Container */}
            <div className="bg-[#0d1323] border border-[#1b2742] rounded-2xl p-5 flex flex-col space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-black font-mono tracking-widest uppercase">
                <Users className="w-4 h-4 stroke-[2.2]" />
                <span>INDIVÍDUOS ENVOLVIDOS ({involvedList.length})</span>
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {involvedList.length > 0 ? (
                  involvedList.map((person, idx) => {
                    const matchedSuspect = suspects.find(
                      (s) =>
                        s.id === person.id ||
                        s.name.toLowerCase() === person.name.toLowerCase()
                    );

                    return (
                      <div
                        key={`inv-${person.id || "person"}-${idx}`}
                        onClick={() => {
                          if (matchedSuspect && onViewSuspect) {
                            onClose();
                            onViewSuspect(matchedSuspect);
                          }
                        }}
                        className={`bg-[#11182c] hover:bg-[#16213c] border border-[#1e2b4a] hover:border-blue-500/50 rounded-xl p-3 flex items-center gap-3.5 transition-all shadow-sm ${
                          matchedSuspect && onViewSuspect ? "cursor-pointer group" : ""
                        }`}
                      >
                        {/* Mugshot Image */}
                        <div className="w-12 h-12 rounded-lg border border-[#27375a] bg-[#060912] overflow-hidden flex-shrink-0">
                          {person.photoUrl || matchedSuspect?.photos?.[0] ? (
                            <img
                              src={person.photoUrl || matchedSuspect?.photos?.[0]}
                              alt={person.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <User className="w-6 h-6 stroke-[1.5]" />
                            </div>
                          )}
                        </div>

                        {/* Person Info */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-white uppercase tracking-wide truncate group-hover:text-blue-400 transition-colors">
                            {person.name}
                          </h4>
                          <p className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider truncate mt-0.5">
                            VULGO: {person.vulgo || "N/I"}
                          </p>
                          {person.document && (
                            <p className="text-[9px] font-mono text-zinc-500 truncate mt-0.5">
                              {person.document}
                            </p>
                          )}
                        </div>

                        {matchedSuspect && onViewSuspect && (
                          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-zinc-500 italic font-mono uppercase">
                    Nenhum indivíduo associado.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Agent in Charge */}
        <div className="pt-4 mt-4 border-t border-[#1b2742] flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            <span>Encarregado:</span>
            <span className="text-zinc-300 font-bold">{occurrence.agentInCharge || "Não Informado"}</span>
          </div>

          <div className="text-zinc-600">
            ID: {occurrence.id.toUpperCase()}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
