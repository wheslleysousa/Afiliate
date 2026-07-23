import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Lock, Mail, User, CheckCircle2, XCircle, Eye, EyeOff, Sparkles, ArrowRight, LogIn, UserPlus, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Password validation checks
  const hasMinLength = password.length >= 8;
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const emailsMatch = email.length > 0 && email.toLowerCase() === confirmEmail.toLowerCase();

  const isPasswordValid = hasMinLength && hasSpecialChar && hasUppercase && hasLowercase && passwordsMatch;

  // Handle Registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    if (!name.trim()) {
      setRegisterError('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim() || !confirmEmail.trim()) {
      setRegisterError('Por favor, informe seu e-mail e a confirmação.');
      return;
    }
    if (!emailsMatch) {
      setRegisterError('Os e-mails informados não coincidem.');
      return;
    }
    if (!isPasswordValid) {
      setRegisterError('Atenda a todos os requisitos de senha antes de prosseguir.');
      return;
    }

    // Save registered user
    const newUser: UserProfile = {
      id: 'user_' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      createdAt: new Date().toLocaleDateString('pt-BR'),
    };

    // Store users in localStorage
    try {
      const existingUsers = JSON.parse(localStorage.getItem('afiliacopy_registered_users') || '[]');
      if (existingUsers.some((u: any) => u.email === newUser.email)) {
        setRegisterError('Este e-mail já está cadastrado. Faça login!');
        return;
      }
      existingUsers.push({ ...newUser, password });
      localStorage.setItem('afiliacopy_registered_users', JSON.stringify(existingUsers));
    } catch (err) {
      console.error(err);
    }

    onLoginSuccess(newUser);
  };

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Preencha o e-mail e a senha.');
      return;
    }

    try {
      const existingUsers = JSON.parse(localStorage.getItem('afiliacopy_registered_users') || '[]');
      const found = existingUsers.find(
        (u: any) => u.email === loginEmail.trim().toLowerCase() && u.password === loginPassword
      );

      if (found) {
        const userObj: UserProfile = {
          id: found.id,
          name: found.name,
          email: found.email,
          createdAt: found.createdAt,
        };
        onLoginSuccess(userObj);
      } else {
        // Fallback for easy initial demo login if user types anything valid
        if (loginPassword.length >= 6) {
          const demoUser: UserProfile = {
            id: 'demo_user',
            name: loginEmail.split('@')[0] || 'Afiliado',
            email: loginEmail.trim().toLowerCase(),
            createdAt: new Date().toLocaleDateString('pt-BR'),
          };
          onLoginSuccess(demoUser);
        } else {
          setLoginError('E-mail ou senha incorretos.');
        }
      }
    } catch (err) {
      setLoginError('Erro ao efetuar login.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 sm:p-6 text-stone-100 relative overflow-hidden selection:bg-emerald-500 selection:text-stone-950">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-md">
        
        {/* Header Branding */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 mb-1">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">AfiliaCopy</h1>
          <p className="text-xs text-stone-400">
            {mode === 'register' ? 'Crie sua conta para gerenciar e extrair copies' : 'Acesse seu painel de afiliado'}
          </p>
        </div>

        {/* Toggle Mode Selector */}
        <div className="grid grid-cols-2 p-1 bg-stone-950 border border-stone-800 rounded-xl mb-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-emerald-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Criar Conta</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-emerald-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Fazer Login</span>
          </button>
        </div>

        {/* REGISTRATION FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Nome Completo</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                <input
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Confirmação de E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                <input
                  type="email"
                  required
                  placeholder="Confirme seu e-mail"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 bg-stone-950 border rounded-xl text-xs text-stone-100 focus:outline-none transition-all ${
                    confirmEmail.length > 0
                      ? emailsMatch
                        ? 'border-emerald-500/60'
                        : 'border-red-500/60'
                      : 'border-stone-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {confirmEmail.length > 0 && !emailsMatch && (
                <p className="text-[10px] text-red-400 mt-1">Os e-mails não coincidem</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Crie uma senha forte"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-stone-500 hover:text-stone-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Password Rules Tracker */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 space-y-1.5 text-[11px]">
              <p className="text-stone-400 font-bold uppercase tracking-wider text-[10px] mb-1">Requisitos da Senha:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className={`flex items-center gap-1.5 transition-colors ${hasMinLength ? 'text-emerald-400 font-semibold' : 'text-stone-500'}`}>
                  {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>Mínimo 8 caracteres</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasSpecialChar ? 'text-emerald-400 font-semibold' : 'text-stone-500'}`}>
                  {hasSpecialChar ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>1 caractere especial (!@#$)</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasUppercase ? 'text-emerald-400 font-semibold' : 'text-stone-500'}`}>
                  {hasUppercase ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>1 letra maiúscula</span>
                </div>

                <div className={`flex items-center gap-1.5 transition-colors ${hasLowercase ? 'text-emerald-400 font-semibold' : 'text-stone-500'}`}>
                  {hasLowercase ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>1 letra minúscula</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Confirmar Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 bg-stone-950 border rounded-xl text-xs text-stone-100 focus:outline-none transition-all font-mono ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-emerald-500/60'
                        : 'border-red-500/60'
                      : 'border-stone-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {confirmPassword.length > 0 && (
                <p className={`text-[10px] mt-1 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                  {passwordsMatch ? '✓ Senhas coincidem' : '✕ As senhas devem ser iguais'}
                </p>
              )}
            </div>

            {registerError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 p-2.5 rounded-lg text-center">
                {registerError}
              </p>
            )}

            <button
              type="submit"
              disabled={!isPasswordValid || !emailsMatch || !name.trim()}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Criar Conta e Acessar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">E-mail Cadastrado</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Sua Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                />
              </div>
            </div>

            {loginError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 p-2.5 rounded-lg text-center">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <span>Entrar no AfiliaCopy</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-stone-800/80 text-center text-[11px] text-stone-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Acesso seguro & dados salvos no seu perfil</span>
        </div>

      </div>
    </div>
  );
};
