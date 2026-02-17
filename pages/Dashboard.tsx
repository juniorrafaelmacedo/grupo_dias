import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie, Legend
} from 'recharts';
import { ICONS } from '../constants';
import { Eye, Layout, CheckSquare, Square, ChevronDown } from 'lucide-react';

type VisibleSection = 'stats' | 'timeline' | 'distribution' | 'vendors' | 'insights';

export const Dashboard: React.FC = () => {
  const { payments, selectedCompanyId, currentCompany, companies } = useFinance();
  
  // State for visibility customization
  const [visibleSections, setVisibleSections] = useState<Record<VisibleSection, boolean>>({
    stats: true,
    timeline: true,
    distribution: true,
    vendors: true,
    insights: true
  });
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_preferences');
    if (saved) {
      try {
        setVisibleSections(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse dashboard preferences");
      }
    }
  }, []);

  // Save preferences when changed
  const toggleSection = (section: VisibleSection) => {
    const newState = { ...visibleSections, [section]: !visibleSections[section] };
    setVisibleSections(newState);
    localStorage.setItem('dashboard_preferences', JSON.stringify(newState));
  };

  // Logic: "All" or Specific Company
  const isConsolidated = selectedCompanyId === 'all';
  const displayPayments = isConsolidated 
    ? payments 
    : payments.filter(p => p.companyId === selectedCompanyId);

  // 1. Stats Cards Data
  const totalPending = displayPayments.filter(p => p.status === 'PENDING').reduce((acc, curr) => acc + curr.valor, 0);
  const totalProcessed = displayPayments.filter(p => p.status === 'PROCESSED').reduce((acc, curr) => acc + curr.valor, 0);
  const totalGeral = totalPending + totalProcessed;

  // 2. Timeline Data
  const timelineMap = displayPayments
    .filter(p => p.status === 'PENDING')
    .reduce((acc, curr) => {
      const dateKey = curr.dataVencimento;
      if (!acc[dateKey]) acc[dateKey] = 0;
      acc[dateKey] += curr.valor;
      return acc;
    }, {} as Record<string, number>);

  const timelineData = Object.keys(timelineMap)
    .sort()
    .map(date => ({
      name: formatDate(date).substring(0, 5),
      fullDate: date,
      valor: timelineMap[date]
    }));

  // 3. Dynamic Chart: By Sector (Single Company) OR By Company (Consolidated)
  let distributionData = [];
  let distributionTitle = '';

  if (isConsolidated) {
    distributionTitle = 'Distribuição por Empresa';
    const companyMap = displayPayments.reduce((acc, curr) => {
      // Find company name
      const compName = companies.find(c => c.id === curr.companyId)?.nomeEmpresa || 'Desconhecida';
      if (!acc[compName]) acc[compName] = 0;
      acc[compName] += curr.valor;
      return acc;
    }, {} as Record<string, number>);

    distributionData = Object.keys(companyMap)
      .map(key => ({ name: key, value: companyMap[key] }))
      .sort((a, b) => b.value - a.value);
  } else {
    distributionTitle = 'Por Setor / Filial';
    const sectorMap = displayPayments.reduce((acc, curr) => {
      const key = curr.setor || curr.filial || 'Geral';
      if (!acc[key]) acc[key] = 0;
      acc[key] += curr.valor;
      return acc;
    }, {} as Record<string, number>);

    distributionData = Object.keys(sectorMap)
      .map(key => ({ name: key, value: sectorMap[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  // 4. Top Vendors
  const vendorMap = displayPayments.reduce((acc, curr) => {
    if (!acc[curr.nomeFavorecido]) acc[curr.nomeFavorecido] = 0;
    acc[curr.nomeFavorecido] += curr.valor;
    return acc;
  }, {} as Record<string, number>);

  const topVendorsData = Object.keys(vendorMap)
    .map(key => ({ name: key, value: vendorMap[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#003F7F', '#EC7000', '#10B981', '#6366f1', '#8b5cf6', '#f43f5e', '#64748b'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg z-50">
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <p className="text-sm text-itau-blue font-bold">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const FilterCheckbox = ({ section, label }: { section: VisibleSection, label: string }) => (
    <button 
      onClick={() => toggleSection(section)}
      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {visibleSections[section] ? <CheckSquare size={16} className="text-dias-teal"/> : <Square size={16} className="text-gray-400"/>}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isConsolidated ? 'Visão Consolidada (Holding)' : `Dashboard: ${currentCompany?.nomeEmpresa}`}
          </h1>
          <p className="text-gray-500">
            {isConsolidated 
              ? 'Análise global de fluxo de caixa de todas as empresas cadastradas.' 
              : 'Visão geral financeira e previsão de caixa.'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            {isConsolidated && (
              <div className="bg-slate-800 text-white px-3 py-1.5 rounded text-xs uppercase font-bold tracking-wider">
                Modo Global
              </div>
            )}
            
            {/* Display Customization Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                className="flex items-center gap-2 bg-white border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                <Layout size={16} />
                <span className="hidden sm:inline">Visualização</span>
                <ChevronDown size={14} className="text-gray-400"/>
              </button>
              
              {isFilterMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsFilterMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                      Exibir / Ocultar
                    </div>
                    <div className="py-1">
                      <FilterCheckbox section="stats" label="Resumo (Cards)" />
                      <FilterCheckbox section="timeline" label="Fluxo de Caixa" />
                      <FilterCheckbox section="distribution" label="Distribuição (Pizza)" />
                      <FilterCheckbox section="vendors" label="Top Fornecedores" />
                      <FilterCheckbox section="insights" label="Insights Operacionais" />
                    </div>
                  </div>
                </>
              )}
            </div>
        </div>
      </div>

      {/* Stats Cards */}
      {visibleSections.stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-itau-blue">
              <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-50 p-2 rounded-lg text-itau-blue">
                      {ICONS.Money}
                  </div>
                  <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">A Pagar (Pendente)</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalPending)}</h3>
              <p className="text-sm text-gray-500 mt-1">{displayPayments.filter(p => p.status === 'PENDING').length} títulos em aberto</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between mb-4">
                  <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                      {ICONS.Check}
                  </div>
                  <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Processado (CNAB)</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalProcessed)}</h3>
              <p className="text-sm text-gray-500 mt-1">Já exportados</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-gray-400">
              <div className="flex items-center justify-between mb-4">
                  <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                      {ICONS.Bank}
                  </div>
                  <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Volume Total</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalGeral)}</h3>
              <p className="text-sm text-gray-500 mt-1">Ciclo atual</p>
          </div>
        </div>
      )}

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Chart (Takes 2 columns) */}
        {visibleSections.timeline && (
          <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[350px] animate-in fade-in slide-in-from-bottom-6 duration-700 ${!visibleSections.distribution ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Fluxo de Caixa (Vencimentos)</h3>
            <p className="text-xs text-gray-500 mb-6">Previsão de pagamentos pendentes por dia {isConsolidated ? '(Global)' : ''}</p>
            <div className="h-[280px] w-full">
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EC7000" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#EC7000" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="valor" stroke="#EC7000" strokeWidth={3} fillOpacity={1} fill="url(#colorValor)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados de vencimento pendente.</div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Breakdown (Pie Chart) */}
        {visibleSections.distribution && (
          <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[350px] animate-in fade-in slide-in-from-bottom-6 duration-700 ${!visibleSections.timeline ? 'lg:col-span-3' : ''}`}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{distributionTitle}</h3>
            <p className="text-xs text-gray-500 mb-4">Distribuição de gastos {isConsolidated ? 'por CNPJ' : 'interna'}</p>
            <div className="h-[280px] w-full">
              {distributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Secondary Charts Row */}
      <div className={`grid grid-cols-1 gap-6 ${visibleSections.vendors && visibleSections.insights ? 'lg:grid-cols-2' : ''}`}>
         {/* Top Vendors */}
         {visibleSections.vendors && (
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Top 5 Fornecedores {isConsolidated ? '(Global)' : ''}</h3>
              <div className="h-[250px] w-full">
                {topVendorsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={topVendorsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12, fill: '#4B5563'}} />
                      <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                        {topVendorsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#003F7F" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados suficientes.</div>
                )}
              </div>
           </div>
         )}

         {/* Mini Insight: Efficiency */}
         {visibleSections.insights && (
           <div className="bg-gradient-to-br from-itau-blue to-blue-900 p-6 rounded-xl shadow-lg text-white flex flex-col justify-center animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h3 className="text-xl font-bold mb-2">Resumo da Operação</h3>
              <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center border-b border-blue-700 pb-3">
                  <span className="text-blue-200 text-sm">Média por Título</span>
                  <span className="font-bold text-lg">{formatCurrency(totalGeral / (displayPayments.length || 1))}</span>
                </div>
                <div className="flex justify-between items-center border-b border-blue-700 pb-3">
                  <span className="text-blue-200 text-sm">Maior Vencimento</span>
                  <span className="font-bold text-lg">
                    {displayPayments.length > 0 
                      ? formatDate(displayPayments.reduce((max, p) => p.valor > max.valor ? p : max, displayPayments[0]).dataVencimento)
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-200 text-sm">Maior concentração</span>
                  <span className="font-bold text-lg">{distributionData[0]?.name || '-'}</span>
                </div>
              </div>
           </div>
         )}
      </div>
      
      {/* Empty State if everything is hidden */}
      {!Object.values(visibleSections).some(Boolean) && (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400">
          <Eye size={48} className="mb-4 opacity-20" />
          <p>Todos os painéis estão ocultos. Utilize o botão "Visualização" para reativá-los.</p>
        </div>
      )}
    </div>
  );
};