import React, { useState } from 'react';
import {
  AlertOctagon,
  Plus,
  Search,
  MapPin,
  Calendar,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Maximize2,
  X,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Compass,
  ImageIcon,
  ShieldCheck,
  Share2,
  Navigation,
  FileText
} from 'lucide-react';
import { BlockedRoad, RoadBlockStatus } from '../../types';
import { RoadBlockMap } from './RoadBlockMap';
import { RoadBlockFormModal } from './RoadBlockFormModal';

const DEFAULT_VALE_CITIES = [
  'Lajeado', 'Estrela', 'Arroio do Meio', 'Encantado', 'Muçum',
  'Roca Sales', 'Cruzeiro do Sul', 'Taquari', 'Bom Retiro do Sul', 'Santa Tereza'
];

interface BlockedRoadsPageProps {
  blockedRoads: BlockedRoad[];
  onAddRoad: (road: Omit<BlockedRoad, 'id' | 'createdAt'>) => void;
  onUpdateRoad: (id: string, road: Partial<BlockedRoad>) => void;
  onDeleteRoad: (id: string) => void;
  isAdminAuthorized?: boolean;
  onRequestAdminAuth?: (actionName: string, callback: () => void) => void;
}

export const BlockedRoadsPage: React.FC<BlockedRoadsPageProps> = ({
  blockedRoads,
  onAddRoad,
  onUpdateRoad,
  onDeleteRoad,
  isAdminAuthorized = false,
  onRequestAdminAuth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRoad, setEditingRoad] = useState<BlockedRoad | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [roadToDelete, setRoadToDelete] = useState<BlockedRoad | null>(null);

  // Extract unique cities list
  const uniqueCities = Array.from(
    new Set(blockedRoads.map((r) => r.cityName))
  ).sort();

  // Filter roads by search term and tab
  const filteredRoads = blockedRoads.filter((road) => {
    if (statusFilter !== 'all' && road.status !== statusFilter) return false;
    if (selectedCityFilter !== 'all' && road.cityName !== selectedCityFilter) return false;

    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    const matchLocation = road.locationName.toLowerCase().includes(query);
    const matchCity = road.cityName.toLowerCase().includes(query);
    const matchReason = road.reason?.toLowerCase().includes(query) || false;

    return matchLocation || matchCity || matchReason;
  });

  // Selected road object for popup details modal
  const selectedRoad = selectedRoadId ? blockedRoads.find((r) => r.id === selectedRoadId) || null : null;

  // Counters
  const totalCount = blockedRoads.length;
  const totalBlockCount = blockedRoads.filter((r) => r.status === 'total').length;
  const partialBlockCount = blockedRoads.filter((r) => r.status === 'parcial').length;
  const releasedCount = blockedRoads.filter((r) => r.status === 'liberado').length;

  const handleOpenAddModal = () => {
    if (!isAdminAuthorized && onRequestAdminAuth) {
      onRequestAdminAuth('Cadastrar Via Interditada', () => {
        setEditingRoad(null);
        setIsFormModalOpen(true);
      });
    } else {
      setEditingRoad(null);
      setIsFormModalOpen(true);
    }
  };

  const handleOpenEditModal = (road: BlockedRoad) => {
    if (!isAdminAuthorized && onRequestAdminAuth) {
      onRequestAdminAuth('Editar Via Interditada', () => {
        setEditingRoad(road);
        setIsFormModalOpen(true);
      });
    } else {
      setEditingRoad(road);
      setIsFormModalOpen(true);
    }
  };

  const handleDeleteRequest = (road: BlockedRoad) => {
    setRoadToDelete(road);
  };

  const confirmDeleteRoad = () => {
    if (!roadToDelete) return;
    const targetRoad = roadToDelete;

    const performDeletion = () => {
      onDeleteRoad(targetRoad.id);
      if (selectedRoadId === targetRoad.id) {
        setSelectedRoadId(null);
      }
      setRoadToDelete(null);
    };

    if (!isAdminAuthorized && onRequestAdminAuth) {
      setRoadToDelete(null);
      onRequestAdminAuth(`Excluir Via Interditada ("${targetRoad.locationName}")`, () => {
        onDeleteRoad(targetRoad.id);
        if (selectedRoadId === targetRoad.id) {
          setSelectedRoadId(null);
        }
      });
    } else {
      performDeletion();
    }
  };

  const handleFormSave = (data: Omit<BlockedRoad, 'id' | 'createdAt'> & { id?: string }) => {
    if (data.id) {
      onUpdateRoad(data.id, data);
    } else {
      onAddRoad(data);
    }
  };

  const renderStatusBadge = (status: RoadBlockStatus) => {
    switch (status) {
      case 'total':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/90 text-red-300 border border-red-800/80 text-xs font-black shadow-inner">
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            Bloqueio Total
          </span>
        );
      case 'parcial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/90 text-amber-300 border border-amber-800/80 text-xs font-black shadow-inner">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Meia Pista (Parcial)
          </span>
        );
      case 'liberado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-800/80 text-xs font-black shadow-inner">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Via Liberada
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      
      {/* Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-red-950/70 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-950/90 border border-red-800/80 text-red-300 text-xs font-bold shadow-inner">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              Mapeamento de Trânsito & Defesa Civil
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Vias Interditadas no Vale do Taquari
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consulte em tempo real no mapa interativo os trechos, pontes e ruas bloqueadas por alagamento, deslizamento ou avarias na região. Veja a foto anexada e a previsão de liberação.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg hover:shadow-red-900/30 transition-all transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Cadastrar Via Interditada</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total de Vias Mapeadas</span>
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalCount}</div>
          <p className="text-[11px] text-slate-400">Pontos em acompanhamento</p>
        </div>

        <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-bold uppercase tracking-wider">Bloqueio Total</span>
            <AlertOctagon className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-300">{totalBlockCount}</div>
          <p className="text-[11px] text-red-400/80">Trânsito totalmente interrompido</p>
        </div>

        <div className="bg-slate-900 border border-amber-900/40 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-bold uppercase tracking-wider">Meia Pista</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{partialBlockCount}</div>
          <p className="text-[11px] text-amber-400/80">Requer atenção redobrada</p>
        </div>

        <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Vias Liberadas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">{releasedCount}</div>
          <p className="text-[11px] text-emerald-400/80">Trânsito normalizado</p>
        </div>

      </div>

      {/* Filter and Search Bar above Map */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-extrabold text-white">
              Filtrar Pontos de Interdição no Mapa
            </h2>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por rua, avenida, motivo ou cidade..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todos ({blockedRoads.length})
          </button>
          <button
            onClick={() => setStatusFilter('total')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'total'
                ? 'bg-red-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:text-red-300 border border-slate-800'
            }`}
          >
            Bloqueio Total ({totalBlockCount})
          </button>
          <button
            onClick={() => setStatusFilter('parcial')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'parcial'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            Meia Pista ({partialBlockCount})
          </button>
          <button
            onClick={() => setStatusFilter('liberado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'liberado'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            Liberadas ({releasedCount})
          </button>

          {/* City Filter Dropdown */}
          {uniqueCities.length > 0 && (
            <div className="ml-auto">
              <select
                value={selectedCityFilter}
                onChange={(e) => setSelectedCityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Filtrar por Cidade (Todas)</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Map Section (Full Width) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-slate-900 p-4 border border-slate-800 rounded-2xl shadow-md">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-extrabold text-white">
              Mapa Interativo de Vias Bloqueadas
            </h2>
          </div>
          <span className="text-xs text-slate-300 font-semibold hidden sm:inline">
            Clique em um ponto no mapa para abrir o card com a foto e informações detalhadas
          </span>
        </div>

        <RoadBlockMap
          blockedRoads={filteredRoads}
          selectedRoadId={selectedRoad?.id}
          onSelectRoad={(road) => setSelectedRoadId(road.id)}
          height="580px"
        />
      </div>

      {/* Histórico Detalhado das Vias Interditadas */}
      <div id="historico-vias" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-950/80 border border-red-800/80 rounded-xl text-red-400">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-extrabold text-white">
                Histórico Detalhado das Vias Interditadas
              </h2>
            </div>
            <p className="text-xs text-slate-300 font-medium pl-9">
              Gerencie os registros de interdição, filtre por município ou altere o status das vias.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Via</span>
            </button>
          </div>
        </div>

        {/* Detailed Section Filters: City, Status, Search */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
          
          {/* City Filter Dropdown */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Filtrar por Cidade:</span>
            </label>
            <select
              value={selectedCityFilter}
              onChange={(e) => setSelectedCityFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">Todas as Cidades ({blockedRoads.length} registros)</option>
              {Array.from(new Set([...uniqueCities, ...DEFAULT_VALE_CITIES])).sort().map((city) => {
                const countForCity = blockedRoads.filter((r) => r.cityName === city).length;
                return (
                  <option key={city} value={city}>
                    {city} ({countForCity})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Status da Interdição:</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="total">Bloqueio Total ({totalBlockCount})</option>
              <option value="parcial">Meia Pista / Parcial ({partialBlockCount})</option>
              <option value="liberado">Liberada / Normalizada ({releasedCount})</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Buscar por Nome/Motivo:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: ERS-130, ponte, alagamento..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Detailed Table / Cards View */}
        {filteredRoads.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
            <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">Nenhum registro encontrado</p>
            <p className="text-xs text-slate-500">
              {selectedCityFilter !== 'all'
                ? `Não há interdições cadastradas para a cidade de "${selectedCityFilter}".`
                : 'Tente alterar os filtros de busca ou cadastrar uma nova via.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800/80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">Foto</th>
                    <th className="py-3 px-4">Cidade</th>
                    <th className="py-3 px-4">Local / Via</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Motivo / Observação</th>
                    <th className="py-3 px-4">Registro / Previsão</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredRoads.map((road) => {
                    const isSelected = selectedRoad?.id === road.id;

                    return (
                      <tr
                        key={road.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-cyan-950/30' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Thumbnail */}
                        <td className="py-3 px-4">
                          {road.imageUrl ? (
                            <div
                              onClick={() => setLightboxImageUrl(road.imageUrl || null)}
                              className="relative w-12 h-12 rounded-xl overflow-hidden bg-black border border-slate-800 cursor-pointer group"
                              title="Ampliar foto"
                            >
                              <img
                                src={road.imageUrl}
                                alt={road.locationName}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Maximize2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center text-slate-600">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                        </td>

                        {/* City */}
                        <td className="py-3 px-4 font-bold text-slate-200 whitespace-nowrap">
                          <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                            📍 {road.cityName}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-extrabold text-white text-xs leading-snug">
                            {road.locationName}
                          </div>
                          {road.notes && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5" title={road.notes}>
                              {road.notes}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderStatusBadge(road.status)}
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-4 max-w-xs text-slate-300">
                          <span className="line-clamp-2" title={road.reason || '-'}>
                            {road.reason || <span className="text-slate-600 italic">Sem motivo informado</span>}
                          </span>
                        </td>

                        {/* Reported / Expected */}
                        <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-400 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(road.reportedAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                          {road.expectedRelease ? (
                            <div className="flex items-center gap-1 text-cyan-400 font-semibold">
                              <Calendar className="w-3 h-3" />
                              <span>Prev: {road.expectedRelease}</span>
                            </div>
                          ) : (
                            <div className="text-slate-600 text-[10px]">Sem previsão</div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedRoadId(road.id)}
                              className="p-1.5 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-400 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                              title="Ver detalhes no mapa / foto"
                            >
                              <Compass className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(road)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                              title="Editar via"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRequest(road);
                              }}
                              className="p-1.5 bg-red-950/60 hover:bg-red-900 text-red-400 rounded-lg border border-red-800/50 transition-colors cursor-pointer"
                              title="Excluir via"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {filteredRoads.map((road) => (
                <div
                  key={road.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex gap-3">
                    {road.imageUrl ? (
                      <img
                        src={road.imageUrl}
                        alt={road.locationName}
                        onClick={() => setLightboxImageUrl(road.imageUrl || null)}
                        className="w-16 h-16 rounded-xl object-cover bg-black border border-slate-800 shrink-0 cursor-pointer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-slate-600">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {road.cityName}
                        </span>
                        {renderStatusBadge(road.status)}
                      </div>
                      <h4 className="text-xs font-extrabold text-white leading-snug">
                        {road.locationName}
                      </h4>
                    </div>
                  </div>

                  {road.reason && (
                    <p className="text-xs text-slate-300 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                      <span className="font-bold text-slate-200">Motivo: </span>
                      {road.reason}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                    <span>{new Date(road.reportedAt).toLocaleDateString('pt-BR')}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedRoadId(road.id)}
                        className="p-2 bg-slate-800 text-slate-200 rounded-xl border border-slate-700"
                        title="Ver foto / card"
                      >
                        <Compass className="w-4 h-4 text-cyan-400" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(road)}
                        className="p-2 bg-slate-800 text-slate-200 rounded-xl border border-slate-700"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRequest(road);
                        }}
                        className="p-2 bg-red-950/60 hover:bg-red-900 text-red-400 rounded-xl border border-red-800/50 transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      {/* Selected Road Details Card Modal (Opens when clicking a map marker) */}
      {selectedRoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedRoadId(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Status & City Badges */}
            <div className="flex items-center gap-2 pr-8">
              {renderStatusBadge(selectedRoad.status)}
              <span className="text-xs font-bold text-slate-300 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                {selectedRoad.cityName}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-extrabold text-white leading-snug">
              {selectedRoad.locationName}
            </h3>

            {/* Photo Attachment Container */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black group aspect-video">
              {selectedRoad.imageUrl ? (
                <>
                  <img
                    src={selectedRoad.imageUrl}
                    alt={selectedRoad.locationName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                  <button
                    onClick={() => setLightboxImageUrl(selectedRoad.imageUrl || null)}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-slate-950/80 text-white hover:bg-cyan-500 hover:text-slate-950 transition-colors backdrop-blur-md cursor-pointer"
                    title="Ampliar Foto"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-semibold text-slate-200">
                    <span className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                      <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                      Foto Anexada da Interdição
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-500 bg-slate-950/80 space-y-2">
                  <ImageIcon className="w-10 h-10 text-slate-700" />
                  <p className="text-xs font-medium">Nenhuma foto anexada para esta via</p>
                </div>
              )}
            </div>

            {/* Details List */}
            <div className="space-y-3 text-xs text-slate-300 bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80">
              {selectedRoad.reason && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200">Motivo: </span>
                    <span>{selectedRoad.reason}</span>
                  </div>
                </div>
              )}

              {selectedRoad.expectedRelease && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200">Previsão de Liberação: </span>
                    <span className="text-cyan-300 font-semibold">{selectedRoad.expectedRelease}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-200">Registro: </span>
                  <span>{new Date(selectedRoad.reportedAt).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {selectedRoad.notes && (
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">Desvios & Observações: </span>
                  {selectedRoad.notes}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedRoad.latitude},${selectedRoad.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Abrir no Google Maps</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(selectedRoad)}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  title="Editar Registro"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(selectedRoad);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-red-950/60 hover:bg-red-900 text-red-400 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-red-800/40"
                  title="Excluir Registro"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {roadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-950/80 text-red-400 rounded-2xl border border-red-800/60 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Confirmar Exclusão</h3>
                <p className="text-xs text-slate-400">Esta ação removerá o registro do sistema</p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Localidade / Trecho</p>
              <p className="text-sm font-extrabold text-slate-100">{roadToDelete.locationName}</p>
              <p className="text-xs text-slate-400">{roadToDelete.cityName} - {roadToDelete.roadName}</p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza de que deseja excluir permanentemente o registro de interdição desta via?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRoadToDelete(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoad}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-lg shadow-red-950/50 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Photo Enlarge */}
      {lightboxImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute top-3 right-3 p-2 bg-slate-900/80 text-white rounded-full hover:bg-slate-800 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Foto da via interditada"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Register / Edit Form Modal */}
      <RoadBlockFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleFormSave}
        initialData={editingRoad}
        cityList={uniqueCities.length > 0 ? uniqueCities : DEFAULT_VALE_CITIES}
      />

    </div>
  );
};
