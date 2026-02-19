export type PaymentType = '01' | '02' | '03' | '04' | '06'; // 01=TED/DOC, 02=Boleto, 03=Debito, 04=Tributo, 06=PIX

export interface Company {
  id: string;
  nomeEmpresa: string;
  cnpj: string;
  bancoAgencia: string;
  bancoConta: string;
  bancoContaDV: string;
  convenio?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  estado?: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string; // Optional for display, required for storage
  role: 'admin' | 'user';
}

export interface Payable {
  id: string;
  companyId: string; // Link to the payer company
  tipo: PaymentType;
  nomeFavorecido: string; // FORNECEDOR
  cpfCnpjFavorecido: string;
  
  // Dados do Título
  filial?: string;
  numeroNF?: string; // NF
  setor?: string;
  detalhe?: string;
  
  // Classificação
  legenda?: string;
  subLegenda?: string;
  descricao: string; // Descrição
  
  // Financeiro
  valor: number;
  saldo?: number;
  credito?: string; // Campo descritivo ou contábil
  dataVencimento: string; // YYYY-MM-DD
  dataPagamento: string; // YYYY-MM-DD
  status: 'PENDING' | 'PAID' | 'PROCESSED';
  
  // Dados Bancários (Para TED/DOC/PIX)
  bancoDestino?: string;
  agenciaDestino?: string;
  contaDestino?: string;
  contaDestinoDV?: string;
  chavePix?: string; // CHAVE PIX
  
  // Dados Boleto
  codigoBarras?: string;
}

export interface DashboardStats {
  totalPending: number;
  totalPaid: number;
  countPending: number;
  countProcessed: number;
}