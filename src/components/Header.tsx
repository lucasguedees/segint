import React, { useState } from 'react';
import { Waves, Plus, Building2, RefreshCw, AlertTriangle, ShieldCheck, Download, Home, Users, Activity, Lock, Unlock, KeyRound, CloudCheck, Info, Youtube, Printer, FileText, Loader2, Database, UploadCloud, PhoneCall, Phone, AlertOctagon } from 'lucide-react';
import { CalculatedReading, City, CalculatedShelterReading, Shelter } from '../types';

interface HeaderProps {
  activeTab: 'river' | 'shelters' | 'roads' | 'videos' | 'phones';
  onChangeTab: (tab: 'river' | 'shelters' | 'roads' | 'videos' | 'phones') => void;
  onOpenNewReadingModal: () => void;
  onOpenNewCityModal: () => void;
  onOpenNewShelterReadingModal: () => void;
  onOpenNewShelterModal: () => void;
  onOpenNewVideoModal?: () => void;
  onOpenBackupRestoreModal?: () => void;
  onResetSeedData?: () => void;
  onExportCSV: () => void;
  readings: CalculatedReading[];
  cities: City[];
  shelterReadings: CalculatedShelterReading[];
  shelters: Shelter[];
  videosCount?: number;
  blockedRoadsCount?: number;
  isAdminAuthorized: boolean;
  onOpenAdminAuth: (pendingAction?: string) => void;
  onLogoutAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onChangeTab,
  onOpenNewReadingModal,
  onOpenNewCityModal,
  onOpenNewShelterReadingModal,
  onOpenNewShelterModal,
  onOpenNewVideoModal,
  onOpenBackupRestoreModal,
  onResetSeedData,
  onExportCSV,
  readings,
  cities,
  shelterReadings,
  shelters,
  videosCount,
  blockedRoadsCount,
  isAdminAuthorized,
  onOpenAdminAuth,
  onLogoutAdmin,
}) => {
  // Compute overall river status summary across cities
  const latestByCity = new Map<string, CalculatedReading>();
  readings.forEach(r => {
    if (!latestByCity.has(r.cityId)) {
      latestByCity.set(r.cityId, r);
    }
  });

  let counts = { normal: 0, atencao: 0, alerta: 0, inundacao: 0 };
  latestByCity.forEach(r => {
    if (r.status in counts) {
      counts[r.status as keyof typeof counts]++;
    }
  });

  const totalMonitored = cities.length;
  const inRisk = counts.atencao + counts.alerta + counts.inundacao;

  // Compute shelter totals
  const totalPeopleSheltered = shelterReadings.length > 0
    ? Array.from(
        shelterReadings.reduce((map, r) => {
          if (!map.has(r.shelterId)) map.set(r.shelterId, r.peopleCount);
          return map;
        }, new Map<string, number>()).values()
      ).reduce((acc: number, curr: number) => acc + curr, 0)
    : 0;

  return (
    <header id="main-header" className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
        
        {/* Top Row: Logo, Summary Badges, Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl shadow-md shadow-cyan-500/20 text-white">
              <Waves className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Monitoramento de Enchentes & Abrigos
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-medium">
                  Vale do Taquari
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-semibold" title="Banco de Dados Firestore ativo com sincronização em tempo real">
                  <CloudCheck className="w-3 h-3 text-emerald-400" />
                  Nuvem Ativa
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Níveis de água e cadastro contínuo de pessoas e famílias desabrigadas
              </p>
            </div>
          </div>

          {/* Quick Alert Status Summary Pills */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {counts.inundacao > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                {counts.inundacao} em Inundação
              </span>
            )}
            {counts.alerta > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                {counts.alerta} em Alerta
              </span>
            )}
            {counts.atencao > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                {counts.atencao} em Atenção
              </span>
            )}
            {inRisk === 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {totalMonitored} Cidades Estáveis
              </span>
            )}

            {/* Shelters Summary Pill */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              {Number(totalPeopleSheltered).toLocaleString()} Abrigados ({shelters.length} abrigos)
            </span>
          </div>

          {/* Action Buttons & Access Mode */}
          <div className="flex flex-col items-start md:items-end gap-2.5 no-print">
            
            {/* Top Row: Larger Entrar / Operator Login Button */}
            <div>
              {isAdminAuthorized ? (
                <button
                  id="btn-logout-admin"
                  onClick={onLogoutAdmin}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900 transition-colors cursor-pointer shadow-md"
                  title="Modo Administrador Ativo. Clique para encerrar a sessão."
                >
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  <span>Modo Operador</span>
                  <span className="text-[10px] text-emerald-400/80 underline ml-1">Bloquear</span>
                </button>
              ) : (
                <button
                  id="btn-login-admin"
                  onClick={() => onOpenAdminAuth()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border border-indigo-400/40 shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
                  title="Área do Operador - Clique para fazer login e liberar cadastros"
                >
                  <Lock className="w-4 h-4 text-indigo-200" />
                  <span>Entrar</span>
                </button>
              )}
            </div>

            {/* Bottom Row: Secondary Action Buttons aligned under Entrar */}
            <div className="flex items-center gap-1.5 flex-wrap justify-start md:justify-end">
              
              {/* Backup / Restaurar Button */}
              {onOpenBackupRestoreModal && (
                <button
                  id="btn-open-backup-modal"
                  onClick={onOpenBackupRestoreModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-950 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 text-cyan-200 border border-cyan-700/80 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 h-9"
                  title="Fazer download do backup ou anexar arquivo para restaurar"
                >
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Backup / Restaurar</span>
                </button>
              )}

              {/* CSV Export Button */}
              <button
                id="btn-export-csv"
                onClick={onExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                title="Exportar dados em planilha CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>

              {/* Tab-Specific Action Buttons */}
              {activeTab === 'shelters' && (
                <>
                  <button
                    id="btn-open-shelter-reading-modal"
                    onClick={onOpenNewShelterReadingModal}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md shadow-indigo-500/20 transition-all cursor-pointer active:scale-95"
                    title="Lançar número de pessoas e famílias acolhidas"
                  >
                    <Plus className="w-4 h-4" />
                    Lançar Pessoas/Famílias
                  </button>

                  <button
                    id="btn-open-new-shelter-modal"
                    onClick={onOpenNewShelterModal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 text-xs font-bold rounded-lg border border-indigo-700/80 transition-colors cursor-pointer"
                    title="Cadastrar Novo Abrigo Manualmente"
                  >
                    <Home className="w-4 h-4 text-indigo-400" />
                    <span>+ Cadastrar Abrigo</span>
                  </button>
                </>
              )}

              {activeTab === 'videos' && onOpenNewVideoModal && (
                <button
                  id="btn-open-new-video-modal"
                  onClick={onOpenNewVideoModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-semibold text-sm rounded-lg shadow-md shadow-red-500/20 transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Compartilhar Vídeo
                </button>
              )}

            </div>
          </div>

        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 border-t border-slate-800/80 pt-2.5 overflow-x-auto">
          <button
            onClick={() => onChangeTab('river')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'river'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Nível do Rio Taquari</span>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 font-semibold text-white">
              {cities.length} cidades
            </span>
          </button>

          <button
            onClick={() => onChangeTab('shelters')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'shelters'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Abrigos & Desabrigados</span>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 font-semibold text-white">
              {shelters.length} abrigos
            </span>
          </button>

          <button
            onClick={() => onChangeTab('roads')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'roads'
                ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <span>Vias Interditadas</span>
            {blockedRoadsCount !== undefined && (
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 font-semibold text-white">
                {blockedRoadsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onChangeTab('videos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'videos'
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Youtube className="w-4 h-4 text-red-400" />
            <span>Vídeos & Transmissões</span>
            {videosCount !== undefined && (
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 font-semibold text-white">
                {videosCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onChangeTab('phones')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'phones'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            <span>Telefones Úteis</span>
          </button>
        </div>

      </div>
    </header>
  );
};
