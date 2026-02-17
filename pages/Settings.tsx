import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ICONS } from '../constants';
import { Company } from '../types';

export const Settings: React.FC = () => {
  const { companies, updateCompany, addCompany, selectCompany, selectedCompanyId } = useFinance();
  
  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Company>>({});
  const [isNew, setIsNew] = useState(false);

  const startEdit = (company: Company) => {
    setEditingId(company.id);
    setFormData(company);
    setIsNew(false);
  };

  const startNew = () => {
    setIsNew(true);
    setEditingId('new');
    setFormData({
      nomeEmpresa: '',
      cnpj: '',
      bancoAgencia: '',
      bancoConta: '',
      bancoContaDV: ''
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsNew(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomeEmpresa || !formData.cnpj) return;

    if (isNew) {
      const newCompany: Company = {
        ...formData as Company,
        id: Date.now().toString()
      };
      addCompany(newCompany);
      selectCompany(newCompany.id); // Switch to new company
    } else {
      updateCompany(formData as Company);
    }
    setEditingId(null);
    setIsNew(false);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Empresas</h1>
           <p className="text-gray-500">Configure os dados das empresas para emissão de CNAB.</p>
        </div>
        <button 
          onClick={startNew} 
          disabled={!!editingId}
          className="bg-itau-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-900 disabled:opacity-50"
        >
          {ICONS.Add} Nova Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {companies.map(company => {
          const isEditing = editingId === company.id;
          const isSelected = selectedCompanyId === company.id;

          if (isEditing) {
            return (
              <form key={company.id} onSubmit={handleSave} className="bg-white rounded-xl shadow-lg border-2 border-itau-blue p-6 space-y-4 animate-in fade-in zoom-in-95">
                 <h3 className="text-lg font-bold text-itau-blue mb-4">Editando: {company.nomeEmpresa}</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Razão Social</label>
                        <input required name="nomeEmpresa" value={formData.nomeEmpresa} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-itau-blue outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">CNPJ</label>
                        <input required name="cnpj" value={formData.cnpj} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-itau-blue outline-none" />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-4 gap-4">
                        <div>
                             <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Agência</label>
                             <input required name="bancoAgencia" value={formData.bancoAgencia} onChange={handleChange} maxLength={5} className="w-full p-2 border rounded focus:ring-2 focus:ring-itau-blue outline-none" />
                        </div>
                         <div className="col-span-2">
                             <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Conta</label>
                             <input required name="bancoConta" value={formData.bancoConta} onChange={handleChange} maxLength={12} className="w-full p-2 border rounded focus:ring-2 focus:ring-itau-blue outline-none" />
                        </div>
                         <div>
                             <label className="block text-xs font-medium text-gray-500 uppercase mb-1">DV</label>
                             <input required name="bancoContaDV" value={formData.bancoContaDV} onChange={handleChange} maxLength={1} className="w-full p-2 border rounded focus:ring-2 focus:ring-itau-blue outline-none" />
                        </div>
                    </div>
                 </div>
                 <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={handleCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-itau-blue text-white rounded hover:bg-blue-900">Salvar</button>
                 </div>
              </form>
            );
          }

          return (
            <div key={company.id} className={`bg-white rounded-xl p-6 border transition-all ${isSelected ? 'border-itau-blue ring-1 ring-itau-blue shadow-md' : 'border-gray-200 shadow-sm hover:border-gray-300'}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${isSelected ? 'bg-itau-blue' : 'bg-gray-400'}`}>
                      {company.nomeEmpresa.substring(0, 1)}
                   </div>
                   <div>
                      <h3 className="font-bold text-gray-900">{company.nomeEmpresa}</h3>
                      <p className="text-sm text-gray-500">{company.cnpj}</p>
                   </div>
                   {isSelected && <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">Ativa</span>}
                </div>
                <div className="flex gap-2">
                  {!isSelected && (
                      <button onClick={() => selectCompany(company.id)} className="text-sm text-gray-600 hover:text-itau-blue px-3 py-1 border rounded hover:bg-gray-50">
                        Selecionar
                      </button>
                  )}
                  <button onClick={() => startEdit(company)} className="text-gray-400 hover:text-gray-600 p-1">
                    {ICONS.Settings}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded-lg">
                  <div>
                      <span className="text-gray-400 block text-xs uppercase">Banco Itaú (341)</span>
                      <span className="font-mono text-gray-700">Ag: {company.bancoAgencia}</span>
                  </div>
                  <div>
                      <span className="text-gray-400 block text-xs uppercase">Conta Corrente</span>
                      <span className="font-mono text-gray-700">CC: {company.bancoConta}-{company.bancoContaDV}</span>
                  </div>
              </div>
            </div>
          );
        })}

        {isNew && (
             <form onSubmit={handleSave} className="bg-white rounded-xl shadow-lg border-2 border-emerald-500 p-6 space-y-4 animate-in fade-in zoom-in-95">
                 <h3 className="text-lg font-bold text-emerald-600 mb-4">Nova Empresa</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Razão Social</label>
                        <input required name="nomeEmpresa" value={formData.nomeEmpresa} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">CNPJ</label>
                        <input required name="cnpj" value={formData.cnpj} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-4 gap-4">
                        <div>
                             <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Agência</label>
                             <input required name="bancoAgencia" value={formData.bancoAgencia} onChange={handleChange} maxLength={5} className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                         <div className="col-span-2">
                             <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Conta</label>
                             <input required name="bancoConta" value={formData.bancoConta} onChange={handleChange} maxLength={12} className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                         <div>
                             <label className="block text-xs font-medium text-gray-500 uppercase mb-1">DV</label>
                             <input required name="bancoContaDV" value={formData.bancoContaDV} onChange={handleChange} maxLength={1} className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                    </div>
                 </div>
                 <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={handleCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Criar Empresa</button>
                 </div>
              </form>
        )}
      </div>
    </div>
  );
};