import React, { useState, useEffect, useMemo } from "react";
import { UserProfile, UserRole, UserStatus } from "../types";
import { subscribeToAllUsers, updateUserStatus, deleteUserProfile } from "../dbService";
import UserEditModal from "./UserEditModal";
import NewUserModal from "./NewUserModal";
import {
  Shield,
  Check,
  X,
  UserX,
  UserCheck,
  Search,
  Users,
  ShieldAlert,
  Award,
  Edit3,
  Trash2,
  UserPlus,
  Building,
  Phone,
  Clock,
  Ban,
  CheckCircle2,
  Filter
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdminPanelProps {
  currentUser: UserProfile;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
  initialFilter?: "all" | "pending" | "approved" | "rejected";
}

export default function AdminPanel({ currentUser, showToast, initialFilter = "all" }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">(initialFilter);
  const [loading, setLoading] = useState(true);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);
  
  // Modal states
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Listen to all users in the database
    const unsubscribe = subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (uid: string, newStatus: UserStatus, currentRole: UserRole) => {
    setProcessingUid(uid);
    try {
      await updateUserStatus(uid, newStatus, currentRole);
      if (showToast) {
        showToast(
          newStatus === "approved"
            ? "Acesso homologado e liberado com sucesso."
            : "Acesso atualizado com sucesso.",
          "success"
        );
      }
    } catch (err) {
      console.error(err);
      if (showToast) {
        showToast("Erro ao atualizar status do usuário.", "error");
      }
    } finally {
      setProcessingUid(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await deleteUserProfile(userToDelete.uid);
      if (showToast) {
        showToast(`Credencial de ${userToDelete.name} excluída com sucesso.`, "success");
      }
      setUserToDelete(null);
    } catch (err) {
      console.error(err);
      if (showToast) {
        showToast("Erro ao excluir usuário.", "error");
      }
    } finally {
      setDeleting(false);
    }
  };

  const pendingCount = useMemo(() => users.filter((u) => u.status === "pending").length, [users]);
  const approvedCount = useMemo(() => users.filter((u) => u.status === "approved").length, [users]);
  const rejectedCount = useMemo(() => users.filter((u) => u.status === "rejected").length, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Status filter
      if (statusFilter !== "all" && u.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (u.name || "").toLowerCase().includes(q);
        const matchesEmail = (u.email || "").toLowerCase().includes(q);
        const matchesBadge = (u.badgeId || "").toLowerCase().includes(q);
        const matchesLotacao = (u.lotacao || "").toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesBadge || matchesLotacao;
      }
      return true;
    });
  }, [users, statusFilter, searchQuery]);

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> APROVADO
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-rose-950/40 border border-rose-500/30 text-rose-300 uppercase tracking-wider">
            <Ban className="w-3 h-3 text-rose-400" /> RECUSADO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-950/40 border border-amber-500/30 text-amber-300 uppercase tracking-wider animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" /> PENDENTE
          </span>
        );
    }
  };

  const getRoleBadge = (role: UserRole) => {
    if (role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-blue-950/40 text-blue-300 border border-blue-500/30 tracking-wider">
          ★ ADMINISTRADOR
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium bg-white/5 text-zinc-300 border border-white/10 tracking-wider">
        OPERADOR
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div
          onClick={() => setStatusFilter("all")}
          className={`cursor-pointer bg-[#0f1422] border rounded-2xl p-5 flex items-center gap-4 transition-all ${
            statusFilter === "all"
              ? "border-blue-500/60 shadow-lg shadow-blue-500/10"
              : "border-[#1e2a44] hover:border-white/20"
          }`}
        >
          <div className="p-3 bg-[#070a12] border border-[#1e2a44] rounded-xl text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{users.length}</div>
            <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              Total de Operadores
            </div>
          </div>
        </div>

        {/* Pendentes */}
        <div
          onClick={() => setStatusFilter("pending")}
          className={`cursor-pointer bg-[#0f1422] border rounded-2xl p-5 flex items-center gap-4 transition-all ${
            statusFilter === "pending"
              ? "border-amber-500/60 shadow-lg shadow-amber-500/10"
              : "border-[#1e2a44] hover:border-white/20"
          }`}
        >
          <div className="p-3 bg-[#070a12] border border-[#1e2a44] rounded-xl text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-300">{pendingCount}</div>
            <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
              Aguardando Homologação
            </div>
          </div>
        </div>

        {/* Aprovados */}
        <div
          onClick={() => setStatusFilter("approved")}
          className={`cursor-pointer bg-[#0f1422] border rounded-2xl p-5 flex items-center gap-4 transition-all ${
            statusFilter === "approved"
              ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10"
              : "border-[#1e2a44] hover:border-white/20"
          }`}
        >
          <div className="p-3 bg-[#070a12] border border-[#1e2a44] rounded-xl text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-300">{approvedCount}</div>
            <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
              Acessos Autorizados
            </div>
          </div>
        </div>

        {/* Recusados */}
        <div
          onClick={() => setStatusFilter("rejected")}
          className={`cursor-pointer bg-[#0f1422] border rounded-2xl p-5 flex items-center gap-4 transition-all ${
            statusFilter === "rejected"
              ? "border-rose-500/60 shadow-lg shadow-rose-500/10"
              : "border-[#1e2a44] hover:border-white/20"
          }`}
        >
          <div className="p-3 bg-[#070a12] border border-[#1e2a44] rounded-xl text-rose-400">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-rose-300">{rejectedCount}</div>
            <div className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest">
              Acessos Recusados
            </div>
          </div>
        </div>
      </div>

      {/* Control Actions & Filter Bar */}
      <div className="bg-[#0f1422] border border-[#1e2a44] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#070a12] p-1 rounded-xl border border-[#1e2a44] w-full md:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
              statusFilter === "all"
                ? "bg-blue-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white shadow"
                : "text-amber-400/80 hover:text-amber-300"
            }`}
          >
            <Clock className="w-3 h-3" />
            Pendentes ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              statusFilter === "approved"
                ? "bg-emerald-600 text-white shadow"
                : "text-emerald-400/80 hover:text-emerald-300"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Aprovados ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              statusFilter === "rejected"
                ? "bg-rose-600 text-white shadow"
                : "text-rose-400/80 hover:text-rose-300"
            }`}
          >
            <Ban className="w-3 h-3" />
            Recusados ({rejectedCount})
          </button>
        </div>

        {/* Right side: Search + Cadastrar Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, matrícula, email..."
              className="w-full bg-[#070a12] border border-[#1e2a44] hover:border-white/20 focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-4 py-2 outline-none transition-all placeholder:text-zinc-600 font-mono"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowNewUserModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" /> Cadastrar Operador
          </button>
        </div>
      </div>

      {/* Users List / Table */}
      <div className="bg-[#0f1422] border border-[#1e2a44] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <span className="border-4 border-blue-500/20 border-t-blue-500 rounded-full w-8 h-8 animate-spin"></span>
            <span className="text-[10px] uppercase font-mono tracking-widest">Carregando credenciais de operadores...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-xs font-mono uppercase text-zinc-400">
            Nenhuma credencial encontrada para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead className="bg-[#090d17] border-b border-[#1c273e] text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3.5">Nome & Matrícula</th>
                  <th className="px-5 py-3.5">E-mail Funcional</th>
                  <th className="px-5 py-3.5">Lotação / Unidade</th>
                  <th className="px-5 py-3.5">Status de Acesso</th>
                  <th className="px-5 py-3.5">Perfil / Privilégio</th>
                  <th className="px-5 py-3.5 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18233a] bg-transparent">
                {filteredUsers.map((u, uIdx) => {
                  const isProcessing = processingUid === u.uid;
                  const isSelf = u.uid === currentUser.uid;

                  return (
                    <tr
                      key={`user-row-${u.uid || u.email || "u"}-${uIdx}`}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Name & Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-zinc-100 uppercase text-xs">
                          {u.name || "NÃO INFORMADO"}
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
                          MATRÍCULA:{" "}
                          <span className="font-semibold text-zinc-400">
                            {u.badgeId || "NÃO CADASTRADO"}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-zinc-300 font-mono text-xs">
                        {u.email}
                      </td>

                      {/* Lotação */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-zinc-400 text-xs uppercase font-medium">
                        {u.lotacao ? (
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{u.lotacao}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[10px]">NÃO INFORMADA</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getStatusBadge(u.status)}
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getRoleBadge(u.role)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Approve Button (if not approved) */}
                          {u.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(u.uid, "approved", u.role)}
                              disabled={isProcessing}
                              className="bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1"
                              title="Homologar e Liberar Acesso"
                            >
                              <Check className="w-3.5 h-3.5" /> Liberar
                            </button>
                          )}

                          {/* Quick Reject Button (if not rejected) */}
                          {u.status !== "rejected" && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(u.uid, "rejected", u.role)}
                              disabled={isProcessing}
                              className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 hover:text-white px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1"
                              title="Recusar / Bloquear Acesso"
                            >
                              <X className="w-3.5 h-3.5" /> Bloquear
                            </button>
                          )}

                          {/* Full Edit Button */}
                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            className="bg-[#070a12] hover:bg-blue-950/40 border border-[#1e2a44] hover:border-blue-500/40 text-zinc-300 hover:text-blue-300 px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1"
                            title="Editar Todos os Dados do Operador"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Alterar Dados
                          </button>

                          {/* Delete Button (admin only, not self) */}
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                              title="Excluir Credencial"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          currentUser={currentUser}
          onClose={() => setEditingUser(null)}
          showToast={showToast}
        />
      )}

      {/* New User Direct Creation Modal */}
      {showNewUserModal && (
        <NewUserModal
          onClose={() => setShowNewUserModal(false)}
          showToast={showToast}
        />
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div
          id="delete-user-confirmation-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#0f1422] border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center"
          >
            <div className="w-12 h-12 bg-rose-950/50 border border-rose-500/40 rounded-xl flex items-center justify-center mx-auto mb-4 text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold font-mono uppercase text-white tracking-wider">
              Excluir Credencial de Operador?
            </h3>
            <p className="text-xs text-zinc-300 mt-2 font-sans">
              Tem certeza que deseja remover o cadastro de{" "}
              <strong className="text-white uppercase">{userToDelete.name}</strong> (
              <span className="font-mono text-zinc-400">{userToDelete.email}</span>)?
              Esta ação revoga permanentemente o acesso do operador.
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 font-mono text-xs uppercase font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                {deleting ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
