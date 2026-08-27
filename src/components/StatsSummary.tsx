import React from 'react';
import { CalculatedReading, City } from '../types';
import { Activity, AlertTriangle, ShieldCheck, TrendingUp, Droplets, MapPin } from 'lucide-react';

interface StatsSummaryProps {
  readings: CalculatedReading[];
  cities: City[];
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ readings, cities }) => {
  // Find latest reading for each city
  const latestByCityMap = new Map<string, CalculatedReading>();
  readings.forEach(r => {
    if (!latestByCityMap.has(r.cityId)) {
      latestByCityMap.set(r.cityId, r);
    }
  });

  const latestList = Array.from(latestByCityMap.values());

  // Count cities in critical states
  const floodCount = latestList.filter(r => r.status === 'inundacao').length;
  const alertCount = latestList.filter(r => r.status === 'alerta').length;
  const atencaoCount = latestList.filter(r => r.status === 'atencao').length;

  // City closest to or farthest above flood stage
  let highestRatioCity: { name: string; ratio: number; level: number } | null = null;
  cities.forEach(c => {
    const latest = latestByCityMap.get(c.id);
    if (latest) {
      const ratio = latest.levelMeters / c.thresholds.inundacao;
      if (!highestRatioCity || ratio > highestRatioCity.ratio) {
        highestRatioCity = {
          name: c.name,
          ratio,
          level: latest.levelMeters,
        };
      }
    }
  });

  // Calculate average variation speed in past 6 hours
  let totalSpeed = 0;
  let countSpeed = 0;
  latestList.forEach(r => {
    if (r.variationMeterPerHour !== null) {
      totalSpeed += r.variationMeterPerHour;
      countSpeed++;
    }
  });
  const avgSpeedCmPerHour = countSpeed > 0 ? (totalSpeed / countSpeed) * 100 : 0;

  return (
    <div id="stats-summary-strip" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* Stat 1: Total Cidades Monitoradas */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Cidades Monitoradas
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {cities.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">no Vale do Taquari</span>
          </div>
        </div>
        <div className="p-3 bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 rounded-xl">
          <MapPin className="w-5 h-5" />
        </div>
      </div>

      {/* Stat 2: Cidades em Cota de Risco */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Em Alerta / Atenção
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-extrabold ${
              floodCount + alertCount > 0
                ? 'text-red-600 dark:text-red-400'
                : atencaoCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {floodCount + alertCount + atencaoCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              de {cities.length} municípios
            </span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${
          floodCount + alertCount > 0
            ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
            : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
        }`}>
          {floodCount + alertCount > 0 ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <ShieldCheck className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Stat 3: Ponto Mais Crítico */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Nível Mais Elevado
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {highestRatioCity ? `${highestRatioCity.level.toFixed(2)}m` : '--.--'}
            </span>
            <span className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold truncate max-w-[90px]">
              {highestRatioCity ? highestRatioCity.name : 'N/A'}
            </span>
          </div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
          <Droplets className="w-5 h-5" />
        </div>
      </div>

      {/* Stat 4: Variação Média Regional */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Tendência Regional
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-extrabold ${
              avgSpeedCmPerHour > 2
                ? 'text-red-600 dark:text-red-400'
                : avgSpeedCmPerHour < -2
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-900 dark:text-white'
            }`}>
              {avgSpeedCmPerHour > 0 ? `+${avgSpeedCmPerHour.toFixed(0)}` : avgSpeedCmPerHour.toFixed(0)}
            </span>
            <span className="text-xs text-slate-500 font-medium">cm/hora</span>
          </div>
        </div>
        <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
          <Activity className="w-5 h-5" />
        </div>
      </div>

    </div>
  );
};
