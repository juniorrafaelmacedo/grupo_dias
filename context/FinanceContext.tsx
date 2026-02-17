import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Payable, Company } from '../types';
import { supabase, mapCompanyFromDB, mapCompanyToDB, mapPayableFromDB, mapPayableToDB } from '../services/supabase';
import { useAuth } from './AuthContext';

interface FinanceContextType {
  payments: Payable[];
  companies: Company[];
  selectedCompanyId: string;
  currentCompany: Company | undefined;
  addPayment: (payment: Payable) => Promise<void>;
  updatePayment: (id: string, updatedPayment: Partial<Payable>) => Promise<void>;
  markAsProcessed: (ids: string[]) => Promise<void>;
  removePayment: (id: string) => Promise<void>;
  addCompany: (company: Company) => Promise<void>;
  updateCompany: (company: Company) => Promise<void>;
  selectCompany: (id: string) => void;
  isLoadingData: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [payments, setPayments] = useState<Payable[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
        fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
        // Fetch Companies
        const { data: compData } = await supabase.from('companies').select('*');
        if (compData) {
            const mappedCompanies = compData.map(mapCompanyFromDB);
            setCompanies(mappedCompanies);
            // Default selection logic if needed
            if (mappedCompanies.length > 0 && selectedCompanyId !== 'all' && !mappedCompanies.find((c: any) => c.id === selectedCompanyId)) {
                setSelectedCompanyId('all');
            }
        }

        // Fetch Payables
        // Em um app muito grande, filtraríamos por empresa aqui.
        const { data: payData } = await supabase.from('payables').select('*');
        if (payData) {
            setPayments(payData.map(mapPayableFromDB));
        }
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
    } finally {
        setIsLoadingData(false);
    }
  };

  const currentCompany = useMemo(() => 
    companies.find(c => c.id === selectedCompanyId), 
  [companies, selectedCompanyId]);

  const addPayment = async (payment: Payable) => {
    // Omit ID to let DB generate UUID, or keep if generating locally
    const payload = mapPayableToDB(payment);
    delete payload.id; // Let Supabase gen ID for payments

    const { data, error } = await supabase.from('payables').insert(payload).select().single();
    if (data && !error) {
        setPayments(prev => [...prev, mapPayableFromDB(data)]);
    } else {
        console.error(error);
        alert('Erro ao salvar pagamento: ' + error?.message);
    }
  };

  const updatePayment = async (id: string, updatedPayment: Partial<Payable>) => {
    const payload = mapPayableToDB(updatedPayment);
    // Remove undefined fields
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const { error } = await supabase.from('payables').update(payload).eq('id', id);
    if (!error) {
        setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updatedPayment } : p));
    } else {
        alert('Erro ao atualizar: ' + error?.message);
    }
  };

  const markAsProcessed = async (ids: string[]) => {
    const { error } = await supabase
        .from('payables')
        .update({ status: 'PROCESSED' })
        .in('id', ids);

    if (!error) {
        setPayments(prev => prev.map(p => ids.includes(p.id) ? { ...p, status: 'PROCESSED' } : p));
    }
  };

  const removePayment = async (id: string) => {
    const { error } = await supabase.from('payables').delete().eq('id', id);
    if (!error) {
        setPayments(prev => prev.filter(p => p.id !== id));
    }
  };

  const addCompany = async (company: Company) => {
    const payload = mapCompanyToDB(company);
    // IMPORTANTE: Não deletar o ID, pois ele é gerado no front (Date.now()) ou manualmente
    
    const { data, error } = await supabase.from('companies').insert(payload).select().single();
    if (error) {
      console.error("Erro ao adicionar empresa:", error);
      throw new Error(error.message);
    }
    
    if (data) {
        setCompanies(prev => [...prev, mapCompanyFromDB(data)]);
    }
  };

  const updateCompany = async (updatedCompany: Company) => {
    const payload = mapCompanyToDB(updatedCompany);
    const { error } = await supabase.from('companies').update(payload).eq('id', updatedCompany.id);
    
    if (error) {
       console.error("Erro ao atualizar empresa:", error);
       throw new Error(error.message);
    }

    setCompanies(prev => prev.map(c => c.id === updatedCompany.id ? updatedCompany : c));
  };

  const selectCompany = (id: string) => {
    setSelectedCompanyId(id);
  };

  return (
    <FinanceContext.Provider value={{ 
      payments, 
      companies, 
      selectedCompanyId, 
      currentCompany,
      addPayment, 
      updatePayment,
      markAsProcessed,
      removePayment, 
      addCompany,
      updateCompany,
      selectCompany,
      isLoadingData
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};