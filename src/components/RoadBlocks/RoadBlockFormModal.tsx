import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Upload,
  AlertOctagon,
  Calendar,
  Clock,
  FileText,
  Image as ImageIcon,
  Check,
  Building2,
  Navigation,
  Sparkles,
  Plus
} from 'lucide-react';
import { BlockedRoad, RoadBlockStatus } from '../../types';
import { RoadBlockMap } from './RoadBlockMap';

interface RoadBlockFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (road: Omit<BlockedRoad, 'id' | 'createdAt'> & { id?: string }) => void;
  initialData?: BlockedRoad | null;
  cityList?: string[];
}

const DEFAULT_VALE_CITIES = [
  'Lajeado',
  'Estrela',
  'Arroio do Meio',
  'Encantado',
  'Muçum',
  'Roca Sales',
  'Teutônia',
  'Cruzeiro do Sul',
  'Taquari',
  'Venâncio Aires',
  'Bom Retiro do Sul',
  'Santa Clara do Sul',
  'Santa Tereza',
];

// Preset coordinates for quick selection
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Lajeado: { lat: -29.4678, lng: -51.9582 },
  Estrela: { lat: -29.5021, lng: -51.9615 },
  'Arroio do Meio': { lat: -29.4011, lng: -51.9482 },
  Encantado: { lat: -29.2381, lng: -51.8722 },
  Muçum: { lat: -29.1672, lng: -51.8741 },
  'Roca Sales': { lat: -29.2843, lng: -51.8711 },
  Teutônia: { lat: -29.4481, lng: -51.8062 },
  'Cruzeiro do Sul': { lat: -29.5132, lng: -51.9862 },
  Taquari: { lat: -29.8012, lng: -51.8021 },
  'Venâncio Aires': { lat: -29.6102, lng: -52.1942 },
};

export const RoadBlockFormModal: React.FC<RoadBlockFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  cityList = DEFAULT_VALE_CITIES,
}) => {
  const combinedCities = Array.from(new Set([...cityList, ...DEFAULT_VALE_CITIES])).sort();

  const [cityName, setCityName] = useState('Lajeado');
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCityName, setCustomCityName] = useState('');

  const [locationName, setLocationName] = useState('');
  const [status, setStatus] = useState<RoadBlockStatus>('total');
  const [reason, setReason] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [latitude, setLatitude] = useState(-29.4678);
  const [longitude, setLongitude] = useState(-51.9582);
  const [reportedAt, setReportedAt] = useState('');
  const [expectedRelease, setExpectedRelease] = useState('');
  const [notes, setNotes] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    if (initialData) {
      const initialCity = initialData.cityName || 'Lajeado';
      if (combinedCities.includes(initialCity)) {
        setCityName(initialCity);
        setIsCustomCity(false);
        setCustomCityName('');
      } else {
        setCityName('__custom__');
        setIsCustomCity(true);
        setCustomCityName(initialCity);
      }

      setLocationName(initialData.locationName || '');
      setStatus(initialData.status || 'total');
      setReason(initialData.reason || '');
      setImageUrl(initialData.imageUrl || '');
      setLatitude(initialData.latitude || -29.4678);
      setLongitude(initialData.longitude || -51.9582);
      setReportedAt(initialData.reportedAt ? initialData.reportedAt.slice(0, 16) : new Date().toISOString().slice(0, 16));
      setExpectedRelease(initialData.expectedRelease || '');
      setNotes(initialData.notes || '');
    } else {
      setCityName(combinedCities[0] || 'Lajeado');
      setIsCustomCity(false);
      setCustomCityName('');
      setLocationName('');
      setStatus('total');
      setReason('');
      setImageUrl('');
      setLatitude(-29.4678);
      setLongitude(-51.9582);
      setReportedAt(new Date().toISOString().slice(0, 16));
      setExpectedRelease('');
      setNotes('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Handle image file upload (convert to Base64)
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecione um arquivo de imagem (JPG, PNG, WEBP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCityChange = (city: string) => {
    if (city === '__custom__') {
      setIsCustomCity(true);
    } else {
      setIsCustomCity(false);
      setCityName(city);
      if (CITY_COORDINATES[city]) {
        setLatitude(CITY_COORDINATES[city].lat);
        setLongitude(CITY_COORDINATES[city].lng);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalCityName = isCustomCity ? customCityName.trim() : cityName;

    if (!finalCityName) {
      alert('Por favor selecione ou informe o nome do município.');
      return;
    }

    if (!locationName.trim()) {
      alert('Por favor preencha o endereço ou nome do trecho/rua interditado.');
      return;
    }

    onSave({
      id: initialData?.id,
      cityName: finalCityName,
      locationName: locationName.trim(),
      status,
      reason: reason.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      latitude: Number(latitude),
      longitude: Number(longitude),
      reportedAt: reportedAt ? new Date(reportedAt).toISOString() : new Date().toISOString(),
      expectedRelease: expectedRelease.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fadeIn text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/60 text-red-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">
                {initialData ? 'Editar Via Interditada' : 'Cadastrar Via Interditada'}
              </h3>
              <p className="text-xs text-slate-400">
                Preencha as informações do bloqueio e anexe a foto da via
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* City & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  Município
                </label>
                {!isCustomCity ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCity(true);
                      setCustomCityName('');
                    }}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    + Incluir outra cidade
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCity(false);
                      setCityName(combinedCities[0] || 'Lajeado');
                    }}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Escolher da lista
                  </button>
                )}
              </div>

              {!isCustomCity ? (
                <select
                  value={cityName}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
                >
                  {combinedCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__" className="text-cyan-400 font-bold">
                    + Outra cidade (Digitar nova)...
                  </option>
                </select>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={customCityName}
                    onChange={(e) => setCustomCityName(e.target.value)}
                    placeholder="Digite o nome da nova cidade..."
                    required
                    autoFocus
                    className="w-full bg-slate-950 border border-cyan-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-medium shadow-sm"
                  />
                  <p className="text-[10px] text-slate-400">
                    Digite o nome da cidade. Ela será vinculada a este registro.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                Status do Bloqueio
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RoadBlockStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="total" className="text-red-400 font-bold">
                  ⛔ Bloqueio Total (Via Fechada)
                </option>
                <option value="parcial" className="text-amber-400 font-bold">
                  ⚠️ Bloqueio Parcial (Meia Pista)
                </option>
                <option value="liberado" className="text-emerald-400 font-bold">
                  ✅ Via Liberada
                </option>
              </select>
            </div>
          </div>

          {/* Location Name / Address */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Endereço / Nome da Via ou Ponte *
            </label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Ex: Ponte de Ferro / Rua Dr. João Carlos Machado, km 12"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          {/* Reason / Motivo */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Motivo da Interdição
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Alagamento / Ponte Submersa / Queda de Barreira / Buraco na pista"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Photo Upload & Preview Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                Foto da Via Interditada
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Anexo visual</span>
            </label>

            {/* Dropzone File Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-4 transition-all text-center ${
                isDraggingFile
                  ? 'border-cyan-400 bg-cyan-950/30'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
              }`}
            >
              {imageUrl ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-800 max-h-48 bg-black">
                  <img
                    src={imageUrl}
                    alt="Preview da via"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <label className="px-3 py-1.5 bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer hover:bg-cyan-400">
                      Alterar Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-3 py-1.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-500"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-cyan-400 mx-auto" />
                  <div className="text-xs text-slate-300">
                    <label className="text-cyan-400 font-bold underline cursor-pointer hover:text-cyan-300">
                      Clique para escolher uma foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>{' '}
                    ou arraste o arquivo aqui
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Formatos suportados: PNG, JPG, WEBP
                  </p>
                </div>
              )}
            </div>

            {/* URL Option */}
            <div className="pt-1">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Ou cole a URL da imagem (https://...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Geographic Location (Lat/Lng + Map Picker Toggle) */}
          <div className="space-y-2 bg-slate-950/70 rounded-2xl p-4 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                Ponto Geográfico no Mapa
              </span>

              <button
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className={`px-3 py-1 text-xs font-bold rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  showMapPicker
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 text-cyan-400 border-cyan-800/80 hover:bg-slate-800'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{showMapPicker ? 'Ocultar Seleção no Mapa' : 'Marcar no Mapa Interativo'}</span>
              </button>
            </div>

            {showMapPicker && (
              <div className="pt-2">
                <RoadBlockMap
                  blockedRoads={[]}
                  isPicker={true}
                  pickerLat={latitude}
                  pickerLng={longitude}
                  onPickLocation={(lat, lng) => {
                    setLatitude(Number(lat.toFixed(5)));
                    setLongitude(Number(lng.toFixed(5)));
                  }}
                  height="260px"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Timestamps & Expected Release */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Data/Hora do Registro
              </label>
              <input
                type="datetime-local"
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Previsão de Liberação
              </label>
              <input
                type="text"
                value={expectedRelease}
                onChange={(e) => setExpectedRelease(e.target.value)}
                placeholder="Ex: Sem previsão / Após limpeza / Em 24h"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Notes / Desvios */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
              Observações Adicionais / Rotas de Desvio
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva desvios orientados pela Brigada Militar, sinalização no local, etc."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all transform active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{initialData ? 'Salvar Alterações' : 'Cadastrar Via Interditada'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
