import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { City, CalculatedReading, TimeInterval } from '../types';
import { getStatusBadgeStyle, getStatusLabel, formatDateShort } from '../utils/riverUtils';
import { LineChart as ChartIcon, Sliders, Layers, Filter, Palette } from 'lucide-react';

interface RiverChartProps {
  cities: City[];
  readings: CalculatedReading[];
  selectedCityId: string | null;
  onSelectCity: (cityId: string | null) => void;
}

// Distinct elegant colors for multi-city comparison
const CITY_COLORS = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#14b8a6', // Teal
];

const RiverChartComponent: React.FC<RiverChartProps> = ({
  cities,
  readings,
  selectedCityId,
  onSelectCity,
}) => {

  const [timeInterval, setTimeInterval] = useState<TimeInterval>('48h');
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [showThresholdLines, setShowThresholdLines] = useState<boolean>(true);
  const [colorByThreshold, setColorByThreshold] = useState<boolean>(true);

  const activeCity = useMemo(() => {
    return cities.find(c => c.id === selectedCityId) || cities[0] || null;
  }, [cities, selectedCityId]);

  // Fast sort key generator (YYYY-MM-DDTHH:mm) - zero Date allocations
  const getSortKey = (r: { timestamp: string; dateStr?: string; timeStr?: string }) => {
    return (r.dateStr && r.timeStr) ? `${r.dateStr}T${r.timeStr}` : r.timestamp;
  };

  // Filter readings based on time interval
  const filteredReadings = useMemo(() => {
    if (!readings.length) return [];
    
    let hoursCutoff = 48;
    if (timeInterval === '24h') hoursCutoff = 24;
    else if (timeInterval === '7d') hoursCutoff = 24 * 7;
    else if (timeInterval === '30d') hoursCutoff = 24 * 30;
    else if (timeInterval === 'all') hoursCutoff = 24 * 365;

    const cutoffMs = Date.now() - hoursCutoff * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs);
    const cutoffY = cutoffDate.getFullYear();
    const cutoffM = String(cutoffDate.getMonth() + 1).padStart(2, '0');
    const cutoffD = String(cutoffDate.getDate()).padStart(2, '0');
    const cutoffH = String(cutoffDate.getHours()).padStart(2, '0');
    const cutoffMin = String(cutoffDate.getMinutes()).padStart(2, '0');
    const cutoffKey = `${cutoffY}-${cutoffM}-${cutoffD}T${cutoffH}:${cutoffMin}`;

    return readings.filter(r => getSortKey(r) >= cutoffKey);
  }, [readings, timeInterval]);

  // Chart Data for Single City
  const singleCityChartData = useMemo(() => {
    if (!activeCity) return [];
    const cityReadings = filteredReadings
      .filter(r => r.cityId === activeCity.id)
      .sort((a, b) => {
        const ka = getSortKey(a);
        const kb = getSortKey(b);
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });

    return cityReadings.map(r => ({
      timestamp: r.timestamp,
      formattedTime: `${formatDateShort(r.dateStr)} ${r.timeStr}`,
      timeOnly: r.timeStr,
      levelMeters: r.levelMeters,
      status: r.status,
      cityName: r.cityName,
      notes: r.notes,
      variation: r.variationMeterPerHour,
    }));
  }, [filteredReadings, activeCity]);

  // Chart Data for Multi-City Comparison
  const multiCityChartData = useMemo(() => {
    // Collect all unique formatted timestamps
    const timestampsMap = new Map<string, Record<string, any>>();

    const sortedAll = [...filteredReadings].sort((a, b) => {
      const ka = getSortKey(a);
      const kb = getSortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    sortedAll.forEach(r => {
      const label = `${formatDateShort(r.dateStr)} ${r.timeStr}`;
      if (!timestampsMap.has(r.timestamp)) {
        timestampsMap.set(r.timestamp, {
          timestamp: r.timestamp,
          formattedTime: label,
          timeOnly: r.timeStr,
        });
      }
      const item = timestampsMap.get(r.timestamp)!;
      item[r.cityId] = r.levelMeters;
    });

    return Array.from(timestampsMap.values());
  }, [filteredReadings]);

  // Max and Min river level for active city
  const cityStats = useMemo(() => {
    if (!singleCityChartData.length) return { max: 0, min: 0, latest: 0 };
    const levels = singleCityChartData.map(d => d.levelMeters);
    return {
      max: Math.max(...levels),
      min: Math.min(...levels),
      latest: levels[levels.length - 1],
    };
  }, [singleCityChartData]);

  // Calculate explicit Y-Axis domain for precise gradient alignment
  const yDomain = useMemo(() => {
    if (!singleCityChartData.length || !activeCity) return { min: 0, max: 20 };
    const levels = singleCityChartData.map(d => d.levelMeters);
    const minVal = Math.min(...levels);
    const maxVal = Math.max(...levels, activeCity.thresholds.inundacao);

    const min = Math.max(0, Math.floor(minVal - 1));
    const max = Math.ceil(maxVal + 1);
    return { min, max };
  }, [singleCityChartData, activeCity]);

  // Dynamic gradient offsets based on city thresholds and Y-domain
  const gradientOffsets = useMemo(() => {
    if (!activeCity) return { inundacao: 0, alerta: 33, atencao: 66 };
    const range = yDomain.max - yDomain.min || 1;
    
    // SVG gradient y1=0 (top, yDomain.max) to y2=100% (bottom, yDomain.min)
    const calcOffset = (val: number) => {
      const pct = ((yDomain.max - val) / range) * 100;
      return Math.min(100, Math.max(0, pct));
    };

    return {
      inundacao: Number(calcOffset(activeCity.thresholds.inundacao).toFixed(2)),
      alerta: Number(calcOffset(activeCity.thresholds.alerta).toFixed(2)),
      atencao: Number(calcOffset(activeCity.thresholds.atencao).toFixed(2)),
    };
  }, [activeCity, yDomain]);

  return (
    <div id="river-chart-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-5 space-y-4">
      
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 rounded-lg">
              <ChartIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                Gráfico de Nível do Rio
                {comparisonMode ? (
                  <span className="text-xs px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold rounded-full border border-blue-300 dark:border-blue-700 shadow-xs">
                    Modo Comparativo
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-bold rounded-full border border-cyan-300 dark:border-cyan-700 shadow-xs">
                    {activeCity?.name}
                  </span>
                )}
              </h2>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {comparisonMode
                  ? 'Comparação direta das curvas de cota entre cidades do Vale do Taquari'
                  : `Evolução temporal do Rio Taquari em ${activeCity?.name || 'Lajeado'} com cotas de alerta`}
              </p>
            </div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* City Dropdown if not comparison mode */}
          {!comparisonMode && (
            <select
              id="chart-city-select"
              value={activeCity?.id || ''}
              onChange={(e) => onSelectCity(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              {cities.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Time Interval Pills */}
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium">
            {(['24h', '48h', '7d', 'all'] as TimeInterval[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeInterval(t)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  timeInterval === t
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === '24h' ? '24h' : t === '48h' ? '48h' : t === '7d' ? '7 dias' : 'Tudo'}
              </button>
            ))}
          </div>

          {/* Threshold Color Toggle */}
          {!comparisonMode && (
            <button
              onClick={() => setColorByThreshold(!colorByThreshold)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                colorByThreshold
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white border-transparent shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
              title="Colorir a linha e área do gráfico pelas cores das cotas de alerta"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Cores das Cotas</span>
            </button>
          )}

          {/* Mode Switch Button */}
          <button
            onClick={() => setComparisonMode(!comparisonMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              comparisonMode
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {comparisonMode ? 'Ver Única Cidade' : 'Comparar Cidades'}
          </button>

          {/* Toggle Threshold Lines */}
          {!comparisonMode && (
            <button
              onClick={() => setShowThresholdLines(!showThresholdLines)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                showThresholdLines
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
              title="Alternar exibição das linhas de alerta/inundação"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Linhas Ref.</span>
            </button>
          )}

        </div>
      </div>

      {/* Threshold Legends / Summary Bar */}
      {!comparisonMode && activeCity && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-cyan-500" />
              Limites de Risco ({activeCity.name}):
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
              Atenção: <strong>{activeCity.thresholds.atencao.toFixed(2)}m</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400 font-medium">
              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full" />
              Alerta: <strong>{activeCity.thresholds.alerta.toFixed(2)}m</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-medium">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
              Inundação: <strong>{activeCity.thresholds.inundacao.toFixed(2)}m</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium">
            <span>Máx no período: <strong className="text-slate-900 dark:text-white">{cityStats.max.toFixed(2)}m</strong></span>
            <span>Mín: <strong className="text-slate-900 dark:text-white">{cityStats.min.toFixed(2)}m</strong></span>
          </div>
        </div>
      )}

      {/* Main Chart Container */}
      <div className="w-full h-[360px] pt-2">
        {comparisonMode ? (
          /* Multi-City Comparison Chart */
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={multiCityChartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis
                dataKey="formattedTime"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                dy={10}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                unit="m"
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700 space-y-2">
                        <p className="font-bold border-b border-slate-800 pb-1">{label}</p>
                        <div className="space-y-1">
                          {payload.map((p, idx) => {
                            const cityObj = cities.find(c => c.id === p.dataKey);
                            return (
                              <div key={idx} className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  {cityObj?.name || p.dataKey}:
                                </span>
                                <strong className="font-mono text-cyan-300">
                                  {Number(p.value).toFixed(2)} m
                                </strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
              {cities.map((city, index) => (
                <Line
                  key={city.id}
                  type="monotone"
                  dataKey={city.id}
                  name={city.name}
                  stroke={CITY_COLORS[index % CITY_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          /* Single City Area Chart with Dynamic Cota Threshold Colors */
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={singleCityChartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
              <defs>
                {/* Default Single Color Area Fill */}
                <linearGradient id="colorRiverLevel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>

                {/* Dynamic Cota Threshold Stroke Gradient */}
                <linearGradient id="thresholdStrokeGradient" x1="0" y1="0" x2="0" y2="1">
                  {/* Above Inundação: Red */}
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset={`${gradientOffsets.inundacao}%`} stopColor="#ef4444" />
                  
                  {/* Between Alerta & Inundação: Orange */}
                  <stop offset={`${gradientOffsets.inundacao}%`} stopColor="#f97316" />
                  <stop offset={`${gradientOffsets.alerta}%`} stopColor="#f97316" />
                  
                  {/* Between Atenção & Alerta: Amber */}
                  <stop offset={`${gradientOffsets.alerta}%`} stopColor="#f59e0b" />
                  <stop offset={`${gradientOffsets.atencao}%`} stopColor="#f59e0b" />
                  
                  {/* Below Atenção: Cyan */}
                  <stop offset={`${gradientOffsets.atencao}%`} stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>

                {/* Dynamic Cota Threshold Fill Gradient */}
                <linearGradient id="thresholdFillGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                  <stop offset={`${gradientOffsets.inundacao}%`} stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset={`${gradientOffsets.inundacao}%`} stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset={`${gradientOffsets.alerta}%`} stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset={`${gradientOffsets.alerta}%`} stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset={`${gradientOffsets.atencao}%`} stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset={`${gradientOffsets.atencao}%`} stopColor="#06b6d4" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />

              <XAxis
                dataKey="formattedTime"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                dy={10}
              />

              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                unit="m"
                domain={[yDomain.min, yDomain.max]}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const badge = getStatusBadgeStyle(data.status);
                    return (
                      <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700 space-y-2 min-w-[200px]">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="font-bold">{data.formattedTime}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {getStatusLabel(data.status)}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="text-slate-400">Nível do Rio:</span>
                          <span className="text-xl font-extrabold text-cyan-300 font-mono">
                            {data.levelMeters.toFixed(2)} m
                          </span>
                        </div>

                        {data.variation !== null && (
                          <div className="flex items-center justify-between text-slate-300 text-[11px]">
                            <span>Variação por hora:</span>
                            <span className={data.variation > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                              {data.variation > 0 ? `+${(data.variation * 100).toFixed(0)} cm/h` : `${(data.variation * 100).toFixed(0)} cm/h`}
                            </span>
                          </div>
                        )}

                        {data.notes && (
                          <p className="text-[11px] text-amber-300 bg-slate-800 p-1.5 rounded border border-slate-700 italic">
                            "{data.notes}"
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Threshold Reference Lines */}
              {showThresholdLines && activeCity && (
                <>
                  <ReferenceLine
                    y={activeCity.thresholds.atencao}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Atenção (${activeCity.thresholds.atencao}m)`,
                      fill: '#f59e0b',
                      fontSize: 11,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    y={activeCity.thresholds.alerta}
                    stroke="#f97316"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Alerta (${activeCity.thresholds.alerta}m)`,
                      fill: '#f97316',
                      fontSize: 11,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    y={activeCity.thresholds.inundacao}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{
                      value: `INUNDAÇÃO (${activeCity.thresholds.inundacao}m)`,
                      fill: '#ef4444',
                      fontSize: 11,
                      fontWeight: 'bold',
                      position: 'top',
                    }}
                  />
                </>
              )}

              <Area
                type="monotone"
                dataKey="levelMeters"
                stroke={colorByThreshold ? "url(#thresholdStrokeGradient)" : "#06b6d4"}
                strokeWidth={3}
                fillOpacity={1}
                fill={colorByThreshold ? "url(#thresholdFillGradient)" : "url(#colorRiverLevel)"}
                isAnimationActive={false}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  if (cx === undefined || cy === undefined) return null;
                  
                  let dotColor = '#06b6d4';
                  if (colorByThreshold) {
                    if (payload.status === 'inundacao') dotColor = '#ef4444';
                    else if (payload.status === 'alerta') dotColor = '#f97316';
                    else if (payload.status === 'atencao') dotColor = '#f59e0b';
                  }

                  return (
                    <circle
                      key={`chart-dot-${index}`}
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      fill={dotColor}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx === undefined || cy === undefined) return null;
                  
                  let dotColor = '#06b6d4';
                  if (payload.status === 'inundacao') dotColor = '#ef4444';
                  else if (payload.status === 'alerta') dotColor = '#f97316';
                  else if (payload.status === 'atencao') dotColor = '#f59e0b';

                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={dotColor}
                      stroke="#ffffff"
                      strokeWidth={2.5}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
};

export const RiverChart = React.memo(RiverChartComponent);

