import React, { useState } from "react";
import { UserProfile, UserRole, UserStatus } from "../types";
import { updateUserProfileData } from "../dbService";
import { motion } from "motion/react";
import {
  X,
  User,
  Shield,
  BadgeCheck,
  Mail,
  Building,
  Phone,
  FileText,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban
} from "lucide-react";

interface UserEditModalProps {
  user: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

export default function UserEditModal({
  user,
  currentUser,
  onClose,
  showToast,
}: UserEditModalProps) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [badgeId, setBadgeId] = useState(user.badgeId || "");
  const [lotacao, setLotacao] = useState(user.lotacao || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [notes, setNotes] = useState(user.notes || "");
  const [role, setRole] = useState<UserRole>(user.role || "user");
  const [status, setStatus] = useState<UserStatus>(user.status || "pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isSelf = user.uid === currentUser.uid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome completo / graduação é obrigatório.");
      return;
    }
    if (!email.trim()) {
      setError("O e-mail funcional é obrigatório.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateUserProfileData(user.uid, {
        name: name.trim(),
        email: email.trim(),
        badgeId: badgeId.trim(),
        lotacao: lotacao.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        role: isSelf ? user.role : role, // Prevent self-demotion accidentally
        status: isSelf ? user.status : status,
      });

      if (showToast) {
        showToast(`Cadastro de ${name.trim()} atualizado com sucesso.`, "success");
      }
      onClose();
    } catch (err: any) {
      console.error("Erro ao atualizar dados do usuário:", err);
      setError("Erro ao salvar alterações no cadastro. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="user-edit-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-[#0f1422] border border-[#233150] rounded-2xl shadow-2xl overflow-hidden font-sans text-[#e0e0e0]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#090d17] border-b border-[#1c273e]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/60 border border-blue-500/30 rounded-xl text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
                Editar Cadastro de Operador
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono">
                UID: {user.uid} · CADASTRADO EM {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/D'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-6 mb-0 p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome / Graduação */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Nome Funcional / Graduação (EX: SD PM FULANO) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="EX: SD PM FULANO"
                  className="w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all uppercase font-medium placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* E-mail Funcional */}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                E-mail Funcional <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="policial@instituicao.gov.br"
                  className="w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* Matrícula / ID Funcional */}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Matrícula / ID Funcional
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <BadgeCheck className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  placeholder="Ex: PM-89412"
                  className="w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all uppercase placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* Lotação / Batalhão */}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Lotação / Unidade / Batalhão
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Building className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={lotacao}
                  onChange={(e) => setLotacao(e.target.value)}
                  placeholder="Ex: 22º BPM - 1ª Cia"
                  className="w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all uppercase placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* Telefone / Contato */}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Telefone / Contato Operacional
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (51) 99999-9999"
                  className="w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* Status de Acesso */}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Status de Homologação / Acesso
              </label>
              <select
                disabled={isSelf}
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className={`w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl px-3 py-2.5 outline-none transition-all font-mono uppercase font-bold cursor-pointer ${
                  status === "approved"
                    ? "text-emerald-400"
                    : status === "rejected"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                <option value="approved">✓ APROVADO (ACESSO LIBERADO)</option>
                <option value="pending">⏳ PENDENTE (EM ANÁLISE)</option>
                <option value="rejected">✕ RECUSADO (ACESSO BLOQUEADO)</option>
              </select>
              {isSelf && (
                <span className="text-[9px] font-mono text-zinc-500 mt-1 block">
                  * Você não pode alterar o status da sua própria conta.
                </span>
              )}
            </div>

            {/* Perfil / Função */}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Nível de Privilégio / Função
              </label>
              <select
                disabled={isSelf}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl px-3 py-2.5 outline-none transition-all font-mono uppercase font-bold cursor-pointer text-blue-400"
              >
                <option value="user">OPERADOR COMUM (ACESSO PADRÃO)</option>
                <option value="admin">★ ADMINISTRADOR (ACESSO TOTAL)</option>
              </select>
              {isSelf && (
                <span className="text-[9px] font-mono text-zinc-500 mt-1 block">
                  * Você não pode alterar a função da sua própria conta.
                </span>
              )}
            </div>

            {/* Observações / Notas */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                Observações Administrativas / Notas Internas
              </label>
              <div className="relative">
                <span className="absolute top-3 left-3 text-zinc-500">
                  <FileText className="w-4 h-4" />
                </span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Policial transferido do 40º BPM em 2026. Acesso concedido para investigações da AISP 12."
                  className="w-full bg-[#070a12] border border-[#1e2a44] focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2 outline-none transition-all placeholder:text-zinc-700 custom-scrollbar resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1c273e]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 font-mono text-xs uppercase font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="border-2 border-white/20 border-t-white rounded-full w-4 h-4 animate-spin"></span>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
