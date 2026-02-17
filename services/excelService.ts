import * as XLSX from 'xlsx';
import { Payable, PaymentType, Company } from '../types';

export const downloadTemplate = () => {
  // --- SHEET 1: MODELO DE IMPORTAÇÃO ---
  const wsData = [
    [
      'Empresa', // NEW COLUMN
      'Filial',
      'Setor',
      'Tipo Pagto (Cod)', 
      'Fornecedor', 
      'CPF/CNPJ', 
      'NF',
      'Vencimento',
      'Data Pagamento',
      'Valor', 
      'Saldo',
      'Crédito',
      'Descrição',
      'Legenda',
      'Sub-Legenda',
      'Detalhe',
      'Código de Barras', 
      'Banco Destino', 
      'Agência', 
      'Conta', 
      'DV',
      'Chave PIX'
    ],
    [
      'Minha Empresa LTDA', 'Matriz', 'TI', '01', 'João Silva', '12345678900', '1001', '25/12/2023', '25/12/2023', 1500.50, 1500.50, 'Adiantamento', 'Serviço prestado', 'Despesa', 'Operacional', 'Projeto X', '', '341', '1234', '56789', '0', ''
    ],
    [
      'Minha Empresa LTDA', 'Filial 1', 'Adm', '06', 'Empresa X', '12345678000199', '2005', '26/12/2023', '26/12/2023', 500.00, 0, '', 'Pix Serviço', 'Custo', 'Fixo', '', '', '', '', '', '', 'email@chave.com'
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths based on content
  ws['!cols'] = [
    { wch: 25 }, // Empresa
    { wch: 15 }, // Filial
    { wch: 15 }, // Setor
    { wch: 15 }, // Tipo (Wider header)
    { wch: 30 }, // Fornecedor
    { wch: 18 }, // CPF/CNPJ
    { wch: 10 }, // NF
    { wch: 12 }, // Vencimento
    { wch: 12 }, // Data Pagto
    { wch: 12 }, // Valor
    { wch: 12 }, // Saldo
    { wch: 15 }, // Credito
    { wch: 25 }, // Descricao
    { wch: 15 }, // Legenda
    { wch: 15 }, // Sub-Legenda
    { wch: 15 }, // Detalhe
    { wch: 45 }, // Cod Barras
    { wch: 8 },  // Banco
    { wch: 8 },  // AG
    { wch: 10 }, // CC
    { wch: 5 },  // DV
    { wch: 25 }, // PIX
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo Importação");

  // --- SHEET 2: LEGENDA DE CÓDIGOS ---
  const legendData = [
    ['Código', 'Descrição do Tipo de Pagamento'],
    ['01', 'Crédito em Conta Corrente / TED / DOC'],
    ['02', 'Boleto Bancário (Requer Código de Barras)'],
    ['03', 'Débito em Conta (Mesmo titular ou pré-aprovado)'],
    ['04', 'Tributos com Código de Barras (DARF/GPS/Contas consumo)'],
    ['06', 'PIX Transferência (Requer Chave PIX ou Dados Bancários)']
  ];
  
  const wsLegend = XLSX.utils.aoa_to_sheet(legendData);
  wsLegend['!cols'] = [{ wch: 10 }, { wch: 60 }];
  
  XLSX.utils.book_append_sheet(wb, wsLegend, "Legenda Códigos");

  XLSX.writeFile(wb, "Modelo_Completo_FinanceFlow.xlsx");
};

export const parseImportFile = async (
  file: File, 
  currentCompanyId: string, 
  availableCompanies: Company[]
): Promise<{ valid: Payable[], errors: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const valid: Payable[] = [];
        const errors: string[] = [];

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +2 because Excel header is row 1 and index starts at 0

          const cleanString = (val: any) => val ? String(val).trim() : '';
          const cleanNumber = (val: any) => val ? parseFloat(String(val).replace(',', '.')) : 0;
          
          const nome = cleanString(row['Fornecedor'] || row['Nome Favorecido']);
          const valor = cleanNumber(row['Valor']);

          if (!nome || !valor) {
             return; 
          }

          // --- Company Matching Logic ---
          let targetCompanyId = currentCompanyId;
          const empresaNome = cleanString(row['Empresa']);
          
          if (empresaNome) {
            const foundCompany = availableCompanies.find(c => 
              c.nomeEmpresa.toLowerCase() === empresaNome.toLowerCase() || 
              c.id === empresaNome
            );
            if (foundCompany) {
              targetCompanyId = foundCompany.id;
            } else {
              // Option: Fail row or Warning? Let's add a warning but default to current
              // forcing user to verify, OR just error out. 
              // Better UX: Default to current but maybe could log a warning.
              // For now, strict match or fallback to current context.
            }
          }

          const tipo = (cleanString(row['Tipo Pagto (Cod)'] || row['Tipo (Cod)']).padStart(2, '0') as PaymentType) || '01';
          
          // Intelligent Cleaning
          const rawBarcode = cleanString(row['Código de Barras'] || row['Boleto Bancario']);
          const cleanBarcode = rawBarcode.replace(/\D/g, ''); 
          
          // Validation Logic
          if ((tipo === '02' || tipo === '04')) {
             if (!cleanBarcode) {
               errors.push(`Linha ${rowNum}: Tipo '${tipo}' (Boleto/Tributo) exige Código de Barras. Valor encontrado: Vazio.`);
               return;
             }
             if (cleanBarcode.length < 30) {
                errors.push(`Linha ${rowNum}: Código de Barras parece incompleto (${cleanBarcode.length} dígitos).`);
                return;
             }
          }

          if (tipo === '01') {
             const bco = cleanString(row['Banco Destino'] || row['Banco']);
             const ag = cleanString(row['Agência'] || row['Agencia']);
             const cc = cleanString(row['Conta'] || row['Corrente']);
             
             if (!bco || !ag || !cc) {
               errors.push(`Linha ${rowNum}: Tipo '01' (Transferência) exige Banco, Agência e Conta.`);
               return;
             }
          }

          const parseDate = (val: any): string => {
             if (!val) return new Date().toISOString().split('T')[0];
             if (typeof val === 'number') {
                const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                return date.toISOString().split('T')[0];
             } else if (typeof val === 'string' && val.includes('/')) {
                const parts = val.split('/');
                if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
             }
             return String(val); 
          };

          const payment: Payable = {
            id: Date.now().toString() + Math.random().toString().substring(2, 6),
            companyId: targetCompanyId, // Using the matched ID
            status: 'PENDING',
            
            tipo: tipo,
            nomeFavorecido: nome,
            cpfCnpjFavorecido: cleanString(row['CPF/CNPJ']).replace(/\D/g, ''),
            numeroNF: cleanString(row['NF']),
            filial: cleanString(row['Filial']),
            setor: cleanString(row['Setor']),
            
            valor: valor,
            saldo: cleanNumber(row['Saldo']),
            credito: cleanString(row['Crédito']),
            
            dataVencimento: parseDate(row['Vencimento'] || row['Data Pagamento']),
            dataPagamento: parseDate(row['Data Pagamento']),
            
            descricao: cleanString(row['Descrição']),
            legenda: cleanString(row['Legenda']),
            subLegenda: cleanString(row['Sub-Legenda']),
            detalhe: cleanString(row['Detalhe']),
            
            codigoBarras: cleanBarcode,
            bancoDestino: cleanString(row['Banco Destino'] || row['Banco']),
            agenciaDestino: cleanString(row['Agência'] || row['Agencia']),
            contaDestino: cleanString(row['Conta'] || row['Corrente']),
            contaDestinoDV: cleanString(row['DV'] || row['DV Conta']),
            chavePix: cleanString(row['Chave PIX'])
          };

          valid.push(payment);
        });

        resolve({ valid, errors });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};