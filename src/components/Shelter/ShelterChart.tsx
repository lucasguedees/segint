import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Shelter, CalculatedShelterReading, TimeInterval } from '../../types';
import { Users, Home, TrendingUp, Filter, BarChart3, Layers, MapPin } from 'lucide-react';
import { formatShelterDate } from '../../utils/shelterUtils';

interface ShelterChartProps {
  shelters: Shelter[];
  readings: CalculatedShelterReading[];
  selectedCity?: string;
  onSelectCity?: (cityId: string) => void;
  selectedShelterId: string | null;
  onSelectShelter: (shelterId: string | null) => void;
}

type ChartMetric = 'people' | 'families';

const ShelterChartComponent: React.FC<ShelterChartProps> = ({
  shelters,
  readings,
  selectedCity = 'all',
  onSelectCity,
  selectedShelterId,
  onSelectShelter,
}) => {
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('48h');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('people');

  const activeShelter = useMemo(() => {
    return shelters.find(s => s.id === selectedShelterId) || null;
  }, [shelters, selectedShelterId]);

  // Unique cities list for the city filter dropdown
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

  // Filter shelters dropdown according to chosen city
  const sheltersForCity = useMemo(() => {
    if (!selectedCity || selectedCity === 'all') return shelters;
    return shelters.filter(s => (s.cityId || s.cityName.toLowerCase()) === selectedCity);
  }, [shelters, selectedCity]);

  // Filter readings by city, shelter and time interval
  const filteredChartData = useMemo(() => {
    let dataset = [...readings];

    if (selectedShelterId) {
      dataset = dataset.filter(r => r.shelterId === selectedShelterId);
    } else if (selectedCity && selectedCity !== 'all') {
      const cityShelterIds = new Set(
        shelters
          .filter(s => (s.cityId || s.cityName.toLowerCase()) === selectedCity)
          .map(s => s.id)
      );
      dataset = dataset.filter(r => cityShelterIds.has(r.shelterId) || r.cityName.toLowerCase() === selectedCity);
    }

    if (timeInterval !== 'all') {
      const hoursMap: Record<TimeInterval, number> = {
        '24h': 24,
        '48h': 48,
        '7d': 168,
        '30d': 720,
        'all': 999999,
      };
      const cutoffHours = hoursMap[timeInterval];
      const cutoffTime = new Date(Date.now() - cutoffHours * 3600 * 1000).getTime();

      const getSortKey = (r: { timestamp: string; dateStr?: string; timeStr?: string }) => {
        return (r.dateStr && r.timeStr) ? `${r.dateStr}T${r.timeStr}` : r.timestamp;
      };

      const cutoffMs = Date.now() - cutoffHours * 3600 * 1000;
      const cutoffDate = new Date(cutoffMs);
      const cutoffY = cutoffDate.getFullYear();
      const cutoffM = String(cutoffDate.getMonth() + 1).padStart(2, '0');
      const cutoffD = String(cutoffDate.getDate()).padStart(2, '0');
      const cutoffH = String(cutoffDate.getHours()).padStart(2, '0');
      const cutoffMin = String(cutoffDate.getMinutes()).padStart(2, '0');
      const cutoffKey = `${cutoffY}-${cutoffM}-${cutoffD}T${cutoffH}:${cutoffMin}`;

      dataset = dataset.filter(r => getSortKey(r) >= cutoffKey);
    }

    // Sort chronologically ascending for Recharts timeline
    dataset.sort((a, b) => {
      const getSortKey = (r: { timestamp: string; dateStr?: string; timeStr?: string }) => {
        return (r.dateStr && r.timeStr) ? `${r.dateStr}T${r.timeStr}` : r.timestamp;
      };
      const ka = getSortKey(a);
      const kb = getSortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    // Format for chart display
    return dataset.map(r => {
      const formattedDate = formatShelterDate(r.dateStr, r.timeStr);
      return {
        ...r,
        displayLabel: `${r.dateStr.slice(5)} ${r.timeStr}`,
        formattedDate,
      };
    });
  }, [readings, shelters, selectedCity, selectedShelterId, timeInterval]);

  return (
    <div id="shelter-chart-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-5 space-y-4">
      
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                Evolução Temporal dos Abrigos
                {activeShelter ? (
                  <span className="text-xs px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-bold rounded-full border border-indigo-300 dark:border-indigo-700 shadow-xs">
                    {activeShelter.name}
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-full border border-slate-300 dark:border-slate-700 shadow-xs">
                    Visão Geral de Todos os Abrigos
                  </span>
                )}
              </h2>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                Histórico acumulado do número de pessoas e famílias desabrigadas acolhidas
              </p>
            </div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* City Selector dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <MapPin className="w-3.5 h-3.5 text-indigo-500 ml-1.5 flex-shrink-0" />
            <select
              value={selectedCity}
              onChange={e => {
                if (onSelectCity) onSelectCity(e.target.value);
                if (selectedShelterId) {
                  const s = shelters.find(sh => sh.id === selectedShelterId);
                  if (s && e.target.value !== 'all' && (s.cityId || s.cityName.toLowerCase()) !== e.target.value) {
                    onSelectShelter(null);
                  }
                }
              }}
              className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none pr-2 py-1 cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                Todas as Cidades
              </option>
              {uniqueCities.map(([cityId, cityName]) => (
                <option key={cityId} value={cityId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {cityName}
                </option>
              ))}
            </select>
          </div>

          {/* Shelter Selector dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={selectedShelterId || ''}
              onChange={e => onSelectShelter(e.target.value ? e.target.value : null)}
              className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none pr-2 py-1 cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                {selectedCity !== 'all' ? 'Todos os Abrigos da Cidade' : 'Todos os Abrigos'}
              </option>
              {sheltersForCity.map(s => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {s.cityName} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Metric Selector Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setChartMetric('people')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                chartMetric === 'people'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pessoas
            </button>
            <button
              onClick={() => setChartMetric('families')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                chartMetric === 'families'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Famílias
            </button>
          </div>

          {/* Time Interval Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {(['24h', '48h', '7d', '30d', 'all'] as TimeInterval[]).map(interval => (
              <button
                key={interval}
                onClick={() => setTimeInterval(interval)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                  timeInterval === interval
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {interval === 'all' ? 'Tudo' : interval}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Chart Visual Canvas */}
      <div className="h-72 w-full pt-2">
        {filteredChartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
            <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
            <p>Nenhum dado de histórico encontrado para o filtro selecionado.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <defs>
                {/* People Gradient */}
                <linearGradient id="colorPeople" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>

                {/* Families Gradient */}
                <linearGradient id="colorFamilies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>

                {/* Occupancy Gradient */}
                <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />

              <XAxis
                dataKey="displayLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                dy={8}
              />

              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as CalculatedShelterReading & { formattedDate: string };
                    return (
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-xl shadow-xl p-3 text-xs space-y-1.5 min-w-[200px]">
                        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                          {data.shelterName} ({data.cityName})
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Data/Hora: <span className="font-mono text-slate-200">{data.formattedDate}</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-indigo-400 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Pessoas:
                          </span>
                          <span className="text-white text-sm">{data.peopleCount.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-purple-400 flex items-center gap-1">
                            <Home className="w-3 h-3" /> Famílias:
                          </span>
                          <span className="text-white text-sm">{data.familiesCount.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="text-[10px] text-indigo-300 bg-indigo-950/60 p-1.5 rounded border border-indigo-800/40 mt-1">
                          Fonte: <strong>{data.dataSource}</strong>
                        </div>
                        {data.notes && (
                          <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800">
                            "{data.notes}"
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey={
                  chartMetric === 'people'
                    ? 'peopleCount'
                    : 'familiesCount'
                }
                name={
                  chartMetric === 'people'
                    ? 'Pessoas Abrigadas'
                    : 'Famílias Abrigadas'
                }
                stroke={
                  chartMetric === 'people'
                    ? '#6366f1'
                    : '#a855f7'
                }
                strokeWidth={3}
                fillOpacity={1}
                fill={
                  chartMetric === 'people'
                    ? 'url(#colorPeople)'
                    : 'url(#colorFamilies)'
                }
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 1 }}
                activeDot={{ r: 7, fill: '#a5b4fc', stroke: '#4f46e5', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
};

export const ShelterChart = React.memo(ShelterChartComponent);
