import React, { useMemo } from 'react';
import { Shelter, CalculatedShelterReading } from '../../types';
import { getShelterLatestReading, getShelterStatusBadgeStyle, formatShelterDate } from '../../utils/shelterUtils';
import { Users, Home, Plus, Edit2, Trash2, Phone, MapPin, Building, Database, UserCheck, Filter, Building2 } from 'lucide-react';

interface ShelterOverviewCardsProps {
  shelters: Shelter[];
  readings: CalculatedShelterReading[];
  selectedCity?: string;
  onSelectCity?: (cityId: string) => void;
  selectedShelterId: string | null;
  onSelectShelter: (shelterId: string | null) => void;
  onOpenReadingModal: (shelterId: string) => void;
  onOpenEditShelterModal: (shelter: Shelter) => void;
  onOpenNewShelterModal: () => void;
  onDeleteShelter?: (shelterId: string) => void;
  isAdminAuthorized?: boolean;
}

const ShelterOverviewCardsComponent: React.FC<ShelterOverviewCardsProps> = ({
  shelters,
  readings,
  selectedCity = 'all',
  onSelectCity,
  selectedShelterId,
  onSelectShelter,
  onOpenReadingModal,
  onOpenEditShelterModal,
  onOpenNewShelterModal,
  onDeleteShelter,
  isAdminAuthorized = false,
}) => {
  // Extract unique cities from shelters with count
  const cityList = useMemo(() => {
    const map = new Map<string, { cityId: string; cityName: string; count: number }>();
    shelters.forEach(s => {
      const key = s.cityId || s.cityName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { cityId: key, cityName: s.cityName, count: 0 });
      }
      map.get(key)!.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.cityName.localeCompare(b.cityName));
  }, [shelters]);

  // Filter shelters according to selected city
  const filteredShelters = useMemo(() => {
    if (!selectedCity || selectedCity === 'all') {
      return shelters;
    }
    return shelters.filter(s => (s.cityId || s.cityName.toLowerCase()) === selectedCity);
  }, [shelters, selectedCity]);

  return (
    <div id="shelter-overview-cards" className="space-y-4">
      
      {/* Top Bar / Header & City Filter */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-400" />
              Abrigos Cadastrados no Vale do Taquari
            </h2>
            <p className="text-xs font-medium text-slate-300 mt-0.5">
              Filtre os abrigos por município para visualizar todos os locais de acolhimento da cidade selecionada
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewShelterModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
              title="Cadastrar Novo Abrigo no Vale do Taquari"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Novo Abrigo
            </button>
          </div>
        </div>

        {/* City Filter Pills */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5 flex-shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            Filtrar por Cidade:
          </span>

          <button
            onClick={() => onSelectCity?.('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCity === 'all'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Todas as Cidades</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/50 text-indigo-200 font-mono">
              {shelters.length}
            </span>
          </button>

          {cityList.map(item => {
            const isSelected = selectedCity === item.cityId;
            return (
              <button
                key={item.cityId}
                onClick={() => onSelectCity?.(item.cityId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
              >
                <span>{item.cityName}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-950/60 text-slate-400'
                }`}>
                  {item.count} {item.count === 1 ? 'abrigo' : 'abrigos'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Shelter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShelters.map(shelter => {
          const latest = getShelterLatestReading(shelter.id, readings);
          const people = latest ? latest.peopleCount : 0;
          const families = latest ? latest.familiesCount : 0;
          const badge = getShelterStatusBadgeStyle(shelter.status);
          const demographics = latest?.demographics || {};
          const demographicEntries = Object.entries(demographics);

          return (
            <div
              key={shelter.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-all flex flex-col justify-between hover:border-slate-700 shadow-sm"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded-md border border-indigo-800/60">
                      {shelter.cityName}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5 line-clamp-1">
                      {shelter.name}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} whitespace-nowrap`}>
                    <span className={`w-2 h-2 rounded-full ${badge.dotColor}`} />
                    {badge.label}
                  </span>
                </div>

                {/* Address & Contact info */}
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  {shelter.address && (
                    <div className="flex items-center gap-1.5 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span>{shelter.address}</span>
                    </div>
                  )}
                  {shelter.contact && (
                    <div className="flex items-center gap-1.5 line-clamp-1">
                      <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span>{shelter.contact}</span>
                    </div>
                  )}
                </div>

                {/* Main Counts Panel */}
                <div className="mt-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                        <Users className="w-3 h-3 text-indigo-400" /> Total Pessoas
                      </span>
                      <span className="text-xl font-extrabold text-white">
                        {people.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                        <Home className="w-3 h-3 text-purple-400" /> Total Famílias
                      </span>
                      <span className="text-xl font-extrabold text-white">
                        {families.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Demographic profile tags if available */}
                  {demographicEntries.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] uppercase font-bold text-indigo-300 flex items-center gap-1 mb-1.5">
                        <UserCheck className="w-3 h-3 text-indigo-400" /> Perfil Detalhado
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {demographicEntries.map(([cat, count]) => (
                          <span
                            key={cat}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800/50 text-indigo-200 font-semibold flex items-center gap-1"
                          >
                            <span>{cat}:</span>
                            <span className="font-mono text-white font-bold">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Latest Reading Metadata & Source */}
                {latest ? (
                  <div className="mt-3 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-300">Última Atualização:</span>
                      <span className="text-slate-400 font-mono">
                        {formatShelterDate(latest.dateStr, latest.timeStr)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-300 flex items-center gap-1">
                        <Database className="w-3 h-3 text-slate-500" /> Fonte do Dado:
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-950/60 text-indigo-300 font-semibold rounded border border-indigo-800/40 text-[10px]">
                        {latest.dataSource}
                      </span>
                    </div>
                    {latest.notes && (
                      <p className="text-[10px] text-slate-400 italic mt-1 line-clamp-1">
                        "{latest.notes}"
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500 italic text-center p-2 bg-slate-950/40 rounded-lg">
                    Nenhuma atualização registrada ainda.
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                {onDeleteShelter && (
                  <button
                    onClick={() => onDeleteShelter(shelter.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1 border border-rose-800/40"
                    title="Excluir este abrigo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                )}

                <button
                  onClick={() => onOpenEditShelterModal(shelter)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Editar dados cadastrais do abrigo"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>

                <button
                  onClick={() => onOpenReadingModal(shelter.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                  title="Lançar Nível de Pessoas e Famílias Abrigadas"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Lançar Dados
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {filteredShelters.length === 0 && (
        <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400">
          Nenhum abrigo cadastrado encontrado para o município selecionado.
        </div>
      )}

    </div>
  );
};

export const ShelterOverviewCards = React.memo(ShelterOverviewCardsComponent);

