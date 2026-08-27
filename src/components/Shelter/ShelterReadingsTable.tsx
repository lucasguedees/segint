import React, { useState, useMemo, useEffect } from 'react';
import { Shelter, CalculatedShelterReading } from '../../types';
import { formatShelterDate } from '../../utils/shelterUtils';
import {
  Search,
  Filter,
  Download,
  Users,
  Home,
  Database,
  Calendar,
  Clock,
  Edit,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  MapPin
} from 'lucide-react';

interface ShelterReadingsTableProps {
  readings: CalculatedShelterReading[];
  shelters: Shelter[];
  selectedCity?: string;
  onEditReading: (reading: CalculatedShelterReading) => void;
  onDeleteReading: (readingId: string) => void;
  onClearAllReadings?: (readingIds?: string[]) => void;
  onExportCSV: () => void;
  onOpenNewReadingModal: () => void;
  isAdminAuthorized?: boolean;
}

const ShelterReadingsTableComponent: React.FC<ShelterReadingsTableProps> = ({
  readings,
  shelters,
  selectedCity = 'all',
  onEditReading,
  onDeleteReading,
  onClearAllReadings,
  onExportCSV,
  onOpenNewReadingModal,
  isAdminAuthorized = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>(selectedCity);
  const [selectedShelterFilter, setSelectedShelterFilter] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Sync prop selectedCity with local filter state
  useEffect(() => {
    setSelectedCityFilter(selectedCity);
  }, [selectedCity]);

  // Extract unique cities from shelters
  const uniqueCities = useMemo(() => {
    const map = new Map<string, string>();
    shelters.forEach(s => {
      const key = s.cityId || s.cityName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, s.cityName);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [shelters]);

  // Filter readings based on search and filters
  const filteredReadings = useMemo(() => {
    return readings.filter(reading => {
      // City filter
      if (selectedCityFilter !== 'all') {
        const matchingShelter = shelters.find(s => s.id === reading.shelterId);
        const shelterCityKey = matchingShelter ? (matchingShelter.cityId || matchingShelter.cityName.toLowerCase()) : reading.cityName.toLowerCase();
        if (shelterCityKey !== selectedCityFilter && reading.cityName.toLowerCase() !== selectedCityFilter) {
          return false;
        }
      }

      // Shelter filter
      if (selectedShelterFilter !== 'all' && reading.shelterId !== selectedShelterFilter) {
        return false;
      }

      // Text search filter
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesShelter = reading.shelterName.toLowerCase().includes(term);
        const matchesCity = reading.cityName.toLowerCase().includes(term);
        const matchesNotes = (reading.notes || '').toLowerCase().includes(term);
        const matchesDate = reading.dateStr.includes(term) || reading.timeStr.includes(term);

        return matchesShelter || matchesCity || matchesNotes || matchesDate;
      }

      return true;
    });
  }, [readings, shelters, selectedCityFilter, selectedShelterFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCityFilter, selectedShelterFilter, searchTerm, pageSize]);

  const totalPages = Math.ceil(filteredReadings.length / pageSize) || 1;
  const paginatedReadings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReadings.slice(start, start + pageSize);
  }, [filteredReadings, currentPage, pageSize]);

  return (
    <div id="shelter-readings-history-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
      
      {/* Table Header Controls */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Histórico Pretérito de Cadastros e Atualizações
            </h2>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
              Registro contínuo e histórico sem perda de dados pretéritos ({readings.length} lançamentos gravados)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdminAuthorized && filteredReadings.length > 0 && onClearAllReadings && (
              <button
                onClick={() => onClearAllReadings(filteredReadings.map(r => r.id))}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-semibold text-xs rounded-xl border border-red-200 dark:border-red-800/60 transition-colors cursor-pointer"
                title="Excluir lançamentos selecionados do histórico"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Histórico ({filteredReadings.length})
              </button>
            )}

            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Exportar dados históricos de abrigos em CSV"
            >
              <Download className="w-4 h-4 text-slate-400" />
              CSV
            </button>

            <button
              onClick={onOpenNewReadingModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              + Novo Registro
            </button>
          </div>
        </div>

        {/* Filter Inputs Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por abrigo, cidade, observações..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl">
            <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <select
              value={selectedCityFilter}
              onChange={e => setSelectedCityFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900">Todas as Cidades</option>
              {uniqueCities.map(([cityId, cityName]) => (
                <option key={cityId} value={cityId} className="bg-white dark:bg-slate-900">
                  {cityName}
                </option>
              ))}
            </select>
          </div>

          {/* Shelter Filter */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={selectedShelterFilter}
              onChange={e => setSelectedShelterFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900">Todos os Abrigos ({shelters.length})</option>
              {shelters.map(s => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-slate-900">
                  {s.cityName} - {s.name}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Table Data View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Data & Hora</th>
              <th className="py-3 px-4">Abrigo e Cidade</th>
              <th className="py-3 px-4 text-right">Pessoas</th>
              <th className="py-3 px-4 text-right">Famílias</th>
              <th className="py-3 px-4">Perfil / Grupos</th>
              <th className="py-3 px-4">Observações / Necessidades</th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {paginatedReadings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-6 h-6 text-slate-500" />
                    <span>Nenhum registro histórico atende aos critérios de busca.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedReadings.map(reading => {
                const demoEntries = Object.entries(reading.demographics || {});
                return (
                  <tr
                    key={reading.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatShelterDate(reading.dateStr)}</span>
                        <Clock className="w-3.5 h-3.5 text-slate-400 ml-1" />
                        <span className="font-bold text-slate-900 dark:text-white">{reading.timeStr}</span>
                      </div>
                    </td>

                    {/* Shelter & City */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                        {reading.shelterName}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        {reading.cityName}
                      </div>
                    </td>

                    {/* People */}
                    <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                      {reading.peopleCount.toLocaleString('pt-BR')}
                    </td>

                    {/* Families */}
                    <td className="py-3 px-4 text-right font-bold text-purple-600 dark:text-purple-400 text-sm">
                      {reading.familiesCount.toLocaleString('pt-BR')}
                    </td>

                    {/* Demographics / Profile */}
                    <td className="py-3 px-4">
                      {demoEntries.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {demoEntries.map(([cat, count]) => (
                            <span
                              key={cat}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              <span className="font-medium">{cat}:</span>
                              <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{count}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Geral</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={reading.notes}>
                      {reading.notes || <span className="text-slate-400 dark:text-slate-600 italic">Sem observações</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditReading(reading)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors cursor-pointer"
                          title="Editar lançamento histórico"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDeleteReading(reading.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info & Pagination */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>Exibindo {(currentPage - 1) * pageSize + 1} até {Math.min(currentPage * pageSize, filteredReadings.length)} de <strong>{filteredReadings.length}</strong> cadastros</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="ml-2 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
          >
            <option value={15}>15 por página</option>
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
          </select>
        </div>

        {filteredReadings.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Primeira
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Anterior
            </button>
            <span className="px-2 font-semibold text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Próxima
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Última
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export const ShelterReadingsTable = React.memo(ShelterReadingsTableComponent);
