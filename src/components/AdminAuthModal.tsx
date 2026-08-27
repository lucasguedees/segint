import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, AlertCircle, X, CheckCircle2, Settings } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorizeSuccess: () => void;
  currentPin: string;
  onChangePin?: (newPin: string) => void;
  pendingActionName?: string | null;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthorizeSuccess,
  currentPin,
  onChangePin,
  pendingActionName,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  
  // States for changing PIN securely
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  if (!isOpen) return null;

  const resetAllFields = () => {
    setPinInput('');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setErrorMsg('');
    setIsChangingPin(false);
    setPinChangeSuccess(false);
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === currentPin) {
      setErrorMsg('');
      setPinInput('');
      onAuthorizeSuccess();
    } else {
      setErrorMsg('Senha / PIN de autorização incorreto. Tente novamente.');
    }
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Security Check 1: Must provide current password
    if (currentPinInput.trim() !== currentPin) {
      setErrorMsg('A senha atual está incorreta. Apenas o operador atual pode alterar a senha.');
      return;
    }

    // Security Check 2: Minimum length for new password
    if (!newPinInput.trim() || newPinInput.trim().length < 3) {
      setErrorMsg('A nova senha deve possuir pelo menos 3 caracteres.');
      return;
    }

    // Security Check 3: Confirm new password matches
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setErrorMsg('A confirmação da senha não confere com a nova senha.');
      return;
    }

    // Security Check 4: New password cannot be identical to current
    if (newPinInput.trim() === currentPin) {
      setErrorMsg('A nova senha não pode ser idêntica à senha atual.');
      return;
    }

    if (onChangePin) {
      onChangePin(newPinInput.trim());
      setPinChangeSuccess(true);
      setTimeout(() => {
        resetAllFields();
      }, 1500);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/60">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {isChangingPin ? 'Alterar Senha do Operador' : 'Acesso Restrito ao Operador'}
              </h3>
              <p className="text-xs text-slate-400">
                {isChangingPin ? 'Confirmação de segurança obrigatória' : 'Autorização para alteração de dados'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetAllFields();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          
          {pendingActionName && !isChangingPin && (
            <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Ação solicitada:</strong> {pendingActionName}
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Qualquer pessoa pode consultar os dados publicamente. Digite a senha do operador autorizador para efetuar alterações.
                </p>
              </div>
            </div>
          )}

          {!pendingActionName && !isChangingPin && (
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              O sistema está em <strong>modo de consulta pública</strong>. Para liberar cadastramentos, alterações e lançamentos, digite a senha do operador autorizador.
            </p>
          )}

          {isChangingPin && (
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              Por medidas de segurança, informe a <strong>senha atual</strong> para autorizar a criação de uma nova senha de operador.
            </p>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-800/80 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {pinChangeSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Senha de operador alterada com sucesso!</span>
            </div>
          )}

          {!isChangingPin ? (
            <form onSubmit={handleVerifyPin} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  Digite a Senha do Operador
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  placeholder="Código de acesso do operador"
                  value={pinInput}
                  onChange={e => {
                    setPinInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-base tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {onChangePin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPin(true);
                      setErrorMsg('');
                      setCurrentPinInput('');
                      setNewPinInput('');
                      setConfirmPinInput('');
                    }}
                    className="text-xs text-slate-400 hover:text-indigo-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Alterar Senha
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      resetAllFields();
                      onClose();
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-cyan-600 hover:from-indigo-400 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Autorizar
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveNewPin} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Senha Atual do Operador
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  placeholder="Digite a senha atual"
                  value={currentPinInput}
                  onChange={e => {
                    setCurrentPinInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm tracking-wider placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  Nova Senha
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite a nova senha"
                  value={newPinInput}
                  onChange={e => {
                    setNewPinInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm tracking-wider placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPinInput}
                  onChange={e => {
                    setConfirmPinInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm tracking-wider placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setIsChangingPin(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
          Qualquer cidadão possui acesso livre e desimpedido para leitura e download dos dados.
        </div>

      </div>
    </div>
  );
};
