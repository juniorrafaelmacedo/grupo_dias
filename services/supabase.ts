import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables
const getEnvVar = (key: string, defaultValue: string) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // ignore error
  }
  return defaultValue;
};

// --- CONFIGURAÇÃO SUPABASE ---
export const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', '');
export const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY', '');

// Verifica se as chaves são válidas ou apenas placeholders
const isPlaceholder = !supabaseUrl || !supabaseKey || supabaseKey.includes('COLE_SUA') || supabaseKey.length < 20;

const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseKey || 'placeholder-key';

// Inicializa o cliente Supabase
// Se for placeholder, desativamos a persistência para evitar erros de LockManager (Navigator LockManager timeout)
export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: !isPlaceholder,
    autoRefreshToken: !isPlaceholder,
    detectSessionInUrl: !isPlaceholder,
    // Em ambientes de desenvolvimento/placeholder, desativamos o LockManager para evitar deadlocks
    ...(isPlaceholder ? { storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }} : {})
  }
});

// Helper para converter snake_case (Banco) para camelCase (App)
export const mapCompanyFromDB = (data: any): any => ({
  id: data.id,
  nomeEmpresa: data.nome_empresa,
  cnpj: data.cnpj,
  bancoAgencia: data.banco_agencia,
  bancoConta: data.banco_conta,
  bancoContaDV: data.banco_conta_dv,
});

export const mapCompanyToDB = (data: any): any => ({
  id: data.id,
  nome_empresa: data.nomeEmpresa,
  cnpj: data.cnpj,
  banco_agencia: data.bancoAgencia,
  banco_conta: data.bancoConta,
  banco_conta_dv: data.bancoContaDV,
});

export const mapPayableFromDB = (data: any): any => ({
  id: data.id,
  companyId: data.company_id,
  tipo: data.tipo,
  nomeFavorecido: data.nome_favorecido,
  cpfCnpjFavorecido: data.cpf_cnpj_favorecido,
  numeroNF: data.numero_nf,
  filial: data.filial,
  setor: data.setor,
  detalhe: data.detalhe,
  legenda: data.legenda,
  subLegenda: data.sub_legenda,
  descricao: data.descricao,
  valor: Number(data.valor),
  saldo: Number(data.saldo),
  credito: data.credito,
  dataVencimento: data.data_vencimento,
  dataPagamento: data.data_pagamento,
  status: data.status,
  bancoDestino: data.banco_destino,
  agenciaDestino: data.agencia_destino,
  contaDestino: data.conta_destino,
  contaDestinoDV: data.conta_destino_dv,
  chavePix: data.chave_pix,
  codigoBarras: data.codigo_barras,
});

export const mapPayableToDB = (data: any): any => ({
  id: data.id,
  company_id: data.companyId,
  tipo: data.tipo,
  nome__favorecido: data.nomeFavorecido,
  cpf_cnpj_favorecido: data.cpfCnpjFavorecido,
  numero_nf: data.numeroNF,
  filial: data.filial,
  setor: data.setor,
  detalhe: data.detalhe,
  legenda: data.legenda,
  sub_legenda: data.subLegenda,
  descricao: data.descricao,
  valor: data.valor,
  saldo: data.saldo,
  credito: data.credito,
  data_vencimento: data.dataVencimento,
  data_pagamento: data.dataPagamento,
  status: data.status,
  banco_destino: data.bancoDestino,
  agencia_destino: data.agenciaDestino,
  conta_destino: data.contaDestino,
  conta_destino_dv: data.contaDestinoDV,
  chave_pix: data.chavePix,
  codigo_barras: data.codigoBarras,
});