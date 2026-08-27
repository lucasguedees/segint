import React, { useState, useEffect } from 'react';
import { Shelter, City, ShelterStatus } from '../../types';
import { X, Building2, MapPin, Phone, CheckCircle2 } from 'lucide-react';

interface ShelterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveShelter: (shelter: Omit<Shelter, 'id' | 'createdAt'> & { id?: string }) => void;
  cities: City[];
  editingShelter?: Shelter | null;
}

export const ShelterFormModal: React.FC<ShelterFormModalProps> = ({
  isOpen,
  onClose,
  onSaveShelter,
  cities,
  editingShelter,
}) => {
  const [name, setName] = useState('');
  const [cityId, setCityId] = useState('');
  const [customCityName, setCustomCityName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<ShelterStatus>('ativo');

  useEffect(() => {
    if (editingShelter) {
      setName(editingShelter.name);
      setCityId(editingShelter.cityId);
      setCustomCityName(editingShelter.cityName || '');
      setAddress(editingShelter.address || '');
      setContact(editingShelter.contact || '');
      setStatus(editingShelter.status);
    } else {
      setName('');
      setCityId(cities[0]?.id || 'lajeado');
      setCustomCityName('');
      setAddress('');
      setContact('');
      setStatus('ativo');
    }
  }, [editingShelter, cities, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome do abrigo.');
      return;
    }
    if (!cityId) {
      alert('Selecione um município.');
      return;
    }

    let finalCityId = cityId;
    let finalCityName = '';

    if (cityId === 'outro_custom') {
      if (!customCityName.trim()) {
        alert('Por favor, informe o nome do novo município.');
        return;
      }
      finalCityName = customCityName.trim();
      finalCityId = customCityName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-');
    } else {
      const selectedCity = cities.find(c => c.id === cityId);
      finalCityName = selectedCity ? selectedCity.name : 'Cidade';
    }

    onSaveShelter({
      id: editingShelter ? editingShelter.id : undefined,
      name: name.trim(),
      cityId: finalCityId,
      cityName: finalCityName,
      address: address.trim(),
      contact: contact.trim(),
      status,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/60">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {editingShelter ? 'Editar Cadastro do Abrigo' : 'Cadastrar Novo Abrigo'}
              </h3>
              <p className="text-xs text-slate-400">
                Informações de localização e identificação do ponto de acolhimento
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Shelter Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Nome do Abrigo / Local <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Ginásio Municipal, Salão Paroquial, EEEM Martin Luther"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* City & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Município <span className="text-red-400">*</span>
              </label>
              <select
                value={cityId}
                onChange={e => setCityId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {cities.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="outro_custom">+ Outro Município...</option>
              </select>

              {cityId === 'outro_custom' && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    placeholder="Digite o nome do município"
                    value={customCityName}
                    onChange={e => setCustomCityName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-indigo-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Status Operacional
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ShelterStatus)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ativo">Ativo (Aberto e Acolhendo)</option>
                <option value="preparacao">Em Preparação</option>
                <option value="inativo">Inativo / Fechado</option>
              </select>
            </div>

          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Endereço / Bairro
            </label>
            <input
              type="text"
              placeholder="Ex: Rua General Osório, Bairro Centro"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Contato / Telefone do Responsável
            </label>
            <input
              type="text"
              placeholder="Ex: (51) 99999-0000 / Maria - Defesa Civil"
              value={contact}
              onChange={e => setContact(e.target.value)}
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
              {editingShelter ? 'Salvar Alterações' : 'Cadastrar Abrigo'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
