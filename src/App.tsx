import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { subscribeToUserProfile } from "./dbService";
import { UserProfile } from "./types";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import { Shield, ShieldAlert, LogOut, Clock, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to Firebase Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        const activeUid = localStorage.getItem("sispir_active_uid");
        if (activeUid) {
          const localProfileStr = localStorage.getItem(`sispir_local_profile_${activeUid}`);
          if (localProfileStr) {
            const localProfile = JSON.parse(localProfileStr);
            setUser({ uid: activeUid, email: localProfile.email });
            setProfile(localProfile);
            setLoading(false);
            return;
          }
          setUser({ uid: activeUid, email: "lucas2305rj1994@gmail.com" });
          return;
        }
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // 2. Listen to User profile document in Firestore
    setLoading(true);
    const unsubscribeProfile = subscribeToUserProfile(user.uid, async (userProfile) => {
      if (userProfile) {
        // Auto-approve/Auto-admin for the workspace owner (case-insensitive check)
        const isOwner = userProfile.email && userProfile.email.toLowerCase() === "lucas2305rj1994@gmail.com";
        if (isOwner && (userProfile.status !== "approved" || userProfile.role !== "admin")) {
          try {
            const { updateUserStatus } = await import("./dbService");
            await updateUserStatus(user.uid, "approved", "admin");
            return;
          } catch (err) {
            console.error("Error auto-approving owner profile:", err);
          }
        }
        setProfile(userProfile);
      } else {
        // Profile fallback if not yet created in Firestore
        const defaultProfile: UserProfile = {
          uid: user.uid,
          name: "ADMINISTRADOR (ALI)",
          email: user.email || "lucas2305rj1994@gmail.com",
          role: "admin",
          status: "approved",
          badgeId: "ADM-22BPM",
          lotacao: "22º BPM - ALI",
          createdAt: new Date().toISOString(),
        };
        setProfile(defaultProfile);
      }
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user]);

  const handleAuthSuccess = (uid: string) => {
    const activeUid = uid || "admin-master";
    const localProfileStr = localStorage.getItem(`sispir_local_profile_${activeUid}`);
    let initialProfile: UserProfile | null = localProfileStr ? JSON.parse(localProfileStr) : null;
    if (!initialProfile) {
      initialProfile = {
        uid: activeUid,
        name: "ADMINISTRADOR (ALI)",
        email: "lucas2305rj1994@gmail.com",
        role: "admin",
        status: "approved",
        badgeId: "ADM-22BPM",
        lotacao: "22º BPM - ALI",
        createdAt: new Date().toISOString(),
      };
    }
    setUser({ uid: activeUid, email: initialProfile.email });
    setProfile(initialProfile);
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("sispir_mode");
      localStorage.removeItem("sispir_active_uid");
      localStorage.removeItem("sispir_local_user_id");
      setUser(null);
      setProfile(null);
      await signOut(auth);
    } catch (e) {
      console.error("Erro ao deslogar:", e);
    }
  };

  // --- RENDERING ROUTER ---

  // 1. Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-4 font-sans text-[#e0e0e0]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-500 animate-pulse" />
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">
            Estabelecendo Conexão Segura...
          </span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated user
  if (!user || !profile) {
    return <LoginScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // 3. Authenticated - Rejected Access Screen
  if (profile.status === "rejected") {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center p-4 font-sans select-none text-[#e0e0e0]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0d0d12_1px,transparent_1px),linear-gradient(to_bottom,#0d0d12_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#12121a]/95 border border-rose-500/20 rounded-2xl p-8 shadow-2xl text-center z-10"
        >
          <div className="w-16 h-16 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-500/10">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-sm font-bold tracking-widest text-rose-400 uppercase font-mono">
            ACESSO NEGADO
          </h1>
          <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest border-b border-white/5 pb-4">
            SOLICITAÇÃO DE CREDENCIAL REJEITADA
          </p>

          <p className="text-xs text-zinc-300 leading-relaxed my-6">
            Prezado operador, a análise de sua solicitação foi concluída e o seu acesso foi <strong className="text-rose-400">recusado</strong> por um administrador do sistema.
            <br />
            Caso acredite tratar-se de um equívoco, entre em contato com o administrador de plantão.
          </p>

          <button
            onClick={handleLogout}
            className="w-full bg-[#0d0d12] hover:bg-[#12121a] text-zinc-300 font-semibold text-xs rounded-lg py-3 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Desconectar Usuário
          </button>
        </motion.div>
      </div>
    );
  }

  // 4. Authenticated - Pending Approval Screen
  if (profile.status === "pending") {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center p-4 font-sans select-none text-[#e0e0e0]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0d0d12_1px,transparent_1px),linear-gradient(to_bottom,#0d0d12_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#12121a]/95 border border-white/10 rounded-2xl p-8 shadow-2xl text-center z-10"
        >
          <div className="w-16 h-16 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/10 animate-pulse">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-sm font-bold tracking-widest text-amber-400 uppercase font-mono">
            ACESSO PENDENTE
          </h1>
          <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest border-b border-white/5 pb-4">
            AGUARDANDO LIBERAÇÃO OPERACIONAL
          </p>

          <div className="text-left bg-[#050507] p-4 rounded-xl border border-white/5 my-6 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500">OPERADOR:</span>
              <span className="text-zinc-300 font-bold uppercase">{profile.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">MATRÍCULA:</span>
              <span className="text-zinc-300 font-semibold uppercase">{profile.badgeId || "NÃO CONSTA"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">EMAIL:</span>
              <span className="text-zinc-300 font-mono text-xs">{profile.email}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            Seu cadastro foi recebido com sucesso no centro de comunicações. Para manter a segurança da base de dados policial, o seu acesso precisa ser homologado por um administrador antes de prosseguir.
          </p>

          <button
            onClick={handleLogout}
            className="w-full bg-[#0d0d12] hover:bg-[#12121a] text-zinc-300 font-semibold text-xs rounded-lg py-3 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Cancelar / Voltar
          </button>
        </motion.div>
      </div>
    );
  }

  // 5. Authenticated & Approved User -> Show operational dashboard!
  return <Dashboard currentUser={profile} onLogout={handleLogout} />;
}
