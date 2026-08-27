import React from 'react';
import { CalculatedShelterReading, Shelter } from '../../types';
import { Users, Home, UserCheck, Database, Building2 } from 'lucide-react';

interface ShelterStatsSummaryProps {
  shelters: Shelter[];
  readings: CalculatedShelterReading[];
}

export const ShelterStatsSummary: React.FC<ShelterStatsSummaryProps> = ({ shelters, readings }) => {
  // Compute latest reading for each shelter
  const latestMap = new Map<string, CalculatedShelterReading>();
  readings.forEach(r => {
    if (!latestMap.has(r.shelterId)) {
      latestMap.set(r.shelterId, r);
    }
  });

  let totalPeople = 0;
  let totalFamilies = 0;
  let activeSheltersCount = 0;
  const aggregatedDemographics: Record<string, number> = {};

  shelters.forEach(shelter => {
    if (shelter.status === 'ativo') {
      activeSheltersCount++;
    }
    const latest = latestMap.get(shelter.id);
    if (latest) {
      totalPeople += latest.peopleCount;
      totalFamilies += latest.familiesCount;

      if (latest.demographics) {
        Object.entries(latest.demographics).forEach(([cat, val]) => {
          aggregatedDemographics[cat] = (aggregatedDemographics[cat] || 0) + val;
        });
      }
    }
  });

  const demographicEntries = Object.entries(aggregatedDemographics);

  return (
    <div id="shelter-stats-summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      
      {/* Total Abrigados */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total de Pessoas
          </span>
          <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/50">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {totalPeople.toLocaleString('pt-BR')}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-indigo-400 font-semibold">Pessoas Acolhidas na Região</span>
          </p>
        </div>
      </div>

      {/* Total Famílias */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total de Famílias
          </span>
          <div className="p-2 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/50">
            <Home className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {totalFamilies.toLocaleString('pt-BR')}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Média: <strong className="text-slate-300">{(totalFamilies > 0 ? (totalPeople / totalFamilies).toFixed(1) : '0')} pessoas/família</strong>
          </p>
        </div>
      </div>

      {/* Rede de Abrigos */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Pontos de Acolhimento
          </span>
          <div className="p-2 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/50">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {shelters.length} <span className="text-xs font-normal text-slate-400">locais</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{activeSheltersCount} abrigos em operação ativa</span>
          </p>
        </div>
      </div>

      {/* Perfil / Categorias Agregadas */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Perfil Mapeado (Geral)
          </span>
          <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/50">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          {demographicEntries.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
              {demographicEntries.map(([cat, count]) => (
                <span
                  key={cat}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/50 text-emerald-200 font-semibold flex items-center gap-1"
                >
                  <span>{cat}:</span>
                  <span className="font-mono text-white font-bold">{count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic mt-2">
              Lançamentos por perfil ainda não registrados.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};
