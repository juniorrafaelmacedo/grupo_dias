import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ICONS } from '../constants';
import { User } from '../types';
import { Edit2 } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { usersList, addUser, removeUser, updateUser, user: currentUser } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user'
  });

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({ name: '', username: '', password: '', role: 'user' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      password: '', // Empty means "don't change"
      role: user.role
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check username duplication (skip if editing self)
    if (usersList.some(u => u.username === formData.username && u.id !== editingId)) {
      alert('Este nome de usuário já está em uso.');
      return;
    }

    if (editingId) {
      // Update Existing
      const updates: Partial<User> = {
        name: formData.name,
        username: formData.username,
        role: formData.role
      };
      // Only update password if typed
      if (formData.password.trim() !== '') {
        updates.password = formData.password;
      }

      updateUser(editingId, updates);
    } else {
      // Create New
      if (!formData.password) {
        alert('Senha é obrigatória para novos usuários.');
        return;
      }
      const newUser: User = {
        id: Date.now().toString(),
        name: formData.name,
        username: formData.username,
        password: formData.password,
        role: formData.role
      };
      addUser(newUser);
    }

    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', username: '', password: '', role: 'user' });
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="bg-red-100 p-4 rounded-full text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800">Acesso Negado</h2>
        <p>Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
           <p className="text-gray-500">Cadastre e gerencie o acesso ao sistema.</p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="bg-dias-teal text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#00606e] shadow-md transition-colors"
        >
          {ICONS.Add} Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">Usuário (Login)</th>
              <th className="px-6 py-4">Perfil</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usersList.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                <td className="px-6 py-4 text-gray-600">{u.username}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {u.role === 'admin' ? 'Administrador' : 'Operador'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="text-gray-400 hover:text-dias-teal p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar Usuário / Senha"
                    >
                      <Edit2 size={16} />
                    </button>
                    {u.id !== '1' && u.id !== currentUser.id && (
                      <button 
                        onClick={() => {
                          if(window.confirm(`Tem certeza que deseja remover ${u.name}?`)) {
                            removeUser(u.id);
                          }
                        }}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover Usuário"
                      >
                        {ICONS.Delete}
                      </button>
                    )}
                  </div>
                  {u.id === '1' && <span className="text-[10px] text-gray-400 italic block mt-1">Admin Principal</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Usuario (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-dias-teal">
                {editingId ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                <input 
                  required 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dias-teal/20 focus:border-dias-teal outline-none"
                  placeholder="Ex: João da Silva"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome de Usuário (Login)</label>
                <input 
                  required 
                  name="username" 
                  value={formData.username} 
                  onChange={handleInputChange} 
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dias-teal/20 focus:border-dias-teal outline-none"
                  placeholder="Ex: joao.silva"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {editingId ? 'Nova Senha (Deixe em branco para manter)' : 'Senha'}
                </label>
                <input 
                  required={!editingId}
                  type="password"
                  name="password" 
                  value={formData.password} 
                  onChange={handleInputChange} 
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dias-teal/20 focus:border-dias-teal outline-none"
                  placeholder={editingId ? "Manter senha atual" : "••••••••"}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Perfil de Acesso</label>
                <select 
                  name="role" 
                  value={formData.role} 
                  onChange={handleInputChange}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dias-teal/20 focus:border-dias-teal outline-none bg-white"
                >
                  <option value="user">Operador (Padrão)</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-dias-teal text-white rounded-lg font-medium hover:bg-[#00606e] shadow-md">
                  {editingId ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};