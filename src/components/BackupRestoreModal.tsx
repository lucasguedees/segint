import React, { useState, useRef, useEffect } from 'react';
import { X, Download, UploadCloud, FileJson, CheckCircle2, AlertCircle, Database, RefreshCw, HardDrive, ShieldCheck, Layers } from 'lucide-react';
import { City, RiverReading, Shelter, ShelterReading, YouTubeVideo, BlockedRoad } from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: City[];
  readings: RiverReading[];
  shelters: Shelter[];
  shelterReadings: ShelterReading[];
  videos: YouTubeVideo[];
  blockedRoads?: BlockedRoad[];
  dataSources: string[];
  onRestoreData: (backupData: {
    cities?: City[];
    readings?: RiverReading[];
    shelters?: Shelter[];
    shelterReadings?: ShelterReading[];
    videos?: YouTubeVideo[];
    blockedRoads?: BlockedRoad[];
    dataSources?: string[];
  }) => Promise<void>;
}

export interface SystemBackupFormat {
  version: string;
  exportedAt: string;
  system: string;
  data: {
    cities?: City[];
    readings?: RiverReading[];
    shelters?: Shelter[];
    shelterReadings?: ShelterReading[];
    videos?: YouTubeVideo[];
    blockedRoads?: BlockedRoad[];
    dataSources?: string[];
  };
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  cities,
  readings,
  shelters,
  shelterReadings,
  videos,
  blockedRoads,
  dataSources,
  onRestoreData,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'restore'>('download');
  
  // Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<SystemBackupFormat['data'] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handler to export and download current system JSON backup
  const handleDownloadBackup = () => {
    try {
      const backupPayload: SystemBackupFormat = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        system: 'Monitoramento de Enchentes e Abrigos - Vale do Taquari',
        data: {
          cities,
          readings,
          shelters,
          shelterReadings,
          videos,
          blockedRoads,
          dataSources,
        },
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      
      link.href = url;
      link.setAttribute('download', `backup_monitoramento_taquari_${nowStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccessMsg('Backup baixado com sucesso!');
      setTimeout(() => setDownloadSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Erro ao gerar backup:', err);
      alert('Ocorreu um erro ao gerar o arquivo de backup.');
    }
  };

  // Process uploaded JSON file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setFileError(null);
    setParsedBackup(null);
    setRestoreSuccessMsg(null);

    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setFileError('Por favor, selecione um arquivo válido no formato .json.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Extract backup data payload (support either wrapped { data: {...} } or direct object)
        const dataPayload = parsed.data || parsed;

        if (
          !dataPayload ||
          (typeof dataPayload !== 'object') ||
          (!dataPayload.cities && !dataPayload.readings && !dataPayload.shelters && !dataPayload.shelterReadings && !dataPayload.videos)
        ) {
          setFileError('O arquivo anexado não possui uma estrutura válida de backup de monitoramento.');
          return;
        }

        setParsedBackup({
          cities: Array.isArray(dataPayload.cities) ? dataPayload.cities : [],
          readings: Array.isArray(dataPayload.readings) ? dataPayload.readings : [],
          shelters: Array.isArray(dataPayload.shelters) ? dataPayload.shelters : [],
          shelterReadings: Array.isArray(dataPayload.shelterReadings) ? dataPayload.shelterReadings : [],
          videos: Array.isArray(dataPayload.videos) ? dataPayload.videos : [],
          dataSources: Array.isArray(dataPayload.dataSources) ? dataPayload.dataSources : [],
        });
      } catch (err) {
        console.error('Erro ao ler arquivo JSON:', err);
        setFileError('Ocorreu um erro ao processar o arquivo JSON. Certifique-se de que o arquivo não está corrompido.');
      }
    };
    reader.readAsText(file);
  };

  // Perform actual restore
  const handleConfirmRestore = async () => {
    if (!parsedBackup) return;

    setIsRestoring(true);
    setFileError(null);
    try {
      await onRestoreData(parsedBackup);
      const totalItems =
        (parsedBackup.cities?.length || 0) +
        (parsedBackup.readings?.length || 0) +
        (parsedBackup.shelters?.length || 0) +
        (parsedBackup.shelterReadings?.length || 0) +
        (parsedBackup.videos?.length || 0);

      setRestoreSuccessMsg(`Restauração concluída! ${totalItems} registros foram integrados e salvos com sucesso.`);
      setSelectedFile(null);
      setParsedBackup(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      setFileError('Ocorreu um erro durante a restauração do banco de dados.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl text-white shadow-md">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Backup e Restauração de Dados</h3>
              <p className="text-xs text-slate-400">Exporte cópias de segurança ou anexe arquivos .JSON para restaurar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('download')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'download'
                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>1. Fazer Download do Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>2. Anexar e Restaurar Backup</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: DOWNLOAD BACKUP */}
          {activeTab === 'download' && (
            <div className="space-y-5">
              <div className="p-4 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-cyan-900 dark:text-cyan-200 space-y-1">
                  <p className="font-bold">Cópia de Segurança Completa do Sistema</p>
                  <p>
                    O arquivo baixado incluirá todas as medições de rios, cadastros de cidades, abrigos, contagem de desabrigados, vídeos e fontes de dados ativas no sistema em tempo real.
                  </p>
                </div>
              </div>

              {/* System Inventory Stats */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Conteúdo incluído no arquivo (.JSON):
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{cities.length}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cidades Monitoradas</p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{readings.length}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Medições do Rio</p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{shelters.length}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Abrigos Cadastrados</p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{shelterReadings.length}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Registros de Abrigados</p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-2xl font-black text-red-600 dark:text-red-400">{videos.length}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Vídeos & Transmissões</p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{dataSources.length}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Fontes de Dados</p>
                  </div>
                </div>
              </div>

              {/* Download Success Message */}
              {downloadSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{downloadSuccessMsg}</span>
                </div>
              )}

              {/* Main Download Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full py-3.5 px-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  <span>Baixar Arquivo de Backup (.JSON)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE BACKUP */}
          {activeTab === 'restore' && (
            <div className="space-y-5">
              
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-xl flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                  <p className="font-bold">Anexar e Restaurar Backup do Sistema</p>
                  <p>
                    Selecione ou arraste o arquivo de backup (.JSON) baixado anteriormente. Os dados serão lidos, validados e sincronizados diretamente com o banco de dados.
                  </p>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  selectedFile
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl text-indigo-600 dark:text-indigo-300">
                  <FileJson className="w-8 h-8" />
                </div>

                {selectedFile ? (
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Clique para escolher outro arquivo
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Clique para anexar ou arraste o arquivo de backup (.JSON) aqui
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Suporta arquivos de backup gerados por este sistema
                    </p>
                  </div>
                )}
              </div>

              {/* File Parsing Error */}
              {fileError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Restore Success Message */}
              {restoreSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{restoreSuccessMsg}</span>
                </div>
              )}

              {/* Parsed Backup Contents Summary */}
              {parsedBackup && (
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 animate-fadeIn">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Resumo do Arquivo Validade:
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-slate-900 dark:text-white">{parsedBackup.cities?.length || 0}</span> Cidades
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-cyan-600 dark:text-cyan-400">{parsedBackup.readings?.length || 0}</span> Medições de Rios
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{parsedBackup.shelters?.length || 0}</span> Abrigos
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-purple-600 dark:text-purple-400">{parsedBackup.shelterReadings?.length || 0}</span> Reg. Abrigados
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-red-600 dark:text-red-400">{parsedBackup.videos?.length || 0}</span> Vídeos
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{parsedBackup.dataSources?.length || 0}</span> Fontes
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    disabled={isRestoring}
                    className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Restaurando dados no banco...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-5 h-5" />
                        <span>Restaurar Dados Anexados Agora</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
