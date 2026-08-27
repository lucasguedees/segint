import React, { useState } from 'react';
import { City } from '../types';
import { X, Building2, Plus, Trash2, Edit2, Check, AlertTriangle, ShieldAlert } from 'lucide-react';

interface CityManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: City[];
  onAddCity: (city: Omit<City, 'id'>) => void;
  onUpdateCity: (city: City) => void;
  onDeleteCity: (cityId: string) => void;
}

export const CityManagementModal: React.FC<CityManagementModalProps> = ({
  isOpen,
  onClose,
  cities,
  onAddCity,
  onUpdateCity,
  onDeleteCity,
}) => {
  const [cityName, setCityName] = useState('');
  const [riverName, setRiverName] = useState('Rio Taquari');
  const [atencao, setAtencao] = useState('14.0');
  const [alerta, setAlerta] = useState('16.0');
  const [inundacao, setInundacao] = useState('18.0');

  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [editAtencao, setEditAtencao] = useState('');
  const [editAlerta, setEditAlerta] = useState('');
  const [editInundacao, setEditInundacao] = useState('');

  if (!isOpen) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityName.trim()) return;

    const atencaoNum = parseFloat(atencao);
    const alertaNum = parseFloat(alerta);
    const inundacaoNum = parseFloat(inundacao);

    if (isNaN(atencaoNum) || isNaN(alertaNum) || isNaN(inundacaoNum)) {
      alert('Por favor insira cotas de referência válidas.');
      return;
    }

    if (atencaoNum >= alertaNum || alertaNum >= inundacaoNum) {
      alert('A Cota de Atenção deve ser menor que a de Alerta, e esta menor que a de Inundação.');
      return;
    }

    onAddCity({
      name: cityName.trim(),
      riverName: riverName.trim() || 'Rio Taquari',
      thresholds: {
        atencao: atencaoNum,
        alerta: alertaNum,
        inundacao: inundacaoNum,
      },
      isDefault: false,
    });

    // Reset form
    setCityName('');
    setRiverName('Rio Taquari');
    setAtencao('14.0');
    setAlerta('16.0');
    setInundacao('18.0');
  };

  const startEditCity = (city: City) => {
    setEditingCityId(city.id);
    setEditAtencao(String(city.thresholds.atencao));
    setEditAlerta(String(city.thresholds.alerta));
    setEditInundacao(String(city.thresholds.inundacao));
  };

  const saveEditCity = (city: City) => {
    const at = parseFloat(editAtencao);
    const al = parseFloat(editAlerta);
    const inu = parseFloat(editInundacao);

    if (isNaN(at) || isNaN(al) || isNaN(inu)) {
      alert('Cotas inválidas.');
      return;
    }

    onUpdateCity({
      ...city,
      thresholds: {
        atencao: at,
        alerta: al,
        inundacao: inu,
      },
    });

    setEditingCityId(null);
  };

  return (
    <div id="city-modal-backdrop" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div id="city-modal-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Gerenciar Cidades Monitoradas</h3>
              <p className="text-xs text-slate-400">
                Cadastre novas cidades do Vale do Taquari ou ajuste as cotas de alerta
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

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Add New City Form */}
          <form onSubmit={handleAddSubmit} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-600" />
              Cadastrar Nova Cidade
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Cidade *
                </label>
                <input
                  id="input-city-name"
                  type="text"
                  required
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="Ex: Cruzeiro do Sul, Taquari, Estrela"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Rio
                </label>
                <input
                  id="input-city-river"
                  type="text"
                  value={riverName}
                  onChange={(e) => setRiverName(e.target.value)}
                  placeholder="Ex: Rio Taquari"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Threshold Meters */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Cota Atenção (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={atencao}
                  onChange={(e) => setAtencao(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-orange-700 dark:text-orange-400 mb-1">
                  Cota Alerta (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={alerta}
                  onChange={(e) => setAlerta(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-red-700 dark:text-red-400 mb-1">
                  Cota Inundação (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={inundacao}
                  onChange={(e) => setInundacao(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono font-semibold"
                />
              </div>
            </div>

            <button
              id="btn-add-city-submit"
              type="submit"
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Adicionar Cidade à Lista
            </button>
          </form>

          {/* List of Registered Cities */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Cidades Cadastradas no Sistema ({cities.length})
            </h4>

            <div className="space-y-2">
              {cities.map((city) => {
                const isEditing = editingCityId === city.id;

                return (
                  <div
                    key={city.id}
                    className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {city.name}
                        </span>
                        {city.isDefault && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                            Vale do Taquari (Padrão)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {city.riverName || 'Rio Taquari'}
                      </p>
                    </div>

                    {/* Thresholds Display / Edit */}
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-300 dark:border-slate-700">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">At:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={editAtencao}
                            onChange={(e) => setEditAtencao(e.target.value)}
                            className="w-16 px-1.5 py-1 text-xs font-mono font-bold border rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            title="Cota de Atenção (metros)"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">Al:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={editAlerta}
                            onChange={(e) => setEditAlerta(e.target.value)}
                            className="w-16 px-1.5 py-1 text-xs font-mono font-bold border rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            title="Cota de Alerta (metros)"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">In:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={editInundacao}
                            onChange={(e) => setEditInundacao(e.target.value)}
                            className="w-16 px-1.5 py-1 text-xs font-mono font-bold border rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            title="Cota de Inundação (metros)"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => saveEditCity(city)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="Salvar alterações de cotas"
                        >
                          <Check className="w-4 h-4" />
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-amber-600 dark:text-amber-400">
                          At: <strong>{city.thresholds.atencao}m</strong>
                        </span>
                        <span className="text-orange-600 dark:text-orange-400">
                          Al: <strong>{city.thresholds.alerta}m</strong>
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          In: <strong>{city.thresholds.inundacao}m</strong>
                        </span>

                        <div className="flex items-center gap-1 border-l pl-3 border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => startEditCity(city)}
                            className="p-1 text-slate-400 hover:text-cyan-600 rounded"
                            title="Editar cotas de referência"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {!city.isDefault && (
                            <button
                              onClick={() => onDeleteCity(city.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="Remover cidade personalizada"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Concluído
          </button>
        </div>

      </div>
    </div>
  );
};
