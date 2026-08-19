import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { createUserProfile } from "../dbService";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  BadgeCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Key,
  LogIn,
  ShieldCheck,
  UserPlus
} from "lucide-react";

interface LoginScreenProps {
  onAuthSuccess: (uid: string) => void;
}

type AuthMode = "operator" | "admin" | "signup";

export default function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("operator");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("segint_saved_email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Contingency & Master Admin Authentication (only requires administrative password 234589)
  const handleAdminMasterAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const pass = adminPassword.trim();

      if (!pass) {
        throw new Error("Digite a senha administrativa.");
      }

      if (pass !== "234589") {
        throw new Error("Senha administrativa incorreta.");
      }

      // Master admin authorized
      localStorage.setItem("sispir_mode", "local");
      const uid = "admin-master";
      localStorage.setItem("sispir_local_user_id", uid);

      const localProfile = {
        uid,
        name: "ADMINISTRADOR (ALI)",
        email: "admin@segint.gov.br",
        role: "admin" as const,
        status: "approved" as const,
        badgeId: "ADM-22BPM",
        lotacao: "22º BPM - ALI",
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(`sispir_local_profile_${uid}`, JSON.stringify(localProfile));

      const usersStr = localStorage.getItem("sispir_local_users") || "[]";
      const users = JSON.parse(usersStr);
      if (!users.some((u: any) => u.uid === uid)) {
        users.push(localProfile);
        localStorage.setItem("sispir_local_users", JSON.stringify(users));
      }

      onAuthSuccess(uid);
      window.location.reload();
      return;
    } catch (err: any) {
      console.error("Erro na autenticação administrativa:", err);
      setError(err.message || "Senha administrativa incorreta.");
    } finally {
      setLoading(false);
    }
  };

  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error("Informe seu e-mail de operador.");
      }
      if (!password) {
        throw new Error("Informe sua senha de acesso.");
      }

      if (rememberMe) {
        localStorage.setItem("segint_saved_email", email.trim());
      } else {
        localStorage.removeItem("segint_saved_email");
      }

      // Try Firebase Auth
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess(userCredential.user.uid);
      } catch (fbErr: any) {
        // If local user exists or in contingency
        const localUsersStr = localStorage.getItem("sispir_local_users");
        if (localUsersStr) {
          const localUsers = JSON.parse(localUsersStr);
          const found = localUsers.find(
            (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
          );
          if (found) {
            localStorage.setItem("sispir_mode", "local");
            localStorage.setItem("sispir_local_user_id", found.uid);
            onAuthSuccess(found.uid);
            window.location.reload();
            return;
          }
        }

        if (fbErr.code === "auth/invalid-credential" || fbErr.code === "auth/wrong-password" || fbErr.code === "auth/user-not-found") {
          throw new Error("Credenciais inválidas. Verifique seu e-mail e senha de acesso.");
        } else if (fbErr.code === "auth/too-many-requests") {
          throw new Error("Muitas tentativas consecutivas. Aguarde alguns instantes.");
        } else {
          throw fbErr;
        }
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      setError(err.message || "Falha ao realizar login no sistema.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!name.trim()) {
        throw new Error("O nome completo e graduação são obrigatórios (Ex: SD PM FULANO).");
      }
      if (!email.trim()) {
        throw new Error("O e-mail funcional é obrigatório.");
      }
      if (password.length < 6) {
        throw new Error("A senha deve conter no mínimo 6 caracteres.");
      }
      if (password !== confirmPassword) {
        throw new Error("As senhas digitadas não coincidem.");
      }

      // Try creating user in Firebase Auth
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;
        await createUserProfile(user.uid, name.trim().toUpperCase(), email.trim(), badgeId.trim());
      } catch (fbErr: any) {
        // If Firebase Auth fails or is offline, register in local contingency storage
        const uid = `usr_${Date.now()}`;
        const newProfile = {
          uid,
          name: name.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          badgeId: badgeId.trim().toUpperCase(),
          role: "user" as const,
          status: "pending" as const,
          lotacao: "22º BPM - ALI",
          createdAt: new Date().toISOString(),
        };

        const usersStr = localStorage.getItem("sispir_local_users") || "[]";
        const users = JSON.parse(usersStr);
        users.push(newProfile);
        localStorage.setItem("sispir_local_users", JSON.stringify(users));
        localStorage.setItem(`sispir_local_profile_${uid}`, JSON.stringify(newProfile));
      }

      setSignUpSuccess(true);
      setAuthMode("operator");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail funcional já está cadastrado no sistema.");
      } else {
        setError(err.message || "Erro ao solicitar cadastro.");
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div
      id="login-page-container"
      className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none font-sans text-[#e0e0e0]"
    >
      {/* Subtle background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[430px] bg-[#0c1220]/95 backdrop-blur-md border border-[#1b263b] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-10"
      >
        {/* Top Header Section */}
        <div className="pt-8 pb-6 px-6 flex flex-col items-center text-center">
          {/* Shield Icon Badge */}
          <div className="w-16 h-16 rounded-2xl border border-blue-500/40 bg-[#09101f] flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(37,99,235,0.15)]">
            <Shield className="w-8 h-8 text-blue-400 stroke-[1.8]" />
          </div>

          {/* Title SEGINT */}
          <h1 className="text-2xl font-black tracking-wider uppercase text-white font-sans">
            SEGINT
          </h1>

          {/* Pill Badge: 22º BPM - ALI */}
          <div className="mt-2 inline-flex items-center justify-center px-4 py-1 rounded-full bg-[#0a1428] border border-blue-500/40 text-blue-400 text-xs font-bold font-mono tracking-widest">
            22º BPM - ALI
          </div>

          {/* Subtitle */}
          <p className="mt-2.5 text-[10px] text-zinc-400 font-mono tracking-[0.18em] uppercase">
            SISTEMA ESTRUTURADO DE GESTÃO E INTELIGÊNCIA
          </p>
        </div>

        {/* Success Alert */}
        {signUpSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mb-4 p-3.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-start gap-2.5"
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <p className="font-bold font-mono uppercase tracking-wider text-[11px]">
                Solicitação de Acesso Registrada!
              </p>
              <p className="mt-1 text-zinc-300 text-[11px] leading-relaxed">
                Seu cadastro foi encaminhado com sucesso. Um administrador homologará sua credencial para liberação de acesso.
              </p>
            </div>
          </motion.div>
        )}

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mb-4 p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="font-medium">{error}</span>
          </motion.div>
        )}

        {/* Body Section */}
        <div className="px-6 pb-6 pt-1">
          {/* Mode Switcher Tabs (OPERADORES vs ADMINISTRADOR) */}
          {authMode !== "signup" && (
            <div className="bg-[#070b14] p-1 rounded-xl border border-[#182338] mb-6 flex items-center gap-1">
              {/* Tab 1: Operadores */}
              <button
                type="button"
                onClick={() => {
                  setAuthMode("operator");
                  setError("");
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  authMode === "operator"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>OPERADORES</span>
              </button>

              {/* Tab 2: Administrador */}
              <button
                type="button"
                onClick={() => {
                  setAuthMode("admin");
                  setError("");
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  authMode === "admin"
                    ? "bg-[#d97706] hover:bg-[#b45309] text-white shadow-lg shadow-amber-600/30 border border-amber-400/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>ADMINISTRADOR</span>
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* 1. OPERATOR LOGIN FORM                                   */}
          {/* ======================================================== */}
          {authMode === "operator" && (
            <form onSubmit={handleOperatorLogin} className="space-y-4">
              {/* E-mail Field */}
              <div>
                <label className="block text-[11px] font-bold font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  E-MAIL
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@email.com"
                    className="w-full bg-[#070b14] border border-[#1c283f] hover:border-blue-500/40 focus:border-blue-500 text-white text-xs rounded-xl pl-10 pr-3.5 py-3 outline-none transition-all placeholder:text-zinc-600 font-medium"
                  />
                </div>
              </div>

              {/* Senha Field */}
              <div>
                <label className="block text-[11px] font-bold font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  SENHA
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#070b14] border border-[#1c283f] hover:border-blue-500/40 focus:border-blue-500 text-white text-xs rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-zinc-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Lembrar de mim Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#070b14] border-[#1c283f] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                />
                <label
                  htmlFor="remember-me"
                  className="text-[11px] font-bold font-mono text-zinc-400 uppercase tracking-wider cursor-pointer select-none"
                >
                  LEMBRAR DE MIM
                </label>
              </div>

              {/* Entrar no Sistema Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold uppercase tracking-wider text-xs rounded-xl py-3.5 mt-2 transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <span className="border-2 border-white/20 border-t-white rounded-full w-4 h-4 animate-spin"></span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>ENTRAR NO SISTEMA</span>
                  </>
                )}
              </button>

              {/* Link: Novo Operador? Cadastre-se */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setError("");
                  }}
                  className="text-xs font-mono font-bold text-zinc-400 hover:text-blue-400 uppercase tracking-wider transition-colors"
                >
                  NOVO OPERADOR? CADASTRE-SE
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* 2. ADMIN LOGIN FORM                                      */}
          {/* ======================================================== */}
          {authMode === "admin" && (
            <form onSubmit={handleAdminMasterAuth} className="space-y-4">
              {/* Senha Administrativa Field */}
              <div>
                <label className="block text-[11px] font-bold font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  SENHA ADMINISTRATIVA
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#070b14] border border-[#1c283f] hover:border-amber-500/40 focus:border-amber-500 text-white text-xs rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-zinc-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Lembrar de mim Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember-admin"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#070b14] border-[#1c283f] text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-600"
                />
                <label
                  htmlFor="remember-admin"
                  className="text-[11px] font-bold font-mono text-zinc-400 uppercase tracking-wider cursor-pointer select-none"
                >
                  LEMBRAR DE MIM
                </label>
              </div>

              {/* Autenticar Master Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#d97706] hover:bg-[#b45309] text-white font-mono font-bold uppercase tracking-wider text-xs rounded-xl py-3.5 mt-2 transition-all shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <span className="border-2 border-white/20 border-t-white rounded-full w-4 h-4 animate-spin"></span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>AUTENTICAR MASTER</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* 3. SIGN UP FORM (CADASTRO DE OPERADOR)                   */}
          {/* ======================================================== */}
          {authMode === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="text-center pb-1">
                <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-blue-400 flex items-center justify-center gap-1.5">
                  <UserPlus className="w-4 h-4" /> SOLICITAÇÃO DE CADASTRO
                </h2>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  Preencha os dados para análise da Agência de Inteligência
                </p>
              </div>

              {/* Nome / Graduação */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  NOME / GRADUAÇÃO (EX: SD PM FULANO) <span className="text-rose-400">*</span>
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
                    className="w-full bg-[#070b14] border border-[#1c283f] hover:border-blue-500/40 focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all uppercase placeholder:text-zinc-600 font-medium"
                  />
                </div>
              </div>

              {/* E-mail Funcional */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  E-MAIL FUNCIONAL <span className="text-rose-400">*</span>
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
                    placeholder="usuario@email.com"
                    className="w-full bg-[#070b14] border border-[#1c283f] hover:border-blue-500/40 focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all placeholder:text-zinc-600 font-medium"
                  />
                </div>
              </div>

              {/* Matrícula / ID */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  MATRÍCULA / ID FUNCIONAL (OPCIONAL)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <BadgeCheck className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={badgeId}
                    onChange={(e) => setBadgeId(e.target.value)}
                    placeholder="EX: PM-94182"
                    className="w-full bg-[#070b14] border border-[#1c283f] hover:border-blue-500/40 focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all uppercase placeholder:text-zinc-600 font-mono"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  SENHA DE ACESSO (MÍNIMO 6 DÍGITOS) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#070b14] border border-[#1c283f] hover:border-blue-500/40 focus:border-blue-500 text-white text-xs rounded-xl pl-9 pr-9 py-2.5 outline-none transition-all placeholder:text-zinc-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirmação de Senha */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">
                    CONFIRMAÇÃO DE SENHA <span className="text-rose-400">*</span>
                  </label>
                  {passwordsMatch && (
                    <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Senhas coincidem
                    </span>
                  )}
                  {passwordsMismatch && (
                    <span className="text-[9px] font-mono text-rose-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Senhas não conferem
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-[#070b14] border text-white text-xs rounded-xl pl-9 pr-9 py-2.5 outline-none transition-all placeholder:text-zinc-600 font-mono ${
                      passwordsMismatch
                        ? "border-rose-500/60 focus:border-rose-500"
                        : passwordsMatch
                        ? "border-emerald-500/50 focus:border-emerald-500"
                        : "border-[#1c283f] hover:border-blue-500/40 focus:border-blue-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Botão Enviar Solicitação */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold uppercase tracking-wider text-xs rounded-xl py-3 mt-3 transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <span className="border-2 border-white/20 border-t-white rounded-full w-4 h-4 animate-spin"></span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>SOLICITAR CADASTRO DE ACESSO</span>
                  </>
                )}
              </button>

              {/* Link Voltar ao Login */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("operator");
                    setError("");
                  }}
                  className="text-xs font-mono font-bold text-zinc-400 hover:text-blue-400 uppercase tracking-wider transition-colors"
                >
                  JÁ POSSUI ACESSO? FAÇA LOGIN
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Card Bottom Footer */}
        <div className="py-4 px-6 bg-[#080d18] border-t border-[#182338] text-center">
          <p className="text-[9px] font-mono font-medium text-zinc-500 uppercase tracking-widest leading-relaxed">
            USO RESTRITO · AGÊNCIA DE INTELIGÊNCIA - 22º BPM - ALI
          </p>
        </div>
      </motion.div>
    </div>
  );
}
