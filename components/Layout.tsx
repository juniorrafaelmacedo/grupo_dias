import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { LogOut, Settings as SettingsIcon, KeyRound, Menu, X, Info } from 'lucide-react';

export const Layout: React.FC = () => {
  const { companies, selectedCompanyId, selectCompany } = useFinance();
  const { logout, user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isConsolidated = selectedCompanyId === 'all';
  const currentCompanyName = isConsolidated 
    ? 'Visão Consolidada' 
    : companies.find(c => c.id === selectedCompanyId)?.nomeEmpresa;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert("A nova senha e a confirmação não coincidem.");
      return;
    }
    if (!user) return;
    updateUser(user.id, { password: passwordForm.new });
    alert("Senha alterada com sucesso!");
    setIsProfileModalOpen(false);
    setPasswordForm({ current: '', new: '', confirm: '' });
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm" onClick={closeMobileMenu} />}

      <aside className={`fixed md:relative z-30 h-full w-64 bg-slate-900 text-white flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 bg-slate-900">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-end gap-1 select-none">
              <span className="text-3xl font-black text-dias-teal tracking-tighter" style={{ textShadow: '0 0 10px rgba(0,121,138,0.3)' }}>DIAS</span>
              <span className="text-4xl font-black text-dias-green leading-none -ml-1 transform -translate-y-1 drop-shadow-lg">+</span>
            </div>
            <button onClick={closeMobileMenu} className="md:hidden text-slate-400 hover:text-white p-1"><X size={24} /></button>
          </div>
          <div className="relative">
             <label className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 block">Empresa</label>
             <select value={selectedCompanyId} onChange={(e) => { selectCompany(e.target.value); closeMobileMenu(); }} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-2.5 focus:ring-1 focus:ring-dias-teal outline-none transition-all">
               <option value="all">🏢 TODAS (Consolidado)</option>
               <option disabled>────────────────</option>
               {companies.map(c => <option key={c.id} value={c.id}>{c.nomeEmpresa}</option>)}
             </select>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink to="/" onClick={closeMobileMenu} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-dias-teal text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{ICONS.Dashboard}<span className="font-medium">Dashboard</span></NavLink>
          <NavLink to="/payables" onClick={closeMobileMenu} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-dias-teal text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{ICONS.Payables}<span className="font-medium">Contas a Pagar</span></NavLink>
          <NavLink to="/settings" onClick={closeMobileMenu} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-dias-teal text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{ICONS.Settings}<span className="font-medium">Empresas</span></NavLink>
          {user?.role === 'admin' && <NavLink to="/users" onClick={closeMobileMenu} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-dias-teal text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{ICONS.Users}<span className="font-medium">Usuários</span></NavLink>}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-900">
          <div className="bg-slate-800 rounded-lg p-3 flex items-center justify-between group">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-dias-green animate-pulse"></div>
               <span className="text-sm font-medium text-slate-300">Online</span>
             </div>
             <div className="text-right flex items-center gap-2">
               <div className="max-w-[100px] overflow-hidden">
                 <span className="text-xs text-white block font-semibold truncate">{user?.username}</span>
                 <span className="text-[10px] text-slate-400 uppercase">{user?.role === 'admin' ? 'Admin' : 'Operador'}</span>
               </div>
               <button onClick={() => { setIsProfileModalOpen(true); closeMobileMenu(); }} className="text-slate-500 hover:text-dias-teal transition-colors" title="Alterar Minha Senha"><SettingsIcon size={16} /></button>
             </div>
          </div>

          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 py-2 rounded-lg transition-colors text-sm font-medium"><LogOut size={16} />Sair do Sistema</button>
          
          <div className="text-center pt-2 pb-1 border-t border-slate-800/50 mt-2">
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              <Info size={10} /> Sistema DIAS+ v4.1.8
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[#f0f0f0] w-full">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-gray-600 hover:text-dias-teal p-1 rounded hover:bg-gray-100"><Menu size={24} /></button>
             <div className="flex items-center gap-2">
                <h2 className="hidden sm:block text-gray-500 text-sm font-medium uppercase tracking-wider">Área de Trabalho</h2>
                <span className="hidden sm:block text-gray-300">/</span>
                <span className="text-gray-900 font-medium text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{currentCompanyName}</span>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className={`w-8 h-8 rounded-full ${isConsolidated ? 'bg-slate-700' : 'bg-dias-teal'} text-white flex items-center justify-center font-bold text-sm shadow-md`}>{isConsolidated ? 'C' : currentCompanyName?.substring(0, 1)}</div>
          </div>
        </header>
        <div className="p-4 md:p-8"><Outlet /></div>
      </main>

      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><KeyRound size={20} className="text-dias-teal"/> Alterar Minha Senha</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nova Senha</label>
                <input required type="password" value={passwordForm.new} onChange={(e) => setPasswordForm(prev => ({...prev, new: e.target.value}))} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dias-teal outline-none" placeholder="Nova senha" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar Nova Senha</label>
                <input required type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm(prev => ({...prev, confirm: e.target.value}))} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dias-teal outline-none" placeholder="Repita a nova senha" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-dias-teal text-white rounded-lg text-sm font-medium hover:bg-[#00606e]">Atualizar Senha</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};