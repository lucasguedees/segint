import React, { useState, useEffect } from 'react';
import { City, RiverReading } from '../types';
import { generateStandardTimeSlots, getTodayDateStr, getCurrentTimeNearest30, getAlertStatus, getStatusLabel, getStatusBadgeStyle } from '../utils/riverUtils';
import { X, Clock, Calendar, Building2, Ruler, FileText, Plus, AlertTriangle, CheckCircle2, Save, FileSpreadsheet, Upload, Download, Info, RefreshCw } from 'lucide-react';

interface ReadingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveReading: (reading: Omit<RiverReading, 'id' | 'createdAt'> & { id?: string }) => void;
  onBatchSaveReadings?: (readings: Omit<RiverReading, 'id' | 'createdAt'>[]) => void;
  onOpenNewCityModal: () => void;
  cities: City[];
  initialCityId?: string | null;
  editingReading?: RiverReading | null;
}

export const ReadingFormModal: React.FC<ReadingFormModalProps> = ({
  isOpen,
  onClose,
  onSaveReading,
  onBatchSaveReadings,
  onOpenNewCityModal,
  cities,
  initialCityId,
  editingReading,
}) => {
  const timeSlots = generateStandardTimeSlots();

  const [mode, setMode] = useState<'manual' | 'csv'>('manual');
  const [cityId, setCityId] = useState<string>(cities[0]?.id || 'lajeado');
  const [dateStr, setDateStr] = useState<string>(getTodayDateStr());
  const [timeStr, setTimeStr] = useState<string>(getCurrentTimeNearest30());
  const [levelMeters, setLevelMeters] = useState<string>('12.50');
  const [notes, setNotes] = useState<string>('');
  const [isFetchingAuto, setIsFetchingAuto] = useState<boolean>(false);

  const handleFetchAutoStation = async () => {
    setIsFetchingAuto(true);
    try {
      const res = await fetch('/api/sync-river');
      const data = await res.json();
      if (data.success && Array.isArray(data.readings) && data.readings.length > 0) {
        const match = data.readings.find((r: any) => r.cityId === cityId) || data.readings[0];
        if (match) {
          setLevelMeters(match.levelMeters.toFixed(2));
          setNotes(`Medição capturada via ${match.source}`);
        }
      } else {
        alert('Não foi possível obter a medição automática no momento.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao buscar dados das estações de telemetria.');
    } finally {
      setIsFetchingAuto(false);
    }
  };

  // CSV import states
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [parsedCsvReadings, setParsedCsvReadings] = useState<Omit<RiverReading, 'id' | 'createdAt'>[]>([]);
  const [csvErrorCount, setCsvErrorCount] = useState<number>(0);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingReading) {
      setMode('manual');
      setCityId(editingReading.cityId);
      setDateStr(editingReading.dateStr);
      setTimeStr(editingReading.timeStr);
      setLevelMeters(String(editingReading.levelMeters));
      setNotes(editingReading.notes || '');
    } else {
      setMode('manual');
      if (initialCityId) {
        setCityId(initialCityId);
      } else if (cities.length > 0) {
        setCityId(cities[0].id);
      }
      setDateStr(getTodayDateStr());
      setTimeStr(getCurrentTimeNearest30());
      setLevelMeters('12.50');
      setNotes('');
      setCsvFileName('');
      setParsedCsvReadings([]);
      setCsvErrorCount(0);
      setCsvSuccessMsg(null);
    }
  }, [editingReading, initialCityId, isOpen, cities]);

  if (!isOpen) return null;

  const selectedCity = cities.find(c => c.id === cityId) || cities[0];
  const parsedLevel = parseFloat(levelMeters) || 0;
  const computedStatus = selectedCity ? getAlertStatus(parsedLevel, selectedCity.thresholds) : 'normal';
  const badgeStyle = getStatusBadgeStyle(computedStatus);

  const handleLevelChange = (delta: number) => {
    const current = parseFloat(levelMeters) || 0;
    const next = Math.max(0, current + delta);
    setLevelMeters(next.toFixed(2));
  };

  const parseDateString = (rawDate: string): string | null => {
    const clean = rawDate.trim();
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const brMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (brMatch) {
      const day = brMatch[1].padStart(2, '0');
      const month = brMatch[2].padStart(2, '0');
      let year = brMatch[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
    // YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const parseTimeString = (rawTime: string): string => {
    const clean = rawTime.trim().toLowerCase().replace(/h/g, ':');
    const match = clean.match(/^(\d{1,2})(?::(\d{1,2}))?/);
    if (match) {
      const hours = match[1].padStart(2, '0');
      const minutes = match[2] ? match[2].padStart(2, '0') : '00';
      return `${hours}:${minutes}`;
    }
    return '00:00';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/);
      const parsed: Omit<RiverReading, 'id' | 'createdAt'>[] = [];
      let errors = 0;

      lines.forEach((line, index) => {
        const rawLine = line.trim();
        if (!rawLine) return;

        let cols: string[] = [];
        if (rawLine.includes(';')) {
          cols = rawLine.split(';');
        } else if (rawLine.includes('\t')) {
          cols = rawLine.split('\t');
        } else {
          cols = rawLine.split(',');
        }

        if (cols.length < 3) {
          if (index > 0) errors++;
          return;
        }

        const rawCol1 = cols[0].trim();
        const rawCol2 = cols[1].trim();
        const rawCol3 = cols[2].trim();

        // Skip header if line 1 contains text headers
        if (
          index === 0 &&
          (rawCol1.toLowerCase().includes('data') ||
           rawCol1.toLowerCase().includes('date') ||
           rawCol3.toLowerCase().includes('indice') ||
           rawCol3.toLowerCase().includes('cota') ||
           rawCol3.toLowerCase().includes('nivel') ||
           rawCol3.toLowerCase().includes('cm'))
        ) {
          return;
        }

        const parsedDate = parseDateString(rawCol1);
        if (!parsedDate) {
          errors++;
          return;
        }

        const parsedTime = parseTimeString(rawCol2);
        const cleanCmStr = rawCol3.replace(',', '.').replace(/[^\d\.]/g, '');
        const numCm = parseFloat(cleanCmStr);

        if (isNaN(numCm) || numCm < 0) {
          errors++;
          return;
        }

        // Convert index from centimeters to meters (divide by 100)
        const numMeters = Number((numCm / 100).toFixed(2));
        const timestamp = `${parsedDate}T${parsedTime}`;

        parsed.push({
          cityId,
          dateStr: parsedDate,
          timeStr: parsedTime,
          timestamp,
          levelMeters: numMeters,
          notes: `Importado via CSV (${numCm} cm)`,
        });
      });

      setParsedCsvReadings(parsed);
      setCsvErrorCount(errors);
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleDownloadTemplateCSV = () => {
    const templateContent = `Data;Hora;Indice_cm
02/05/2024;14:00;1250
02/05/2024;14:30;1280
02/05/2024;15:00;1310
02/05/2024;15:30;1350`;
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_historico_cotas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsvSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedCsvReadings.length === 0) {
      alert('Nenhum dado válido foi encontrado no arquivo CSV.');
      return;
    }

    // Re-bind selected city to all parsed readings in case user changed city after uploading
    const updatedReadings = parsedCsvReadings.map(r => ({ ...r, cityId }));

    if (onBatchSaveReadings) {
      onBatchSaveReadings(updatedReadings);
    } else {
      updatedReadings.forEach(r => onSaveReading(r));
    }

    alert(`Sucesso! ${updatedReadings.length} leituras de cota importadas para ${selectedCity?.name || 'a cidade'}.`);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'csv') {
      handleImportCsvSubmit(e);
      return;
    }

    if (!cityId || !dateStr || !timeStr) return;

    const numLevel = parseFloat(levelMeters);
    if (isNaN(numLevel) || numLevel < 0) {
      alert('Por favor insira um nível do rio válido (em metros).');
      return;
    }

    const timestamp = `${dateStr}T${timeStr}`;

    onSaveReading({
      id: editingReading ? editingReading.id : undefined,
      cityId,
      dateStr,
      timeStr,
      timestamp,
      levelMeters: numLevel,
      notes: notes.trim() ? notes.trim() : undefined,
    });

    onClose();
  };

  return (
    <div id="reading-modal-backdrop" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div id="reading-modal-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full overflow-hidden transition-all my-8">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {editingReading ? 'Editar Leitura de Rio' : 'Lançar Leitura do Rio'}
              </h3>
              <p className="text-xs text-slate-400">
                Registre medições manuais ou importe histórico via arquivo CSV
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle Tabs (Only when not editing an existing single reading) */}
        {!editingReading && (
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 flex gap-1 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mode === 'manual'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              Lançamento Manual
            </button>

            <button
              type="button"
              onClick={() => setMode('csv')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mode === 'csv'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Anexar Arquivo CSV (Histórico)
            </button>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* City Selector (Common to both modes) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-cyan-600" />
                Cidade Monitorada
              </label>

              <button
                type="button"
                onClick={onOpenNewCityModal}
                className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Cidade
              </button>
            </div>

            <select
              id="select-reading-city"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.riverName || 'Rio Taquari'})
                </option>
              ))}
            </select>
          </div>

          {/* ================= MODE 1: MANUAL ENTRY ================= */}
          {mode === 'manual' && (
            <>
              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-cyan-600" />
                    Data da Leitura
                  </label>
                  <input
                    id="input-reading-date"
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-600" />
                    Horário (15 em 15 min)
                  </label>
                  <select
                    id="select-reading-time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot} h
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* River Meter Gauge Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-cyan-600" />
                    Metragem do Rio (em metros)
                  </label>

                  <button
                    type="button"
                    onClick={handleFetchAutoStation}
                    disabled={isFetchingAuto}
                    className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 hover:underline cursor-pointer disabled:opacity-50"
                    title="Obter valor automaticamente da estação de telemetria da cidade selecionada"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingAuto ? 'animate-spin' : ''}`} />
                    <span>Capturar Nível (Auto)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id="input-river-meters"
                      type="number"
                      step="0.01"
                      min="0"
                      max="40"
                      value={levelMeters}
                      onChange={(e) => setLevelMeters(e.target.value)}
                      placeholder="Ex: 14.85"
                      required
                      className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-extrabold text-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <span className="absolute right-4 top-3.5 font-bold text-slate-400 text-sm">
                      metros
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => handleLevelChange(0.1)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      +0.1m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLevelChange(0.5)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      +0.5m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLevelChange(-0.1)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      -0.1m
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Preview */}
              {selectedCity && (
                <div className={`p-3.5 rounded-xl border ${badgeStyle.bg} ${badgeStyle.border} space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Classificação da Leitura:
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                      {getStatusLabel(computedStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {selectedCity.name} — Limites: Atenção ({selectedCity.thresholds.atencao}m), Alerta ({selectedCity.thresholds.alerta}m), Inundação ({selectedCity.thresholds.inundacao}m).
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-600" />
                  Observações (Opcional)
                </label>
                <input
                  id="input-reading-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Chuva fraca, nível subindo rápido"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </>
          )}

          {/* ================= MODE 2: CSV FILE ATTACH ================= */}
          {mode === 'csv' && (
            <div className="space-y-4">
              
              {/* Instructions Box */}
              <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-cyan-400" />
                    Instruções para o Arquivo CSV
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplateCSV}
                    className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    Baixar Exemplo CSV
                  </button>
                </div>
                <div className="text-xs text-slate-300 space-y-1 pl-5 list-disc">
                  <p>• <strong>Coluna 1:</strong> Data (Ex: <code className="bg-slate-800 px-1 rounded">02/05/2024</code>)</p>
                  <p>• <strong>Coluna 2:</strong> Hora do sistema (Ex: <code className="bg-slate-800 px-1 rounded">14:00</code>)</p>
                  <p>• <strong>Coluna 3:</strong> Índice da cota em <strong>centímetros</strong> (Ex: <code className="bg-slate-800 px-1 rounded">1250</code> cm é convertido automaticamente para <strong>12.50 metros</strong>)</p>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-400 rounded-2xl p-6 text-center transition-all bg-slate-50 dark:bg-slate-800/50">
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {csvFileName ? csvFileName : 'Clique ou arraste o arquivo CSV aqui'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Arquivos .csv separados por vírgula, ponto e vírgula (;) ou tabulação
                    </p>
                  </div>
                </div>
              </div>

              {/* CSV Parse Results & Preview */}
              {parsedCsvReadings.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {parsedCsvReadings.length} medições válidas encontradas
                    </span>

                    {csvErrorCount > 0 && (
                      <span className="text-amber-400 flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {csvErrorCount} linhas ignoradas
                      </span>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                        <tr>
                          <th className="p-2 border-b border-slate-200 dark:border-slate-700">Data</th>
                          <th className="p-2 border-b border-slate-200 dark:border-slate-700">Hora</th>
                          <th className="p-2 border-b border-slate-200 dark:border-slate-700">Original (cm)</th>
                          <th className="p-2 border-b border-slate-200 dark:border-slate-700">Convertido (m)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {parsedCsvReadings.slice(0, 15).map((reading, idx) => {
                          const cmVal = Math.round(reading.levelMeters * 100);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-2 font-mono">{reading.dateStr}</td>
                              <td className="p-2 font-mono">{reading.timeStr} h</td>
                              <td className="p-2 font-mono text-slate-400">{cmVal} cm</td>
                              <td className="p-2 font-mono font-bold text-cyan-400">{reading.levelMeters.toFixed(2)} m</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {parsedCsvReadings.length > 15 && (
                      <div className="p-2 text-center text-slate-400 bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                        + {parsedCsvReadings.length - 15} mais linhas no arquivo...
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {mode === 'manual' ? (
              <button
                id="btn-save-reading-submit"
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {editingReading ? 'Atualizar Leitura' : 'Salvar Leitura'}
              </button>
            ) : (
              <button
                id="btn-import-csv-submit"
                type="submit"
                disabled={parsedCsvReadings.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Importar {parsedCsvReadings.length > 0 ? `${parsedCsvReadings.length} Leituras` : 'CSV'}
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};
