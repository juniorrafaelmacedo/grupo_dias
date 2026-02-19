import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowRight, Database, ExternalLink, HelpCircle } from 'lucide-react';
import { supabaseKey, supabaseUrl } from '../services/supabase';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const isKeyInvalid = !supabaseKey || supabaseKey.includes('COLE_SUA') || supabaseKey.length < 20;
  const projectRef = supabaseUrl?.split('.')[0]?.replace('https://', '');
  const settingsLink = `https://supabase.com/dashboard/project/${projectRef}/settings/api`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) navigate('/');
      else setError(result.error || 'Credenciais inválidas.');
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f0f0] font-sans relative overflow-hidden p-4">
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-dias-teal relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="mb-8 text-center">
            <div className="relative inline-block">
                <h1 className="text-[70px] leading-none font-black italic tracking-tighter text-dias-teal font-orbitron" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.05)' }}>
                    DIAS<span className="text-dias-green">+</span>
                </h1>
            </div>
            <p className="text-center text-gray-400 font-bold tracking-[0.2em] text-xs mt-2 uppercase">Soluções Financeiras</p>
        </div>

        {isKeyInvalid && (
           <div className="mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-sm text-yellow-800">
             <div className="font-bold flex items-center gap-2 mb-2 text-yellow-900"><HelpCircle size={18}/> Chave de API Não Encontrada</div>
             <p className="mb-3">Você precisa copiar a chave <code>anon / public</code> do painel do Supabase.</p>
             <a href={settingsLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-900 font-bold py-2 px-4 rounded-lg transition-colors border border-yellow-300">
               <Database size={16} />Abrir Painel Supabase<ExternalLink size={14} />
             </a>
           </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-center justify-center animate-pulse">{error}</div>}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Usuário</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-dias-teal transition-colors"><User size={20} /></div>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-0 focus:border-dias-teal outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 font-medium disabled:opacity-50" placeholder="Identificação" disabled={isKeyInvalid} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-dias-teal transition-colors"><Lock size={20} /></div>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-0 focus:border-dias-teal outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 font-medium disabled:opacity-50" placeholder="••••••••" disabled={isKeyInvalid} />
            </div>
          </div>
          <button type="submit" disabled={isLoading || isKeyInvalid} className={`w-full bg-gradient-to-r from-dias-teal to-[#00606e] hover:from-[#00606e] hover:to-dias-teal text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-900/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-4 ${isLoading || isKeyInvalid ? 'opacity-50 cursor-not-allowed transform-none' : ''}`}>
            {isLoading ? 'CONECTANDO...' : 'ACESSAR SISTEMA'}{!isLoading && <ArrowRight size={20} />}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">&copy; {new Date().getFullYear()} Grupo Dias | Logistics</p>
          <p className="text-[9px] text-dias-teal/60 font-bold mt-1">BUILD v4.2.7 - CNAB NSR FIXED</p>
        </div>
      </div>
      <div className="absolute top-0 left-0 w-full h-1/2 bg-dias-teal/5 skew-y-3 transform -translate-y-20 z-0"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-dias-green/5 rounded-full blur-3xl z-0"></div>
    </div>
  );
};