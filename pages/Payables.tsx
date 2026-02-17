import React, { useState, useRef, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Payable, PaymentType } from '../types';
import { ICONS, PAYMENT_TYPES } from '../constants';
import { formatCurrency, formatDate, generateUUID } from '../utils/formatters';
import { generateCNAB240 } from '../services/cnabService';
import { downloadTemplate, parseImportFile } from '../services/excelService';
import { Edit2, Filter, Calendar } from 'lucide-react';

export const Payables: React.FC = () => {
  const { payments, addPayment, updatePayment, removePayment, markAsProcessed, currentCompany, selectedCompanyId, companies } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isConsolidated = selectedCompanyId === 'all';

  // --- Filter Logic ---
  const filteredPayments = useMemo(() => {
    let list = isConsolidated 
      ? payments 
      : payments.filter(p => p.companyId === selectedCompanyId);

    // Text Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(p => 
        p.nomeFavorecido.toLowerCase().includes(lowerSearch) ||
        p.numeroNF?.includes(searchTerm)
      );
    }

    // Date Filter (Vencimento)
    if (dateStart) {
      list = list.filter(p => p.dataVencimento >= dateStart);
    }
    if (dateEnd) {
      list = list.filter(p => p.dataVencimento <= dateEnd);
    }

    return list;
  }, [payments, selectedCompanyId, isConsolidated, searchTerm, dateStart, dateEnd]);

  // --- Helpers ---
  const getPaymentLabel = (code: string) => {
    const type = PAYMENT_TYPES.find(t => t.value === code);
    return type ? type.label.split(' - ')[1] : code;
  };

  const getCompanyName = (id: string) => {
    return companies.find(c => c.id === id)?.nomeEmpresa || 'N/A';
  };

  // --- Selection Logic ---
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPayments.length && filteredPayments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPayments.map(p => p.id)));
    }
  };

  const isAllSelected = filteredPayments.length > 0 && selectedIds.size === filteredPayments.length;

  // --- Form Logic ---
  const initialFormState: Partial<Payable> = {
    tipo: '01',
    status: 'PENDING',
    dataPagamento: new Date().toISOString().split('T')[0],
    dataVencimento: new Date().toISOString().split('T')[0],
    saldo: 0,
    valor: 0
  };

  const [formData, setFormData] = useState<Partial<Payable>>(initialFormState);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (payment: Payable) => {
    setEditingId(payment.id);
    setFormData({ ...payment });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'codigoBarras') {
      const cleaned = value.replace(/\D/g, ''); 
      setFormData(prev => ({ ...prev, [name]: cleaned }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomeFavorecido || !formData.valor) return;

    if (editingId) {
      // Update existing
      updatePayment(editingId, formData);
    } else {
      // Create new
      const newPayment: Payable = {
        ...initialFormState,
        ...formData as Payable,
        id: generateUUID(),
        companyId: selectedCompanyId,
        valor: Number(formData.valor),
        saldo: Number(formData.saldo || 0),
        status: 'PENDING'
      };
      addPayment(newPayment);
    }

    setIsModalOpen(false);
    setFormData(initialFormState);
    setEditingId(null);
  };

  const handleGenerateCNAB = () => {
    if(isConsolidated) {
      alert('Para gerar o CNAB, selecione uma empresa específica no menu lateral.');
      return;
    }

    if(!currentCompany) {
      alert('Empresa não selecionada.');
      return;
    }

    // Get strictly the selected payments
    const paymentsToProcess = filteredPayments.filter(p => selectedIds.has(p.id));

    if (paymentsToProcess.length === 0) {
      alert('Selecione pelo menos um título na tabela para gerar o CNAB.');
      return;
    }

    // Optional: Warn if mixing already processed items
    const alreadyProcessed = paymentsToProcess.filter(p => p.status === 'PROCESSED');
    if (alreadyProcessed.length > 0) {
      const confirm = window.confirm(`Você selecionou ${alreadyProcessed.length} títulos que JÁ FORAM PROCESSADOS anteriormente. Deseja incluí-los novamente no arquivo?`);
      if (!confirm) return;
    }

    try {
      const cnabContent = generateCNAB240(currentCompany, paymentsToProcess, 1);
      
      const blob = new Blob([cnabContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CNAB240_${currentCompany.nomeEmpresa}_${new Date().getTime()}.rem`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Mark selected as processed
      markAsProcessed(paymentsToProcess.map(p => p.id));
      setSelectedIds(new Set()); // Clear selection
      alert(`Arquivo gerado com sucesso! Status de ${paymentsToProcess.length} títulos atualizado para PROCESSADO.`);

    } catch (error) {
      console.error(error);
      alert('Erro ao gerar arquivo CNAB.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const { valid, errors } = await parseImportFile(file, isConsolidated ? '' : selectedCompanyId, companies);
        const validWithCompany = valid.filter(p => p.companyId); 

        if (validWithCompany.length > 0) {
          validWithCompany.forEach(p => addPayment(p));
        }

        let message = '';
        if (validWithCompany.length > 0) {
          message += `✅ Sucesso: ${validWithCompany.length} pagamentos importados.\n`;
        } else {
          message += `⚠️ Nenhum pagamento foi importado.\n`;
        }

        if (errors.length > 0) {
          message += `\n❌ ${errors.length} Erros Encontrados:\n`;
          message += errors.slice(0, 10).join('\n');
          alert(message);
        } else if (validWithCompany.length > 0) {
          alert(message);
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error(error);
        alert('Erro crítico ao ler o arquivo.');
      }
    }
  };

  // Common Input Style
  const inputClass = "w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-itau-blue/20 focus:border-itau-blue outline-none bg-white text-gray-900 placeholder-gray-400 transition-all";
  const labelClass = "block text-xs font-semibold text-gray-700 mb-1.5";

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
           <p className="text-gray-500">
             Empresa: <span className="font-semibold text-itau-blue">{isConsolidated ? 'TODAS (Consolidado)' : currentCompany?.nomeEmpresa}</span>
           </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
          >
            {ICONS.Excel} Baixar Modelo
          </button>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" hidden />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
          >
            {ICONS.Upload} Importar
          </button>

          <div className="w-px h-8 bg-gray-300 mx-1 hidden md:block"></div>

          <button 
            onClick={handleOpenNew}
            disabled={isConsolidated}
            title={isConsolidated ? "Selecione uma empresa específica para adicionar manualmente" : ""}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium ${isConsolidated ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-itau-blue text-white hover:bg-blue-900'}`}
          >
            {ICONS.Add} Novo Manual
          </button>
          
          <button 
            onClick={handleGenerateCNAB}
            disabled={isConsolidated || selectedIds.size === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium ${
              isConsolidated || selectedIds.size === 0 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
            }`}
          >
            {ICONS.Download} Gerar CNAB ({selectedIds.size})
          </button>
        </div>
      </div>

      {isConsolidated && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
           <div className="font-bold">Modo de Visualização:</div>
           Selecione uma empresa no menu lateral para editar títulos ou gerar arquivos CNAB.
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {ICONS.Search}
          </div>
          <input
            type="text"
            placeholder="Buscar por Fornecedor ou Nota Fiscal (NF)..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-itau-blue focus:border-transparent outline-none transition-all bg-white text-gray-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto text-sm text-gray-600">
          <Filter size={18} className="text-gray-400" />
          <span className="font-medium whitespace-nowrap">Vencimento:</span>
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
            <input 
              type="date" 
              value={dateStart} 
              onChange={e => setDateStart(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-gray-700 text-xs w-28 outline-none"
            />
            <span className="text-gray-400">-</span>
            <input 
              type="date" 
              value={dateEnd} 
              onChange={e => setDateEnd(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-gray-700 text-xs w-28 outline-none"
            />
          </div>
          {(dateStart || dateEnd) && (
            <button 
              onClick={() => { setDateStart(''); setDateEnd(''); }}
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Extended List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected} 
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-itau-blue focus:ring-itau-blue bg-white"
                  />
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Empresa / Filial</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">NF / Venc.</th>
                <th className="px-4 py-3">Tipo / Banco</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPayments.length > 0 ? (
                filteredPayments.map(payment => {
                  const isSelected = selectedIds.has(payment.id);
                  const isProcessed = payment.status === 'PROCESSED';
                  
                  return (
                    <tr key={payment.id} className={`transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelect(payment.id)}
                          className="rounded border-gray-300 text-itau-blue focus:ring-itau-blue bg-white"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${
                          isProcessed 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {isProcessed ? 'PROCESSADO' : 'PENDENTE'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-itau-blue">{getCompanyName(payment.companyId)}</div>
                        <div className="text-gray-500 font-medium">{payment.filial || 'Matriz'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{payment.nomeFavorecido}</div>
                        <div className="text-xs text-gray-500">{payment.cpfCnpjFavorecido}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-itau-blue font-mono">NF: {payment.numeroNF || 'S/N'}</div>
                        <div className={`font-medium ${new Date(payment.dataVencimento) < new Date() && !isProcessed ? 'text-red-600' : 'text-gray-500'}`}>
                          {formatDate(payment.dataVencimento)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${payment.tipo === '02' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                          {getPaymentLabel(payment.tipo)}
                        </span>
                        <div className="text-[10px] mt-1 text-gray-500">
                          {payment.tipo === '06' ? 'PIX' : (payment.bancoDestino ? `Bco: ${payment.bancoDestino}` : 'S/ Bco')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(payment.valor)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleOpenEdit(payment)}
                            className="text-gray-400 hover:text-itau-blue transition-colors p-1"
                            title="Editar Título"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => removePayment(payment.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Remover"
                          >
                            {ICONS.Delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                       <Filter size={32} className="opacity-20" />
                       <p>Nenhum título encontrado com os filtros atuais.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
           <div>
             Total exibido: {filteredPayments.length} | Selecionados: {selectedIds.size}
           </div>
           {selectedIds.size > 0 && (
             <div className="text-itau-blue font-bold">
               Valor Selecionado: {formatCurrency(filteredPayments.filter(p => selectedIds.has(p.id)).reduce((acc, curr) => acc + curr.valor, 0))}
             </div>
           )}
        </div>
      </div>

      {/* Expanded Modal (New & Edit) */}
      {isModalOpen && !isConsolidated && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Editar Título / Pagamento' : 'Novo Título / Pagamento'}
                </h3>
                <p className="text-sm text-gray-500">Empresa: {currentCompany?.nomeEmpresa}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              
              {/* Seção 1: Dados do Título */}
              <div>
                <h4 className="text-sm font-bold text-itau-blue uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">1. Dados do Título</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Filial</label>
                    <input name="filial" value={formData.filial || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Setor</label>
                    <input name="setor" value={formData.setor || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nota Fiscal (NF)</label>
                    <input name="numeroNF" value={formData.numeroNF || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Vencimento</label>
                    <input type="date" required name="dataVencimento" value={formData.dataVencimento || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Seção 2: Favorecido e Classificação */}
              <div>
                <h4 className="text-sm font-bold text-itau-blue uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">2. Favorecido & Classificação</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Fornecedor (Nome)</label>
                    <input required name="nomeFavorecido" value={formData.nomeFavorecido || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>CPF / CNPJ</label>
                    <input required name="cpfCnpjFavorecido" value={formData.cpfCnpjFavorecido || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  
                  <div>
                    <label className={labelClass}>Legenda</label>
                    <input name="legenda" value={formData.legenda || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Sub-Legenda</label>
                    <input name="subLegenda" value={formData.subLegenda || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Detalhe</label>
                    <input name="detalhe" value={formData.detalhe || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Crédito (Memo)</label>
                    <input name="credito" value={formData.credito || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div className="md:col-span-4">
                    <label className={labelClass}>Descrição</label>
                    <input name="descricao" value={formData.descricao || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Seção 3: Financeiro */}
              <div>
                <h4 className="text-sm font-bold text-itau-blue uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">3. Financeiro</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Valor (R$)</label>
                    <input type="number" step="0.01" required name="valor" value={formData.valor || ''} onChange={handleInputChange} className={`${inputClass} font-bold`} />
                  </div>
                  <div>
                    <label className={labelClass}>Saldo (R$)</label>
                    <input type="number" step="0.01" name="saldo" value={formData.saldo || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Data Pagamento (Previsão)</label>
                    <input type="date" required name="dataPagamento" value={formData.dataPagamento || ''} onChange={handleInputChange} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Seção 4: Dados Bancários */}
              <div>
                <h4 className="text-sm font-bold text-itau-blue uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">4. Dados Bancários / Pagamento</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="md:col-span-4">
                    <label className={labelClass}>Tipo de Pagamento</label>
                    <select name="tipo" value={formData.tipo} onChange={handleInputChange} className={inputClass}>
                      {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {formData.tipo === '06' && (
                    <div className="md:col-span-4">
                      <label className={labelClass}>Chave PIX</label>
                      <input name="chavePix" value={formData.chavePix || ''} onChange={handleInputChange} placeholder="Email, CPF, Telefone ou Aleatória" className={inputClass} />
                    </div>
                  )}

                  {(formData.tipo === '02' || formData.tipo === '04') && (
                    <div className="md:col-span-4">
                      <label className={labelClass}>Boleto Bancário (Código de Barras)</label>
                      <input name="codigoBarras" value={formData.codigoBarras || ''} onChange={handleInputChange} className={`${inputClass} font-mono`} />
                    </div>
                  )}

                  {(formData.tipo !== '02' && formData.tipo !== '04') && (
                    <>
                      <div>
                        <label className={labelClass}>Banco</label>
                        <input name="bancoDestino" placeholder="341" value={formData.bancoDestino || ''} onChange={handleInputChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Agência</label>
                        <input name="agenciaDestino" value={formData.agenciaDestino || ''} onChange={handleInputChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Conta Corrente</label>
                        <input name="contaDestino" value={formData.contaDestino || ''} onChange={handleInputChange} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>DV</label>
                        <input name="contaDestinoDV" value={formData.contaDestinoDV || ''} onChange={handleInputChange} className={inputClass} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-itau-blue text-white rounded-lg font-medium hover:bg-blue-900 shadow-md">
                  {editingId ? 'Salvar Alterações' : 'Criar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};