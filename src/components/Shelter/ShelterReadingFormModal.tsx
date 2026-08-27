import React, { useState, useEffect } from 'react';
import { Shelter, ShelterReading, CalculatedShelterReading } from '../../types';
import { X, Users, Home, Calendar, Clock, Database, Plus, CheckCircle2, UserCheck, Trash2 } from 'lucide-react';
import { DEFAULT_DEMOGRAPHIC_CATEGORIES } from '../../data/shelterSeedData';

interface ShelterReadingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveReading: (reading: Omit<ShelterReading, 'id' | 'createdAt'> & { id?: string }) => void;
  shelters: Shelter[];
  dataSources: string[];
  onAddNewDataSource: (newSource: string) => void;
  initialShelterId?: string | null;
  editingReading?: CalculatedShelterReading | null;
}

export const ShelterReadingFormModal: React.FC<ShelterReadingFormModalProps> = ({
  isOpen,
  onClose,
  onSaveReading,
  shelters,
  dataSources,
  onAddNewDataSource,
  initialShelterId,
  editingReading,
}) => {
  const [shelterId, setShelterId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [peopleCount, setPeopleCount] = useState<number | ''>(0);
  const [familiesCount, setFamiliesCount] = useState<number | ''>(0);
  
  // Demographics / Faixas Etárias / Grupos
  const [categoriesList, setCategoriesList] = useState<string[]>(DEFAULT_DEMOGRAPHIC_CATEGORIES);
  const [demographics, setDemographics] = useState<Record<string, number>>({});
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);

  // Data source
  const [selectedDataSource, setSelectedDataSource] = useState('');
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [customDataSourceName, setCustomDataSourceName] = useState('');
  const [notes, setNotes] = useState('');

  // Set initial state when modal opens or editing changes
  useEffect(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    if (editingReading) {
      setShelterId(editingReading.shelterId);
      setDateStr(editingReading.dateStr);
      setTimeStr(editingReading.timeStr);
      setPeopleCount(editingReading.peopleCount);
      setFamiliesCount(editingReading.familiesCount);
      setNotes(editingReading.notes || '');
      setDemographics(editingReading.demographics || {});

      // Ensure any demographic keys present in editing item are in categories list
      if (editingReading.demographics) {
        const keys = Object.keys(editingReading.demographics);
        setCategoriesList(prev => Array.from(new Set([...prev, ...keys])));
      }

      if (dataSources.includes(editingReading.dataSource)) {
        setSelectedDataSource(editingReading.dataSource);
        setIsCustomSource(false);
      } else {
        setSelectedDataSource('custom');
        setIsCustomSource(true);
        setCustomDataSourceName(editingReading.dataSource);
      }
    } else {
      setShelterId(initialShelterId || shelters[0]?.id || '');
      setDateStr(todayStr);
      setTimeStr(currentTimeStr);
      setPeopleCount('');
      setFamiliesCount('');
      setDemographics({});
      setSelectedDataSource(dataSources[0] || 'Defesa Civil Municipal');
      setIsCustomSource(false);
      setCustomDataSourceName('');
      setNotes('');
    }
  }, [editingReading, initialShelterId, shelters, dataSources, isOpen]);

  if (!isOpen) return null;

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setIsCustomSource(true);
      setSelectedDataSource('custom');
    } else {
      setIsCustomSource(false);
      setSelectedDataSource(val);
    }
  };

  const handleDemographicChange = (category: string, val: string) => {
    const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
    setDemographics(prev => {
      const updated = { ...prev };
      if (num > 0) {
        updated[category] = num;
      } else {
        delete updated[category];
      }
      return updated;
    });
  };

  const handleAddCategorySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const catName = newCategoryInput.trim();
    if (!catName) return;

    if (!categoriesList.includes(catName)) {
      setCategoriesList(prev => [...prev, catName]);
    }
    setNewCategoryInput('');
    setIsAddingNewCategory(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!shelterId) {
      alert('Por favor, selecione o abrigo.');
      return;
    }

    if (peopleCount === '' || Number(peopleCount) < 0) {
      alert('Por favor, informe o número de pessoas abrigadas.');
      return;
    }

    if (familiesCount === '' || Number(familiesCount) < 0) {
      alert('Por favor, informe o número de famílias.');
      return;
    }

    let finalSource = selectedDataSource;
    if (isCustomSource) {
      if (!customDataSourceName.trim()) {
        alert('Por favor, digite o nome da nova fonte de dados.');
        return;
      }
      finalSource = customDataSourceName.trim();
      onAddNewDataSource(finalSource);
    }

    const timestamp = `${dateStr}T${timeStr}`;

    onSaveReading({
      id: editingReading ? editingReading.id : undefined,
      shelterId,
      timestamp,
      dateStr,
      timeStr,
      peopleCount: Number(peopleCount),
      familiesCount: Number(familiesCount),
      demographics: Object.keys(demographics).length > 0 ? demographics : undefined,
      dataSource: finalSource,
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/60">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {editingReading ? 'Editar Lançamento do Abrigo' : 'Lançar Atualização de Abrigados'}
              </h3>
              <p className="text-xs text-slate-400">
                Lançamento com especificação por perfil e grupos cadastráveis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {/* Select Shelter */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Abrigo Monitorado <span className="text-red-400">*</span>
            </label>
            <select
              value={shelterId}
              onChange={e => setShelterId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {shelters.map(s => (
                <option key={s.id} value={s.id}>
                  {s.cityName} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Totals: People Count & Families Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Total de Pessoas <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                placeholder="Ex: 150"
                value={peopleCount}
                onChange={e => setPeopleCount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
                <Home className="w-3.5 h-3.5 text-purple-400" />
                Total de Famílias <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                placeholder="Ex: 48"
                value={familiesCount}
                onChange={e => setFamiliesCount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

          </div>

          {/* Dynamic Categories / Demographics / Faixas Etárias */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Perfil dos Abrigados (Idoso, Adolescente, PCD, etc.)
              </label>

              {!isAddingNewCategory && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewCategory(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/80 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Nova Categoria
                </button>
              )}
            </div>

            {/* Inline Form to add new Category */}
            {isAddingNewCategory && (
              <div className="flex items-center gap-2 p-2 bg-slate-900 border border-indigo-800/80 rounded-lg animate-fadeIn">
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: Gestantes, Cadeirantes, Idoso..."
                  value={newCategoryInput}
                  onChange={e => setNewCategoryInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategorySubmit();
                    }
                  }}
                  className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddCategorySubmit()}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-md cursor-pointer"
                >
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewCategory(false);
                    setNewCategoryInput('');
                  }}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Inputs grid for categories */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {categoriesList.map(category => (
                <div key={category} className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-300 truncate" title={category}>
                    {category}
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={demographics[category] !== undefined ? demographics[category] : ''}
                    onChange={e => handleDemographicChange(category, e.target.value)}
                    className="w-full mt-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">
              * Preencha as quantidades por categoria conforme identificadas na triagem do abrigo.
            </p>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Data da Atualização
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Horário da Leitura
              </label>
              <input
                type="time"
                required
                value={timeStr}
                onChange={e => setTimeStr(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

          </div>

          {/* Data Source Selection & Custom Data Source Registration */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Fonte do Dado / Órgão Informante <span className="text-red-400">*</span>
              </span>
            </label>

            <select
              value={isCustomSource ? 'custom' : selectedDataSource}
              onChange={handleSourceChange}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {dataSources.map(ds => (
                <option key={ds} value={ds}>
                  {ds}
                </option>
              ))}
              <option value="custom" className="font-bold text-indigo-400">
                + Cadastrar Nova Fonte de Dado...
              </option>
            </select>

            {/* Custom Source Input */}
            {isCustomSource && (
              <div className="pt-2 animate-fadeIn">
                <label className="block text-[11px] font-semibold text-indigo-300 mb-1">
                  Nome da Nova Fonte de Dados:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ex: Igreja Evangélica Luterana, ONG Resgate, Defesa Civil Estadual"
                    value={customDataSourceName}
                    onChange={e => setCustomDataSourceName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-indigo-950/40 border border-indigo-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes / Needs */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Observações / Necessidades do Abrigo
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Necessita de doações de água potável, colchões de solteiro e fraldas descartáveis."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingReading ? 'Salvar Alterações' : 'Gravar Histórico'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
