import React from 'react';
import { City, CalculatedReading } from '../types';
import { getStatusBadgeStyle, getStatusLabel, formatDateTimeBR } from '../utils/riverUtils';
import { TrendingUp, TrendingDown, Minus, Clock, Plus, Building2, Sliders } from 'lucide-react';

interface CityOverviewCardsProps {
  cities: City[];
  readings: CalculatedReading[];
  selectedCityId: string | null;
  onSelectCity: (cityId: string) => void;
  onOpenReadingModalForCity: (cityId: string) => void;
  onOpenCityModal?: () => void;
  isAdminAuthorized?: boolean;
}

const CityOverviewCardsComponent: React.FC<CityOverviewCardsProps> = ({
  cities,
  readings,
  selectedCityId,
  onSelectCity,
  onOpenReadingModalForCity,
  onOpenCityModal,
}) => {
  // Map city to its latest reading
  const latestReadingsMap = new Map<string, CalculatedReading>();
  readings.forEach(r => {
    if (!latestReadingsMap.has(r.cityId)) {
      latestReadingsMap.set(r.cityId, r);
    }
  });

  return (
    <div id="city-overview-section" className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Situação Atual por Cidade
          </h2>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Últimas medições cadastradas e nível do Rio Taquari (clique para lançar ou alterar cotas)
          </p>
        </div>
        <span className="text-xs font-bold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full self-start sm:self-auto shadow-xs">
          {cities.length} Cidades Cadastradas
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cities.map(city => {
          const latest = latestReadingsMap.get(city.id);
          const isSelected = selectedCityId === city.id;
          const status = latest ? latest.status : 'normal';
          const badgeStyle = getStatusBadgeStyle(status);
          const level = latest ? latest.levelMeters : null;
          const variation = latest ? latest.variationMeterPerHour : null;

          // Difference to flood stage
          let diffToFlood: string | null = null;
          if (level !== null) {
            const diff = city.thresholds.inundacao - level;
            if (diff > 0) {
              diffToFlood = `Faltam ${diff.toFixed(2)}m para cota de Inundação (${city.thresholds.inundacao.toFixed(2)}m)`;
            } else if (diff === 0) {
              diffToFlood = `Atingiu exatamente a cota de Inundação (${city.thresholds.inundacao.toFixed(2)}m)`;
            } else {
              diffToFlood = `Superou a cota de Inundação em +${Math.abs(diff).toFixed(2)}m`;
            }
          }

          return (
            <div
              key={city.id}
              id={`city-card-${city.id}`}
              onClick={() => onSelectCity(city.id)}
              className={`group relative rounded-2xl p-4 transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500 text-white shadow-xl shadow-cyan-500/10 ring-2 ring-cyan-500/30'
                  : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-cyan-400/60 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Card Top: City name & Status Badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className={`font-bold text-base leading-tight ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {city.name}
                  </h3>
                  <p className={`text-xs ${isSelected ? 'text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {city.riverName || 'Rio Taquari'}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                >
                  <span className={`w-2 h-2 rounded-full ${badgeStyle.dot}`} />
                  {getStatusLabel(status)}
                </span>
              </div>

              {/* Card Middle: River Meter Level */}
              <div className="flex items-baseline justify-between mb-3">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-extrabold tracking-tight ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {level !== null ? level.toFixed(2) : '--.--'}
                  </span>
                  <span className={`text-sm font-semibold ${isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    m
                  </span>
                </div>

                {/* Trend Speed indicator */}
                {variation !== null && (
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                      variation > 0.02
                        ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                        : variation < -0.02
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                    title="Variação calculada por hora"
                  >
                    {variation > 0.02 ? (
                      <>
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+{(variation * 100).toFixed(0)}cm/h</span>
                      </>
                    ) : variation < -0.02 ? (
                      <>
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{(variation * 100).toFixed(0)}cm/h</span>
                      </>
                    ) : (
                      <>
                        <Minus className="w-3.5 h-3.5" />
                        <span>Estável</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Reference Levels Bar */}
              <div className="mb-3 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <span>Cotas Ref:</span>
                  <span>
                    At: <strong className="text-amber-600 dark:text-amber-400">{city.thresholds.atencao.toFixed(1)}m</strong> •
                    Al: <strong className="text-orange-600 dark:text-orange-400">{city.thresholds.alerta.toFixed(1)}m</strong> •
                    Inund: <strong className="text-red-600 dark:text-red-400">{city.thresholds.inundacao.toFixed(1)}m</strong>
                  </span>
                </div>

                {diffToFlood && (
                  <p className={`text-[11px] font-medium ${
                    status === 'inundacao'
                      ? 'text-red-500 dark:text-red-400 font-semibold'
                      : isSelected ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'
                  }`}>
                    {diffToFlood}
                  </p>
                )}
              </div>

              {/* Card Footer: Timestamp & Action Buttons */}
              <div className={`pt-2.5 border-t flex items-center justify-between text-xs gap-2 ${
                isSelected ? 'border-slate-800' : 'border-slate-100 dark:border-slate-700/60'
              }`}>
                <div className={`flex items-center gap-1 min-w-0 ${isSelected ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{latest ? formatDateTimeBR(latest.timestamp, latest.dateStr, latest.timeStr) : 'Sem leituras'}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenCityModal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCityModal();
                      }}
                      className={`p-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                          : 'bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                      title="Alterar Cotas da Cidade (Atenção, Alerta, Inundação)"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenReadingModalForCity(city.id);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                        : 'bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                    }`}
                    title="Lançar Nova Cota / Leitura"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CityOverviewCards = React.memo(CityOverviewCardsComponent);
