import React, { useState, useEffect } from 'react';
import {
  Waves,
  Plus,
  Building2,
  AlertTriangle,
  ShieldCheck,
  Download,
  Home,
  Users,
  Activity,
  Lock,
  Unlock,
  CloudCheck,
  Youtube,
  FileText,
  Loader2,
  Database,
  PhoneCall,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  RefreshCw
} from 'lucide-react';
import { CalculatedReading, City, CalculatedShelterReading, Shelter } from '../types';

interface SidebarProps {
  activeTab: 'river' | 'shelters' | 'roads' | 'videos';
  onChangeTab: (tab: 'river' | 'shelters' | 'roads' | 'videos') => void;
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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
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
  isCollapsed,
  onToggleCollapse,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Compute overall river status summary across cities
  const latestByCity = new Map<string, CalculatedReading>();
  readings.forEach((r) => {
    if (!latestByCity.has(r.cityId)) {
      latestByCity.set(r.cityId, r);
    }
  });

  let counts = { normal: 0, atencao: 0, alerta: 0, inundacao: 0 };
  latestByCity.forEach((r) => {
    if (r.status in counts) {
      counts[r.status as keyof typeof counts]++;
    }
  });

  const totalMonitored = cities.length;
  const inRisk = counts.atencao + counts.alerta + counts.inundacao;

  // Compute shelter totals
  const totalPeopleSheltered =
    shelterReadings.length > 0
      ? Array.from(
          shelterReadings
            .reduce((map, r) => {
              if (!map.has(r.shelterId)) map.set(r.shelterId, r.peopleCount);
              return map;
            }, new Map<string, number>())
            .values()
        ).reduce((acc: number, curr: number) => acc + curr, 0)
      : 0;

  const navItems = [
    {
      id: 'river' as const,
      label: 'Nível do Rio Taquari',
      icon: Activity,
      color: 'text-cyan-400',
      activeGradient: 'from-cyan-500 to-blue-600 text-slate-950 font-extrabold shadow-md',
      count: cities.length,
      unit: 'cidades',
    },
    {
      id: 'shelters' as const,
      label: 'Abrigos & Desabrigados',
      icon: Home,
      color: 'text-indigo-400',
      activeGradient: 'from-indigo-500 to-purple-600 text-white font-extrabold shadow-md',
      count: shelters.length,
      unit: 'abrigos',
    },
    {
      id: 'roads' as const,
      label: 'Vias Interditadas',
      icon: AlertOctagon,
      color: 'text-red-400',
      activeGradient: 'from-red-600 to-amber-600 text-white font-extrabold shadow-md',
      count: blockedRoadsCount,
      unit: 'locais',
    },
    {
      id: 'videos' as const,
      label: 'Vídeos & Transmissões',
      icon: Youtube,
      color: 'text-rose-400',
      activeGradient: 'from-red-500 to-rose-600 text-white font-extrabold shadow-md',
      count: videosCount,
      unit: 'vídeos',
    },
  ];

  return (
    <>
      {/* Mobile Top Header (Visible only on small screens) */}
      <div className="md:hidden no-print sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl text-white shadow-sm">
            <Waves className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              Monitoramento Taquari
            </h1>
            <p className="text-[10px] text-slate-400">Enchentes & Abrigos</p>
          </div>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 cursor-pointer"
          aria-label="Alternar Menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop Overlay for Mobile Drawer */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden no-print fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fadeIn"
        />
      )}

      {/* Main Collapsible Sidebar Container */}
      <aside
        id="main-sidebar"
        className={`no-print fixed top-0 left-0 bottom-0 z-50 bg-slate-900 border-r border-slate-800 text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl ${
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-72'}`}
      >
        {/* Sidebar Header / Brand & Collapse Toggle */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl shadow-md shadow-cyan-500/20 text-white shrink-0">
              <Waves className="w-6 h-6 animate-pulse" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-sm font-extrabold tracking-tight text-white truncate">
                    Monitoramento
                  </h1>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                  <span>Vale do Taquari</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <CloudCheck className="w-3 h-3" />
                    Nuvem
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle Button */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu Lateral'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Main Sidebar Body */}
        <div className="flex-1 overflow-y-auto space-y-5 p-3 custom-scrollbar">
          
          {/* Operator Auth Button (Entrar / Modo Operador) */}
          <div className="px-1">
            {isAdminAuthorized ? (
              <button
                id="btn-logout-admin-sidebar"
                onClick={onLogoutAdmin}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900 transition-all cursor-pointer shadow-md ${
                  isCollapsed ? 'p-2.5' : ''
                }`}
                title="Modo Operador Ativo. Clique para encerrar a sessão."
              >
                <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>Modo Operador</span>
                    <span className="text-[10px] text-emerald-400/80 underline">Sair</span>
                  </div>
                )}
              </button>
            ) : (
              <button
                id="btn-login-admin-sidebar"
                onClick={() => onOpenAdminAuth()}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border border-indigo-400/40 shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 ${
                  isCollapsed ? 'p-2.5' : ''
                }`}
                title="Área do Operador - Clique para fazer login e liberar cadastros"
              >
                <Lock className="w-4 h-4 text-indigo-200 shrink-0" />
                {!isCollapsed && <span>Entrar (Operador)</span>}
              </button>
            )}
          </div>

          {/* Quick River & Shelter Status Indicators */}
          {!isCollapsed ? (
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Resumo da Situação
              </span>
              <div className="space-y-1.5 text-xs font-semibold">
                {counts.inundacao > 0 && (
                  <div className="flex items-center justify-between bg-red-950/50 text-red-300 border border-red-800/60 p-2 rounded-xl">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      Inundação
                    </span>
                    <span className="font-extrabold bg-red-900 px-2 py-0.5 rounded-md text-[11px]">
                      {counts.inundacao}
                    </span>
                  </div>
                )}
                {counts.alerta > 0 && (
                  <div className="flex items-center justify-between bg-orange-950/50 text-orange-300 border border-orange-800/60 p-2 rounded-xl">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      Alerta
                    </span>
                    <span className="font-extrabold bg-orange-900 px-2 py-0.5 rounded-md text-[11px]">
                      {counts.alerta}
                    </span>
                  </div>
                )}
                {counts.atencao > 0 && (
                  <div className="flex items-center justify-between bg-amber-950/50 text-amber-300 border border-amber-800/60 p-2 rounded-xl">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Atenção
                    </span>
                    <span className="font-extrabold bg-amber-900 px-2 py-0.5 rounded-md text-[11px]">
                      {counts.atencao}
                    </span>
                  </div>
                )}
                {inRisk === 0 && (
                  <div className="flex items-center justify-between bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 p-2 rounded-xl">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Estáveis
                    </span>
                    <span className="font-extrabold bg-emerald-900 px-2 py-0.5 rounded-md text-[11px]">
                      {totalMonitored}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between bg-indigo-950/50 text-indigo-300 border border-indigo-800/60 p-2 rounded-xl">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    Abrigados
                  </span>
                  <span className="font-extrabold text-indigo-200">
                    {Number(totalPeopleSheltered).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Compact Status Indicators when collapsed */
            <div className="flex flex-col items-center gap-2 py-1">
              {counts.inundacao > 0 && (
                <div
                  className="w-8 h-8 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400 text-xs font-bold"
                  title={`${counts.inundacao} cidades em Inundação`}
                >
                  {counts.inundacao}
                </div>
              )}
              {counts.alerta > 0 && (
                <div
                  className="w-8 h-8 rounded-xl bg-orange-950 border border-orange-800 flex items-center justify-center text-orange-400 text-xs font-bold"
                  title={`${counts.alerta} cidades em Alerta`}
                >
                  {counts.alerta}
                </div>
              )}
              {counts.atencao > 0 && (
                <div
                  className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 text-xs font-bold"
                  title={`${counts.atencao} cidades em Atenção`}
                >
                  {counts.atencao}
                </div>
              )}
              {inRisk === 0 && (
                <div
                  className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 text-xs font-bold"
                  title="Todas as cidades estão estáveis"
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
              )}
            </div>
          )}

          {/* Navigation Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-2 mb-2">
                Navegação
              </span>
            )}

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeTab(item.id);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? `bg-gradient-to-r ${item.activeGradient}`
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  } ${isCollapsed ? 'justify-center p-2.5' : ''}`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? '' : item.color}`} />
                  
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.count !== undefined && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ml-1.5 ${
                            isActive
                              ? 'bg-black/30 text-white'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Action Tools */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            {!isCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-2">
                Ferramentas & Exportação
              </span>
            )}

            {/* Backup / Restore Button */}
            {onOpenBackupRestoreModal && (
              <button
                id="btn-open-backup-sidebar"
                onClick={onOpenBackupRestoreModal}
                className={`w-full flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-cyan-950 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 text-cyan-200 border border-cyan-700/80 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
                  isCollapsed ? 'justify-center p-2.5' : ''
                }`}
                title="Backup / Restaurar Dados"
              >
                <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Backup / Restaurar</span>}
              </button>
            )}

            {/* CSV Export Button */}
            <div>
              <button
                id="btn-export-csv-sidebar"
                onClick={onExportCSV}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                  isCollapsed ? 'p-2.5' : ''
                }`}
                title="Exportar dados em CSV"
              >
                <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isCollapsed && <span>Exportar CSV</span>}
              </button>
            </div>

            {/* Context-Specific Actions */}
            {activeTab === 'shelters' && !isCollapsed && (
              <div className="pt-2 space-y-1.5">
                <button
                  id="btn-open-shelter-reading-modal-sidebar"
                  onClick={onOpenNewShelterReadingModal}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lançar Pessoas</span>
                </button>

                <button
                  id="btn-open-new-shelter-modal-sidebar"
                  onClick={onOpenNewShelterModal}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 text-[11px] font-bold rounded-xl border border-indigo-700/80 transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+ Novo Abrigo</span>
                </button>
              </div>
            )}

            {activeTab === 'videos' && onOpenNewVideoModal && !isCollapsed && (
              <div className="pt-2">
                <button
                  id="btn-open-new-video-modal-sidebar"
                  onClick={onOpenNewVideoModal}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Compartilhar Vídeo</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer Credit */}
        {!isCollapsed && (
          <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-400 text-center shrink-0 bg-slate-950/40">
            <span>Sistema Vale do Taquari • 2026</span>
          </div>
        )}
      </aside>
    </>
  );
};
